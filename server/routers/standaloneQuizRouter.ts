/**
 * standaloneQuizRouter.ts
 * Quiz Creator tool — standalone quizzes and mock exams built from the question bank.
 * Splits into three sub-routers:
 *   standaloneQuizPublicRouter   — unauthenticated quiz metadata (public quizzes)
 *   standaloneQuizLearnerRouter  — attempt start/submit, results, student dashboard
 *   standaloneQuizAdminRouter    — CRUD, question management, analytics, import/export
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql, isNull, isNotNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  standaloneQuizzes,
  standaloneQuizQuestions,
  standaloneQuizAttempts,
  standaloneQuizAttemptAnswers,
  questionBank,
  questionBankFolders,
  questionBankTags,
  questionBankTagMap,
  users,
  lmsLessons,
  lmsEnrollments,
  lmsCourses,
} from "../../drizzle/schema";
import { drawQuestionsFromBuilder, parseBuilderConfig } from "../lib/quizBuilderConfig";
import { builderQuestionToPlayerPayload, gradeBuilderAnswer, stableBuilderQuestionId } from "../lib/gradeBuilderQuestion";
import { buildStandaloneLearnerOptions, orderQuestionOptions } from "../lib/questionOptionOrder";

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

/** Quiz Creator content is available through an assigned LMS lesson, not as a public standalone product. */
export async function assertEmbeddedQuizAccess(db: any, user: { id: number; role: string }, quizId: number) {
  if (user.role === "admin") return;
  const [assignment] = await db
    .select({ lessonId: lmsLessons.id })
    .from(lmsLessons)
    .innerJoin(lmsEnrollments, and(
      eq(lmsEnrollments.courseId, lmsLessons.courseId),
      eq(lmsEnrollments.userId, user.id),
      or(isNull(lmsEnrollments.accessExpiresAt), gte(lmsEnrollments.accessExpiresAt, new Date())),
    ))
    .where(and(
      eq(lmsLessons.type, "standalone_quiz"),
      eq(lmsLessons.standaloneQuizId, quizId),
    ))
    .limit(1);
  if (assignment) return;
  const [previewAssignment] = await db
    .select({ lessonId: lmsLessons.id })
    .from(lmsLessons)
    .where(and(
      eq(lmsLessons.type, "standalone_quiz"),
      eq(lmsLessons.standaloneQuizId, quizId),
      or(
        eq(lmsLessons.previewMode, "preview"),
        eq(lmsLessons.previewMode, "preview_hide_after_purchase"),
      ),
    ))
    .limit(1);
  if (previewAssignment) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "This quiz is available through its assigned learning experience." });
}

/** Shuffle an array in-place using Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Shared input schemas ─────────────────────────────────────────────────────
const quizSettingsInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  type: z.enum(["quiz", "mock_exam"]).default("quiz"),
  passingScore: z.number().int().min(0).max(100).default(70),
  timeLimitMinutes: z.number().int().min(1).nullable().optional(),
  shuffleQuestions: z.boolean().default(false),
  shuffleAnswers: z.boolean().default(false),
  showResultsImmediately: z.boolean().default(true),
  showResultsAfterDate: z.string().nullable().optional(), // ISO date string
  showExplanations: z.boolean().default(true),
  allowRetakes: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).nullable().optional(),
  accessType: z.enum(["enrolled", "members_only"]).default("enrolled"),
  brand: z.enum(["aaus", "iheartecho"]).default("aaus"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  coverImageUrl: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  sharedInSonoQuiz: z.boolean().optional(),
  // Result visibility
  showGroupNames: z.boolean().default(true).optional(),
  showPerQuestionResult: z.boolean().default(true).optional(),
  showOnlyPercentage: z.boolean().default(false).optional(),
  // Per-category question draw config
  categoryConfig: z.string().nullable().optional(), // JSON: [{folderId, folderName, count}]
  questionsPerAttempt: z.number().int().min(1).nullable().optional(),
});

// ─── Public Router ────────────────────────────────────────────────────────────
export const standaloneQuizPublicRouter = router({
  /** Public metadata is disabled; Quiz Creator content is embedded in assigned learning experiences. */
  getPublicQuiz: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async () => {
      throw new TRPCError({ code: "FORBIDDEN", message: "Quiz Creator quizzes are available through assigned learning experiences." });
    }),
});

// ─── Learner Router ───────────────────────────────────────────────────────────
export const standaloneQuizLearnerRouter = router({
  /** Get quiz info + question count for the take-quiz page */
  getQuizInfo: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [quiz] = await db
        .select()
        .from(standaloneQuizzes)
        .where(and(eq(standaloneQuizzes.id, input.quizId), eq(standaloneQuizzes.status, "published")))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      await assertEmbeddedQuizAccess(db, ctx.user, quiz.id);
      const builderConfig = parseBuilderConfig(quiz.builderConfig);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(standaloneQuizQuestions)
        .where(eq(standaloneQuizQuestions.quizId, quiz.id));
      const questionCount = builderConfig
        ? (builderConfig.meta.drawConfig?.enabled
            ? builderConfig.meta.drawConfig.totalQuestions
            : builderConfig.questions.length)
        : Number(count);
      // Check attempt limits
      let attemptCount = 0;
      if (!quiz.allowRetakes || quiz.maxAttempts) {
        const [{ cnt }] = await db
          .select({ cnt: sql<number>`count(*)` })
          .from(standaloneQuizAttempts)
          .where(and(
            eq(standaloneQuizAttempts.quizId, quiz.id),
            eq(standaloneQuizAttempts.userId, ctx.user.id),
            isNotNull(standaloneQuizAttempts.completedAt),
          ));
        attemptCount = Number(cnt);
      }
      const canAttempt =
        quiz.allowRetakes
          ? quiz.maxAttempts === null || attemptCount < quiz.maxAttempts
          : attemptCount === 0;
      return { ...quiz, questionCount, attemptCount, canAttempt, builderConfig: builderConfig?.meta ?? null };
    }),

  /** Start a new attempt — returns attempt ID and the ordered questions */
  startAttempt: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [quiz] = await db
        .select()
        .from(standaloneQuizzes)
      .where(and(eq(standaloneQuizzes.id, input.quizId), eq(standaloneQuizzes.status, "published")))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      await assertEmbeddedQuizAccess(db, ctx.user, quiz.id);

      const builderConfig = parseBuilderConfig(quiz.builderConfig);

      // Check attempt limits
      if (!quiz.allowRetakes || quiz.maxAttempts) {
        const [{ cnt }] = await db
          .select({ cnt: sql<number>`count(*)` })
          .from(standaloneQuizAttempts)
          .where(and(
            eq(standaloneQuizAttempts.quizId, quiz.id),
            eq(standaloneQuizAttempts.userId, ctx.user.id),
            isNotNull(standaloneQuizAttempts.completedAt),
          ));
        const done = Number(cnt);
        if (!quiz.allowRetakes && done > 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Retakes are not allowed for this quiz" });
        }
        if (quiz.maxAttempts && done >= quiz.maxAttempts) {
          throw new TRPCError({ code: "FORBIDDEN", message: `Maximum attempts (${quiz.maxAttempts}) reached` });
        }
      }

      // Get next attempt number
      const [{ cnt: prevCnt }] = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(standaloneQuizAttempts)
        .where(and(eq(standaloneQuizAttempts.quizId, quiz.id), eq(standaloneQuizAttempts.userId, ctx.user.id)));
      const attemptNumber = Number(prevCnt) + 1;

      // ── Visual builder mode: questions from builderConfig JSON ──
      if (builderConfig && builderConfig.questions.length > 0) {
        const drawn = drawQuestionsFromBuilder(builderConfig) as typeof builderConfig.questions;
        const totalPoints = drawn.reduce((s, q) => s + ((q as { points?: number }).points ?? 1), 0);
        const [result] = await db.insert(standaloneQuizAttempts).values({
          quizId: quiz.id,
          userId: ctx.user.id,
          totalQuestions: drawn.length,
          totalPoints,
          attemptNumber,
        });
        const attemptId = (result as { insertId: number }).insertId;
        const showAnswers = quiz.type === "quiz";
        const questions = drawn.map((q) =>
          builderQuestionToPlayerPayload(q as Parameters<typeof builderQuestionToPlayerPayload>[0], showAnswers, Boolean(builderConfig.meta.shuffleAnswers))
        );
        return {
          attemptId,
          questions,
          quiz: { ...quiz, totalPoints, builderMode: true, builderMeta: builderConfig.meta },
        };
      }

      // Fetch questions with their bank data
      let quizQs = await db
        .select({
          sqqId: standaloneQuizQuestions.id,
          sortOrder: standaloneQuizQuestions.sortOrder,
          points: standaloneQuizQuestions.points,
          qb: questionBank,
        })
        .from(standaloneQuizQuestions)
        .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
        .where(eq(standaloneQuizQuestions.quizId, quiz.id))
        .orderBy(asc(standaloneQuizQuestions.sortOrder));

      // ── Per-category draw: if categoryConfig is set, draw N questions per folder ──
      if (quiz.categoryConfig) {
        try {
          const cats: { folderId: number | null; folderName: string; count: number }[] = JSON.parse(quiz.categoryConfig);
          let drawn: typeof quizQs = [];
          for (const cat of cats) {
            const pool = quizQs.filter(q =>
              cat.folderId === null ? q.qb.folderId === null : q.qb.folderId === cat.folderId
            );
            const shuffled = shuffle(pool);
            drawn = drawn.concat(shuffled.slice(0, cat.count));
          }
          quizQs = quiz.shuffleQuestions ? shuffle(drawn) : drawn;
        } catch { /* ignore parse errors, fall through to full set */ }
      } else if (quiz.shuffleQuestions) {
        quizQs = shuffle(quizQs);
      }
      // ── questionsPerAttempt cap (applies after category draw) ──
      if (quiz.questionsPerAttempt && quizQs.length > quiz.questionsPerAttempt) {
        quizQs = shuffle(quizQs).slice(0, quiz.questionsPerAttempt);
      }

      const totalPoints = quizQs.reduce((s, q) => s + q.points, 0);

      // Create attempt record
      const [result] = await db.insert(standaloneQuizAttempts).values({
        quizId: quiz.id,
        userId: ctx.user.id,
        totalQuestions: quizQs.length,
        totalPoints,
        attemptNumber,
      });
      const attemptId = (result as any).insertId as number;

      // Build question payloads — strip correct answers for mock_exam
      const questions = quizQs.map((q) => {
        let options: any[] = [];
        try { options = JSON.parse(q.qb.options ?? "[]"); } catch { /* ignore */ }
        options = buildStandaloneLearnerOptions({
          options,
          quizShuffleAnswers: quiz.shuffleAnswers,
          questionShuffleAnswerOptions: q.sqq.shuffleAnswerOptions,
          lockAnswerOrder: q.sqq.lockAnswerOrder,
        });
        return {
          sqqId: q.sqqId,
          questionBankId: q.qb.id,
          points: q.points,
          question: q.qb.question,
          type: q.qb.type,
          options,
          questionImageUrl: q.qb.questionImageUrl,
          questionVideoUrl: q.qb.questionVideoUrl,
          hotspotMarkers: q.qb.hotspotMarkers,
          matchingPairs: q.qb.matchingPairs,
          // Only send correct answer in quiz mode (not mock_exam)
          ...(quiz.type === "quiz"
            ? {
                correctAnswer: q.qb.correctAnswer,
                correctAnswers: q.qb.correctAnswers,
                explanation: quiz.showExplanations ? q.qb.explanation : null,
                feedbackImageUrl: quiz.showExplanations ? q.qb.feedbackImageUrl : null,
                feedbackVideoUrl: quiz.showExplanations ? q.qb.feedbackVideoUrl : null,
              }
            : {}),
        };
      });

      return { attemptId, questions, quiz: { ...quiz, totalPoints } };
    }),

  /** Submit a completed attempt */
  submitAttempt: protectedProcedure
    .input(z.object({
      attemptId: z.number().int(),
      answers: z.array(z.object({
        questionBankId: z.number().int(),
        givenAnswer: z.string(), // JSON string
        timeSpentSeconds: z.number().int().optional(),
      })),
      timeSpentSeconds: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [attempt] = await db
        .select()
        .from(standaloneQuizAttempts)
        .where(and(eq(standaloneQuizAttempts.id, input.attemptId), eq(standaloneQuizAttempts.userId, ctx.user.id)))
        .limit(1);
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND" });
      if (attempt.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Attempt already submitted" });

      const [quiz] = await db
        .select()
        .from(standaloneQuizzes)
        .where(eq(standaloneQuizzes.id, attempt.quizId))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      const builderConfig = parseBuilderConfig(quiz.builderConfig);
      const isBuilderMode = !!(builderConfig && builderConfig.questions.length > 0);

      let earnedPoints = 0;
      let correctAnswers = 0;
      const answerRows: typeof standaloneQuizAttemptAnswers.$inferInsert[] = [];

      if (isBuilderMode) {
        const qMap = new Map(
          builderConfig!.questions.map((q) => {
            const qq = q as { id: string; points: number };
            return [stableBuilderQuestionId(qq.id), qq];
          })
        );
        for (const ans of input.answers) {
          const q = qMap.get(ans.questionBankId) as { id: string; points: number; type: string; data: unknown } | undefined;
          if (!q) continue;
          const isCorrect = gradeBuilderAnswer(q, ans.givenAnswer);
          if (isCorrect) {
            earnedPoints += q.points;
            correctAnswers++;
          }
          answerRows.push({
            attemptId: input.attemptId,
            questionId: ans.questionBankId,
            givenAnswer: ans.givenAnswer,
            isCorrect,
            timeSpentSeconds: ans.timeSpentSeconds ?? null,
          });
        }
      } else {
        const quizQs = await db
          .select({
            sqq: standaloneQuizQuestions,
            qb: questionBank,
          })
          .from(standaloneQuizQuestions)
          .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
          .where(eq(standaloneQuizQuestions.quizId, quiz.id));

        const qMap = new Map(quizQs.map((q) => [q.qb.id, q]));

        for (const ans of input.answers) {
          const q = qMap.get(ans.questionBankId);
          if (!q) continue;
          let isCorrect = false;
          try {
            const given = JSON.parse(ans.givenAnswer);
            if (q.qb.type === "mcq" || q.qb.type === "truefalse") {
              isCorrect = String(given) === String(q.qb.correctAnswer);
            } else if (q.qb.type === "multiselect") {
              const correct: number[] = JSON.parse(q.qb.correctAnswers ?? "[]");
              const givenArr: number[] = Array.isArray(given) ? given : [];
              isCorrect =
                givenArr.length === correct.length &&
                givenArr.every((v) => correct.includes(v));
            } else if (q.qb.type === "hotspot") {
              isCorrect = String(given?.markerId ?? given) === String(q.qb.correctAnswer);
            } else if (q.qb.type === "matching") {
              const pairs: { id: string; left: string; right: string }[] = JSON.parse(q.qb.matchingPairs ?? "[]");
              const givenPairs: { id: string; right: string }[] = Array.isArray(given) ? given : [];
              isCorrect = pairs.every((p) => givenPairs.find((g) => g.id === p.id)?.right === p.right);
            }
          } catch { /* ignore parse errors */ }

          if (isCorrect) {
            earnedPoints += q.sqq.points;
            correctAnswers++;
          }
          answerRows.push({
            attemptId: input.attemptId,
            questionId: ans.questionBankId,
            givenAnswer: ans.givenAnswer,
            isCorrect,
            timeSpentSeconds: ans.timeSpentSeconds ?? null,
          });
        }
      }

      // Bulk insert answers
      if (answerRows.length > 0) {
        await db.insert(standaloneQuizAttemptAnswers).values(answerRows);
      }

      const totalPoints = attempt.totalPoints;
      const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      const passed = score >= quiz.passingScore;

      await db.update(standaloneQuizAttempts).set({
        completedAt: new Date(),
        score: String(score.toFixed(2)) as any,
        passed,
        correctAnswers,
        earnedPoints,
        timeSpentSeconds: input.timeSpentSeconds ?? null,
      }).where(eq(standaloneQuizAttempts.id, input.attemptId));

      return { attemptId: input.attemptId, score, passed, correctAnswers, totalQuestions: attempt.totalQuestions, earnedPoints, totalPoints };
    }),

  /** Get attempt result with per-question breakdown */
  getAttemptResult: protectedProcedure
    .input(z.object({ attemptId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [attempt] = await db
        .select()
        .from(standaloneQuizAttempts)
        .where(and(eq(standaloneQuizAttempts.id, input.attemptId), eq(standaloneQuizAttempts.userId, ctx.user.id)))
        .limit(1);
      if (!attempt) throw new TRPCError({ code: "NOT_FOUND" });

      const [quiz] = await db
        .select()
        .from(standaloneQuizzes)
        .where(eq(standaloneQuizzes.id, attempt.quizId))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if results should be shown
      const now = new Date();
      const canSeeResults =
        quiz.showResultsImmediately ||
        (quiz.showResultsAfterDate && now >= new Date(quiz.showResultsAfterDate));

      const answers = await db
        .select()
        .from(standaloneQuizAttemptAnswers)
        .where(eq(standaloneQuizAttemptAnswers.attemptId, input.attemptId));

      let questionDetails: any[] = [];
      if (canSeeResults) {
        const questionIds = answers.map((a) => a.questionId);
        if (questionIds.length > 0) {
          const qbs = await db
            .select()
            .from(questionBank)
            .where(inArray(questionBank.id, questionIds));
          const qMap = new Map(qbs.map((q) => [q.id, q]));
          questionDetails = answers.map((a) => ({
            ...a,
            question: qMap.get(a.questionId),
          }));
        }
      }

      return {
        attempt,
        quiz,
        canSeeResults: !!canSeeResults,
        answers: canSeeResults ? questionDetails : [],
      };
    }),

  /** List all published quizzes available to this user, with their best score */
  listAvailableQuizzes: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const quizzes = await db
        .select()
        .from(standaloneQuizzes)
        .where(eq(standaloneQuizzes.status, "published"))
        .orderBy(asc(standaloneQuizzes.title));
      const results = await Promise.all(
        quizzes.map(async (quiz) => {
          const attempts = await db
            .select({ score: standaloneQuizAttempts.score, passed: standaloneQuizAttempts.passed })
            .from(standaloneQuizAttempts)
            .where(and(
              eq(standaloneQuizAttempts.quizId, quiz.id),
              eq(standaloneQuizAttempts.userId, ctx.user.id),
              isNotNull(standaloneQuizAttempts.completedAt),
            ));
          const bestScore = attempts.length > 0
            ? Math.max(...attempts.map((a) => Number(a.score ?? 0)))
            : null;
          const lastPassed = attempts.some((a) => a.passed);
          return { quiz, attemptCount: attempts.length, bestScore, lastPassed };
        })
      );
      return results;
    }),

  /** Get all completed attempts for this user (for My Quizzes history tab) */
  getMyAttempts: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          attempt: standaloneQuizAttempts,
          quizTitle: standaloneQuizzes.title,
        })
        .from(standaloneQuizAttempts)
        .innerJoin(standaloneQuizzes, eq(standaloneQuizAttempts.quizId, standaloneQuizzes.id))
        .where(and(
          eq(standaloneQuizAttempts.userId, ctx.user.id),
          isNotNull(standaloneQuizAttempts.completedAt),
        ))
        .orderBy(desc(standaloneQuizAttempts.completedAt))
        .limit(100);
      return rows;
    }),

  /** List all attempts for the current user */
  myAttempts: protectedProcedure
    .input(z.object({
      quizId: z.number().int().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [
        eq(standaloneQuizAttempts.userId, ctx.user.id),
        isNotNull(standaloneQuizAttempts.completedAt),
      ];
      if (input.quizId) conditions.push(eq(standaloneQuizAttempts.quizId, input.quizId));
      const offset = (input.page - 1) * input.pageSize;
      const [attempts, [{ total }]] = await Promise.all([
        db.select({
          attempt: standaloneQuizAttempts,
          quizTitle: standaloneQuizzes.title,
          quizType: standaloneQuizzes.type,
          quizPassingScore: standaloneQuizzes.passingScore,
        })
          .from(standaloneQuizAttempts)
          .innerJoin(standaloneQuizzes, eq(standaloneQuizAttempts.quizId, standaloneQuizzes.id))
          .where(and(...conditions))
          .orderBy(desc(standaloneQuizAttempts.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` })
          .from(standaloneQuizAttempts)
          .where(and(...conditions)),
      ]);
      return { attempts, total: Number(total), page: input.page, pageSize: input.pageSize };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
export const standaloneQuizAdminRouter = router({
  /** List all quizzes */
  listQuizzes: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      type: z.enum(["quiz", "mock_exam"]).optional(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.search) conditions.push(like(standaloneQuizzes.title, `%${input.search}%`));
      if (input.status) conditions.push(eq(standaloneQuizzes.status, input.status));
      if (input.type) conditions.push(eq(standaloneQuizzes.type, input.type));
      if (input.brand) conditions.push(eq(standaloneQuizzes.brand, input.brand));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [quizzes, [{ total }]] = await Promise.all([
        db.select({
          quiz: standaloneQuizzes,
          questionCount: sql<number>`(SELECT COUNT(*) FROM standalone_quiz_questions WHERE quiz_id = ${standaloneQuizzes.id})`,
          attemptCount: sql<number>`(SELECT COUNT(*) FROM standalone_quiz_attempts WHERE quiz_id = ${standaloneQuizzes.id} AND completed_at IS NOT NULL)`,
        })
          .from(standaloneQuizzes)
          .where(where)
          .orderBy(desc(standaloneQuizzes.updatedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` }).from(standaloneQuizzes).where(where),
      ]);
      return { quizzes, total: Number(total), page: input.page, pageSize: input.pageSize };
    }),

  /** Get a single quiz with its questions */
  getQuiz: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [quiz] = await db
        .select()
        .from(standaloneQuizzes)
        .where(eq(standaloneQuizzes.id, input.id))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
      const questions = await db
        .select({
          sqq: standaloneQuizQuestions,
          qb: questionBank,
        })
        .from(standaloneQuizQuestions)
        .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
        .where(eq(standaloneQuizQuestions.quizId, quiz.id))
        .orderBy(asc(standaloneQuizQuestions.sortOrder));
      const assignments = await db
        .select({
          lessonId: lmsLessons.id,
          lessonTitle: lmsLessons.title,
          courseId: lmsCourses.id,
          courseTitle: lmsCourses.title,
          previewMode: lmsLessons.previewMode,
        })
        .from(lmsLessons)
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsLessons.courseId))
        .where(and(
          eq(lmsLessons.type, "standalone_quiz"),
          eq(lmsLessons.standaloneQuizId, quiz.id),
        ));
      return { quiz, questions, assignments };
    }),

  /** Create a new quiz */
  createQuiz: protectedProcedure
    .input(quizSettingsInput)
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(standaloneQuizzes).values({
        ...input,
        showResultsAfterDate: input.showResultsAfterDate ? new Date(input.showResultsAfterDate) : null,
        createdByUserId: ctx.user.id,
      });
      return { id: (result as any).insertId as number };
    }),

  /** Update quiz settings */
  updateQuiz: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(quizSettingsInput.partial()))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, showResultsAfterDate, ...rest } = input;
      const updates: any = { ...rest };
      if (showResultsAfterDate !== undefined) {
        updates.showResultsAfterDate = showResultsAfterDate ? new Date(showResultsAfterDate) : null;
      }
      await db.update(standaloneQuizzes).set(updates).where(eq(standaloneQuizzes.id, id));
      return { success: true };
    }),

  /** Delete a quiz and all its questions/attempts */
  deleteQuiz: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Delete in dependency order
      const attempts = await db
        .select({ id: standaloneQuizAttempts.id })
        .from(standaloneQuizAttempts)
        .where(eq(standaloneQuizAttempts.quizId, input.id));
      if (attempts.length > 0) {
        await db.delete(standaloneQuizAttemptAnswers)
          .where(inArray(standaloneQuizAttemptAnswers.attemptId, attempts.map((a) => a.id)));
        await db.delete(standaloneQuizAttempts).where(eq(standaloneQuizAttempts.quizId, input.id));
      }
      await db.delete(standaloneQuizQuestions).where(eq(standaloneQuizQuestions.quizId, input.id));
      await db.delete(standaloneQuizzes).where(eq(standaloneQuizzes.id, input.id));
      return { success: true };
    }),

  /** Add a question from the bank to the quiz */
  addQuestion: protectedProcedure
    .input(z.object({
      quizId: z.number().int(),
      questionBankId: z.number().int(),
      points: z.number().int().min(1).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get max sort_order
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(standaloneQuizQuestions)
        .where(eq(standaloneQuizQuestions.quizId, input.quizId));
      const [result] = await db.insert(standaloneQuizQuestions).values({
        quizId: input.quizId,
        questionBankId: input.questionBankId,
        sortOrder: Number(maxOrder) + 1,
        points: input.points,
      });
      return { id: (result as any).insertId as number };
    }),

  /** Add multiple questions at once */
  addQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number().int(),
      questionBankIds: z.array(z.number().int()).min(1),
      points: z.number().int().min(1).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(standaloneQuizQuestions)
        .where(eq(standaloneQuizQuestions.quizId, input.quizId));
      // Filter out already-added questions
      const existing = await db
        .select({ questionBankId: standaloneQuizQuestions.questionBankId })
        .from(standaloneQuizQuestions)
        .where(and(
          eq(standaloneQuizQuestions.quizId, input.quizId),
          inArray(standaloneQuizQuestions.questionBankId, input.questionBankIds),
        ));
      const existingIds = new Set(existing.map((e) => e.questionBankId));
      const newIds = input.questionBankIds.filter((id) => !existingIds.has(id));
      if (newIds.length === 0) return { added: 0 };
      const rows = newIds.map((qbId, i) => ({
        quizId: input.quizId,
        questionBankId: qbId,
        sortOrder: Number(maxOrder) + 1 + i,
        points: input.points,
      }));
      await db.insert(standaloneQuizQuestions).values(rows);
      return { added: rows.length };
    }),

  /** Remove a question from the quiz */
  removeQuestion: protectedProcedure
    .input(z.object({ standaloneQuizQuestionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(standaloneQuizQuestions).where(eq(standaloneQuizQuestions.id, input.standaloneQuizQuestionId));
      return { success: true };
    }),

  /** Update points for a quiz question */
  updateQuestionPoints: protectedProcedure
    .input(z.object({ standaloneQuizQuestionId: z.number().int(), points: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(standaloneQuizQuestions)
        .set({ points: input.points })
        .where(eq(standaloneQuizQuestions.id, input.standaloneQuizQuestionId));
      return { success: true };
    }),

  /** Configure whether options are shuffled for one question only. */
  updateQuestionAnswerOrder: protectedProcedure
    .input(z.object({ standaloneQuizQuestionId: z.number().int(), lockAnswerOrder: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(standaloneQuizQuestions)
        .set({ lockAnswerOrder: input.lockAnswerOrder })
        .where(eq(standaloneQuizQuestions.id, input.standaloneQuizQuestionId));
      return { success: true };
    }),

  /** Reorder questions */
  reorderQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number().int(),
      orderedIds: z.array(z.number().int()), // standaloneQuizQuestion IDs in new order
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(standaloneQuizQuestions)
          .set({ sortOrder: i })
          .where(and(eq(standaloneQuizQuestions.id, input.orderedIds[i]), eq(standaloneQuizQuestions.quizId, input.quizId)));
      }
      return { success: true };
    }),

  /** Get quiz analytics */
  getAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [quiz] = await db.select().from(standaloneQuizzes).where(eq(standaloneQuizzes.id, input.quizId)).limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      const [overall] = await db
        .select({
          totalAttempts: sql<number>`count(*)`,
          completedAttempts: sql<number>`SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END)`,
          passedAttempts: sql<number>`SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END)`,
          avgScore: sql<number>`AVG(CASE WHEN completed_at IS NOT NULL THEN score ELSE NULL END)`,
          avgTime: sql<number>`AVG(CASE WHEN completed_at IS NOT NULL THEN time_spent_seconds ELSE NULL END)`,
        })
        .from(standaloneQuizAttempts)
        .where(eq(standaloneQuizAttempts.quizId, input.quizId));

      // Per-question stats
      const questionStats = await db
        .select({
          questionId: standaloneQuizAttemptAnswers.questionId,
          totalAnswers: sql<number>`count(*)`,
          correctAnswers: sql<number>`SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END)`,
          questionText: questionBank.question,
          questionType: questionBank.type,
        })
        .from(standaloneQuizAttemptAnswers)
        .innerJoin(standaloneQuizAttempts, eq(standaloneQuizAttemptAnswers.attemptId, standaloneQuizAttempts.id))
        .innerJoin(questionBank, eq(standaloneQuizAttemptAnswers.questionId, questionBank.id))
        .where(and(
          eq(standaloneQuizAttempts.quizId, input.quizId),
          isNotNull(standaloneQuizAttempts.completedAt),
        ))
        .groupBy(standaloneQuizAttemptAnswers.questionId, questionBank.question, questionBank.type);

      // Recent attempts with user info
      const recentAttempts = await db
        .select({
          attempt: standaloneQuizAttempts,
          userName: users.name,
          userEmail: users.email,
        })
        .from(standaloneQuizAttempts)
        .innerJoin(users, eq(standaloneQuizAttempts.userId, users.id))
        .where(and(eq(standaloneQuizAttempts.quizId, input.quizId), isNotNull(standaloneQuizAttempts.completedAt)))
        .orderBy(desc(standaloneQuizAttempts.completedAt))
        .limit(50);

      return {
        quiz,
        overall: {
          totalAttempts: Number(overall.totalAttempts),
          completedAttempts: Number(overall.completedAttempts),
          passedAttempts: Number(overall.passedAttempts),
          passRate: overall.completedAttempts > 0
            ? Math.round((Number(overall.passedAttempts) / Number(overall.completedAttempts)) * 100)
            : 0,
          avgScore: overall.avgScore ? Number(Number(overall.avgScore).toFixed(1)) : null,
          avgTimeSeconds: overall.avgTime ? Math.round(Number(overall.avgTime)) : null,
        },
        questionStats: questionStats.map((q) => ({
          ...q,
          totalAnswers: Number(q.totalAnswers),
          correctAnswers: Number(q.correctAnswers),
          correctRate: q.totalAnswers > 0
            ? Math.round((Number(q.correctAnswers) / Number(q.totalAnswers)) * 100)
            : 0,
        })),
        recentAttempts,
      };
    }),

  /** List all attempts for a quiz (admin view) */
  listAttempts: protectedProcedure
    .input(z.object({
      quizId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const [attempts, [{ total }]] = await Promise.all([
        db.select({
          attempt: standaloneQuizAttempts,
          userName: users.name,
          userEmail: users.email,
        })
          .from(standaloneQuizAttempts)
          .innerJoin(users, eq(standaloneQuizAttempts.userId, users.id))
          .where(and(eq(standaloneQuizAttempts.quizId, input.quizId), isNotNull(standaloneQuizAttempts.completedAt)))
          .orderBy(desc(standaloneQuizAttempts.completedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` })
          .from(standaloneQuizAttempts)
          .where(and(eq(standaloneQuizAttempts.quizId, input.quizId), isNotNull(standaloneQuizAttempts.completedAt))),
      ]);
      return { attempts, total: Number(total), page: input.page, pageSize: input.pageSize };
    }),

  /** Duplicate a quiz — clones all settings, category config, and question links */
  duplicateQuiz: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Fetch original quiz
      const [original] = await db
        .select()
        .from(standaloneQuizzes)
        .where(eq(standaloneQuizzes.id, input.id))
        .limit(1);
      if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
      // Insert clone: title gets "(Copy)", status reset to draft
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = original as any;
      const [result] = await db.insert(standaloneQuizzes).values({
        ...rest,
        title: `${original.title} (Copy)`,
        status: "draft",
        createdByUserId: ctx.user.id,
      });
      const newQuizId = (result as any).insertId as number;
      // Clone question links
      const questions = await db
        .select()
        .from(standaloneQuizQuestions)
        .where(eq(standaloneQuizQuestions.quizId, input.id))
        .orderBy(asc(standaloneQuizQuestions.sortOrder));
      if (questions.length > 0) {
        await db.insert(standaloneQuizQuestions).values(
          questions.map(({ id: _qid, quizId: _qzid, ...q }) => ({
            ...q,
            quizId: newQuizId,
          }))
        );
      }
      return { id: newQuizId };
    }),
});

// ─── Extend standaloneQuizAdminRouter with cross-quiz results ─────────────────
// (appended below the closing brace of standaloneQuizAdminRouter — merged in lmsRouter.ts)
export const standaloneQuizResultsAdminRouter = router({
  /** Cross-quiz results: all attempts across all quizzes, filterable by user/quiz/type/date */
  listAllAttempts: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      quizId: z.number().int().optional(),
      quizType: z.enum(["quiz", "mock_exam"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [isNotNull(standaloneQuizAttempts.completedAt)];
      if (input.quizId) conditions.push(eq(standaloneQuizAttempts.quizId, input.quizId));
      if (input.quizType) conditions.push(eq(standaloneQuizzes.type, input.quizType));
      if (input.dateFrom) conditions.push(gte(standaloneQuizAttempts.completedAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(standaloneQuizAttempts.completedAt, new Date(input.dateTo)));
      if (input.search) {
        const like = `%${input.search}%`;
        conditions.push(sql`(${users.name} LIKE ${like} OR ${users.email} LIKE ${like})`);
      }
      const offset = (input.page - 1) * input.pageSize;
      const [attempts, [{ total }]] = await Promise.all([
        db.select({
          attempt: standaloneQuizAttempts,
          userName: users.name,
          userEmail: users.email,
          quizTitle: standaloneQuizzes.title,
          quizType: standaloneQuizzes.type,
          quizPassingScore: standaloneQuizzes.passingScore,
        })
          .from(standaloneQuizAttempts)
          .innerJoin(users, eq(standaloneQuizAttempts.userId, users.id))
          .innerJoin(standaloneQuizzes, eq(standaloneQuizAttempts.quizId, standaloneQuizzes.id))
          .where(and(...conditions))
          .orderBy(desc(standaloneQuizAttempts.completedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` })
          .from(standaloneQuizAttempts)
          .innerJoin(users, eq(standaloneQuizAttempts.userId, users.id))
          .innerJoin(standaloneQuizzes, eq(standaloneQuizAttempts.quizId, standaloneQuizzes.id))
          .where(and(...conditions)),
      ]);
      return { attempts, total: Number(total), page: input.page, pageSize: input.pageSize };
    }),
});
