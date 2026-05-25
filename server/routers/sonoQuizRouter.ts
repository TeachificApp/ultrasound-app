/**
 * sonoQuizRouter.ts — SonoQuiz Live Quiz Platform tRPC Router
 *
 * Access: admin-only during development (platform_admin role required).
 * When released, educators with appropriate subscription will gain access.
 *
 * Procedures:
 *   Quiz CRUD:     listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz
 *   Questions:     listQuestions, upsertQuestion, deleteQuestion, reorderQuestions
 *   Sessions:      createSession, getSession, joinSession, startSession,
 *                  advanceQuestion, endSession
 *   Participants:  getParticipants, getLeaderboard
 *   Answers:       submitAnswer
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  sonoQuizzes,
  sonoQuizQuestions,
  sonoQuizSessions,
  sonoQuizParticipants,
  sonoQuizAnswers,
  users,
  lmsArchive,
} from "../../drizzle/schema";
import {
  broadcastLobbyUpdate,
  broadcastQuestionStart,
  broadcastQuestionEnd,
  broadcastLeaderboard,
  broadcastSessionEnded,
  recordAnswer,
  type ParticipantInfo,
  type RankEntry,
  type ScoreEntry,
} from "../sonoQuizHub";

// ─── Ultrasound-themed anonymous names ────────────────────────────────────────

const SONO_ADJECTIVES = [
  "Acoustic", "Doppler", "Echogenic", "Hyperechoic", "Hypoechoic",
  "Isoechoic", "Anechoic", "Pulsed", "Linear", "Curvilinear",
  "Phased", "Convex", "Transverse", "Sagittal", "Coronal",
  "Posterior", "Anterior", "Medial", "Lateral", "Proximal",
  "Distal", "Caudal", "Cranial", "Vascular", "Spectral",
];

const SONO_NOUNS = [
  "Probe", "Transducer", "Phantom", "Artifact", "Shadow",
  "Enhancement", "Reverberation", "Comet", "Needle", "Cyst",
  "Nodule", "Calcification", "Thrombus", "Plaque", "Stenosis",
  "Waveform", "Velocity", "Frequency", "Wavelength", "Pixel",
  "Sonographer", "Scanner", "Imager", "Detector", "Mapper",
];

function generateAnonName(seed?: number): string {
  const adj = SONO_ADJECTIVES[Math.floor(Math.random() * SONO_ADJECTIVES.length)];
  const noun = SONO_NOUNS[Math.floor(Math.random() * SONO_NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
}

// ─── Speed bonus calculation ──────────────────────────────────────────────────
// Max bonus = 50% of base points, awarded for fastest response
function calcPoints(basePoints: number, timeLimitMs: number, responseTimeMs: number): number {
  const speedRatio = Math.max(0, 1 - responseTimeMs / timeLimitMs);
  const bonus = Math.round(basePoints * 0.5 * speedRatio);
  return basePoints + bonus;
}

// ─── Admin guard helper ───────────────────────────────────────────────────────
async function requireAdmin(userId: number) {
  const db = (await getDb())!;
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0] || user[0].role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const sonoQuizRouter = router({

  // ── Quiz CRUD ──────────────────────────────────────────────────────────────

  listQuizzes: protectedProcedure
    .input(z.object({ status: z.enum(["draft", "published", "archived", "all"]).default("all") }).optional())
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const conditions = [eq(sonoQuizzes.createdByUserId, ctx.user.id)];
      if (input?.status && input.status !== "all") {
        conditions.push(eq(sonoQuizzes.status, input.status));
      }
      const quizzes = await db
        .select()
        .from(sonoQuizzes)
        .where(and(...conditions))
        .orderBy(desc(sonoQuizzes.updatedAt));
      return quizzes;
    }),

  getQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const quiz = await db.select().from(sonoQuizzes).where(eq(sonoQuizzes.id, input.quizId)).limit(1);
      if (!quiz[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const questions = await db
        .select()
        .from(sonoQuizQuestions)
        .where(eq(sonoQuizQuestions.quizId, input.quizId))
        .orderBy(asc(sonoQuizQuestions.sortOrder));
      return { quiz: quiz[0], questions };
    }),

  createQuiz: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(300),
      description: z.string().optional(),
      timeLimitSeconds: z.number().min(5).max(120).default(20),
      musicTrack: z.string().optional(),
      theme: z.string().default("teal"),
      coverImageUrl: z.string().optional(),
      category: z.string().default("General"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const result = await db.insert(sonoQuizzes).values({
        createdByUserId: ctx.user.id,
        title: input.title,
        description: input.description,
        timeLimitSeconds: input.timeLimitSeconds,
        musicTrack: input.musicTrack,
        theme: input.theme,
        coverImageUrl: input.coverImageUrl,
        category: input.category as any,
        questionCount: 0,
        status: "draft",
      });
      return { quizId: Number((result as any).insertId) };
    }),

  updateQuiz: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      title: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      timeLimitSeconds: z.number().min(5).max(120).optional(),
      musicTrack: z.string().nullable().optional(),
      theme: z.string().optional(),
      coverImageUrl: z.string().nullable().optional(),
      category: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const { quizId, ...updates } = input;
      await db.update(sonoQuizzes).set(updates as any).where(
        and(eq(sonoQuizzes.id, quizId), eq(sonoQuizzes.createdByUserId, ctx.user.id))
      );
      return { ok: true };
    }),

  deleteQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const [quiz] = await db.select().from(sonoQuizzes).where(eq(sonoQuizzes.id, input.quizId)).limit(1);
      if (quiz) {
        const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.insert(lmsArchive).values({
          itemType: "quiz",
          originalId: quiz.id,
          title: quiz.title,
          snapshot: JSON.stringify(quiz),
          deletedByUserId: ctx.user.id,
          purgeAt,
        });
      }
      await db.delete(sonoQuizQuestions).where(eq(sonoQuizQuestions.quizId, input.quizId));
      await db.delete(sonoQuizzes).where(
        and(eq(sonoQuizzes.id, input.quizId), eq(sonoQuizzes.createdByUserId, ctx.user.id))
      );
      return { ok: true };
    }),

  // ── Question CRUD ──────────────────────────────────────────────────────────

  upsertQuestion: protectedProcedure
    .input(z.object({
      questionId: z.number().optional(), // omit to create
      quizId: z.number(),
      question: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
      correctAnswer: z.number().min(0).max(3),
      explanation: z.string().optional(),
      mediaUrl: z.string().optional(),
      mediaType: z.enum(["image", "video", "gif"]).optional(),
      timeLimitSeconds: z.number().min(5).max(120).optional(),
      points: z.number().min(10).max(1000).default(100),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const optionsJson = JSON.stringify(input.options);

      if (input.questionId) {
        await db.update(sonoQuizQuestions).set({
          question: input.question,
          options: optionsJson,
          correctAnswer: input.correctAnswer,
          explanation: input.explanation,
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          timeLimitSeconds: input.timeLimitSeconds,
          points: input.points,
          sortOrder: input.sortOrder,
        }).where(eq(sonoQuizQuestions.id, input.questionId));
        return { questionId: input.questionId };
      } else {
        const result = await db.insert(sonoQuizQuestions).values({
          quizId: input.quizId,
          question: input.question,
          options: optionsJson,
          correctAnswer: input.correctAnswer,
          explanation: input.explanation,
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          timeLimitSeconds: input.timeLimitSeconds,
          points: input.points,
          sortOrder: input.sortOrder,
        });
        // Update question count
        await db.update(sonoQuizzes)
          .set({ questionCount: sql`questionCount + 1` })
          .where(eq(sonoQuizzes.id, input.quizId));
        return { questionId: Number((result as any).insertId) };
      }
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.number(), quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      await db.delete(sonoQuizQuestions).where(eq(sonoQuizQuestions.id, input.questionId));
      await db.update(sonoQuizzes)
        .set({ questionCount: sql`GREATEST(0, questionCount - 1)` })
        .where(eq(sonoQuizzes.id, input.quizId));
      return { ok: true };
    }),

  reorderQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      // Array of { questionId, sortOrder }
      order: z.array(z.object({ questionId: z.number(), sortOrder: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      for (const { questionId, sortOrder } of input.order) {
        await db.update(sonoQuizQuestions)
          .set({ sortOrder })
          .where(eq(sonoQuizQuestions.id, questionId));
      }
      return { ok: true };
    }),

  // ── Session Management ─────────────────────────────────────────────────────

  createSession: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      allowAnonymous: z.boolean().default(true),
      showLeaderboard: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;

      // Verify quiz exists and has questions
      const quiz = await db.select().from(sonoQuizzes).where(eq(sonoQuizzes.id, input.quizId)).limit(1);
      if (!quiz[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
      if (quiz[0].questionCount === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz has no questions" });
      }

      // Generate unique 6-char join code
      let joinCode = "";
      let attempts = 0;
      while (attempts < 10) {
        const candidate = Math.random().toString(36).substring(2, 8).toUpperCase();
        const existing = await db.select({ id: sonoQuizSessions.id })
          .from(sonoQuizSessions)
          .where(and(eq(sonoQuizSessions.joinCode, candidate), eq(sonoQuizSessions.status, "lobby")))
          .limit(1);
        if (!existing[0]) { joinCode = candidate; break; }
        attempts++;
      }
      if (!joinCode) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate join code" });

      // Snapshot quiz + questions for the session
      const questions = await db.select().from(sonoQuizQuestions)
        .where(eq(sonoQuizQuestions.quizId, input.quizId))
        .orderBy(asc(sonoQuizQuestions.sortOrder));

      const snapshot = JSON.stringify({ quiz: quiz[0], questions });

      const result = await db.insert(sonoQuizSessions).values({
        quizId: input.quizId,
        hostUserId: ctx.user.id,
        joinCode,
        status: "lobby",
        allowAnonymous: input.allowAnonymous,
        showLeaderboard: input.showLeaderboard,
        quizSnapshot: snapshot,
        participantCount: 0,
      });

      return { sessionId: Number((result as any).insertId), joinCode };
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const session = await db.select().from(sonoQuizSessions)
        .where(eq(sonoQuizSessions.id, input.sessionId)).limit(1);
      if (!session[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const participants = await db.select().from(sonoQuizParticipants)
        .where(and(eq(sonoQuizParticipants.sessionId, input.sessionId), eq(sonoQuizParticipants.isActive, true)))
        .orderBy(desc(sonoQuizParticipants.totalScore));
      return { session: session[0], participants };
    }),

  /** Public: join a session by join code (no auth required for anonymous) */
  joinSession: publicProcedure
    .input(z.object({
      joinCode: z.string().min(4).max(10).toUpperCase(),
      displayName: z.string().min(1).max(50).optional(),
      useAnonymous: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const session = await db.select().from(sonoQuizSessions)
        .where(and(
          eq(sonoQuizSessions.joinCode, input.joinCode.toUpperCase()),
          eq(sonoQuizSessions.status, "lobby")
        )).limit(1);

      if (!session[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found or no longer accepting participants" });
      }

      const userId = (ctx as any).user?.id ?? null;
      const displayName = input.useAnonymous || !input.displayName
        ? generateAnonName()
        : input.displayName;
      const avatarSeed = Math.random().toString(36).substring(2, 8);

      const result = await db.insert(sonoQuizParticipants).values({
        sessionId: session[0].id,
        userId,
        displayName,
        avatarSeed,
        totalScore: 0,
        isActive: true,
      });

      const participantId = Number((result as any).insertId);

      // Update participant count
      await db.update(sonoQuizSessions)
        .set({ participantCount: sql`participantCount + 1` })
        .where(eq(sonoQuizSessions.id, session[0].id));

      // Broadcast updated lobby list
      const allParticipants = await db.select().from(sonoQuizParticipants)
        .where(and(eq(sonoQuizParticipants.sessionId, session[0].id), eq(sonoQuizParticipants.isActive, true)));
      const participantInfos: ParticipantInfo[] = allParticipants.map(p => ({
        participantId: p.id,
        displayName: p.displayName,
        avatarSeed: p.avatarSeed ?? "",
        totalScore: p.totalScore,
      }));
      broadcastLobbyUpdate(session[0].id, participantInfos);

      // Parse snapshot for quiz info
      let quizInfo: any = null;
      try { quizInfo = JSON.parse(session[0].quizSnapshot ?? "{}"); } catch {}

      return {
        sessionId: session[0].id,
        participantId,
        displayName,
        avatarSeed,
        quizTitle: quizInfo?.quiz?.title ?? "SonoQuiz",
        musicTrack: quizInfo?.quiz?.musicTrack ?? null,
        theme: quizInfo?.quiz?.theme ?? "teal",
      };
    }),

  /** Host: start the session (move from lobby → active, reveal question 0) */
  startSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const session = await db.select().from(sonoQuizSessions)
        .where(and(eq(sonoQuizSessions.id, input.sessionId), eq(sonoQuizSessions.hostUserId, ctx.user.id)))
        .limit(1);
      if (!session[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (session[0].status !== "lobby") throw new TRPCError({ code: "BAD_REQUEST", message: "Session already started" });

      const snapshot = JSON.parse(session[0].quizSnapshot ?? "{}");
      const questions = snapshot.questions ?? [];
      if (questions.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No questions in quiz" });

      const now = new Date();
      await db.update(sonoQuizSessions).set({
        status: "active",
        currentQuestionIndex: 0,
        questionStartedAt: now,
        startedAt: now,
      }).where(eq(sonoQuizSessions.id, input.sessionId));

      const q = questions[0];
      const timeLimitSeconds = q.timeLimitSeconds ?? snapshot.quiz?.timeLimitSeconds ?? 20;
      broadcastQuestionStart(
        input.sessionId,
        {
          id: q.id,
          question: q.question,
          options: JSON.parse(q.options),
          mediaUrl: q.mediaUrl,
          mediaType: q.mediaType,
          points: q.points,
        },
        0,
        questions.length,
        timeLimitSeconds
      );

      return { ok: true, questionIndex: 0, totalQuestions: questions.length };
    }),

  /** Host: advance to the next question (reveals results of current, then next question) */
  advanceQuestion: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const session = await db.select().from(sonoQuizSessions)
        .where(and(eq(sonoQuizSessions.id, input.sessionId), eq(sonoQuizSessions.hostUserId, ctx.user.id)))
        .limit(1);
      if (!session[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (session[0].status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Session not active" });

      const snapshot = JSON.parse(session[0].quizSnapshot ?? "{}");
      const questions = snapshot.questions ?? [];
      const currentIndex = session[0].currentQuestionIndex ?? 0;
      const currentQ = questions[currentIndex];

      // Gather scores for current question
      const answers = await db.select({
        participantId: sonoQuizAnswers.participantId,
        isCorrect: sonoQuizAnswers.isCorrect,
        pointsEarned: sonoQuizAnswers.pointsEarned,
        responseTimeMs: sonoQuizAnswers.responseTimeMs,
      }).from(sonoQuizAnswers)
        .where(and(
          eq(sonoQuizAnswers.sessionId, input.sessionId),
          eq(sonoQuizAnswers.questionId, currentQ.id)
        ));

      const participants = await db.select().from(sonoQuizParticipants)
        .where(eq(sonoQuizParticipants.sessionId, input.sessionId));
      const participantMap = new Map(participants.map(p => [p.id, p]));

      const scores: ScoreEntry[] = answers.map(a => {
        const p = participantMap.get(a.participantId);
        return {
          participantId: a.participantId,
          displayName: p?.displayName ?? "Unknown",
          pointsEarned: a.pointsEarned,
          totalScore: p?.totalScore ?? 0,
          isCorrect: a.isCorrect,
          responseTimeMs: a.responseTimeMs ?? undefined,
        };
      });

      broadcastQuestionEnd(input.sessionId, currentQ.correctAnswer, currentQ.explanation, scores);

      // Build leaderboard
      const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);
      const rankings: RankEntry[] = sorted.map((p, i) => ({
        rank: i + 1,
        participantId: p.id,
        displayName: p.displayName,
        avatarSeed: p.avatarSeed ?? "",
        totalScore: p.totalScore,
      }));

      if (session[0].showLeaderboard) {
        broadcastLeaderboard(input.sessionId, rankings);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        // End session
        await db.update(sonoQuizSessions).set({
          status: "ended",
          endedAt: new Date(),
        }).where(eq(sonoQuizSessions.id, input.sessionId));

        // Save final ranks
        for (let i = 0; i < sorted.length; i++) {
          await db.update(sonoQuizParticipants)
            .set({ finalRank: i + 1 })
            .where(eq(sonoQuizParticipants.id, sorted[i].id));
        }

        broadcastSessionEnded(input.sessionId, rankings);
        return { done: true, nextQuestionIndex: null };
      }

      // Advance to next question
      const now = new Date();
      await db.update(sonoQuizSessions).set({
        currentQuestionIndex: nextIndex,
        questionStartedAt: now,
      }).where(eq(sonoQuizSessions.id, input.sessionId));

      const nextQ = questions[nextIndex];
      const timeLimitSeconds = nextQ.timeLimitSeconds ?? snapshot.quiz?.timeLimitSeconds ?? 20;
      broadcastQuestionStart(
        input.sessionId,
        {
          id: nextQ.id,
          question: nextQ.question,
          options: JSON.parse(nextQ.options),
          mediaUrl: nextQ.mediaUrl,
          mediaType: nextQ.mediaType,
          points: nextQ.points,
        },
        nextIndex,
        questions.length,
        timeLimitSeconds
      );

      return { done: false, nextQuestionIndex: nextIndex };
    }),

  /** Host: end the session early */
  endSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      await db.update(sonoQuizSessions).set({ status: "ended", endedAt: new Date() })
        .where(and(eq(sonoQuizSessions.id, input.sessionId), eq(sonoQuizSessions.hostUserId, ctx.user.id)));

      const participants = await db.select().from(sonoQuizParticipants)
        .where(eq(sonoQuizParticipants.sessionId, input.sessionId))
        .orderBy(desc(sonoQuizParticipants.totalScore));
      const rankings: RankEntry[] = participants.map((p, i) => ({
        rank: i + 1,
        participantId: p.id,
        displayName: p.displayName,
        avatarSeed: p.avatarSeed ?? "",
        totalScore: p.totalScore,
      }));
      broadcastSessionEnded(input.sessionId, rankings);
      return { ok: true };
    }),

  /** Participant: submit an answer */
  submitAnswer: publicProcedure
    .input(z.object({
      sessionId: z.number(),
      participantId: z.number(),
      questionId: z.number(),
      selectedAnswer: z.number().min(-1).max(3),
      responseTimeMs: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const session = await db.select().from(sonoQuizSessions)
        .where(and(eq(sonoQuizSessions.id, input.sessionId), eq(sonoQuizSessions.status, "active")))
        .limit(1);
      if (!session[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Session not active" });

      // Get question from snapshot
      const snapshot = JSON.parse(session[0].quizSnapshot ?? "{}");
      const questions = snapshot.questions ?? [];
      const question = questions.find((q: any) => q.id === input.questionId);
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const isCorrect = input.selectedAnswer === question.correctAnswer;
      const timeLimitMs = (question.timeLimitSeconds ?? snapshot.quiz?.timeLimitSeconds ?? 20) * 1000;
      const pointsEarned = isCorrect ? calcPoints(question.points, timeLimitMs, input.responseTimeMs) : 0;

      // Insert answer (ignore duplicate — first answer wins)
      try {
        await db.insert(sonoQuizAnswers).values({
          sessionId: input.sessionId,
          participantId: input.participantId,
          questionId: input.questionId,
          selectedAnswer: input.selectedAnswer,
          isCorrect,
          pointsEarned,
          responseTimeMs: input.responseTimeMs,
        });

        // Update participant score
        if (pointsEarned > 0) {
          await db.update(sonoQuizParticipants)
            .set({ totalScore: sql`totalScore + ${pointsEarned}` })
            .where(eq(sonoQuizParticipants.id, input.participantId));
        }

        // Record answer in hub (broadcasts count update)
        recordAnswer(input.sessionId);
      } catch {
        // Duplicate answer — silently ignore
      }

      return { isCorrect, pointsEarned };
    }),

  /** Get leaderboard for a session */
  getLeaderboard: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const participants = await db.select().from(sonoQuizParticipants)
        .where(and(eq(sonoQuizParticipants.sessionId, input.sessionId), eq(sonoQuizParticipants.isActive, true)))
        .orderBy(desc(sonoQuizParticipants.totalScore));
      return participants.map((p, i) => ({
        rank: i + 1,
        participantId: p.id,
        displayName: p.displayName,
        avatarSeed: p.avatarSeed ?? "",
        totalScore: p.totalScore,
        finalRank: p.finalRank,
      }));
    }),

  /** Get session by join code (for participant join page) */
  getSessionByCode: publicProcedure
    .input(z.object({ joinCode: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const session = await db.select({
        id: sonoQuizSessions.id,
        status: sonoQuizSessions.status,
        joinCode: sonoQuizSessions.joinCode,
        participantCount: sonoQuizSessions.participantCount,
        allowAnonymous: sonoQuizSessions.allowAnonymous,
        quizSnapshot: sonoQuizSessions.quizSnapshot,
      }).from(sonoQuizSessions)
        .where(eq(sonoQuizSessions.joinCode, input.joinCode.toUpperCase()))
        .limit(1);
      if (!session[0]) return null;
      let quizTitle = "SonoQuiz";
      let theme = "teal";
      let musicTrack: string | null = null;
      try {
        const snap = JSON.parse(session[0].quizSnapshot ?? "{}");
        quizTitle = snap.quiz?.title ?? quizTitle;
        theme = snap.quiz?.theme ?? theme;
        musicTrack = snap.quiz?.musicTrack ?? null;
      } catch {}
      return {
        id: session[0].id,
        status: session[0].status,
        joinCode: session[0].joinCode,
        participantCount: session[0].participantCount,
        allowAnonymous: session[0].allowAnonymous,
        quizTitle,
        theme,
        musicTrack,
      };
    }),

  /** List recent sessions for a quiz */
  listSessions: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      const sessions = await db.select().from(sonoQuizSessions)
        .where(and(eq(sonoQuizSessions.quizId, input.quizId), eq(sonoQuizSessions.hostUserId, ctx.user.id)))
        .orderBy(desc(sonoQuizSessions.createdAt))
        .limit(20);
      return sessions;
    }),

  /** Admin: create a new user account (if needed) and send them a quiz invitation email */
  createAndInviteQuizUser: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.user.id);
      const db = (await getDb())!;
      // Find or create user
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${input.email})`).limit(1);
      let userId: number;
      let isNewUser = false;
      if (existing) {
        userId = existing.id;
        // Backfill openId for existing users created without one.
        // Without openId the magic-link session lookup fails and the user can never log in.
        const [existingFull] = await db.select({ openId: users.openId }).from(users)
          .where(eq(users.id, userId)).limit(1);
        if (!existingFull?.openId) {
          const generatedOpenId = `email:${input.email.toLowerCase().trim()}`;
          await db.update(users).set({ openId: generatedOpenId }).where(eq(users.id, userId));
        }
      } else {
        // New user: use stable email-based openId so magic link login works immediately
        const openId = `email:${input.email.toLowerCase().trim()}`;
        const [inserted] = await db.insert(users).values({
          openId,
          name: input.name,
          displayName: input.name,
          email: input.email,
          role: "user",
        }).$returningId();
        userId = inserted.id;
        isNewUser = true;
      }
      // Get quiz details
      const [quiz] = await db.select({ title: sonoQuizzes.title }).from(sonoQuizzes)
        .where(eq(sonoQuizzes.id, input.quizId)).limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
      // Send invitation email asynchronously
      void (async () => {
        try {
          const { sendQuizAccessEmail } = await import("../lib/enrollmentEmail");
          await sendQuizAccessEmail({
            to: { name: input.name, email: input.email },
            quizTitle: quiz.title,
          });
        } catch (e) {
          console.error("[quiz-invite-email] Failed:", e);
        }
      })();
      return { userId, isNewUser };
    }),
});
