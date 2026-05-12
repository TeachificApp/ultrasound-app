/**
 * Sharing Monitor Router
 * Admin-only procedures for viewing and managing account sharing abuse flags.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ipAccessLogs, sharingAbuseFlags, users } from "../../drizzle/schema";
import { eq, and, gte, desc, sql, inArray } from "drizzle-orm";
import { runSharingMonitor } from "../jobs/sharingMonitor";

function assertAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

export const sharingMonitorRouter = router({
  /** Get all abuse flags with user info */
  getFlags: protectedProcedure
    .input(z.object({
      status: z.enum(["flagged", "confirmed", "dismissed", "warned", "all"]).default("all"),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(sharingAbuseFlags.status, input.status));
      }

      const flags = await db
        .select({
          id: sharingAbuseFlags.id,
          userId: sharingAbuseFlags.userId,
          status: sharingAbuseFlags.status,
          distinctIpCount: sharingAbuseFlags.distinctIpCount,
          ipAddresses: sharingAbuseFlags.ipAddresses,
          detectionReason: sharingAbuseFlags.detectionReason,
          alertSentAt: sharingAbuseFlags.alertSentAt,
          reviewedAt: sharingAbuseFlags.reviewedAt,
          reviewedBy: sharingAbuseFlags.reviewedBy,
          notes: sharingAbuseFlags.notes,
          createdAt: sharingAbuseFlags.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(sharingAbuseFlags)
        .leftJoin(users, eq(users.id, sharingAbuseFlags.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sharingAbuseFlags.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(sharingAbuseFlags)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { flags, total: countResult?.total ?? 0 };
    }),

  /** Get IP access history for a specific user */
  getUserIpHistory: protectedProcedure
    .input(z.object({
      userId: z.number(),
      days: z.number().int().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const logs = await db
        .select()
        .from(ipAccessLogs)
        .where(
          and(
            eq(ipAccessLogs.userId, input.userId),
            gte(ipAccessLogs.accessedAt, since)
          )
        )
        .orderBy(desc(ipAccessLogs.accessedAt))
        .limit(200);

      // Aggregate by IP
      const ipSummary = await db
        .select({
          ip: ipAccessLogs.ipAddress,
          count: sql<number>`COUNT(*)`.as("cnt"),
          firstSeen: sql<string>`MIN(${ipAccessLogs.accessedAt})`.as("first_seen"),
          lastSeen: sql<string>`MAX(${ipAccessLogs.accessedAt})`.as("last_seen"),
        })
        .from(ipAccessLogs)
        .where(
          and(
            eq(ipAccessLogs.userId, input.userId),
            gte(ipAccessLogs.accessedAt, since)
          )
        )
        .groupBy(ipAccessLogs.ipAddress)
        .orderBy(desc(sql`COUNT(*)`));

      return { logs, ipSummary };
    }),

  /** Update flag status (confirm, dismiss, warn) */
  updateFlagStatus: protectedProcedure
    .input(z.object({
      flagId: z.number(),
      status: z.enum(["confirmed", "dismissed", "warned"]),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(sharingAbuseFlags)
        .set({
          status: input.status,
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          notes: input.notes ?? null,
        })
        .where(eq(sharingAbuseFlags.id, input.flagId));

      return { success: true };
    }),

  /** Get dashboard stats */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [flagged] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "flagged"));
    const [confirmed] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "confirmed"));
    const [warned] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "warned"));
    const [dismissed] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharingAbuseFlags).where(eq(sharingAbuseFlags.status, "dismissed"));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentLogs] = await db.select({ count: sql<number>`COUNT(*)` }).from(ipAccessLogs).where(gte(ipAccessLogs.accessedAt, sevenDaysAgo));
    const [uniqueUsers] = await db.select({ count: sql<number>`COUNT(DISTINCT ${ipAccessLogs.userId})` }).from(ipAccessLogs).where(gte(ipAccessLogs.accessedAt, sevenDaysAgo));

    return {
      flagged: flagged?.count ?? 0,
      confirmed: confirmed?.count ?? 0,
      warned: warned?.count ?? 0,
      dismissed: dismissed?.count ?? 0,
      recentAccessLogs: recentLogs?.count ?? 0,
      uniqueUsersTracked: uniqueUsers?.count ?? 0,
    };
  }),

  /** Manually trigger a scan */
  triggerScan: protectedProcedure.mutation(async ({ ctx }) => {
    assertAdmin(ctx);
    // Run in background
    runSharingMonitor().catch(err => console.error("[SharingMonitor] Manual scan failed:", err));
    return { started: true };
  }),
});
