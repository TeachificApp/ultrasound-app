import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { adminNotifications, premiumTrialCancellationFeedback } from "../../drizzle/schema";
import { desc, eq, and, sql } from "drizzle-orm";

// Helper: verify caller is admin or platform admin
function requireAdmin(role: string, roles: string[]) {
  if (role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const adminNotificationsRouter = router({
  /** List notifications with optional source filter and pagination */
  list: protectedProcedure
    .input(
      z.object({
        source: z.string().optional(),
        unreadOnly: z.boolean().optional().default(false),
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role, ctx.user.roles ?? []);
      const conditions = [];
      if (input.source) conditions.push(eq(adminNotifications.source, input.source));
      if (input.unreadOnly) conditions.push(eq(adminNotifications.isRead, false));

      const db = await getDb();
      if (!db) return { notifications: [], total: 0, unread: 0 };

      const rows = await db
        .select()
        .from(adminNotifications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(adminNotifications.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(adminNotifications)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const [{ unread }] = await db
        .select({ unread: sql<number>`count(*)` })
        .from(adminNotifications)
        .where(eq(adminNotifications.isRead, false));

      return { notifications: rows, total: Number(total), unread: Number(unread) };
    }),

  /** Mark one notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role, ctx.user.roles ?? []);
    const db2 = await getDb();
      if (!db2) return { success: false };
      await db2
        .update(adminNotifications)
        .set({ isRead: true })
        .where(eq(adminNotifications.id, input.id));
      return { success: true };
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    requireAdmin(ctx.user.role, ctx.user.roles ?? []);
    const db2 = await getDb();
    if (!db2) return { success: false };
    await db2
        .update(adminNotifications)
        .set({ isRead: true })
        .where(eq(adminNotifications.isRead, false));
    return { success: true };
  }),

  /** Delete a single notification */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role, ctx.user.roles ?? []);
      const db2 = await getDb();
      if (!db2) return { success: false };
      await db2
        .delete(adminNotifications)
        .where(eq(adminNotifications.id, input.id));
      return { success: true };
    }),

  /** Delete all read notifications (cleanup) */
  clearRead: protectedProcedure.mutation(async ({ ctx }) => {
    requireAdmin(ctx.user.role, ctx.user.roles ?? []);
    const db2 = await getDb();
    if (!db2) return { success: false };
    await db2
        .delete(adminNotifications)
        .where(eq(adminNotifications.isRead, true));
    return { success: true };
  }),

  /** Get distinct source values for filter dropdown */
  sources: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role, ctx.user.roles ?? []);
    const db2 = await getDb();
    if (!db2) return [];
    const rows = await db2
      .selectDistinct({ source: adminNotifications.source })
      .from(adminNotifications)
      .orderBy(adminNotifications.source);
    return rows.map((r) => r.source);
  }),

  /** Aggregate administrator-only Premium trial cancellation reasons. */
  trialCancellationInsights: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role, ctx.user.roles ?? []);
    const db = await getDb();
    if (!db) return { total: 0, withComment: 0, latestAt: null, reasons: [] };

    const countExpression = sql<number>`count(*)`;
    const [summary] = await db
      .select({
        total: countExpression,
        withComment: sql<number>`sum(case when ${premiumTrialCancellationFeedback.details} is not null and trim(${premiumTrialCancellationFeedback.details}) <> '' then 1 else 0 end)`,
        latestAt: sql<Date | null>`max(${premiumTrialCancellationFeedback.createdAt})`,
      })
      .from(premiumTrialCancellationFeedback);

    const reasons = await db
      .select({
        reason: premiumTrialCancellationFeedback.reason,
        count: countExpression,
      })
      .from(premiumTrialCancellationFeedback)
      .groupBy(premiumTrialCancellationFeedback.reason)
      .orderBy(desc(countExpression), premiumTrialCancellationFeedback.reason);

    return {
      total: Number(summary?.total ?? 0),
      withComment: Number(summary?.withComment ?? 0),
      latestAt: summary?.latestAt ?? null,
      reasons: reasons.map((row) => ({ reason: row.reason, count: Number(row.count) })),
    };
  }),
});
