/**
 * quizMakerRouter.ts
 * iSpring-style visual quiz builder API — persists to standalone_quizzes.builderConfig
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
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

async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role !== "admin") {
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
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function standaloneQuestionToBuilderQuestion(row: { sqq: typeof standaloneQuizQuestions.$inferSelect; qb: typeof questionBank.$inferSelect }) {
  const options = parseJson<{ text?: string; imageUrl?: string; videoUrl?: string; feedback?: string }[]>(row.qb.options, []);
  const correctAnswer = String(row.qb.correctAnswer ?? "0");
  const correctAnswers = parseJson<number[]>(row.qb.correctAnswers, []);
  const normalizedCorrectAnswer = correctAnswer.trim().toLocaleLowerCase();
  const correctChoiceIndex = /^\d+$/.test(correctAnswer)
    ? Number(correctAnswer)
    : options.findIndex((option) => (option.text ?? "").trim().toLocaleLowerCase() === normalizedCorrectAnswer);
  const base = {
    id: `bank-${row.qb.id}`,
    order: row.sqq.sortOrder + 1,
    points: row.sqq.points,
    stem: row.qb.question,
    required: true,
    shuffleAnswerOptions: row.sqq.shuffleAnswerOptions,
    lockAnswerOrder: row.sqq.lockAnswerOrder ?? false,
    explanation: row.qb.explanation ?? "",
    image: row.qb.questionImageUrl ? { url: row.qb.questionImageUrl, alt: "Question media" } : null,
    video: row.qb.questionVideoUrl ? { url: row.qb.questionVideoUrl, type: "file" } : null,
    feedbackImage: row.qb.feedbackImageUrl ? { url: row.qb.feedbackImageUrl, alt: "Feedback media" } : null,
    feedbackVideo: row.qb.feedbackVideoUrl ? { url: row.qb.feedbackVideoUrl, type: "file" } : null,
    branchRules: [],
  };

  if (row.qb.type === "truefalse") return { ...base, type: "tf", data: { correct: correctAnswer === "true" || correctAnswer === "0" } };
  if (row.qb.type === "matching") return { ...base, type: "matching", data: { pairs: parseJson(row.qb.matchingPairs, []) } };
  if (row.qb.type === "hotspot") return { ...base, type: "hotspot", data: { markers: parseJson(row.qb.hotspotMarkers, []) } };
  return {
    ...base,
    type: "mcq",
    data: {
      multiple: row.qb.type === "multiselect",
      choices: options.map((option, index) => ({
        id: String(index), text: option.text ?? "", imageUrl: option.imageUrl, videoUrl: option.videoUrl, feedback: option.feedback ?? "",
        correct: row.qb.type === "multiselect" ? correctAnswers.includes(index) : index === correctChoiceIndex,
      })),
    },
  };
}

export const quizMakerRouter = router({
  addQuestionBankQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number().int(),
      questionBankIds: z.array(z.number().int()).min(1),
      groupId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
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
      const additions = linked.map((row) => ({ ...standaloneQuestionToBuilderQuestion(row), groupId: input.groupId }));
      const alreadyInBuilder = new Set(config.questions.map((question) => question.id));
      config.questions = [...config.questions, ...additions.filter((question) => !alreadyInBuilder.has(question.id))];
      await db.update(standaloneQuizzes).set({ builderConfig: serializeBuilderConfig(config) }).where(eq(standaloneQuizzes.id, input.quizId));
      return { added: newIds.length };
    }),

  listQuizzes: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
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
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const quiz = await getQuizOrThrow(db, input.quizId);
      const savedConfig = parseBuilderConfig(quiz.builderConfig);
      let config = builderConfigFromQuizRow(quiz, ctx.user);
      if (!savedConfig || config.questions.length === 0) {
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
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let questions: unknown[];
      let meta: QuizFile["meta"];
      try {
        questions = JSON.parse(input.questionsJson);
        meta = JSON.parse(input.settingsJson) as QuizFile["meta"];
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid quiz JSON" });
      }

      meta.updatedAt = new Date().toISOString();
      const builderConfig: QuizFile = { meta, questions };
      const settings = metaToQuizSettings(meta);

      if (input.quizId) {
        const quiz = await getQuizOrThrow(db, input.quizId);
        meta.cloudId = quiz.id;
        await db
          .update(standaloneQuizzes)
          .set({
            ...settings,
            builderConfig: serializeBuilderConfig({ meta, questions }),
          })
          .where(eq(standaloneQuizzes.id, input.quizId));
        return { id: input.quizId };
      }

      const [result] = await db.insert(standaloneQuizzes).values({
        ...settings,
        type: "quiz",
        status: "draft",
        accessType: "enrolled",
        brand: "aaus",
        showResultsImmediately: true,
        showExplanations: true,
        builderConfig: serializeBuilderConfig(builderConfig),
        createdByUserId: ctx.user.id,
      });
      const id = (result as { insertId: number }).insertId;
      meta.cloudId = id;
      await db
        .update(standaloneQuizzes)
        .set({ builderConfig: serializeBuilderConfig({ meta, questions }) })
        .where(eq(standaloneQuizzes.id, id));
      return { id };
    }),

  deleteQuiz: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
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
        brandLogoUrl: z.string().nullable().optional(),
        brandFontFamily: z.string().nullable().optional(),
        completionMessage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
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
      await assertAdmin(ctx);
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
      await assertAdmin(ctx);
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
      await assertAdmin(ctx);
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
});
