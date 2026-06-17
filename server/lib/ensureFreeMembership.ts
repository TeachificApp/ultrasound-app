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
export async function ensureFreeMembership(userId: number): Promise<void> {
  try {
    const db = await getDb();
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
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.userId, userId),
          eq(membershipSubscriptions.planId, plan.id),
        ),
      )
      .limit(1);

    if (existingSub) {
      // Already enrolled — nothing to do
      return;
    }

    // Insert the subscription row
    await db.insert(membershipSubscriptions).values({
      planId: plan.id,
      userId,
      status: "active",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      currentPeriodEnd: null,
    });

    // Grant plan access items (courses, downloads, etc.) — skipEmail is implicit since
    // we never call sendMembershipWelcomeEmail from here
    try {
      const { fulfillMembershipPlanAccess } = await import("./membershipFulfillment");
      await fulfillMembershipPlanAccess(db as any, userId, plan.id, {
        sessionId: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
      });
    } catch (fulfillErr) {
      console.error(`[ensureFreeMembership] fulfillMembershipPlanAccess failed for user ${userId}:`, fulfillErr);
    }

    console.log(`[ensureFreeMembership] Enrolled user ${userId} in Free Membership (plan ${plan.id})`);
  } catch (err) {
    // Fire-and-forget: log but never throw so callers are not disrupted
    console.error(`[ensureFreeMembership] Error for user ${userId}:`, err);
  }
}
