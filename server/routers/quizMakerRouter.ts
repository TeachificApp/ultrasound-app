/**
 * quizMakerRouter.ts
 * iSpring-style visual quiz builder API — persists to standalone_quizzes.builderConfig
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getUserRoles } from "../db";
import {
  standaloneQuizzes,
  standaloneQuizQuestions,
  questionBank,
  standaloneQuizAttempts,
  standaloneQuizAttemptAnswers,
  users,
} from "../../drizzle/schema";
import {
  builderConfigFromQuizRow,
  parseBuilderConfig,
  serializeBuilderConfig,
  type QuizFile,
  type QuizBranding,
} from "../lib/quizBuilderConfig";
import {
  batchImportScormQuizzesToNative,
  convertMediaAssetToNativeQuiz,
  importMediaAssetToNativeQuiz,
  listImportableScormQuizAssets,
} from "../lib/scormQuizBuilderImport";
import { replaceQuizQuestionText } from "../lib/quizTextReplacement";
import {
  builderQuestionFromQuestionBank,
  mergeCanonicalBuilderQuestion,
  questionBankIdFromBuilderId,
  questionBankValuesFromBuilderQuestion,
} from "../lib/visualBuilderQuestionBankSync";
import { hydrateBuilderConfigFromQuestionBank } from "../lib/standaloneQuizBuilderHydration";
import { isStandaloneQuizStaff } from "../lib/standaloneQuizStaffAccess";

async function assertStandaloneQuizStaff(ctx: { user: { id: number; role: string } }) {
  if (isStandaloneQuizStaff(ctx.user.role)) return;
  const appRoles = await getUserRoles(ctx.user.id);
  if (!isStandaloneQuizStaff(ctx.user.role, appRoles)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

async function getQuizOrThrow(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, quizId: number) {
  const [quiz] = await db.select().from(standaloneQuizzes).where(eq(standaloneQuizzes.id, quizId)).limit(1);
  if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
  return quiz;
}

function metaToQuizSettings(meta: QuizFile["meta"]) {
  return {
    title: meta.title,
    description: meta.description || null,
    passingScore: meta.passingScore,
    timeLimitMinutes: meta.timeLimit ?? null,
    shuffleQuestions: meta.shuffleQuestions,
    shuffleAnswers: meta.shuffleAnswers,
    allowRetakes: meta.allowRetry,
    maxAttempts: meta.maxAttempts > 0 ? meta.maxAttempts : null,
    showPerQuestionResult: meta.showPerQuestionResult ?? (meta.resultSlide?.showReviewButton !== false),
    showGroupNames: meta.showGroupNames === true,
    readAloudEnabled: meta.readAloudEnabled ?? false,
    readAloudVoice: meta.readAloudVoice ?? "female",
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function standaloneQuestionToBuilderQuestion(row: { sqq: typeof standaloneQuizQuestions.$inferSelect; qb: typeof questionBank.$inferSelect }) {
  return builderQuestionFromQuestionBank(row);
}

async function hydrateBuilderQuestionsFromBank(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  quizId: number,
  config: QuizFile,
) {
  return hydrateBuilderConfigFromQuestionBank(db, quizId, config);
}

async function synchronizeBuilderQuestionsToBank(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  quizId: number,
  questions: QuizFile["questions"],
  adminId: number,
) {
  const links = await db
    .select({ sqq: standaloneQuizQuestions, qb: questionBank })
    .from(standaloneQuizQuestions)
    .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
    .where(eq(standaloneQuizQuestions.quizId, quizId));
  const linkedByBankId = new Map(links.map((row) => [row.qb.id, row]));
  const synchronized: QuizFile["questions"] = [];
  let created = 0;
  let updated = 0;

  for (const [index, question] of questions.entries()) {
    const originalBankId = questionBankIdFromBuilderId(question.id);
    const existing = originalBankId ? linkedByBankId.get(originalBankId) : undefined;
    const values = questionBankValuesFromBuilderQuestion(question as Record<string, unknown>);
    let bankId: number;
    if (existing) {
      bankId = existing.qb.id;
      if (question.questionBankOverride !== true) {
        await db.update(questionBank).set(values).where(eq(questionBank.id, bankId));
        updated += 1;
      }
      await db.update(standaloneQuizQuestions).set({ sortOrder: index, points: question.points ?? 1, shuffleAnswerOptions: question.shuffleAnswerOptions ?? false, lockAnswerOrder: question.lockAnswerOrder ?? false }).where(eq(standaloneQuizQuestions.id, existing.sqq.id));
    } else {
      const [createdQuestion] = await db.insert(questionBank).values({ ...values, createdByAdminId: adminId }).$returningId();
      bankId = createdQuestion.id;
      await db.insert(standaloneQuizQuestions).values({
        quizId,
        questionBankId: bankId,
        sortOrder: index,
        points: question.points ?? 1,
        shuffleAnswerOptions: question.shuffleAnswerOptions ?? false,
        lockAnswerOrder: question.lockAnswerOrder ?? false,
      });
      created += 1;
    }
    synchronized.push({ ...question, id: `bank-${bankId}`, order: index + 1 });
  }
  return { questions: synchronized, created, updated };
}

export function assignBuilderQuestionGroup<T extends Record<string, unknown>>(questions: T[], groupId?: string): Array<T & { groupId?: string }> {
  return questions.map((question) => ({ ...question, groupId }));
}

export const quizMakerRouter = router({
  addQuestionBankQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number().int(),
      questionBankIds: z.array(z.number().int()).min(1),
      groupId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const quiz = await getQuizOrThrow(db, input.quizId);
      const existing = await db.select({ questionBankId: standaloneQuizQuestions.questionBankId })
        .from(standaloneQuizQuestions)
        .where(and(eq(standaloneQuizQuestions.quizId, input.quizId), inArray(standaloneQuizQuestions.questionBankId, input.questionBankIds)));
      const existingIds = new Set(existing.map((row) => row.questionBankId));
      const newIds = input.questionBankIds.filter((id) => !existingIds.has(id));
      if (!newIds.length) return { added: 0 };
      const [{ maxOrder }] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(${standaloneQuizQuestions.sortOrder}), -1)` })
        .from(standaloneQuizQuestions).where(eq(standaloneQuizQuestions.quizId, input.quizId));
      await db.insert(standaloneQuizQuestions).values(newIds.map((questionBankId, index) => ({
        quizId: input.quizId,
        questionBankId,
        sortOrder: Number(maxOrder) + index + 1,
        points: 1,
      })));

      const linked = await db.select({ sqq: standaloneQuizQuestions, qb: questionBank })
        .from(standaloneQuizQuestions)
        .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
        .where(and(eq(standaloneQuizQuestions.quizId, input.quizId), inArray(standaloneQuizQuestions.questionBankId, newIds)))
        .orderBy(asc(standaloneQuizQuestions.sortOrder));
      const config = builderConfigFromQuizRow(quiz, ctx.user);
      const additions = assignBuilderQuestionGroup(linked.map(standaloneQuestionToBuilderQuestion), input.groupId);
      const alreadyInBuilder = new Set(config.questions.map((question) => question.id));
      config.questions = [...config.questions, ...additions.filter((question) => !alreadyInBuilder.has(question.id))];
      await db.update(standaloneQuizzes).set({ builderConfig: serializeBuilderConfig(config) }).where(eq(standaloneQuizzes.id, input.quizId));
      return { added: newIds.length };
    }),

  listQuizzes: protectedProcedure.query(async ({ ctx }) => {
    await assertStandaloneQuizStaff(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const quizzes = await db
      .select()
      .from(standaloneQuizzes)
      .where(sql`${standaloneQuizzes.builderConfig} IS NOT NULL`)
      .orderBy(desc(standaloneQuizzes.updatedAt));
    return quizzes;
  }),

  getQuiz: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const quiz = await getQuizOrThrow(db, input.quizId);
      let config = builderConfigFromQuizRow(quiz, ctx.user);
      if (config.questions.length === 0) {
        const linkedQuestions = await db
          .select({ sqq: standaloneQuizQuestions, qb: questionBank })
          .from(standaloneQuizQuestions)
          .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
          .where(eq(standaloneQuizQuestions.quizId, quiz.id))
          .orderBy(asc(standaloneQuizQuestions.sortOrder));
        if (linkedQuestions.length > 0) {
          config = { ...config, questions: linkedQuestions.map(standaloneQuestionToBuilderQuestion) };
          await db.update(standaloneQuizzes).set({ builderConfig: serializeBuilderConfig(config) }).where(eq(standaloneQuizzes.id, quiz.id));
        }
      }
      config = await hydrateBuilderQuestionsFromBank(db, quiz.id, config);
      await db.update(standaloneQuizzes).set({ builderConfig: serializeBuilderConfig(config) }).where(eq(standaloneQuizzes.id, quiz.id));
      const branding = config.meta.branding;
      return {
        ...quiz,
        builderConfig: config,
        brandPrimaryColor: branding?.primaryColor ?? null,
        brandBgColor: branding?.backgroundColor ?? null,
        brandLogoUrl: branding?.logoUrl ?? null,
        brandFontFamily: branding?.fontFamily ?? null,
        completionMessage: (config.meta.resultSlide as { passMessage?: string } | undefined)?.passMessage ?? null,
      };
    }),

  saveQuiz: protectedProcedure
    .input(
      z.object({
        quizId: z.number().int().optional(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        questionsJson: z.string(),
        settingsJson: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let questions: QuizFile["questions"];
      let meta: QuizFile["meta"];
      try {
        questions = JSON.parse(input.questionsJson) as QuizFile["questions"];
        meta = JSON.parse(input.settingsJson) as QuizFile["meta"];
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quiz JSON" });
      }
      if (!Array.isArray(questions)) throw new TRPCError({ code: "BAD_REQUEST", message: "Questions must be an array" });

      meta.updatedAt = new Date().toISOString();
      const builderConfig: QuizFile = { meta, questions };
      const settings = metaToQuizSettings(meta);

      if (input.quizId) {
        const quiz = await getQuizOrThrow(db, input.quizId);
        meta.cloudId = quiz.id;
        const synchronized = await synchronizeBuilderQuestionsToBank(db, quiz.id, questions, ctx.user.id);
        await db
          .update(standaloneQuizzes)
          .set({
            ...settings,
            builderConfig: serializeBuilderConfig({ meta, questions: synchronized.questions }),
          })
          .where(eq(standaloneQuizzes.id, input.quizId));
        return { id: input.quizId, builderConfig: { meta, questions: synchronized.questions }, createdQuestionBankRecords: synchronized.created, updatedQuestionBankRecords: synchronized.updated };
      }

      const [result] = await db.insert(standaloneQuizzes).values({
        ...settings,
        type: "quiz",
        status: "draft",
        accessType: "enrolled",
        brand: "aaus",
        showResultsImmediately: true,
        showExplanations: true,
        builderConfig: serializeBuilderConfig({ ...builderConfig, questions: [] }),
        createdByUserId: ctx.user.id,
      });
      const id = (result as { insertId: number }).insertId;
      meta.cloudId = id;
      const synchronized = await synchronizeBuilderQuestionsToBank(db, id, questions, ctx.user.id);
      await db
        .update(standaloneQuizzes)
        .set({ builderConfig: serializeBuilderConfig({ meta, questions: synchronized.questions }) })
        .where(eq(standaloneQuizzes.id, id));
      return { id, builderConfig: { meta, questions: synchronized.questions }, createdQuestionBankRecords: synchronized.created, updatedQuestionBankRecords: synchronized.updated };
    }),

  findAndReplaceText: protectedProcedure
    .input(z.object({
      quizId: z.number().int().positive(),
      find: z.string().min(1).max(500),
      replace: z.string().max(500),
      questionBankAction: z.enum(["quiz_only", "update_linked", "create_linked"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const quiz = await getQuizOrThrow(db, input.quizId);
      const config = await hydrateBuilderQuestionsFromBank(db, quiz.id, builderConfigFromQuizRow(quiz, ctx.user));
      const updatedQuestions = config.questions.map((question) => replaceQuizQuestionText(question as Record<string, unknown>, input.find, input.replace));
      const replacementCount = updatedQuestions.reduce((total, result) => total + result.replacements, 0);
      config.questions = updatedQuestions.map((result) => result.replacements > 0 && input.questionBankAction === "quiz_only"
        ? { ...result.value, questionBankOverride: true }
        : result.value) as QuizFile["questions"];
      config.meta.updatedAt = new Date().toISOString();

      let updatedQuestionBankRecords = 0;
      let createdQuestionBankRecords = 0;
      if (input.questionBankAction === "update_linked") {
        const questionsForBankUpdate = config.questions.map((question) => ({ ...question, questionBankOverride: false }));
        const synchronized = await synchronizeBuilderQuestionsToBank(db, quiz.id, questionsForBankUpdate, ctx.user.id);
        config.questions = synchronized.questions;
        updatedQuestionBankRecords = synchronized.updated;
        createdQuestionBankRecords = synchronized.created;
      } else if (input.questionBankAction === "create_linked") {
        const existingLinks = await db.select().from(standaloneQuizQuestions).where(eq(standaloneQuizQuestions.quizId, quiz.id));
        const linkByBankId = new Map(existingLinks.map((link) => [link.questionBankId, link]));
        for (const [index, result] of updatedQuestions.entries()) {
          if (result.replacements === 0) continue;
          const updatedQuestion = result.value as QuizFile["questions"][number];
          const oldBankId = questionBankIdFromBuilderId(updatedQuestion.id);
          const [newQuestion] = await db.insert(questionBank).values({
            ...questionBankValuesFromBuilderQuestion(updatedQuestion as Record<string, unknown>),
            createdByAdminId: ctx.user.id,
          }).$returningId();
          const oldLink = oldBankId ? linkByBankId.get(oldBankId) : undefined;
          if (oldLink) {
            await db.update(standaloneQuizQuestions).set({ questionBankId: newQuestion.id, sortOrder: index }).where(eq(standaloneQuizQuestions.id, oldLink.id));
          } else {
            await db.insert(standaloneQuizQuestions).values({ quizId: quiz.id, questionBankId: newQuestion.id, sortOrder: index, points: updatedQuestion.points ?? 1 });
          }
          config.questions[index] = { ...updatedQuestion, id: `bank-${newQuestion.id}`, questionBankOverride: false };
          createdQuestionBankRecords += 1;
        }
      }
      await db.update(standaloneQuizzes).set({ builderConfig: serializeBuilderConfig(config), updatedAt: new Date() }).where(eq(standaloneQuizzes.id, input.quizId));
      return { builderConfig: config, replacementCount, updatedQuestionBankRecords, createdQuestionBankRecords };
    }),

  deleteQuiz: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const attempts = await db
        .select({ id: standaloneQuizAttempts.id })
        .from(standaloneQuizAttempts)
        .where(eq(standaloneQuizAttempts.quizId, input.quizId));
      if (attempts.length > 0) {
        const attemptIds = attempts.map((a) => a.id);
        for (const attemptId of attemptIds) {
          await db.delete(standaloneQuizAttemptAnswers).where(eq(standaloneQuizAttemptAnswers.attemptId, attemptId));
        }
        await db.delete(standaloneQuizAttempts).where(eq(standaloneQuizAttempts.quizId, input.quizId));
      }
      await db.delete(standaloneQuizzes).where(eq(standaloneQuizzes.id, input.quizId));
      return { success: true };
    }),

  updateBranding: protectedProcedure
    .input(
      z.object({
        quizId: z.number().int(),
        brandPrimaryColor: z.string().nullable().optional(),
        brandBgColor: z.string().nullable().optional(),
        backgroundMode: z.enum(["solid", "image", "gradient"]).optional(),
        backgroundGradient: z.string().nullable().optional(),
        brandTextColor: z.string().nullable().optional(),
        brandLogoUrl: z.string().nullable().optional(),
        brandFontFamily: z.string().nullable().optional(),
        completionMessage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const quiz = await getQuizOrThrow(db, input.quizId);
      const config = builderConfigFromQuizRow(quiz, ctx.user);
      const backgroundMode = input.backgroundMode ?? config.meta.branding?.backgroundMode ?? (config.meta.branding?.backgroundImageUrl ? "image" : "solid");
      const branding: QuizBranding = {
        ...(config.meta.branding ?? {}),
        primaryColor: input.brandPrimaryColor ?? config.meta.branding?.primaryColor ?? "#24abbc",
        backgroundColor: backgroundMode === "image"
          ? (config.meta.branding?.backgroundColor ?? "#0d1f3c")
          : (input.brandBgColor ?? config.meta.branding?.backgroundColor ?? "#0d1f3c"),
        backgroundImageUrl: backgroundMode === "image"
          ? (input.brandBgColor ?? config.meta.branding?.backgroundImageUrl)
          : config.meta.branding?.backgroundImageUrl,
        backgroundMode,
        backgroundGradient: input.backgroundGradient ?? config.meta.branding?.backgroundGradient,
        textColor: input.brandTextColor ?? config.meta.branding?.textColor ?? "#ffffff",
        fontFamily: input.brandFontFamily ?? config.meta.branding?.fontFamily,
        logoUrl: input.brandLogoUrl ?? config.meta.branding?.logoUrl,
      };
      config.meta.branding = branding;
      if (input.completionMessage !== undefined) {
        config.meta.resultSlide = {
          ...(config.meta.resultSlide ?? {}),
          passMessage: input.completionMessage ?? undefined,
        };
      }
      await db
        .update(standaloneQuizzes)
        .set({ builderConfig: serializeBuilderConfig(config) })
        .where(eq(standaloneQuizzes.id, input.quizId));
      return { success: true };
    }),

  getQuizAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [overall] = await db
        .select({
          totalAttempts: sql<number>`count(*)`,
          avgScore: sql<number>`AVG(CASE WHEN completed_at IS NOT NULL THEN score ELSE NULL END)`,
          passRate: sql<number>`SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END), 0)`,
        })
        .from(standaloneQuizAttempts)
        .where(eq(standaloneQuizAttempts.quizId, input.quizId));
      return {
        totalAttempts: Number(overall.totalAttempts),
        averageScore: overall.avgScore ? Math.round(Number(overall.avgScore)) : 0,
        passRate: overall.passRate ? Math.round(Number(overall.passRate)) : 0,
      };
    }),

  getQuestionAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const stats = await db
        .select({
          questionId: standaloneQuizAttemptAnswers.questionId,
          totalAnswers: sql<number>`count(*)`,
          correctAnswers: sql<number>`SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END)`,
        })
        .from(standaloneQuizAttemptAnswers)
        .innerJoin(standaloneQuizAttempts, eq(standaloneQuizAttemptAnswers.attemptId, standaloneQuizAttempts.id))
        .where(and(eq(standaloneQuizAttempts.quizId, input.quizId), isNotNull(standaloneQuizAttempts.completedAt)))
        .groupBy(standaloneQuizAttemptAnswers.questionId);
      return stats.map((s) => ({
        questionId: s.questionId,
        totalAnswers: Number(s.totalAnswers),
        correctRate:
          Number(s.totalAnswers) > 0
            ? Math.round((Number(s.correctAnswers) / Number(s.totalAnswers)) * 100)
            : 0,
      }));
    }),

  getAttempts: protectedProcedure
    .input(
      z.object({
        quizId: z.number().int(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const attempts = await db
        .select({
          attempt: standaloneQuizAttempts,
          userName: users.name,
          userEmail: users.email,
        })
        .from(standaloneQuizAttempts)
        .innerJoin(users, eq(standaloneQuizAttempts.userId, users.id))
        .where(and(eq(standaloneQuizAttempts.quizId, input.quizId), isNotNull(standaloneQuizAttempts.completedAt)))
        .orderBy(desc(standaloneQuizAttempts.completedAt))
        .limit(input.limit)
        .offset(input.offset);
      return { attempts, total: attempts.length };
    }),

  listImportableScormQuizAssets: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(200) }).optional())
    .query(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      return listImportableScormQuizAssets(input?.limit ?? 200);
    }),

  previewScormNativeImport: protectedProcedure
    .input(z.object({ mediaAssetId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      const converted = await convertMediaAssetToNativeQuiz(input.mediaAssetId);
      const meta = converted.quizFile.meta as Record<string, unknown>;
      return {
        title: String(meta.title ?? "Imported Quiz"),
        questionCount: converted.questionCount,
        mediaCount: converted.mediaCount,
        groups: (meta.groups as unknown[]) ?? [],
        branchingEnabled: Boolean(meta.branchingEnabled),
        passingScore: Number(meta.passingScore ?? 70),
        warnings: converted.warnings,
        sampleQuestions: converted.quizFile.questions.slice(0, 3).map((q) => {
          const question = q as Record<string, unknown>;
          return {
            type: question.type,
            stem: question.stem,
            hasFeedback: Boolean((question.feedback as Record<string, unknown> | undefined)?.correct),
            branchRuleCount: Array.isArray(question.branchRules) ? question.branchRules.length : 0,
          };
        }),
      };
    }),

  importScormNativeQuiz: protectedProcedure
    .input(z.object({
      mediaAssetId: z.number().int(),
      replaceExisting: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      return importMediaAssetToNativeQuiz(input.mediaAssetId, ctx.user.id, {
        replaceExisting: input.replaceExisting,
      });
    }),

  batchImportScormNativeQuizzes: protectedProcedure
    .input(z.object({
      mediaAssetIds: z.array(z.number().int()).optional(),
      replaceExisting: z.boolean().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertStandaloneQuizStaff(ctx);
      return batchImportScormQuizzesToNative(ctx.user.id, {
        mediaAssetIds: input.mediaAssetIds,
        replaceExisting: input.replaceExisting,
        limit: input.limit,
      });
    }),
});
