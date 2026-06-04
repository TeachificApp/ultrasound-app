import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  generalFormTemplates,
  generalFormSections,
  generalFormItems,
  generalFormOptions,
  generalFormSubmissions,
  sdmsCmeActivityTypeEnum,
  sdmsCmeCompletions,
  sdmsCmeConfigs,
  sdmsCmeCreditCategoryEnum,
  sdmsCmeFormKindEnum,
  sdmsCmeSubmissionLogs,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  buildSdmsPayload,
  formatSdmsDate,
  sdmsConnectionTest,
  validateSdmsPayload,
} from "../lib/sdmsCmeApi";
import { decryptSdmsPassword } from "../lib/sdmsCmeCredentials";
import {
  DEFAULT_SDMS_BASE_URL,
  encryptSdmsPassword,
  getOrCreateConfig,
  listSubmissionLogs,
  listUserCmeCompletions,
  processFormSubmissionForCme,
  sanitizeConfigForAdmin,
  submitCompletionToSdms,
  validateConfigForSubmission,
  validateLearnerFields,
} from "../lib/sdmsCmeService";
import { ensureCmeCurriculumModule, hideCmeCurriculumModule } from "../lib/sdmsCmeCurriculum";

const activityTypeSchema = z.enum(sdmsCmeActivityTypeEnum);
const creditCategorySchema = z.enum(sdmsCmeCreditCategoryEnum);
const formKindSchema = z.enum(sdmsCmeFormKindEnum);

const configInputSchema = z.object({
  activityType: activityTypeSchema,
  activityId: z.number().int().positive(),
  enabled: z.boolean().optional(),
  approvalId: z.string().max(64).optional(),
  activityTitle: z.string().max(500).optional(),
  activityStartDate: z.string().max(32).optional(),
  activityEndDate: z.string().max(32).optional(),
  cmeCreditAmount: z.string().max(16).optional(),
  cmeCreditCategory: creditCategorySchema.optional(),
  speakerStatusDefault: z.enum(["Y", "N"]).optional(),
  apiUsername: z.string().max(255).optional(),
  apiPassword: z.string().max(255).optional(),
  formTemplateId: z.number().int().positive().nullable().optional(),
  formKind: formKindSchema.optional(),
  passingScorePercent: z.string().max(8).optional(),
  submissionDeadlineDays: z.string().max(8).optional(),
  resubmissionEnabled: z.boolean().optional(),
  formFieldMapping: z.record(z.string(), z.string()).optional(),
  moduleBlocks: z.string().optional(),
  cmeInstructions: z.string().optional(),
  sdmsBaseUrl: z.string().max(500).optional(),
});

export const sdmsCmeRouter = router({
  /** Admin: get or create CME config for an activity */
  adminGetConfig: adminProcedure
    .input(z.object({ activityType: activityTypeSchema, activityId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const config = await getOrCreateConfig(input.activityType, input.activityId);
      return sanitizeConfigForAdmin(config);
    }),

  /** Admin: update CME config */
  adminUpdateConfig: adminProcedure
    .input(configInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const config = await getOrCreateConfig(input.activityType, input.activityId);
      const updates: Record<string, unknown> = {
        updatedByUserId: ctx.user.id,
      };

      const { apiPassword, formFieldMapping, ...rest } = input;
      for (const [key, val] of Object.entries(rest)) {
        if (key === "activityType" || key === "activityId") continue;
        if (val !== undefined) updates[key] = val;
      }
      if (formFieldMapping !== undefined) {
        updates.formFieldMapping = JSON.stringify(formFieldMapping);
      }
      if (apiPassword !== undefined && apiPassword.length > 0) {
        updates.apiPasswordEncrypted = encryptSdmsPassword(apiPassword);
      }

      await db.update(sdmsCmeConfigs).set(updates).where(eq(sdmsCmeConfigs.id, config.id));
      let [updated] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, config.id)).limit(1);
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (updated.enabled) {
        await ensureCmeCurriculumModule(updated);
        [updated] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, config.id)).limit(1);
      } else if (input.enabled === false) {
        await hideCmeCurriculumModule(updated);
      }

      return sanitizeConfigForAdmin(updated!);
    }),

  /** Admin: list platform forms for selector */
  adminListForms: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: generalFormTemplates.id, name: generalFormTemplates.name, status: generalFormTemplates.status, scoreEnabled: generalFormTemplates.scoreEnabled })
      .from(generalFormTemplates)
      .orderBy(generalFormTemplates.name);
  }),

  /** Admin: connection test */
  adminTestConnection: adminProcedure
    .input(z.object({
      activityType: activityTypeSchema,
      activityId: z.number().int().positive(),
      username: z.string().optional(),
      password: z.string().optional(),
      baseUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const config = await getOrCreateConfig(input.activityType, input.activityId);
      const username = input.username ?? config.apiUsername;
      const password = input.password ?? decryptSdmsPassword(config.apiPasswordEncrypted);
      if (!username || !password) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SDMS API username and password are required" });
      }
      const result = await sdmsConnectionTest({
        baseUrl: input.baseUrl ?? config.sdmsBaseUrl ?? DEFAULT_SDMS_BASE_URL,
        username,
        password,
      });
      return {
        success: result.ok,
        status: result.status,
        responseCode: result.responseCode,
        message: result.responseMessage,
      };
    }),

  /** Admin: sample payload preview (no network call) */
  adminSamplePayload: adminProcedure
    .input(z.object({ activityType: activityTypeSchema, activityId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const config = await getOrCreateConfig(input.activityType, input.activityId);
      const payload = buildSdmsPayload({
        approvalId: config.approvalId ?? "6000246",
        learner: {
          sdmsNumber: "1179424",
          lastName: "User",
          firstName: "Sample",
          birthDate: "11/08/1969",
          email: "sample@example.com",
          ardmsNumber: "",
          arrtNumber: "",
          sonographyCanadaNumber: "",
          cciNumber: "",
          isSpeaker: config.speakerStatusDefault ?? "N",
        },
        dateCompleted: formatSdmsDate(new Date()),
        creditCategory: (config.cmeCreditCategory ?? "SPI_CME") as typeof sdmsCmeCreditCategoryEnum[number],
        creditAmount: config.cmeCreditAmount ?? "1.00",
      });
      const validation = validateSdmsPayload(payload);
      return { payload, validation };
    }),

  /** Admin: simulate success/failure response */
  adminSimulateSubmission: adminProcedure
    .input(z.object({
      completionId: z.number().int().positive(),
      mode: z.enum(["success", "failure"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await submitCompletionToSdms({
        completionId: input.completionId,
        triggeredBy: "admin",
        simulate: input.mode,
      });
      return result;
    }),

  /** Admin: resend to SDMS */
  adminResendSubmission: adminProcedure
    .input(z.object({ completionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [completion] = await db
        .select()
        .from(sdmsCmeCompletions)
        .where(eq(sdmsCmeCompletions.id, input.completionId))
        .limit(1);
      if (!completion) throw new TRPCError({ code: "NOT_FOUND" });

      const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, completion.configId)).limit(1);
      if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "Config not found" });

      const password = decryptSdmsPassword(config.apiPasswordEncrypted);
      const configErrors = validateConfigForSubmission(config, !!password);
      if (configErrors.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: configErrors.join("; ") });
      }

      let learner: Record<string, string> = {};
      try {
        learner = JSON.parse(completion.learnerPayload ?? "{}");
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid learner payload" });
      }
      const learnerErrors = validateLearnerFields(learner);
      if (learnerErrors.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: learnerErrors.join("; ") });
      }

      if (!config.resubmissionEnabled && completion.sdmsSubmissionStatus === "success") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Resubmission is disabled for this activity" });
      }

      return submitCompletionToSdms({
        completionId: input.completionId,
        triggeredBy: "admin",
      });
    }),

  /** Admin: manual pass/fail override */
  adminOverridePassFail: adminProcedure
    .input(z.object({
      completionId: z.number().int().positive(),
      passStatus: z.enum(["override_pass", "override_fail"]),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(sdmsCmeCompletions)
        .set({
          passStatus: input.passStatus,
          manualOverrideNotes: input.notes ?? null,
          manualOverrideByUserId: ctx.user.id,
        })
        .where(eq(sdmsCmeCompletions.id, input.completionId));
      return { success: true };
    }),

  /** Admin: validate missing fields test */
  adminValidateCompletion: adminProcedure
    .input(z.object({ completionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [completion] = await db
        .select()
        .from(sdmsCmeCompletions)
        .where(eq(sdmsCmeCompletions.id, input.completionId))
        .limit(1);
      if (!completion) throw new TRPCError({ code: "NOT_FOUND" });
      const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, completion.configId)).limit(1);
      const password = decryptSdmsPassword(config?.apiPasswordEncrypted);
      const configErrors = validateConfigForSubmission(config!, !!password);
      let learner: Record<string, string> = {};
      try {
        learner = JSON.parse(completion.learnerPayload ?? "{}");
      } catch {
        configErrors.push("Invalid learner payload JSON");
      }
      const learnerErrors = validateLearnerFields(learner);
      return { valid: configErrors.length === 0 && learnerErrors.length === 0, configErrors, learnerErrors };
    }),

  /** Admin: user profile CME tab */
  adminListUserCompletions: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => listUserCmeCompletions(input.userId)),

  /** Admin: submission logs */
  adminListSubmissionLogs: adminProcedure
    .input(z.object({
      userId: z.number().int().positive().optional(),
      completionId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }))
    .query(async ({ input }) => listSubmissionLogs(input)),

  /** Admin: export submission logs as CSV */
  adminExportSubmissionLogs: adminProcedure
    .input(z.object({
      startDate: z.string().optional(), // ISO date string
      endDate: z.string().optional(),
      status: z.enum(["success", "failed", "timeout", "simulated_success", "simulated_failure", "validation_error", "all"]).optional(),
      activityType: activityTypeSchema.optional(),
    }))
    .query(async ({ input }) => {
            const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const conditions: any[] = [];
      if (input.startDate) conditions.push(gte(sdmsCmeSubmissionLogs.createdAt, new Date(input.startDate)));
      if (input.endDate) {
        const end = new Date(input.endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(sdmsCmeSubmissionLogs.createdAt, end));
      }
      if (input.status && input.status !== "all") conditions.push(eq(sdmsCmeSubmissionLogs.status, input.status));
      if (input.activityType) conditions.push(eq(sdmsCmeSubmissionLogs.activityType, input.activityType));

      const logs = await db
        .select({
          id: sdmsCmeSubmissionLogs.id,
          userId: sdmsCmeSubmissionLogs.userId,
          activityType: sdmsCmeSubmissionLogs.activityType,
          activityId: sdmsCmeSubmissionLogs.activityId,
          approvalId: sdmsCmeSubmissionLogs.approvalId,
          status: sdmsCmeSubmissionLogs.status,
          responseCode: sdmsCmeSubmissionLogs.responseCode,
          errorMessage: sdmsCmeSubmissionLogs.errorMessage,
          triggeredBy: sdmsCmeSubmissionLogs.triggeredBy,
          retryCount: sdmsCmeSubmissionLogs.retryCount,
          resolved: sdmsCmeSubmissionLogs.resolved,
          createdAt: sdmsCmeSubmissionLogs.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(sdmsCmeSubmissionLogs)
        .leftJoin(users, eq(sdmsCmeSubmissionLogs.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sdmsCmeSubmissionLogs.createdAt))
        .limit(10000);

      return logs;
    }),

  /** Admin: get summary stats for SDMS CME dashboard */
  adminGetStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, success: 0, failed: 0, pending: 0 };
    const [row] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' OR status = 'simulated_success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' OR status = 'timeout' OR status = 'validation_error' OR status = 'simulated_failure' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN resolved = 0 AND (status = 'failed' OR status = 'timeout' OR status = 'validation_error') THEN 1 ELSE 0 END) as unresolved
      FROM sdmsCmeSubmissionLogs
    `);
    return {
      total: Number((row as any)?.total ?? 0),
      success: Number((row as any)?.success ?? 0),
      failed: Number((row as any)?.failed ?? 0),
      unresolved: Number((row as any)?.unresolved ?? 0),
    };
  }),

  /** Learner: get CME module for activity (only if enabled) */
  getLearnerModule: protectedProcedure
    .input(z.object({ activityType: activityTypeSchema, activityId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [config] = await db
        .select()
        .from(sdmsCmeConfigs)
        .where(and(eq(sdmsCmeConfigs.activityType, input.activityType), eq(sdmsCmeConfigs.activityId, input.activityId)))
        .limit(1);

      if (!config?.enabled) return null;

      const [completion] = await db
        .select()
        .from(sdmsCmeCompletions)
        .where(and(eq(sdmsCmeCompletions.configId, config.id), eq(sdmsCmeCompletions.userId, ctx.user.id)))
        .limit(1);

      let formSlug: string | null = null;
      if (config.formTemplateId) {
        const [form] = await db
          .select({ publicSlug: generalFormTemplates.publicSlug, status: generalFormTemplates.status })
          .from(generalFormTemplates)
          .where(eq(generalFormTemplates.id, config.formTemplateId))
          .limit(1);
        formSlug = form?.publicSlug ?? null;
      }

      return {
        configId: config.id,
        activityTitle: config.activityTitle,
        cmeInstructions: config.cmeInstructions,
        moduleBlocks: config.moduleBlocks,
        formTemplateId: config.formTemplateId,
        formKind: config.formKind,
        formSlug,
        passingScorePercent: config.passingScorePercent,
        completion: completion
          ? {
              id: completion.id,
              passStatus: completion.passStatus,
              formScorePercent: completion.formScorePercent,
              sdmsSubmissionStatus: completion.sdmsSubmissionStatus,
              sdmsResponseCode: completion.sdmsResponseCode,
              sdmsResponseMessage: completion.sdmsResponseMessage,
              dateCompleted: completion.dateCompleted,
            }
          : null,
      };
    }),

  /** Learner: load attached CME form structure */
  getCmeFormData: protectedProcedure
    .input(z.object({ configId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, input.configId)).limit(1);
      if (!config?.enabled || !config.formTemplateId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "CME form not configured" });
      }

      const [template] = await db
        .select()
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, config.formTemplateId))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      const sections = await db
        .select()
        .from(generalFormSections)
        .where(eq(generalFormSections.templateId, config.formTemplateId))
        .orderBy(asc(generalFormSections.sortOrder));

      const items = await db
        .select()
        .from(generalFormItems)
        .where(eq(generalFormItems.templateId, config.formTemplateId))
        .orderBy(asc(generalFormItems.sortOrder));

      const allOptions = items.length
        ? await db
            .select()
            .from(generalFormOptions)
            .where(inArray(generalFormOptions.itemId, items.map((i) => i.id)))
        : [];

      return {
        template: {
          id: template.id,
          name: template.name,
          scoreEnabled: template.scoreEnabled,
          passingScorePercent: config.passingScorePercent,
        },
        sections,
        items,
        options: allOptions,
      };
    }),

  /** Learner: submit CME form + process pass/fail + SDMS */
  submitCmeForm: protectedProcedure
    .input(z.object({
      configId: z.number().int().positive(),
      responses: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, input.configId)).limit(1);
      if (!config?.enabled || !config.formTemplateId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "CME not enabled" });
      }

      const [template] = await db
        .select()
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, config.formTemplateId))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      let score = 0;
      let maxScore = 0;
      if (template.scoreEnabled) {
        const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, config.formTemplateId));
        const options = items.length
          ? await db.select().from(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i) => i.id)))
          : [];
        const parsed: Record<string, unknown> = JSON.parse(input.responses);
        for (const item of items) {
          if (item.scoreWeight > 0) {
            maxScore += item.scoreWeight;
            const answer = parsed[item.id.toString()];
            const matchingOption = options.find(
              (o) => o.itemId === item.id && (o.value === answer || (Array.isArray(answer) && answer.includes(o.value)))
            );
            if (matchingOption) score += matchingOption.scoreValue;
          }
        }
      }

      const [result] = await db.insert(generalFormSubmissions).values({
        templateId: config.formTemplateId,
        submittedByUserId: ctx.user.id,
        responses: input.responses,
        score,
        maxScore,
        status: "submitted",
      });
      const submissionId = (result as { insertId: number }).insertId;

      const outcome = await processFormSubmissionForCme({
        configId: input.configId,
        userId: ctx.user.id,
        formSubmissionId: submissionId,
      });

      return {
        submissionId,
        score,
        maxScore,
        scorePercent: maxScore > 0 ? Math.round((score / maxScore) * 100) : 100,
        ...outcome,
      };
    }),

  /** Learner: after form submit, process CME pass/fail + optional SDMS submit */
  recordFormCompletion: protectedProcedure
    .input(z.object({
      configId: z.number().int().positive(),
      formSubmissionId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      return processFormSubmissionForCme({
        configId: input.configId,
        userId: ctx.user.id,
        formSubmissionId: input.formSubmissionId,
      });
    }),

  /** Public: check if CME enabled (for course landing pages) */
  isEnabled: publicProcedure
    .input(z.object({ activityType: activityTypeSchema, activityId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return false;
      const [config] = await db
        .select({ enabled: sdmsCmeConfigs.enabled })
        .from(sdmsCmeConfigs)
        .where(and(eq(sdmsCmeConfigs.activityType, input.activityType), eq(sdmsCmeConfigs.activityId, input.activityId)))
        .limit(1);
      return config?.enabled ?? false;
    }),
});
