/**
 * stripeSubscriptionSync.ts
 * Heartbeat handler — runs daily to sync all active Stripe enrollment
 * subscriptions with the database, ensuring access_expires_at and
 * cancellation state stay accurate even if a webhook was missed.
 *
 * Route: POST /api/scheduled/stripe-subscription-sync
 * Cron:  0 0 2 * * *  (daily at 02:00 UTC — low-traffic window)
 */
import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { lmsEnrollments, lmsOrders } from "../../drizzle/schema";
import { getStripeClient } from "../lib/stripeClient";
import { notifyOwner } from "../_core/notification";
import { isNotNull, or, isNull, gt } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function stripeSubscriptionSyncHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const now = new Date();

    // ── 1. Fetch all enrollments that have a direct stripeSubscriptionId ──────
    const enrollmentsWithSub = await db
      .select({
        id: lmsEnrollments.id,
        stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
        accessExpiresAt: lmsEnrollments.accessExpiresAt,
      })
      .from(lmsEnrollments)
      .where(
        isNotNull(lmsEnrollments.stripeSubscriptionId)
      );

    // ── 2. Fetch enrollments linked via lms_orders that have a subscription ──
    const enrollmentsViaOrder = await db.execute(sql`
      SELECT e.id, o.stripe_subscription_id AS stripeSubscriptionId, e.access_expires_at AS accessExpiresAt
      FROM lms_enrollments e
      JOIN lms_orders o ON o.id = e.order_id
      WHERE o.stripe_subscription_id IS NOT NULL
        AND e.stripe_subscription_id IS NULL
    `);

    const allRows: Array<{ id: number; stripeSubscriptionId: string; accessExpiresAt: Date | null }> = [
      ...enrollmentsWithSub.filter(r => r.stripeSubscriptionId).map(r => ({
        id: r.id,
        stripeSubscriptionId: r.stripeSubscriptionId as string,
        accessExpiresAt: r.accessExpiresAt,
      })),
      ...(enrollmentsViaOrder[0] as any[]).map((r: any) => ({
        id: r.id as number,
        stripeSubscriptionId: r.stripeSubscriptionId as string,
        accessExpiresAt: r.accessExpiresAt ? new Date(r.accessExpiresAt) : null,
      })),
    ];

    if (allRows.length === 0) {
      console.log("[StripeSubSync] No enrollment subscriptions to sync.");
      return res.json({ ok: true, synced: 0, errors: 0 });
    }

    const stripe = getStripeClient();
    let synced = 0;
    let errors = 0;
    let accessRevoked = 0;

    for (const row of allRows) {
      try {
        const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId) as any;
        const status: string = sub.status; // active | past_due | canceled | unpaid | trialing | paused
        const cancelAtPeriodEnd: boolean = sub.cancel_at_period_end;
        const periodEnd: Date | null = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        // Determine the correct access_expires_at:
        // - If subscription is canceled/unpaid and period has ended → set to periodEnd (access should be revoked)
        // - If cancel_at_period_end is true → set to periodEnd (access ends at period end)
        // - If active and not canceling → clear access_expires_at (ongoing access)
        let newAccessExpiresAt: Date | null = row.accessExpiresAt;

        if (status === "canceled" || status === "unpaid") {
          // Subscription ended — ensure access_expires_at is set to period end
          newAccessExpiresAt = periodEnd ?? now;
          if (!row.accessExpiresAt || row.accessExpiresAt > (periodEnd ?? now)) {
            accessRevoked++;
          }
        } else if (cancelAtPeriodEnd && periodEnd) {
          // Scheduled to cancel — set access expiry to period end
          newAccessExpiresAt = periodEnd;
        } else if (status === "active" || status === "trialing") {
          // Active subscription — clear any stale expiry
          newAccessExpiresAt = null;
        }

        // Only write if something changed
        const changed =
          (newAccessExpiresAt?.getTime() ?? null) !== (row.accessExpiresAt?.getTime() ?? null);

        if (changed) {
          await db
            .update(lmsEnrollments)
            .set({ accessExpiresAt: newAccessExpiresAt })
            .where(sql`id = ${row.id}`);
        }

        synced++;
      } catch (err: any) {
        // Stripe 404 = subscription deleted/not found — revoke access
        if (err?.statusCode === 404 || err?.code === "resource_missing") {
          try {
            await db
              .update(lmsEnrollments)
              .set({ accessExpiresAt: now })
              .where(sql`id = ${row.id}`);
            accessRevoked++;
          } catch (_) { /* ignore secondary error */ }
        } else {
          console.error(`[StripeSubSync] Error syncing enrollment ${row.id}:`, err?.message ?? err);
          errors++;
        }
      }
    }

    console.log(`[StripeSubSync] Done. synced=${synced} errors=${errors} accessRevoked=${accessRevoked}`);

    // Notify owner if any access was revoked (useful for audit trail)
    if (accessRevoked > 0) {
      await notifyOwner({
        title: "Stripe Subscription Sync — Access Revoked",
        content: `Daily sync revoked or updated access for ${accessRevoked} enrollment(s) whose Stripe subscriptions have ended or been cancelled. Total synced: ${synced}. Errors: ${errors}.`,
      });
    }

    return res.json({ ok: true, total: allRows.length, synced, errors, accessRevoked });
  } catch (err: any) {
    console.error("[StripeSubSync] Unhandled error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
