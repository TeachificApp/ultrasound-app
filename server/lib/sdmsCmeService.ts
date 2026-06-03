import { and, desc, eq } from "drizzle-orm";
import {
  generalFormItems,
  generalFormSubmissions,
  generalFormTemplates,
  sdmsCmeCompletions,
  sdmsCmeConfigs,
  sdmsCmeSubmissionLogs,
  users,
  type SdmsCmeActivityType,
  type SdmsCmeConfig,
  type SdmsCmeCreditCategory,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  buildSdmsPayload,
  formatSdmsDate,
  sdmsImportCompletion,
  validateSdmsPayload,
  type SdmsImportPayload,
} from "./sdmsCmeApi";
import { decryptSdmsPassword, encryptSdmsPassword, maskCredential } from "./sdmsCmeCredentials";

export const DEFAULT_SDMS_BASE_URL = "https://www.sdms.org";

export const SDMS_LEARNER_FIELD_KEYS = [
  "FirstName",
  "LastName",
  "Email",
  "BirthDate",
  "SDMS Number",
  "ARDMS Number",
  "ARRT Number",
  "CCI Number",
  "Sonography Canada Number",
] as const;

export type SdmsLearnerFields = Partial<Record<(typeof SDMS_LEARNER_FIELD_KEYS)[number], string>>;

export function sanitizeConfigForAdmin(config: SdmsCmeConfig) {
  const { apiPasswordEncrypted, ...rest } = config;
  return {
    ...rest,
    hasApiPassword: !!apiPasswordEncrypted,
    apiUsernameMasked: maskCredential(config.apiUsername),
    apiPasswordMasked: apiPasswordEncrypted ? "********" : "",
  };
}

export async function getOrCreateConfig(activityType: SdmsCmeActivityType, activityId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [existing] = await db
    .select()
    .from(sdmsCmeConfigs)
    .where(and(eq(sdmsCmeConfigs.activityType, activityType), eq(sdmsCmeConfigs.activityId, activityId)))
    .limit(1);
  if (existing) return existing;
  const [result] = await db.insert(sdmsCmeConfigs).values({ activityType, activityId });
  const insertId = (result as { insertId?: number }).insertId;
  const [created] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, insertId!)).limit(1);
  return created!;
}

export function parseFormFieldMapping(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/** Match form responses to SDMS learner fields using mapping + label heuristics */
export function extractLearnerFieldsFromForm(
  responses: Record<string, unknown>,
  items: { id: number; label: string }[],
  mapping: Record<string, string>,
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null }
): SdmsLearnerFields {
  const out: SdmsLearnerFields = {};
  const labelNorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const labelAliases: Record<string, string[]> = {
    FirstName: ["firstname", "first name", "fname"],
    LastName: ["lastname", "last name", "lname", "surname"],
    Email: ["email", "emailaddress"],
    BirthDate: ["birthdate", "dateofbirth", "dob", "birth date"],
    "SDMS Number": ["sdmsnumber", "sdms", "sdmsid"],
    "ARDMS Number": ["ardmsnumber", "ardms"],
    "ARRT Number": ["arrtnumber", "arrt"],
    "CCI Number": ["ccinumber", "cci"],
    "Sonography Canada Number": ["sonographycanadanumber", "sonographycanada", "csct"],
  };

  for (const [sdmsField, itemIdStr] of Object.entries(mapping)) {
    const val = responses[itemIdStr];
    if (val != null && String(val).trim()) {
      out[sdmsField as keyof SdmsLearnerFields] = String(val).trim();
    }
  }

  for (const item of items) {
    const norm = labelNorm(item.label);
    for (const [field, aliases] of Object.entries(labelAliases)) {
      if (out[field as keyof SdmsLearnerFields]) continue;
      if (aliases.some((a) => norm.includes(a.replace(/[^a-z0-9]/g, "")))) {
        const val = responses[String(item.id)];
        if (val != null && String(val).trim()) {
          out[field as keyof SdmsLearnerFields] = String(val).trim();
        }
      }
    }
  }

  if (!out.FirstName && user?.firstName) out.FirstName = user.firstName;
  if (!out.LastName && user?.lastName) out.LastName = user.lastName;
  if (!out.Email && user?.email) out.Email = user.email;

  return out;
}

export function computeFormPassFail(opts: {
  score: number;
  maxScore: number;
  passingScorePercent: string;
  manualOverride?: "override_pass" | "override_fail" | null;
}): { passed: boolean; scorePercent: string; passStatus: "passed" | "failed" | "override_pass" | "override_fail" } {
  if (opts.manualOverride === "override_pass") {
    return { passed: true, scorePercent: opts.maxScore > 0 ? String(Math.round((opts.score / opts.maxScore) * 100)) : "100", passStatus: "override_pass" };
  }
  if (opts.manualOverride === "override_fail") {
    return { passed: false, scorePercent: opts.maxScore > 0 ? String(Math.round((opts.score / opts.maxScore) * 100)) : "0", passStatus: "override_fail" };
  }
  const threshold = parseFloat(opts.passingScorePercent) || 70;
  const pct = opts.maxScore > 0 ? (opts.score / opts.maxScore) * 100 : 0;
  const passed = pct >= threshold;
  return {
    passed,
    scorePercent: String(Math.round(pct)),
    passStatus: passed ? "passed" : "failed",
  };
}

export function validateLearnerFields(fields: SdmsLearnerFields): string[] {
  const errors: string[] = [];
  if (!fields.FirstName?.trim()) errors.push("FirstName is required");
  if (!fields.LastName?.trim()) errors.push("LastName is required");
  if (!fields.Email?.trim()) errors.push("Email is required");
  if (!fields.BirthDate?.trim()) errors.push("BirthDate is required");
  return errors;
}

export function validateConfigForSubmission(config: SdmsCmeConfig, hasPassword: boolean): string[] {
  const errors: string[] = [];
  if (!config.enabled) errors.push("SDMS CME is not enabled for this activity");
  if (!config.approvalId?.trim()) errors.push("Approval ID is required");
  if (!config.activityTitle?.trim()) errors.push("Activity title is required");
  if (!config.cmeCreditAmount?.trim()) errors.push("CME credit amount is required");
  if (!config.apiUsername?.trim()) errors.push("SDMS API username is required");
  if (!hasPassword) errors.push("SDMS API password is required");
  if (!config.formTemplateId) errors.push("A CME form must be attached");
  return errors;
}

export async function resolveActivityTitle(
  activityType: SdmsCmeActivityType,
  activityId: number,
  fallback?: string | null
): Promise<string> {
  if (fallback?.trim()) return fallback;
  const db = await getDb();
  if (!db) return `Activity ${activityId}`;
  if (activityType === "webinar" || activityType === "replay_course" || activityType === "live_event") {
    const { webinars } = await import("../../drizzle/schema");
    const [w] = await db.select({ title: webinars.title }).from(webinars).where(eq(webinars.id, activityId)).limit(1);
    return w?.title ?? `Webinar ${activityId}`;
  }
  const { lmsCourses } = await import("../../drizzle/schema");
  const [c] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, activityId)).limit(1);
  return c?.title ?? `Course ${activityId}`;
}

export async function submitCompletionToSdms(opts: {
  completionId: number;
  triggeredBy: "system" | "admin";
  simulate?: "success" | "failure" | null;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; responseCode: string | null; message: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const [completion] = await db.select().from(sdmsCmeCompletions).where(eq(sdmsCmeCompletions.id, opts.completionId)).limit(1);
  if (!completion) throw new Error("Completion not found");

  const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, completion.configId)).limit(1);
  if (!config) throw new Error("CME config not found");

  const password = decryptSdmsPassword(config.apiPasswordEncrypted);
  const configErrors = validateConfigForSubmission(config, !!password);
  if (configErrors.length) {
    throw new Error(configErrors.join("; "));
  }

  const passOk =
    completion.passStatus === "passed" ||
    completion.passStatus === "override_pass";
  if (!passOk) {
    throw new Error("Cannot submit to SDMS until learner passes the CME form");
  }

  let learner: SdmsLearnerFields = {};
  if (completion.learnerPayload) {
    try {
      learner = JSON.parse(completion.learnerPayload);
    } catch {
      learner = {};
    }
  }

  const learnerErrors = validateLearnerFields(learner);
  if (learnerErrors.length) {
    throw new Error(learnerErrors.join("; "));
  }

  const dateCompleted = completion.dateCompleted || formatSdmsDate(new Date());
  const payload = buildSdmsPayload({
    approvalId: config.approvalId!,
    learner: {
      sdmsNumber: learner["SDMS Number"],
      lastName: learner.LastName!,
      firstName: learner.FirstName!,
      birthDate: learner.BirthDate!,
      email: learner.Email!,
      ardmsNumber: learner["ARDMS Number"],
      arrtNumber: learner["ARRT Number"],
      sonographyCanadaNumber: learner["Sonography Canada Number"],
      cciNumber: learner["CCI Number"],
      isSpeaker: config.speakerStatusDefault ?? "N",
    },
    dateCompleted,
    creditCategory: (config.cmeCreditCategory ?? "SPI_CME") as SdmsCmeCreditCategory,
    creditAmount: config.cmeCreditAmount ?? "0.00",
  });

  const payloadValidation = validateSdmsPayload(payload);
  if (!payloadValidation.ok) {
    throw new Error(payloadValidation.errors.join("; "));
  }

  const retryCount = (completion.retryCount ?? 0) + 1;
  const baseUrl = config.sdmsBaseUrl?.trim() || DEFAULT_SDMS_BASE_URL;

  let apiResult: {
    ok: boolean;
    responseCode: string | null;
    responseMessage: string;
    rawBody: string;
    timedOut?: boolean;
    status: number;
  };

  if (opts.simulate === "success") {
    apiResult = {
      ok: true,
      status: 200,
      responseCode: "305",
      responseMessage: "305 - CME Activity Roster Entry – Success (simulated)",
      rawBody: "305 - CME Activity Roster Entry – Success (simulated)",
    };
  } else if (opts.simulate === "failure") {
    apiResult = {
      ok: false,
      status: 200,
      responseCode: "306",
      responseMessage: "306 - CME Activity Roster Entry - General Failure (simulated)",
      rawBody: "306 - CME Activity Roster Entry - General Failure (simulated)",
    };
  } else {
    apiResult = await sdmsImportCompletion({
      baseUrl,
      username: config.apiUsername!,
      password: password!,
      payload: payloadValidation.payload,
      fetchImpl: opts.fetchImpl,
    });
  }

  const logStatus = opts.simulate
    ? opts.simulate === "success"
      ? "simulated_success"
      : "simulated_failure"
    : apiResult.timedOut
      ? "timeout"
      : apiResult.ok
        ? "success"
        : "failed";

  await db.insert(sdmsCmeSubmissionLogs).values({
    completionId: completion.id,
    userId: completion.userId,
    activityType: completion.activityType,
    activityId: completion.activityId,
    approvalId: config.approvalId,
    payloadSent: JSON.stringify(payloadValidation.payload),
    apiResponse: apiResult.rawBody,
    responseCode: apiResult.responseCode,
    status: logStatus,
    retryCount,
    triggeredBy: opts.triggeredBy,
    errorMessage: apiResult.ok ? null : apiResult.responseMessage,
    resolved: apiResult.ok,
  });

  const submissionStatus = apiResult.timedOut
    ? "timeout"
    : apiResult.ok
      ? "success"
      : "failed";

  await db
    .update(sdmsCmeCompletions)
    .set({
      sdmsSubmissionStatus: submissionStatus,
      sdmsResponseCode: apiResult.responseCode,
      sdmsResponseMessage: apiResult.responseMessage,
      sdmsResponseRaw: apiResult.rawBody,
      lastSubmissionAttemptAt: new Date(),
      retryCount,
      lastSubmittedBy: opts.triggeredBy,
    })
    .where(eq(sdmsCmeCompletions.id, completion.id));

  return {
    ok: apiResult.ok,
    responseCode: apiResult.responseCode,
    message: apiResult.responseMessage,
  };
}

export async function processFormSubmissionForCme(opts: {
  configId: number;
  userId: number;
  formSubmissionId: number;
  fetchImpl?: typeof fetch;
}): Promise<{ completionId: number; passed: boolean; submitted: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, opts.configId)).limit(1);
  if (!config?.enabled) throw new Error("SDMS CME not enabled");

  const [submission] = await db
    .select()
    .from(generalFormSubmissions)
    .where(eq(generalFormSubmissions.id, opts.formSubmissionId))
    .limit(1);
  if (!submission) throw new Error("Form submission not found");

  const [template] = await db
    .select()
    .from(generalFormTemplates)
    .where(eq(generalFormTemplates.id, submission.templateId))
    .limit(1);

  const items = await db
    .select({ id: generalFormItems.id, label: generalFormItems.label, isRequired: generalFormItems.isRequired })
    .from(generalFormItems)
    .where(eq(generalFormItems.templateId, submission.templateId));

  const responses: Record<string, unknown> = JSON.parse(submission.responses ?? "{}");
  for (const item of items) {
    if (item.isRequired) {
      const val = responses[String(item.id)];
      if (val == null || String(val).trim() === "") {
        throw new Error(`Required form question not answered: ${item.label}`);
      }
    }
  }

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, opts.userId))
    .limit(1);

  const mapping = parseFormFieldMapping(config.formFieldMapping);
  const learnerFields = extractLearnerFieldsFromForm(
    responses,
    items,
    mapping,
    user ?? undefined
  );

  const score = submission.score ?? 0;
  const maxScore = submission.maxScore ?? 0;
  const passResult = computeFormPassFail({
    score,
    maxScore,
    passingScorePercent: config.passingScorePercent ?? "70",
  });

  const dateCompleted = formatSdmsDate(new Date());

  const [existing] = await db
    .select()
    .from(sdmsCmeCompletions)
    .where(
      and(
        eq(sdmsCmeCompletions.configId, config.id),
        eq(sdmsCmeCompletions.userId, opts.userId)
      )
    )
    .limit(1);

  let completionId: number;
  if (existing) {
    await db
      .update(sdmsCmeCompletions)
      .set({
        formSubmissionId: opts.formSubmissionId,
        formScore: String(score),
        formMaxScore: String(maxScore),
        formScorePercent: passResult.scorePercent,
        passStatus: passResult.passStatus,
        dateCompleted,
        learnerPayload: JSON.stringify(learnerFields),
        sdmsSubmissionStatus: passResult.passed ? "pending" : "not_submitted",
      })
      .where(eq(sdmsCmeCompletions.id, existing.id));
    completionId = existing.id;
  } else {
    const [ins] = await db.insert(sdmsCmeCompletions).values({
      configId: config.id,
      userId: opts.userId,
      activityType: config.activityType,
      activityId: config.activityId,
      formSubmissionId: opts.formSubmissionId,
      formScore: String(score),
      formMaxScore: String(maxScore),
      formScorePercent: passResult.scorePercent,
      passStatus: passResult.passStatus,
      dateCompleted,
      learnerPayload: JSON.stringify(learnerFields),
      sdmsSubmissionStatus: passResult.passed ? "pending" : "not_submitted",
    });
    completionId = (ins as { insertId: number }).insertId;
  }

  let submitted = false;
  if (passResult.passed) {
    const learnerErrors = validateLearnerFields(learnerFields);
    const configErrors = validateConfigForSubmission(config, !!config.apiPasswordEncrypted);
    if (learnerErrors.length === 0 && configErrors.length === 0) {
      try {
        await submitCompletionToSdms({
          completionId,
          triggeredBy: "system",
          fetchImpl: opts.fetchImpl,
        });
        submitted = true;
      } catch (err) {
        console.error("[SDMS CME] Auto-submit failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  return { completionId, passed: passResult.passed, submitted };
}

export async function listUserCmeCompletions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(sdmsCmeCompletions)
    .where(eq(sdmsCmeCompletions.userId, userId))
    .orderBy(desc(sdmsCmeCompletions.updatedAt));

  const enriched = [];
  for (const row of rows) {
    const [config] = await db.select().from(sdmsCmeConfigs).where(eq(sdmsCmeConfigs.id, row.configId)).limit(1);
    const activityName = await resolveActivityTitle(row.activityType, row.activityId, config?.activityTitle);
    enriched.push({
      ...row,
      activityName,
      approvalId: config?.approvalId ?? null,
      cmeCreditCategory: config?.cmeCreditCategory ?? null,
      cmeCreditAmount: config?.cmeCreditAmount ?? null,
    });
  }
  return enriched;
}

export async function listSubmissionLogs(filters: { userId?: number; completionId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const limit = filters.limit ?? 100;
  if (filters.completionId) {
    return db
      .select()
      .from(sdmsCmeSubmissionLogs)
      .where(eq(sdmsCmeSubmissionLogs.completionId, filters.completionId))
      .orderBy(desc(sdmsCmeSubmissionLogs.createdAt))
      .limit(limit);
  }
  if (filters.userId) {
    return db
      .select()
      .from(sdmsCmeSubmissionLogs)
      .where(eq(sdmsCmeSubmissionLogs.userId, filters.userId))
      .orderBy(desc(sdmsCmeSubmissionLogs.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(sdmsCmeSubmissionLogs)
    .orderBy(desc(sdmsCmeSubmissionLogs.createdAt))
    .limit(limit);
}

export { encryptSdmsPassword };
