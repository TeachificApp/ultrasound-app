/**
 * leaderboardRouter.ts
 *
 * Handles all points and leaderboard functionality:
 * - awardPoints: internal helper called from other routers
 * - getLeaderboard: top users by total/category points with period filter
 * - getMyPoints: authenticated user's totals and recent activity
 * - getUserPointHistory: admin view of any user's full activity log
 * - adminAdjustPoints: admin manual point adjustment
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userPointsLog, userPointsTotals, users } from "../../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateVirtualLeaderboard } from "../leaderboardSeed";

// ─── Point values ─────────────────────────────────────────────────────────────
export const POINTS = {
  daily_challenge_correct: 10,
  daily_challenge_streak: 5,
  case_submission: 25,
  case_approved: 50,
  flashcard_session: 5,
  flashcard_card_viewed: 1,
  admin_adjustment: 0,
} as const;

export type ActivityType = keyof typeof POINTS;

// ─── Internal helper (called from other routers) ──────────────────────────────
export async function awardPoints(params: {
  userId: number;
  activityType: ActivityType;
  points?: number;
  referenceId?: number;
  referenceType?: string;
  note?: string;
}) {
  const pts = params.points ?? POINTS[params.activityType];
  if (pts === 0 && params.activityType !== "admin_adjustment") return;

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  await db.insert(userPointsLog).values({
    userId: params.userId,
    points: pts,
    activityType: params.activityType,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    note: params.note,
  });

  const isChallengeActivity = params.activityType.startsWith("daily_challenge");
  const isCaseActivity = params.activityType.startsWith("case");
  const isFlashcardActivity = params.activityType.startsWith("flashcard");

  await db.execute(sql`
    INSERT INTO userPointsTotals (userId, totalPoints, challengePoints, casePoints, flashcardPoints)
    VALUES (
      ${params.userId},
      ${pts},
      ${isChallengeActivity ? pts : 0},
      ${isCaseActivity ? pts : 0},
      ${isFlashcardActivity ? pts : 0}
    )
    ON DUPLICATE KEY UPDATE
      totalPoints = totalPoints + ${pts},
      challengePoints = challengePoints + ${isChallengeActivity ? pts : 0},
      casePoints = casePoints + ${isCaseActivity ? pts : 0},
      flashcardPoints = flashcardPoints + ${isFlashcardActivity ? pts : 0}
  `);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const leaderboardRouter = router({
  getLeaderboard: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        category: z.enum(["total", "challenge", "case", "flashcard"]).default("total"),
        period: z.enum(["all_time", "this_month", "this_week"]).default("all_time"),
      })
    )
    .query(async ({ input }) => {
      const { limit, category, period } = input;
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (period !== "all_time") {
        const now = new Date();
        const cutoff =
          period === "this_week"
            ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            : new Date(now.getFullYear(), now.getMonth(), 1);

        let activityFilter = sql`1=1`;
        if (category === "challenge") {
          activityFilter = sql`${userPointsLog.activityType} LIKE 'daily_challenge%'`;
        } else if (category === "case") {
          activityFilter = sql`${userPointsLog.activityType} LIKE 'case%'`;
        } else if (category === "flashcard") {
          activityFilter = sql`${userPointsLog.activityType} LIKE 'flashcard%'`;
        }

        const rows = await db
          .select({
            userId: userPointsLog.userId,
            periodPoints: sql<number>`SUM(${userPointsLog.points})`,
            displayName: users.displayName,
            name: users.name,
            avatarUrl: users.avatarUrl,
            credentials: users.credentials,
          })
          .from(userPointsLog)
          .innerJoin(users, eq(userPointsLog.userId, users.id))
          .where(and(gte(userPointsLog.createdAt, cutoff), activityFilter))
          .groupBy(
            userPointsLog.userId,
            users.displayName,
            users.name,
            users.avatarUrl,
            users.credentials
          )
          .orderBy(desc(sql`SUM(${userPointsLog.points})`))
          .limit(limit);

          const realEntries = rows.map((r) => ({
          rank: 0,
          userId: String(r.userId),
          displayName: r.displayName || r.name || "Anonymous",
          avatarUrl: r.avatarUrl,
          credentials: r.credentials,
          points: r.periodPoints ?? 0,
          isVirtual: false as const,
        }));

        // Merge with virtual entries, real users always shown, virtual fill the rest
        const virtualPeriod = period === "this_week" ? "7d" : "30d";
        const virtual = generateVirtualLeaderboard(1200, virtualPeriod).map((v) => ({
          rank: 0,
          userId: v.userId,
          displayName: v.displayName,
          avatarUrl: null,
          credentials: v.credentials,
          // Use pre-computed per-category points (single-point flashcard events only count in flashcard/overall)
          points: category === "challenge" ? v.challengePoints
                : category === "case" ? v.casePoints
                : category === "flashcard" ? v.flashcardPoints
                : v.points,
          isVirtual: true as const,
        }));

        const realUserIds = new Set(realEntries.map((r) => r.userId));
        const merged = [
          ...realEntries,
          ...virtual.filter((v) => !realUserIds.has(v.userId)),
        ]
          .sort((a, b) => b.points - a.points)
          .slice(0, limit)
          .map((e, i) => ({ ...e, rank: i + 1 }));

        return merged;
      }

      const pointsCol =
        category === "challenge"
          ? userPointsTotals.challengePoints
          : category === "case"
          ? userPointsTotals.casePoints
          : category === "flashcard"
          ? userPointsTotals.flashcardPoints
          : userPointsTotals.totalPoints;

      const rows = await db
        .select({
          userId: userPointsTotals.userId,
          points: pointsCol,
          displayName: users.displayName,
          name: users.name,
          avatarUrl: users.avatarUrl,
          credentials: users.credentials,
        })
        .from(userPointsTotals)
        .innerJoin(users, eq(userPointsTotals.userId, users.id))
        .orderBy(desc(pointsCol))
        .limit(limit);

      const realEntries = rows.map((r) => ({
        rank: 0,
        userId: String(r.userId),
        displayName: r.displayName || r.name || "Anonymous",
        avatarUrl: r.avatarUrl,
        credentials: r.credentials,
        points: r.points ?? 0,
        isVirtual: false as const,
      }));

      // Merge with virtual entries for all_time view
      const virtual = generateVirtualLeaderboard(1200, "allTime").map((v) => ({
        rank: 0,
        userId: v.userId,
        displayName: v.displayName,
        avatarUrl: null,
        credentials: v.credentials,
        // Use pre-computed per-category points (single-point flashcard events only count in flashcard/overall)
        points: category === "challenge" ? v.challengePoints
              : category === "case" ? v.casePoints
              : category === "flashcard" ? v.flashcardPoints
              : v.points,
        isVirtual: true as const,
      }));

      const realUserIds = new Set(realEntries.map((r) => r.userId));
      const merged = [
        ...realEntries,
        ...virtual.filter((v) => !realUserIds.has(v.userId)),
      ]
        .sort((a, b) => b.points - a.points)
        .slice(0, limit)
        .map((e, i) => ({ ...e, rank: i + 1 }));

      return merged;
    }),

  getMyPoints: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [totals] = await db
      .select()
      .from(userPointsTotals)
      .where(eq(userPointsTotals.userId, userId));

    const recentActivity = await db
      .select()
      .from(userPointsLog)
      .where(eq(userPointsLog.userId, userId))
      .orderBy(desc(userPointsLog.createdAt))
      .limit(20);

    const [rankRow] = await db
      .select({ rank: sql<number>`COUNT(*) + 1` })
      .from(userPointsTotals)
      .where(sql`totalPoints > ${totals?.totalPoints ?? 0}`);

    return {
      totals: totals ?? {
        userId,
        totalPoints: 0,
        challengePoints: 0,
        casePoints: 0,
        flashcardPoints: 0,
        updatedAt: new Date(),
      },
      rank: rankRow?.rank ?? 1,
      recentActivity,
    };
  }),

  getUserPointHistory: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [totals] = await db
        .select()
        .from(userPointsTotals)
        .where(eq(userPointsTotals.userId, input.userId));

      const activity = await db
        .select()
        .from(userPointsLog)
        .where(eq(userPointsLog.userId, input.userId))
        .orderBy(desc(userPointsLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(userPointsLog)
        .where(eq(userPointsLog.userId, input.userId));

      return {
        totals: totals ?? {
          userId: input.userId,
          totalPoints: 0,
          challengePoints: 0,
          casePoints: 0,
          flashcardPoints: 0,
          updatedAt: new Date(),
        },
        activity,
        total: countRow?.count ?? 0,
      };
    }),

  adminAdjustPoints: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        points: z.number(),
        note: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await awardPoints({
        userId: input.userId,
        activityType: "admin_adjustment",
        points: input.points,
        note: input.note,
      });

      return { success: true };
    }),
});
