/**
 * thinkificCancellationAudit.ts — Thinkific Cancellation Safety Net
 *
 * Runs every 6 hours. Checks for Thinkific subscriptions that have been
 * cancelled or expired and revokes platform access for affected users.
 *
 * This is a safety net for missed webhook events — the primary revocation
 * path is the Thinkific webhook (subscription.cancelled). This job catches
 * any cases where the webhook was not delivered or processed.
 *
 * Rules:
 * - Does NOT create new accounts (new user creation is handled by webhooks only)
 * - Only revokes premium_user / diy_user / diy_admin roles for users whose
 *   Thinkific subscription has been cancelled or whose enrollment has expired
 * - Idempotent: safe to run multiple times
 * - Logs all revocations to the console for audit purposes
 */
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { setPremiumStatus, removeRole } from "../db";

let auditIntervalId: ReturnType<typeof setInterval> | null = null;

/** How often to run the audit (every 6 hours) */
const AUDIT_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Run one cancellation audit pass.
 * Finds users with premium/DIY roles whose Thinkific subscription is cancelled/expired
 * and revokes their platform access.
 */
export async function runThinkificMemberSync(): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[ThinkificAudit] DB unavailable — skipping audit");
    return { total: 0, created: 0, skipped: 0, errors: 0 };
  }

  console.log("[ThinkificAudit] Starting cancellation audit…");

  let checked = 0;
  let revoked = 0;
  let errors = 0;

  try {
    // Find users who have a thinkificUserId and are marked as premium
    // These are the users we need to verify are still subscribed
    const premiumUsers = await db
      .select({
        id: users.id,
        email: users.email,
        thinkificUserId: users.thinkificUserId,
        isPremium: users.isPremium,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.thinkificUserId),
          eq(users.isPremium, true),
          eq(users.isDemo, false),
          eq(users.isPending, false),
        )
      )
      .limit(500); // Process at most 500 per run to stay memory-efficient

    console.log(`[ThinkificAudit] Checking ${premiumUsers.length} premium users with Thinkific IDs…`);

    for (const user of premiumUsers) {
      checked++;
      if (!user.thinkificUserId) continue;

      try {
        // Dynamically import to avoid loading Thinkific API on every startup
        const { getEnrollmentsByUserId } = await import("../thinkific");
        const enrollments = await getEnrollmentsByUserId(user.thinkificUserId);

        // Check if user has any active premium enrollment
        const hasPremiumAccess = enrollments.some(
          (e) =>
            !e.expired &&
            (e.expiry_date === null || new Date(e.expiry_date) > new Date()) &&
            (
              e.course_name?.toLowerCase().includes("premium") ||
              e.course_name?.toLowerCase().includes("all about ultrasound app") ||
              e.course_name?.toLowerCase().includes("iheartecho app")
            )
        );

        if (!hasPremiumAccess) {
          console.log(`[ThinkificAudit] Revoking premium access from ${user.email} (userId=${user.id}) — no active premium enrollment found`);
          await setPremiumStatus(user.id, false, "thinkific_audit");
          revoked++;
        }
      } catch (err) {
        // 401 means Thinkific credentials are invalid — stop the whole run
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.includes("Authentication")) {
          console.error("[ThinkificAudit] Thinkific API authentication failed — stopping audit. Check THINKIFIC_API_KEY.");
          break;
        }
        console.error(`[ThinkificAudit] Error checking user ${user.id} (${user.email}):`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error("[ThinkificAudit] Fatal error during audit:", err);
    errors++;
  }

  // Suggest GC after audit to reclaim memory promptly
  if (typeof global.gc === "function") {
    try { global.gc(); } catch (_) { /* ignore */ }
  }

  console.log(
    `[ThinkificAudit] Audit complete: ${checked} checked, ${revoked} revoked, ${errors} errors`,
  );

  // Return in the same shape as the old sync for backward compat with callers
  return { total: checked, created: 0, skipped: checked - revoked - errors, errors };
}

/**
 * Start the recurring Thinkific cancellation audit job.
 * Runs after a 5-minute delay on startup, then every 6 hours.
 */
export function startThinkificMemberSync(): void {
  if (auditIntervalId) return; // Already running

  console.log("[ThinkificAudit] Started — cancellation audit runs every 6 hours. First run in 5 minutes.");

  setTimeout(() => {
    runThinkificMemberSync().catch(err =>
      console.error("[ThinkificAudit] Initial audit failed:", err),
    );
  }, 5 * 60 * 1000);

  auditIntervalId = setInterval(() => {
    runThinkificMemberSync().catch(err =>
      console.error("[ThinkificAudit] Periodic audit failed:", err),
    );
  }, AUDIT_INTERVAL_MS);
}

/**
 * Stub for backward compat — no longer needed since new user creation
 * is handled exclusively by Thinkific webhooks (user.signup, order.created).
 */
export async function runThinkificAccessBackfill(): Promise<{
  total: number;
  membershipGranted: number;
  communityGranted: number;
  errors: number;
}> {
  console.log("[ThinkificAudit] runThinkificAccessBackfill is a no-op — new user creation is handled by webhooks.");
  return { total: 0, membershipGranted: 0, communityGranted: 0, errors: 0 };
}
