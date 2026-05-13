/**
 * Engagement Dashboard Router
 * Platform admin only — real usage metrics for flashcards, daily challenges, and case library.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserRoles } from "../db";
import { getDb } from "../db";
import {
  quickfireAttempts,
  quickfireQuestions,
  echoLibraryCaseAttempts,
  echoLibraryCases,
  caseViewEvents,
  userPointsLog,
  users,
} from "../../drizzle/schema";
import { eq, and, gte, sql, count, desc, isNull, ne, or } from "drizzle-orm";

/** Shared guard: must be owner (role=admin) or platform_admin */
async function requirePlatformAdmin(userId: number, userRole: string) {
  if (userRole === "admin") return;
  const roles = await getUserRoles(userId);
  if (!roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

/** Format YYYY-MM-DD for N days ago */
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const engagementRouter = router({
  /**
   * Platform-level overview stats + 30-day daily activity chart.
   * Returns totals and a day-by-day breakdown for the last 30 days.
   */
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx.user.id, ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const since30 = new Date();
    since30.setDate(since30.getDate() - 29);
    since30.setHours(0, 0, 0, 0);

    // ── Totals ────────────────────────────────────────────────────────────────
    const [challengeTotal] = await db
      .select({ total: count() })
      .from(quickfireAttempts)
      .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
      .where(ne(quickfireQuestions.type, "quickReview"));

    const [flashcardTotal] = await db
      .select({ total: count() })
      .from(quickfireAttempts)
      .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
      .where(eq(quickfireQuestions.type, "quickReview"));

    const [caseTotal] = await db
      .select({ total: count() })
      .from(echoLibraryCaseAttempts);

    const [caseViewTotal] = await db
      .select({ total: count() })
      .from(caseViewEvents)
      .where(eq(caseViewEvents.isAdminView, false));

    // Unique active users (any engagement ever)
    const [uniqueUsers] = await db
      .select({ total: sql<number>`COUNT(DISTINCT ${quickfireAttempts.userId})` })
      .from(quickfireAttempts);

    // ── 30-day daily chart (challenge attempts per day) ───────────────────────
    const dailyChallengeRows = await db
      .select({
        day: quickfireAttempts.setDate,
        total: count(),
        correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.isCorrect} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(quickfireAttempts)
      .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
      .where(
        and(
          ne(quickfireQuestions.type, "quickReview"),
          gte(quickfireAttempts.createdAt, since30),
        )
      )
      .groupBy(quickfireAttempts.setDate)
      .orderBy(quickfireAttempts.setDate);

    // 30-day flashcard attempts (from quickfireAttempts where type=quickReview)
    const dailyFlashcardRows = await db
      .select({
        day: sql<string>`DATE(${quickfireAttempts.createdAt})`,
        total: count(),
      })
      .from(quickfireAttempts)
      .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
      .where(
        and(
          eq(quickfireQuestions.type, "quickReview"),
          gte(quickfireAttempts.createdAt, since30),
        )
      )
      .groupBy(sql`DATE(${quickfireAttempts.createdAt})`)
      .orderBy(sql`DATE(${quickfireAttempts.createdAt})`);

    // 30-day case views
    const dailyCaseViewRows = await db
      .select({
        day: sql<string>`DATE(${caseViewEvents.viewedAt})`,
        total: count(),
      })
      .from(caseViewEvents)
      .where(
        and(
          eq(caseViewEvents.isAdminView, false),
          gte(caseViewEvents.viewedAt, since30),
        )
      )
      .groupBy(sql`DATE(${caseViewEvents.viewedAt})`)
      .orderBy(sql`DATE(${caseViewEvents.viewedAt})`);

    return {
      totals: {
        challengeAttempts: challengeTotal?.total ?? 0,
        flashcardAttempts: flashcardTotal?.total ?? 0,
        caseAttempts: caseTotal?.total ?? 0,
        caseViews: caseViewTotal?.total ?? 0,
        uniqueActiveUsers: uniqueUsers?.total ?? 0,
      },
      dailyChallenge: dailyChallengeRows.map((r) => ({
        day: r.day,
        total: Number(r.total),
        correct: Number(r.correct),
      })),
      dailyFlashcard: dailyFlashcardRows.map((r) => ({
        day: r.day,
        total: Number(r.total),
      })),
      dailyCaseViews: dailyCaseViewRows.map((r) => ({
        day: r.day,
        total: Number(r.total),
      })),
    };
  }),

  /**
   * Per-member engagement summary table.
   * Returns one row per user with their activity counts and last-active date.
   * Sorted by most recently active first.
   */
  getMemberList: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).default(100),
      offset: z.number().int().min(0).default(0),
      search: z.string().max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get users with at least one engagement event, plus search filter
      const userRows = await db
        .select({
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          email: users.email,
          isPremium: users.isPremium,
          isDemo: users.isDemo,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .where(
          and(
            or(isNull(users.isPending), eq(users.isPending, false)),
            input.search
              ? sql`(${users.name} LIKE ${`%${input.search}%`} OR ${users.email} LIKE ${`%${input.search}%`} OR ${users.displayName} LIKE ${`%${input.search}%`})`
              : undefined,
          )
        )
        .orderBy(desc(users.lastSignedIn))
        .limit(input.limit)
        .offset(input.offset);

      if (userRows.length === 0) return { members: [], total: 0 };

      const userIds = userRows.map((u) => u.id);

      // Challenge attempts per user
      const challengeCounts = await db
        .select({
          userId: quickfireAttempts.userId,
          total: count(),
          correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.isCorrect} = 1 THEN 1 ELSE 0 END)`,
          lastDate: sql<string>`MAX(${quickfireAttempts.setDate})`,
        })
        .from(quickfireAttempts)
        .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
        .where(
          and(
            ne(quickfireQuestions.type, "quickReview"),
            sql`${quickfireAttempts.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
          )
        )
        .groupBy(quickfireAttempts.userId);

      // Flashcard attempts per user
      const flashcardCounts = await db
        .select({
          userId: quickfireAttempts.userId,
          total: count(),
          lastDate: sql<string>`MAX(${quickfireAttempts.createdAt})`,
        })
        .from(quickfireAttempts)
        .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
        .where(
          and(
            eq(quickfireQuestions.type, "quickReview"),
            sql`${quickfireAttempts.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
          )
        )
        .groupBy(quickfireAttempts.userId);

      // Case completions per user
      const caseCounts = await db
        .select({
          userId: echoLibraryCaseAttempts.userId,
          total: count(),
          lastDate: sql<string>`MAX(${echoLibraryCaseAttempts.completedAt})`,
        })
        .from(echoLibraryCaseAttempts)
        .where(
          sql`${echoLibraryCaseAttempts.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`
        )
        .groupBy(echoLibraryCaseAttempts.userId);

      // Build lookup maps
      const challengeMap = new Map(challengeCounts.map((r) => [r.userId, r]));
      const flashcardMap = new Map(flashcardCounts.map((r) => [r.userId, r]));
      const caseMap = new Map(caseCounts.map((r) => [r.userId, r]));

      const members = userRows.map((u) => {
        const ch = challengeMap.get(u.id);
        const fl = flashcardMap.get(u.id);
        const ca = caseMap.get(u.id);
        return {
          id: u.id,
          name: u.displayName || u.name || "Unknown",
          email: u.email ?? "",
          isPremium: u.isPremium,
          isDemo: u.isDemo,
          joinedAt: u.createdAt,
          lastSignedIn: u.lastSignedIn,
          challengeAttempts: Number(ch?.total ?? 0),
          challengeCorrect: Number(ch?.correct ?? 0),
          challengeLastDate: ch?.lastDate ?? null,
          flashcardAttempts: Number(fl?.total ?? 0),
          flashcardLastDate: fl?.lastDate ?? null,
          caseCompletions: Number(ca?.total ?? 0),
          caseLastDate: ca?.lastDate ?? null,
          totalEngagements: Number(ch?.total ?? 0) + Number(fl?.total ?? 0) + Number(ca?.total ?? 0),
        };
      });

      // Total count for pagination
      const [totalRow] = await db.select({ total: count() }).from(users);

      return { members, total: totalRow?.total ?? 0 };
    }),

  /**
   * Full activity drill-down for a single user.
   */
  getMemberDrilldown: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // User profile
      const [userRow] = await db
        .select({
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          email: users.email,
          isPremium: users.isPremium,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // Challenge attempts (last 90 days, grouped by date)
      const challengeByDay = await db
        .select({
          day: quickfireAttempts.setDate,
          total: count(),
          correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.isCorrect} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(quickfireAttempts)
        .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
        .where(
          and(
            eq(quickfireAttempts.userId, input.userId),
            ne(quickfireQuestions.type, "quickReview"),
          )
        )
        .groupBy(quickfireAttempts.setDate)
        .orderBy(desc(quickfireAttempts.setDate))
        .limit(90);

      // Flashcard attempts grouped by date
      const flashcardByDay = await db
        .select({
          day: sql<string>`DATE(${quickfireAttempts.createdAt})`,
          total: count(),
          correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.selfMarkedCorrect} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(quickfireAttempts)
        .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
        .where(
          and(
            eq(quickfireAttempts.userId, input.userId),
            eq(quickfireQuestions.type, "quickReview"),
          )
        )
        .groupBy(sql`DATE(${quickfireAttempts.createdAt})`)
        .orderBy(desc(sql`DATE(${quickfireAttempts.createdAt})`))
        .limit(90);

      // Case completions (last 50)
      const caseCompletions = await db
        .select({
          id: echoLibraryCaseAttempts.id,
          caseId: echoLibraryCaseAttempts.caseId,
          score: echoLibraryCaseAttempts.score,
          totalQuestions: echoLibraryCaseAttempts.totalQuestions,
          completedAt: echoLibraryCaseAttempts.completedAt,
          caseTitle: echoLibraryCases.title,
          modality: echoLibraryCases.modality,
          difficulty: echoLibraryCases.difficulty,
        })
        .from(echoLibraryCaseAttempts)
        .innerJoin(echoLibraryCases, eq(echoLibraryCaseAttempts.caseId, echoLibraryCases.id))
        .where(eq(echoLibraryCaseAttempts.userId, input.userId))
        .orderBy(desc(echoLibraryCaseAttempts.completedAt))
        .limit(50);

      // Points log (last 50 events)
      const pointsHistory = await db
        .select({
          id: userPointsLog.id,
          points: userPointsLog.points,
          activityType: userPointsLog.activityType,
          note: userPointsLog.note,
          createdAt: userPointsLog.createdAt,
        })
        .from(userPointsLog)
        .where(eq(userPointsLog.userId, input.userId))
        .orderBy(desc(userPointsLog.createdAt))
        .limit(50);

      // Summary totals
      const [challengeSummary] = await db
        .select({
          total: count(),
          correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.isCorrect} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(quickfireAttempts)
        .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
        .where(
          and(
            eq(quickfireAttempts.userId, input.userId),
            ne(quickfireQuestions.type, "quickReview"),
          )
        );

      const [flashcardSummary] = await db
        .select({
          total: count(),
          correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.selfMarkedCorrect} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(quickfireAttempts)
        .innerJoin(quickfireQuestions, eq(quickfireAttempts.questionId, quickfireQuestions.id))
        .where(
          and(
            eq(quickfireAttempts.userId, input.userId),
            eq(quickfireQuestions.type, "quickReview"),
          )
        );

      return {
        user: {
          id: userRow.id,
          name: userRow.displayName || userRow.name || "Unknown",
          email: userRow.email ?? "",
          isPremium: userRow.isPremium,
          joinedAt: userRow.createdAt,
          lastSignedIn: userRow.lastSignedIn,
        },
        summary: {
          challengeAttempts: Number(challengeSummary?.total ?? 0),
          challengeCorrect: Number(challengeSummary?.correct ?? 0),
          flashcardAttempts: Number(flashcardSummary?.total ?? 0),
          flashcardCorrect: Number(flashcardSummary?.correct ?? 0),
          caseCompletions: caseCompletions.length,
        },
        challengeByDay: challengeByDay.map((r) => ({
          day: r.day,
          total: Number(r.total),
          correct: Number(r.correct),
        })),
        flashcardByDay: flashcardByDay.map((r) => ({
          day: r.day,
          total: Number(r.total),
          correct: Number(r.correct),
        })),
        caseCompletions,
        pointsHistory,
      };
    }),
});
