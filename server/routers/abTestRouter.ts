/**
 * abTestRouter.ts
 *
 * Server-side A/B test event tracking for the SoundBytes upgrade modal.
 *
 * Procedures:
 *  - abTest.track   — public: record an impression or click event
 *  - abTest.results — admin: get aggregated results per variant
 */
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { abTestEvents } from "../../drizzle/schema";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const abTestRouter = router({
  /**
   * Record a single A/B test event (impression or click).
   * Called from the client when the modal is shown or the CTA is clicked.
   * Fire-and-forget — errors are swallowed so they never block the UI.
   */
  track: publicProcedure
    .input(
      z.object({
        testId: z.string().max(64),
        variant: z.enum(["A", "B"]),
        event: z.enum(["impression", "click"]),
        sessionId: z.string().max(64).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) return { ok: false };
        await db.insert(abTestEvents).values({
          testId: input.testId,
          variant: input.variant,
          event: input.event,
          userId: (ctx as any).user?.id ?? null,
          sessionId: input.sessionId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          createdAt: Date.now(),
        });
        return { ok: true };
      } catch {
        // Never throw — tracking must not break the UI
        return { ok: false };
      }
    }),

  /**
   * Get aggregated A/B test results for a given testId.
   * Returns impressions, clicks, and CTR per variant.
   * Admin-only.
   */
  results: adminProcedure
    .input(z.object({ testId: z.string().max(64) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          variant: abTestEvents.variant,
          event: abTestEvents.event,
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(abTestEvents)
        .where(eq(abTestEvents.testId, input.testId))
        .groupBy(abTestEvents.variant, abTestEvents.event);

      // Aggregate into { A: { impressions, clicks, ctr }, B: { ... } }
      const agg: Record<string, { impressions: number; clicks: number; ctr: number }> = {};
      for (const row of rows) {
        if (!agg[row.variant]) agg[row.variant] = { impressions: 0, clicks: 0, ctr: 0 };
        if (row.event === "impression") agg[row.variant].impressions = row.count;
        if (row.event === "click") agg[row.variant].clicks = row.count;
      }
      // Compute CTR
      for (const v of Object.keys(agg)) {
        const { impressions, clicks } = agg[v];
        agg[v].ctr = impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
      }

      return {
        testId: input.testId,
        variants: agg,
        totalImpressions: Object.values(agg).reduce((s, v) => s + v.impressions, 0),
        totalClicks: Object.values(agg).reduce((s, v) => s + v.clicks, 0),
      };
    }),

  /**
   * List all distinct testIds that have events recorded.
   * Admin-only.
   */
  listTests: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db
      .selectDistinct({ testId: abTestEvents.testId })
      .from(abTestEvents)
      .orderBy(abTestEvents.testId);
    return rows.map((r) => r.testId);
  }),
});
