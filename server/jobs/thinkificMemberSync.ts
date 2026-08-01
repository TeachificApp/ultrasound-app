/**
 * thinkificCancellationAudit.ts — Thinkific Cancellation Safety Net
 *
 * Runs every 6 hours. Checks for:
 *   1. Premium access revocations — users marked isPremium in DB whose Thinkific
 *      premium enrollment has expired or been cancelled
 *   2. Individual course access revocations — lmsEnrollments rows where the
 *      corresponding Thinkific enrollment has expired (sets accessExpiresAt = now)
 *
 * This is a safety net for missed webhook events — the primary revocation
 * path is the Thinkific webhook (subscription.cancelled / enrollment.updated).
 *
 * Strategy (inverse lookup — efficient):
 *   - Fetch all enrollments for each relevant Thinkific course/product (paginated)
 *   - Build a map of email → active course IDs
 *   - Cross-reference against DB users / lmsEnrollments
 *   - Revoke only what has genuinely expired
 *
 * Does NOT create new accounts — that is handled by webhooks only.
 */
import { getDb } from "../db";
import { users, lmsEnrollments, cmeCoursesCache } from "../../drizzle/schema";
import { eq, and, isNotNull, isNull, gt, or } from "drizzle-orm";
import { setPremiumStatus } from "../db";
import {
  getEnrollmentsForCourse,
  ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID,
} from "../thinkific";

let auditIntervalId: ReturnType<typeof setInterval> | null = null;

/** How often to run the audit (every 6 hours) */
const AUDIT_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Run one cancellation audit pass.
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
  const now = new Date();
  let totalChecked = 0;
  let totalRevoked = 0;
  let errors = 0;

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1: Premium access audit
  // Fetch all enrollments for the premium product → revoke isPremium for
  // users whose enrollment has expired or been cancelled.
  // ══════════════════════════════════════════════════════════════════════════
  try {
    console.log("[ThinkificAudit] Part 1: Checking premium access…");
    const premiumEnrollments = await getEnrollmentsForCourse(ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID);

    // Build set of emails with an active (non-expired) premium enrollment
    const activePremiumEmails = new Set(
      premiumEnrollments
        .filter((e) => {
          if (e.expired) return false;
          if (e.expiry_date && new Date(e.expiry_date) <= now) return false;
          return true;
        })
        .map((e) => e.user_email.toLowerCase().trim())
        .filter(Boolean)
    );

    console.log(
      `[ThinkificAudit] Premium: ${premiumEnrollments.length} total enrollments, ${activePremiumEmails.size} active`
    );

    // Get all DB users with isPremium=true
    const premiumUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.isPremium, true),
          eq(users.isDemo, false),
          eq(users.isPending, false),
          isNotNull(users.email),
        )
      );

    totalChecked += premiumUsers.length;

    for (const user of premiumUsers) {
      if (!user.email) continue;
      const normalised = user.email.toLowerCase().trim();
      if (!activePremiumEmails.has(normalised)) {
        try {
          console.log(`[ThinkificAudit] Revoking premium from ${normalised} (userId=${user.id})`);
          await setPremiumStatus(user.id, false, "thinkific_audit");
          totalRevoked++;
        } catch (err) {
          console.error(`[ThinkificAudit] Error revoking premium from user ${user.id}:`, err);
          errors++;
        }
      }
    }

    console.log(`[ThinkificAudit] Part 1 complete: ${premiumUsers.length} checked, ${totalRevoked} revoked`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("Authentication")) {
      console.error("[ThinkificAudit] Thinkific API auth failed — stopping audit. Check THINKIFIC_API_KEY.");
      return { total: totalChecked, created: 0, skipped: 0, errors: 1 };
    }
    console.error("[ThinkificAudit] Part 1 (premium) failed:", err);
    errors++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2: Individual course access audit
  // For each native LMS course that is linked to a Thinkific course:
  //   - Fetch all Thinkific enrollments for that course
  //   - Build a set of emails with active access
  //   - For any lmsEnrollments row where the user's email is NOT in the
  //     active set and accessExpiresAt is null (still open), set it to now
  // ══════════════════════════════════════════════════════════════════════════
  try {
    console.log("[ThinkificAudit] Part 2: Checking individual course access…");

    // Get all Thinkific courses that have a linked native LMS course
    const linkedCourses = await db
      .select({
        thinkificCourseId: cmeCoursesCache.thinkificCourseId,
        nativeLmsCourseId: cmeCoursesCache.nativeLmsCourseId,
        name: cmeCoursesCache.name,
      })
      .from(cmeCoursesCache)
      .where(
        and(
          isNotNull(cmeCoursesCache.thinkificCourseId),
          isNotNull(cmeCoursesCache.nativeLmsCourseId),
        )
      );

    console.log(`[ThinkificAudit] Part 2: Found ${linkedCourses.length} Thinkific courses linked to native LMS courses`);

    for (const course of linkedCourses) {
      if (!course.thinkificCourseId || !course.nativeLmsCourseId) continue;

      try {
        // Fetch all enrollments for this Thinkific course
        const courseEnrollments = await getEnrollmentsForCourse(course.thinkificCourseId);

        // Build set of emails with active (non-expired) enrollment
        const activeCourseEmails = new Set(
          courseEnrollments
            .filter((e) => {
              if (e.expired) return false;
              if (e.expiry_date && new Date(e.expiry_date) <= now) return false;
              return true;
            })
            .map((e) => e.user_email.toLowerCase().trim())
            .filter(Boolean)
        );

        // Find all active lmsEnrollments for this course (no expiry set yet)
        const activeDbEnrollments = await db
          .select({
            id: lmsEnrollments.id,
            userId: lmsEnrollments.userId,
          })
          .from(lmsEnrollments)
          .where(
            and(
              eq(lmsEnrollments.courseId, course.nativeLmsCourseId),
              or(
                isNull(lmsEnrollments.accessExpiresAt),
                gt(lmsEnrollments.accessExpiresAt, now),
              ),
            )
          );

        totalChecked += activeDbEnrollments.length;

        if (activeDbEnrollments.length === 0) continue;

        // Get user emails for these enrollment user IDs
        const userIds = activeDbEnrollments.map((e) => e.userId);
        const dbUsers = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(isNotNull(users.email));

        const userEmailMap = new Map(
          dbUsers
            .filter((u) => userIds.includes(u.id) && u.email)
            .map((u) => [u.id, u.email!.toLowerCase().trim()])
        );

        for (const enrollment of activeDbEnrollments) {
          const email = userEmailMap.get(enrollment.userId);
          if (!email) continue;

          if (!activeCourseEmails.has(email)) {
            try {
              console.log(
                `[ThinkificAudit] Expiring course access for ${email} (enrollmentId=${enrollment.id}, course="${course.name}")`
              );
              await db
                .update(lmsEnrollments)
                .set({ accessExpiresAt: now })
                .where(eq(lmsEnrollments.id, enrollment.id));
              totalRevoked++;
            } catch (err) {
              console.error(`[ThinkificAudit] Error expiring enrollment ${enrollment.id}:`, err);
              errors++;
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.includes("Authentication")) {
          console.error("[ThinkificAudit] Thinkific API auth failed mid-run — stopping course audit.");
          break;
        }
        console.error(`[ThinkificAudit] Error checking course "${course.name}" (thinkificCourseId=${course.thinkificCourseId}):`, err);
        errors++;
      }
    }

    console.log(`[ThinkificAudit] Part 2 complete`);
  } catch (err) {
    console.error("[ThinkificAudit] Part 2 (course access) failed:", err);
    errors++;
  }

  // Suggest GC after audit to reclaim memory promptly
  if (typeof global.gc === "function") {
    try { global.gc(); } catch (_) { /* ignore */ }
  }

  console.log(
    `[ThinkificAudit] Audit complete: ${totalChecked} checked, ${totalRevoked} revoked, ${errors} errors`
  );

  return { total: totalChecked, created: 0, skipped: totalChecked - totalRevoked - errors, errors };
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
