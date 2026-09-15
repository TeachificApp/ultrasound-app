/**
 * ensureFreeMembership.ts
 *
 * Silently enrolls a user in the Free Membership plan.
 * Idempotent — safe to call multiple times for the same user.
 * Never sends a welcome email.
 */
import { and, eq, or, isNull, asc } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { getDb } from "../db";
import { membershipPlans, membershipSubscriptions } from "../../drizzle/schema";

const DEFAULT_FREE_SLUG = "free";
const SLUG_ALIASES = ["free", "free-membership", "free_membership"];

const ensuredUserIds = new Set<number>();
const inFlight = new Set<number>();

export async function resolveFreeMembershipPlanId(
  db: MySql2Database<typeof schema>,
): Promise<number | null> {
  const configuredSlug = process.env.FREE_MEMBERSHIP_PLAN_SLUG?.trim();
  const slugCandidates = [
    ...(configuredSlug ? [configuredSlug] : []),
    ...SLUG_ALIASES,
  ];

  for (const slug of slugCandidates) {
    const [plan] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(and(eq(membershipPlans.slug, slug), eq(membershipPlans.status, "published")))
      .limit(1);
    if (plan) return plan.id;
  }

  const [fallback] = await db
    .select({ id: membershipPlans.id })
    .from(membershipPlans)
    .where(and(
      eq(membershipPlans.status, "published"),
      or(isNull(membershipPlans.stripePriceId), eq(membershipPlans.stripePriceId, "")),
      eq(membershipPlans.price, "0.00"),
    ))
    .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.id))
    .limit(1);

  return fallback?.id ?? null;
}

/** Fire-and-forget; deduped per process so login storms stay cheap. */
export function scheduleEnsureFreeMembership(userId: number): void {
  if (!Number.isInteger(userId) || userId < 1) return;
  if (ensuredUserIds.has(userId) || inFlight.has(userId)) return;
  inFlight.add(userId);
  void ensureFreeMembership(userId)
    .then(() => {
      ensuredUserIds.add(userId);
    })
    .catch(() => {
      /* allow retry on next session if DB/plan was temporarily unavailable */
    })
    .finally(() => {
      inFlight.delete(userId);
    });
}

/**
 * Silently enroll a user in the Free Membership plan.
 * Idempotent — safe to call multiple times. Never sends welcome email.
 */
export async function ensureFreeMembership(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const planId = await resolveFreeMembershipPlanId(db);
    if (!planId) {
      console.warn("[ensureFreeMembership] No published free membership plan found — skipping");
      return;
    }

    const [existingSub] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(and(
        eq(membershipSubscriptions.userId, userId),
        eq(membershipSubscriptions.planId, planId),
      ))
      .limit(1);

    if (existingSub) return;

    await db.insert(membershipSubscriptions).values({
      planId,
      userId,
      status: "active",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      currentPeriodEnd: null,
    });

    try {
      const { fulfillMembershipPlanAccess } = await import("./membershipFulfillment");
      await fulfillMembershipPlanAccess(db as any, userId, planId, {
        sessionId: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
      });
    } catch (fulfillErr) {
      console.error(`[ensureFreeMembership] fulfillMembershipPlanAccess failed for user ${userId}:`, fulfillErr);
    }

    console.log(`[ensureFreeMembership] Enrolled user ${userId} in Free Membership (plan ${planId})`);
  } catch (err) {
    console.error(`[ensureFreeMembership] Error for user ${userId}:`, err);
    throw err;
  }
}
