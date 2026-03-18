import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getFlashcards,
  getFlashcardsByCategory,
  getUserFlashcardCount,
  updateUserFlashcardCount,
  getCases,
  getCaseById,
  submitCase,
  getSoundBytes,
  getTodayChallenge,
  submitChallengeAnswer,
  getUserChallengeResponse,
  getLeaderboard,
  getUserProfile,
  updateMembershipFromThinkific,
  logThinkificEvent,
  getAdminStats,
  getAllUsers,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  createCase,
  updateCase,
  deleteCase,
  createSoundByte,
  updateSoundByte,
  deleteSoundByte,
  createDailyChallenge,
  updateDailyChallenge,
  publishCase,
} from "./db";
import { TRPCError } from "@trpc/server";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const premiumProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.membershipTier !== "premium" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Premium membership required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  flashcards: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(async ({ input }) => {
        if (input.category && input.category !== "all") {
          return getFlashcardsByCategory(input.category);
        }
        return getFlashcards();
      }),

    getDaily: protectedProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const today = new Date().toISOString().split("T")[0];
        const isPremium = user.membershipTier === "premium" || user.role === "admin";

        // Reset daily count if new day
        if (user.flashcardsDate !== today) {
          await updateUserFlashcardCount(user.id, 0, today);
          user.flashcardsToday = 0;
          user.flashcardsDate = today;
        }

        const cards = input.category && input.category !== "all"
          ? await getFlashcardsByCategory(input.category)
          : await getFlashcards();

        return {
          cards,
          usedToday: user.flashcardsToday,
          dailyLimit: isPremium ? null : 10,
          isPremium,
        };
      }),

    recordView: protectedProcedure.mutation(async ({ ctx }) => {
      const user = ctx.user;
      const today = new Date().toISOString().split("T")[0];
      const newCount = (user.flashcardsDate === today ? user.flashcardsToday : 0) + 1;
      await updateUserFlashcardCount(user.id, newCount, today);
      return { usedToday: newCount };
    }),

    // Admin
    create: adminProcedure
      .input(z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        category: z.string(),
        difficulty: z.enum(["basic", "intermediate", "advanced"]).optional(),
      }))
      .mutation(async ({ input }) => createFlashcard(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        question: z.string().optional(),
        answer: z.string().optional(),
        category: z.string().optional(),
        difficulty: z.enum(["basic", "intermediate", "advanced"]).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => updateFlashcard(input)),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteFlashcard(input.id)),
  }),

  cases: router({
    list: publicProcedure
      .input(z.object({
        category: z.string().optional(),
        caseType: z.string().optional(),
      }))
      .query(async ({ input }) => getCases(input)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getCaseById(input.id)),

    submit: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        category: z.string(),
        caseType: z.enum(["image", "video", "scenario"]),
        clinicalHistory: z.string().optional(),
        findings: z.string().optional(),
        diagnosis: z.string().optional(),
        teaching: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        submitterName: z.string().optional(),
        submitterCredentials: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => submitCase({ ...input, submittedBy: ctx.user.id })),

    // Admin
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        category: z.string(),
        caseType: z.enum(["image", "video", "scenario"]),
        clinicalHistory: z.string().optional(),
        findings: z.string().optional(),
        diagnosis: z.string().optional(),
        teaching: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        submitterName: z.string().optional(),
        submitterCredentials: z.string().optional(),
      }))
      .mutation(async ({ input }) => createCase(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        category: z.string().optional(),
        clinicalHistory: z.string().optional(),
        findings: z.string().optional(),
        diagnosis: z.string().optional(),
        teaching: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        isPublished: z.boolean().optional(),
        displayViewCount: z.number().optional(),
      }))
      .mutation(async ({ input }) => updateCase(input)),

    publish: adminProcedure
      .input(z.object({ id: z.number(), isPublished: z.boolean() }))
      .mutation(async ({ input }) => publishCase(input.id, input.isPublished)),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteCase(input.id)),
  }),

  soundbytes: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }))
      .query(async ({ input }) => getSoundBytes(input.category)),

    // Admin
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string(),
        videoUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        durationSeconds: z.number().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => createSoundByte(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        videoUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        durationSeconds: z.number().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => updateSoundByte(input)),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteSoundByte(input.id)),
  }),

  challenge: router({
    today: publicProcedure.query(async () => getTodayChallenge()),

    myResponse: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split("T")[0];
      return getUserChallengeResponse(ctx.user.id, today);
    }),

    submit: protectedProcedure
      .input(z.object({
        challengeId: z.number(),
        selectedAnswer: z.enum(["A", "B", "C", "D"]),
      }))
      .mutation(async ({ ctx, input }) =>
        submitChallengeAnswer(ctx.user.id, input.challengeId, input.selectedAnswer)
      ),

    // Admin
    create: adminProcedure
      .input(z.object({
        challengeDate: z.string(),
        question: z.string().min(1),
        optionA: z.string().min(1),
        optionB: z.string().min(1),
        optionC: z.string().min(1),
        optionD: z.string().min(1),
        correctAnswer: z.enum(["A", "B", "C", "D"]),
        explanation: z.string().min(1),
        category: z.string().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => createDailyChallenge(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        question: z.string().optional(),
        optionA: z.string().optional(),
        optionB: z.string().optional(),
        optionC: z.string().optional(),
        optionD: z.string().optional(),
        correctAnswer: z.enum(["A", "B", "C", "D"]).optional(),
        explanation: z.string().optional(),
        category: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => updateDailyChallenge(input)),
  }),

  leaderboard: router({
    list: publicProcedure.query(async () => getLeaderboard()),
  }),

  user: router({
    profile: protectedProcedure.query(async ({ ctx }) => getUserProfile(ctx.user.id)),
  }),

  admin: router({
    stats: adminProcedure.query(async () => getAdminStats()),
    users: adminProcedure.query(async () => getAllUsers()),
    updateUserTier: adminProcedure
      .input(z.object({ userId: z.number(), tier: z.enum(["free", "premium"]) }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(users).set({ membershipTier: input.tier }).where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),

  webhook: router({
    thinkific: publicProcedure
      .input(z.object({
        event: z.string(),
        payload: z.any(),
      }))
      .mutation(async ({ input }) => {
        await logThinkificEvent(input.event, input.payload);
        await updateMembershipFromThinkific(input.event, input.payload);
        return { received: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
