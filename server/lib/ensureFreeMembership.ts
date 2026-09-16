/**
 * ensureFreeMembership.ts
 *
 * Silently enrolls a user in the Free Membership plan (slug: "free").
 * Idempotent — safe to call multiple times for the same user.
 * Never sends a welcome email.
 *
 * Intended to be called fire-and-forget from:
 *   - upsertUser (new OAuth signups)
 *   - getOrCreateUserByEmail (new email-based signups)
 *   - fulfillMembershipPurchase (after any paid purchase, to ensure free tier is also active)
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { membershipPlans, membershipSubscriptions } from "../../drizzle/schema";

/** Slug of the free membership plan on this platform */
const FREE_MEMBERSHIP_SLUG = "free";

/**
 * Silently enroll a user in the Free Membership plan.
 * Idempotent — safe to call multiple times. Never sends welcome email.
 */
export async function ensureFreeMembership(
  userId: number,
  options: { db?: any } = {},
): Promise<void> {
  try {
    const db = options.db ?? await getDb();
    if (!db) return;

    // Look up the free plan by slug
    const [plan] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, FREE_MEMBERSHIP_SLUG))
      .limit(1);

    if (!plan) {
      console.warn(`[ensureFreeMembership] Free membership plan with slug "${FREE_MEMBERSHIP_SLUG}" not found — skipping`);
      return;
    }

    // Check if subscription already exists (idempotent)
    const [existingSub] = await db
      .select({ id: membershipSubscriptions.id, status: membershipSubscriptions.status })
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.userId, userId),
          eq(membershipSubscriptions.planId, plan.id),
        ),
      )
      .limit(1);

    let membershipChanged = false;
    if (existingSub) {
      // A Free Membership is the baseline benefit. Restore an inactive legacy row
      // without touching any paid-plan subscription or generating email.
      if (existingSub.status !== "active") {
        await db.update(membershipSubscriptions).set({
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        }).where(eq(membershipSubscriptions.id, existingSub.id));
        membershipChanged = true;
      }
    } else {
      await db.insert(membershipSubscriptions).values({
        planId: plan.id,
        userId,
        status: "active",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      membershipChanged = true;
    }

    // Always reconcile the configured access items. This is deliberately data-only:
    // neither this helper nor fulfillMembershipPlanAccess calls an item-access or
    // membership welcome email helper.
    try {
      const { fulfillMembershipPlanAccess } = await import("./membershipFulfillment");
      await fulfillMembershipPlanAccess(db as any, userId, plan.id, {
        sessionId: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        source: "membership",
      });
    } catch (fulfillErr) {
      console.error(`[ensureFreeMembership] fulfillMembershipPlanAccess failed for user ${userId}:`, fulfillErr);
    }

    if (membershipChanged) {
      console.log(`[ensureFreeMembership] Activated Free Membership for user ${userId}`);
    }
  } catch (err) {
    // Fire-and-forget: log but never throw so callers are not disrupted
    console.error(`[ensureFreeMembership] Error for user ${userId}:`, err);
  }
}
