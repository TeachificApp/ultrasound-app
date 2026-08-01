/**
 * thinkificMemberSync.ts — Daily Thinkific member import job
 *
 * Runs every 6 hours. Fetches all users from Thinkific and creates
 * pending UltrasoundAssist™ accounts for any not yet in the DB.
 *
 * Rules:
 * - NO welcome emails are sent — emails are only sent on first explicit login/registration.
 * - NO premium_user role is assigned — only base "user" role.
 * - Every synced user receives:
 *     1. Base "user" role
 *     2. Free membership plan enrollment (slug: "free")
 *     3. Community membership in the AAU | iHeartEcho™ Community (slug: "all-about-ultrasound")
 * - Existing users (pending or active) are skipped for account creation but still receive
 *   the free membership + community access if they don't already have it.
 * - The job is idempotent: safe to run multiple times.
 */
import { streamThinkificUsers } from "../thinkific";
import { getDb } from "../db";
import { users, membershipPlans, membershipSubscriptions, communityMembers, communities } from "../../drizzle/schema";
import { eq, sql, and } from "drizzle-orm";

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/** How often to run the sync (every 6 hours) */
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Slug of the free membership plan on this platform */
const FREE_MEMBERSHIP_SLUG = "free";

/** Slug of the AAU | iHeartEcho™ Community */
const AAU_COMMUNITY_SLUG = "all-about-ultrasound";

/**
 * Grant free membership + community access to a user.
 * Idempotent — safe to call multiple times for the same user.
 * Does NOT send any emails.
 */
async function grantFreeAccessToUser(userId: number): Promise<{ membership: boolean; community: boolean }> {
  const db = await getDb();
  if (!db) return { membership: false, community: false };

  let membershipGranted = false;
  let communityGranted = false;

  try {
    // ── 1. Free membership enrollment ────────────────────────────────────────
    const [plan] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, FREE_MEMBERSHIP_SLUG))
      .limit(1);

    if (plan) {
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

      if (!existingSub) {
        await db.insert(membershipSubscriptions).values({
          planId: plan.id,
          userId,
          status: "active",
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          currentPeriodEnd: null,
        });
        try {
          const { fulfillMembershipPlanAccess } = await import("../lib/membershipFulfillment");
          await fulfillMembershipPlanAccess(db as any, userId, plan.id, {
            sessionId: null,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
          });
        } catch (fulfillErr) {
          console.error(`[ThinkificSync] fulfillMembershipPlanAccess failed for user ${userId}:`, fulfillErr);
        }
        membershipGranted = true;
      }
    } else {
      console.warn(`[ThinkificSync] Free membership plan with slug "${FREE_MEMBERSHIP_SLUG}" not found — skipping membership grant`);
    }
  } catch (err) {
    console.error(`[ThinkificSync] Error granting free membership to user ${userId}:`, err);
  }

  try {
    // ── 2. Community membership ───────────────────────────────────────────────
    const [community] = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.slug, AAU_COMMUNITY_SLUG))
      .limit(1);

    if (community) {
      const [existingMember] = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, community.id),
            eq(communityMembers.userId, userId),
          ),
        )
        .limit(1);

      if (!existingMember) {
        await db.insert(communityMembers).values({
          communityId: community.id,
          userId,
          role: "member",
          memberStatus: "approved",
        });
        communityGranted = true;
      }
    } else {
      console.warn(`[ThinkificSync] Community with slug "${AAU_COMMUNITY_SLUG}" not found — skipping community grant`);
    }
  } catch (err) {
    console.error(`[ThinkificSync] Error granting community access to user ${userId}:`, err);
  }

  return { membership: membershipGranted, community: communityGranted };
}

/**
 * Run one full Thinkific → DB member sync pass.
 * Creates accounts for new Thinkific users and grants free membership + community access.
 * Returns counts of created, skipped, and errored users.
 */
export async function runThinkificMemberSync(): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[ThinkificSync] DB unavailable — skipping sync");
    return { total: 0, created: 0, skipped: 0, errors: 0 };
  }

  console.log("[ThinkificSync] Starting Thinkific member sync…");

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let total = 0;

  const { ensureUserRole } = await import("../db");

  try {
    await streamThinkificUsers(async (tUser) => {
      total++;
      if (!tUser.email) { errors++; return; }
      const normalised = tUser.email.trim().toLowerCase();

      try {
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`LOWER(${users.email}) = ${normalised}`)
          .limit(1);

        if (existing[0]) {
          // User already exists — ensure they have free access (idempotent)
          await grantFreeAccessToUser(existing[0].id);
          skipped++;
          return;
        }

        const { randomUUID } = await import("crypto");
        const syntheticOpenId = `pending_${randomUUID()}`;
        const firstName = tUser.first_name?.trim() ?? "";
        const lastName = tUser.last_name?.trim() ?? "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || normalised;

        try {
          await db.insert(users).values({
            openId: syntheticOpenId,
            email: normalised,
            name: fullName,
            isPending: true,
            pendingCreatedAt: new Date(),
            lastSignedIn: new Date(),
          });
        } catch (insertErr: unknown) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          if (msg.includes("Duplicate entry") || msg.includes("UNIQUE") || msg.includes("ER_DUP")) {
            skipped++;
            return;
          }
          throw insertErr;
        }

        const newUser = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.openId, syntheticOpenId))
          .limit(1);

        if (newUser[0]) {
          await ensureUserRole(newUser[0].id);
          await grantFreeAccessToUser(newUser[0].id);
        }

        created++;
      } catch (err) {
        console.error(`[ThinkificSync] Error processing ${normalised}:`, err);
        errors++;
      }
    });
  } catch (err) {
    console.error("[ThinkificSync] Failed to fetch users from Thinkific API:", err);
    return { total: 0, created: 0, skipped: 0, errors: 1 };
  }

  // Suggest GC after large sync to reclaim memory promptly
  if (typeof global.gc === "function") {
    try { global.gc(); } catch (_) { /* ignore */ }
  }

  console.log(
    `[ThinkificSync] Sync complete: ${created} created, ${skipped} skipped, ${errors} errors (${total} total Thinkific users)`,
  );
  return { total, created, skipped, errors };
}

/**
 * Backfill free membership + community access for ALL existing platform users.
 * Intended for one-time use to grant access to the 14,000+ existing members.
 * Does NOT create new accounts — only updates existing users.
 * Returns counts of users processed and access grants made.
 */
export async function runThinkificAccessBackfill(): Promise<{
  total: number;
  membershipGranted: number;
  communityGranted: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[ThinkificBackfill] DB unavailable — skipping backfill");
    return { total: 0, membershipGranted: 0, communityGranted: 0, errors: 0 };
  }

  console.log("[ThinkificBackfill] Starting access backfill for all existing users…");

  const BATCH_SIZE = 500;
  let offset = 0;
  let total = 0;
  let membershipGranted = 0;
  let communityGranted = 0;
  let errors = 0;

  while (true) {
    const batch = await db
      .select({ id: users.id })
      .from(users)
      .limit(BATCH_SIZE)
      .offset(offset);

    if (batch.length === 0) break;

    for (const user of batch) {
      try {
        const result = await grantFreeAccessToUser(user.id);
        if (result.membership) membershipGranted++;
        if (result.community) communityGranted++;
        total++;
      } catch (err) {
        console.error(`[ThinkificBackfill] Error processing user ${user.id}:`, err);
        errors++;
        total++;
      }
    }

    console.log(`[ThinkificBackfill] Processed ${total} users so far (membership: +${membershipGranted}, community: +${communityGranted})…`);
    offset += BATCH_SIZE;

    if (batch.length < BATCH_SIZE) break;
  }

  console.log(
    `[ThinkificBackfill] Complete: ${total} users processed, ${membershipGranted} memberships granted, ${communityGranted} community memberships granted, ${errors} errors`,
  );
  return { total, membershipGranted, communityGranted, errors };
}

/**
 * Start the recurring Thinkific member sync job.
 * Runs immediately on startup, then every 6 hours.
 */
export function startThinkificMemberSync(): void {
  if (syncIntervalId) return; // Already running

  console.log("[ThinkificSync] Started — runs every 6 hours. First run in 2 minutes.");

  setTimeout(() => {
    runThinkificMemberSync().catch(err =>
      console.error("[ThinkificSync] Initial sync failed:", err),
    );
  }, 2 * 60 * 1000);

  syncIntervalId = setInterval(() => {
    runThinkificMemberSync().catch(err =>
      console.error("[ThinkificSync] Periodic sync failed:", err),
    );
  }, SYNC_INTERVAL_MS);
}
