/**
 * stripeSubscriptionSync.ts
 * Heartbeat handler — runs daily to sync all active Stripe enrollment
 * subscriptions with the database, ensuring access_expires_at stays accurate
 * even if a webhook was missed.
 *
 * Grace period logic for past_due subscriptions:
 *  - Day 0 (first past_due detection): stamp payment_failed_at, send warning email, keep access
 *  - Days 1–3: keep access (Stripe retries payment during this window)
 *  - Day 4+: revoke access (set access_expires_at = now)
 *
 * Route: POST /api/scheduled/stripe-subscription-sync
 * Cron:  0 0 2 * * *  (daily at 02:00 UTC — low-traffic window)
 */
import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { getUserById } from "../db";
import { lmsEnrollments, lmsCourses, stripeSubscriptionSyncRuns, stripeSubscriptionSyncSnapshots } from "../../drizzle/schema";
import { getStripeClient } from "../lib/stripeClient";
import { notifyOwner } from "../_core/notification";
import { sendEmail, emailWrapper } from "../_core/email";
import { isNotNull, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { formatStripeSubscriptionSyncReport, isAccountAddedSincePreviousSync, type RevokedStripeAccessAccount } from "./stripeSubscriptionSyncReport";

const GRACE_PERIOD_DAYS = 3;
const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export async function stripeSubscriptionSyncHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const now = new Date();

    // ── 1. Fetch all enrollments with a direct stripeSubscriptionId ──────────
    const enrollmentsWithSub = await db
      .select({
        id: lmsEnrollments.id,
        userId: lmsEnrollments.userId,
        courseId: lmsEnrollments.courseId,
        stripeSubscriptionId: lmsEnrollments.stripeSubscriptionId,
        accessExpiresAt: lmsEnrollments.accessExpiresAt,
        paymentFailedAt: lmsEnrollments.paymentFailedAt,
      })
      .from(lmsEnrollments)
      .where(isNotNull(lmsEnrollments.stripeSubscriptionId));

    // ── 2. Fetch enrollments linked via lms_orders ───────────────────────────
    const enrollmentsViaOrder = await db.execute(sql`
      SELECT e.id, e.user_id AS userId, e.course_id AS courseId,
             o.stripe_subscription_id AS stripeSubscriptionId,
             e.access_expires_at AS accessExpiresAt,
             e.payment_failed_at AS paymentFailedAt
      FROM lms_enrollments e
      JOIN lms_orders o ON o.id = e.order_id
      WHERE o.stripe_subscription_id IS NOT NULL
        AND e.stripe_subscription_id IS NULL
    `);

    const allRows: Array<{
      id: number;
      userId: number;
      courseId: number;
      stripeSubscriptionId: string;
      accessExpiresAt: Date | null;
      paymentFailedAt: Date | null;
    }> = [
      ...enrollmentsWithSub
        .filter(r => r.stripeSubscriptionId)
        .map(r => ({
          id: r.id,
          userId: r.userId,
          courseId: r.courseId,
          stripeSubscriptionId: r.stripeSubscriptionId as string,
          accessExpiresAt: r.accessExpiresAt,
          paymentFailedAt: r.paymentFailedAt,
        })),
      ...(enrollmentsViaOrder[0] as any[]).map((r: any) => ({
        id: r.id as number,
        userId: r.userId as number,
        courseId: r.courseId as number,
        stripeSubscriptionId: r.stripeSubscriptionId as string,
        accessExpiresAt: r.accessExpiresAt ? new Date(r.accessExpiresAt) : null,
        paymentFailedAt: r.paymentFailedAt ? new Date(r.paymentFailedAt) : null,
      })),
    ];

    if (allRows.length === 0) {
      console.log("[StripeSubSync] No enrollment subscriptions to sync.");
      return res.json({ ok: true, synced: 0, errors: 0 });
    }

    const stripe = getStripeClient();
    const [previousRun] = await db.select({ id: stripeSubscriptionSyncRuns.id })
      .from(stripeSubscriptionSyncRuns).limit(1);
    const knownSnapshots = await db.select({ enrollmentId: stripeSubscriptionSyncSnapshots.enrollmentId })
      .from(stripeSubscriptionSyncSnapshots);
    const knownEnrollmentIds = new Set(knownSnapshots.map((snapshot) => snapshot.enrollmentId));
    const hasPreviousSync = Boolean(previousRun);
    let synced = 0;
    let errors = 0;
    let accessRevoked = 0;
    let accountsAdded = 0;
    let warningEmailsSent = 0;
    const revokedAccounts: RevokedStripeAccessAccount[] = [];

    const recordAccessRemoval = async (row: typeof allRows[number], reason: string) => {
      const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses)
        .where(eq(lmsCourses.id, row.courseId)).limit(1);
      const userRecord = await getUserById(row.userId);
      const displayName = [userRecord?.firstName, userRecord?.lastName].filter(Boolean).join(" ") || "Unnamed learner";
      revokedAccounts.push({ userId: row.userId, displayName, courseTitle: course?.title ?? "Course", reason });
    };

    for (const row of allRows) {
      try {
        const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId) as any;
        const status: string = sub.status; // active | past_due | canceled | unpaid | trialing | paused
        const cancelAtPeriodEnd: boolean = sub.cancel_at_period_end;
        const periodEnd: Date | null = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        let newAccessExpiresAt: Date | null = row.accessExpiresAt;
        let newPaymentFailedAt: Date | null = row.paymentFailedAt;

        if (status === "past_due" || status === "unpaid") {
          if (!row.paymentFailedAt) {
            // First time we see this subscription as past_due — stamp the timestamp
            newPaymentFailedAt = now;

            // Send a payment-failed warning email to the subscriber
            try {
              const userRecord = await getUserById(row.userId);
              if (userRecord?.email) {
                // Fetch course title for the email
                const courseRows = await db
                  .select({ title: lmsCourses.title })
                  .from(lmsCourses)
                  .where(eq(lmsCourses.id, row.courseId))
                  .limit(1);
                const courseTitle = courseRows[0]?.title ?? "your course";

                const htmlBody = emailWrapper(`
                  <h2 style="color:#0f766e;margin:0 0 16px">Payment Unsuccessful</h2>
                  <p>Hi ${userRecord.firstName || "there"},</p>
                  <p>We were unable to process your payment for <strong>${courseTitle}</strong>. Your access has been maintained while we retry the payment over the next <strong>${GRACE_PERIOD_DAYS} days</strong>.</p>
                  <p>To avoid losing access, please update your payment method:</p>
                  <div style="text-align:center;margin:24px 0">
                    <a href="https://app.allaboutultrasound.com/my-dashboard?tab=subscriptions"
                       style="background:#0f766e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
                      Update Payment Method
                    </a>
                  </div>
                  <p style="color:#6b7280;font-size:13px">If payment is not resolved within ${GRACE_PERIOD_DAYS} days, your access to <strong>${courseTitle}</strong> will be suspended. You can reactivate at any time by updating your billing information.</p>
                  <p>If you have any questions, please contact us at <a href="mailto:support@allaboutultrasound.com">support@allaboutultrasound.com</a>.</p>
                `);

                const emailSent = await sendEmail({
                  to: { name: `${userRecord.firstName ?? ""} ${userRecord.lastName ?? ""}`.trim() || userRecord.email, email: userRecord.email },
                  subject: "Action Required: Payment Unsuccessful — Update Your Payment Method",
                  htmlBody,
                  previewText: `Your payment for ${courseTitle} was unsuccessful. Update your payment method to keep access.`,
                });
                if (emailSent) {
                  warningEmailsSent++;
                } else {
                  console.warn(`[StripeSubSync] Warning email returned false for enrollment ${row.id} (user ${row.userId})`);
                }
              }
            } catch (emailErr: any) {
              console.warn(`[StripeSubSync] Warning email failed for enrollment ${row.id}:`, emailErr?.message);
            }

            // Keep access during grace period — do not set accessExpiresAt yet
            newAccessExpiresAt = null; // clear any stale expiry
          } else {
            // Already past_due — check if grace period has elapsed
            const gracePeriodEnd = new Date(row.paymentFailedAt.getTime() + GRACE_PERIOD_MS);
            if (now >= gracePeriodEnd) {
              // Grace period expired — revoke access
              newAccessExpiresAt = gracePeriodEnd; // set to when grace period ended
              if (!row.accessExpiresAt || row.accessExpiresAt > now) {
                accessRevoked++;
                await recordAccessRemoval(row, "Grace period expired");
                console.log(`[StripeSubSync] Grace period expired for enrollment ${row.id} — revoking access`);
              }
            } else {
              // Still within grace period — keep access
              newAccessExpiresAt = null;
            }
          }
        } else if (status === "canceled") {
          // Subscription fully canceled — revoke access at period end
          newAccessExpiresAt = periodEnd ?? now;
          newPaymentFailedAt = null; // clear grace period flag
          if (!row.accessExpiresAt || row.accessExpiresAt > (periodEnd ?? now)) {
            accessRevoked++;
            await recordAccessRemoval(row, "Subscription canceled");
          }
        } else if (cancelAtPeriodEnd && periodEnd) {
          // Scheduled to cancel — set access expiry to period end
          newAccessExpiresAt = periodEnd;
          newPaymentFailedAt = null; // clear any past_due flag (payment recovered)
        } else if (status === "active" || status === "trialing") {
          // Active/healthy subscription — clear any stale expiry and grace period flag
          newAccessExpiresAt = null;
          newPaymentFailedAt = null;
        }

        // Only write if something changed
        const accessChanged =
          (newAccessExpiresAt?.getTime() ?? null) !== (row.accessExpiresAt?.getTime() ?? null);
        const failedAtChanged =
          (newPaymentFailedAt?.getTime() ?? null) !== (row.paymentFailedAt?.getTime() ?? null);

        if (accessChanged || failedAtChanged) {
          await db
            .update(lmsEnrollments)
            .set({
              accessExpiresAt: newAccessExpiresAt,
              paymentFailedAt: newPaymentFailedAt,
            })
            .where(sql`id = ${row.id}`);
        }

        if (isAccountAddedSincePreviousSync({ hasPreviousSync, wasPreviouslyObserved: knownEnrollmentIds.has(row.id) })) accountsAdded++;
        await db.insert(stripeSubscriptionSyncSnapshots).values({ enrollmentId: row.id, lastSyncedAt: now })
          .onDuplicateKeyUpdate({ set: { lastSyncedAt: now } });
        synced++;
      } catch (err: any) {
        // Stripe 404 = subscription deleted/not found — revoke access immediately
        if (err?.statusCode === 404 || err?.code === "resource_missing") {
          try {
            await db
              .update(lmsEnrollments)
              .set({ accessExpiresAt: now, paymentFailedAt: null })
              .where(sql`id = ${row.id}`);
            if (!row.accessExpiresAt || row.accessExpiresAt > now) {
              accessRevoked++;
              await recordAccessRemoval(row, "Stripe subscription not found");
            }
          } catch (_) { /* ignore secondary error */ }
        } else {
          console.error(`[StripeSubSync] Error syncing enrollment ${row.id}:`, err?.message ?? err);
          errors++;
        }
      }
    }

    console.log(
      `[StripeSubSync] Done. synced=${synced} accountsAdded=${accountsAdded} errors=${errors} accessRevoked=${accessRevoked} warningEmails=${warningEmailsSent}`
    );

    await db.insert(stripeSubscriptionSyncRuns).values({
      subscriptionsChecked: allRows.length,
      accountsAdded,
      accessRevoked,
      errors,
      completedAt: now,
    });

    await notifyOwner({
      title: "Stripe Subscription Sync Report",
      content: formatStripeSubscriptionSyncReport({
        totalSubscriptions: allRows.length,
        accountsAdded,
        accessRevoked,
        revokedAccounts,
        warningEmailsSent,
        errors,
      }),
    });

    return res.json({ ok: true, total: allRows.length, synced, accountsAdded, errors, accessRevoked, revokedAccounts, warningEmailsSent });
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
