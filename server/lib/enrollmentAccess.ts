/**
 * Enrollment access helpers — expiry-aware active enrollment checks.
 */

import { and, eq, or, isNull, gt, inArray, isNotNull, gte, desc } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  lmsEnrollments,
  lmsCourses,
  membershipSubscriptions,
  membershipPlanAccess,
} from "../../drizzle/schema";

export type EnrollmentRow = {
  id: number;
  userId: number;
  courseId: number;
  enrollmentType: string;
  accessExpiresAt?: Date | null;
  enrolledAt?: Date;
  completedAt?: Date | null;
  progressPct?: number | null;
};

const enrollmentSelect = {
  id: lmsEnrollments.id,
  userId: lmsEnrollments.userId,
  courseId: lmsEnrollments.courseId,
  enrollmentType: lmsEnrollments.enrollmentType,
  accessExpiresAt: lmsEnrollments.accessExpiresAt,
  enrolledAt: lmsEnrollments.enrolledAt,
  completedAt: lmsEnrollments.completedAt,
  progressPct: lmsEnrollments.progressPct,
};

/** True when the learner finished the course (certificate / review access). */
export function isEnrollmentCompleted(enrollment: {
  completedAt?: Date | null;
  progressPct?: number | null;
}): boolean {
  if (enrollment.completedAt) return true;
  return Number(enrollment.progressPct ?? 0) >= 100;
}

/** True when enrollment grants access right now */
export function isEnrollmentAccessActive(enrollment: {
  enrollmentType?: string;
  accessExpiresAt?: Date | null;
}): boolean {
  if (enrollment.enrollmentType === "free_preview") return true;
  if (!enrollment.accessExpiresAt) return true;
  const expiresMs = new Date(enrollment.accessExpiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return true;
  return expiresMs > Date.now();
}

/** True when the learner has dashboard-visible access to a course enrollment row. */
export function hasCourseEnrollmentAccess(enrollment: {
  enrollmentType?: string;
  accessExpiresAt?: Date | null;
  completedAt?: Date | null;
  progressPct?: number | null;
}): boolean {
  return isEnrollmentAccessActive(enrollment) || isEnrollmentCompleted(enrollment);
}

/** Resolve the enrollment row that should grant course player/overview access. */
export async function resolveEnrollmentForCourse(
  db: MySql2Database<typeof schema>,
  userId: number,
  courseId: number,
): Promise<EnrollmentRow | null> {
  const active = await getActiveEnrollment(db, userId, courseId);
  if (active) return active;

  const rows = await db
    .select(enrollmentSelect)
    .from(lmsEnrollments)
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
    .orderBy(desc(lmsEnrollments.enrolledAt));

  for (const row of rows) {
    if (hasCourseEnrollmentAccess(row)) return row;
  }
  return null;
}

/** Match dashboard My Content: resolve access using the enrolled course slug. */
export async function resolveEnrollmentByCourseSlug(
  db: MySql2Database<typeof schema>,
  userId: number,
  courseSlug: string,
): Promise<EnrollmentRow | null> {
  const rows = await db
    .select({
      id: lmsEnrollments.id,
      userId: lmsEnrollments.userId,
      courseId: lmsEnrollments.courseId,
      enrollmentType: lmsEnrollments.enrollmentType,
      accessExpiresAt: lmsEnrollments.accessExpiresAt,
      enrolledAt: lmsEnrollments.enrolledAt,
      completedAt: lmsEnrollments.completedAt,
      progressPct: lmsEnrollments.progressPct,
    })
    .from(lmsEnrollments)
    .innerJoin(lmsCourses, eq(lmsCourses.id, lmsEnrollments.courseId))
    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsCourses.slug, courseSlug)))
    .orderBy(desc(lmsEnrollments.enrolledAt));

  for (const row of rows) {
    if (hasCourseEnrollmentAccess(row)) return row;
  }
  return null;
}

export function activeEnrollmentCondition() {
  const now = new Date();
  return or(isNull(lmsEnrollments.accessExpiresAt), gt(lmsEnrollments.accessExpiresAt, now));
}

export async function getActiveEnrollment(
  db: MySql2Database<typeof schema>,
  userId: number,
  courseId: number,
): Promise<EnrollmentRow | null> {
  const [activeRow] = await db
    .select(enrollmentSelect)
    .from(lmsEnrollments)
    .where(
      and(
        eq(lmsEnrollments.userId, userId),
        eq(lmsEnrollments.courseId, courseId),
        activeEnrollmentCondition(),
      ),
    )
    .limit(1);
  if (activeRow) return activeRow;

  // Completed learners retain read-only access for overview, player review, and certificates
  // even when subscription/time-limited access has expired.
  const [completedRow] = await db
    .select(enrollmentSelect)
    .from(lmsEnrollments)
    .where(
      and(
        eq(lmsEnrollments.userId, userId),
        eq(lmsEnrollments.courseId, courseId),
        or(
          isNotNull(lmsEnrollments.completedAt),
          gte(lmsEnrollments.progressPct, 100),
        ),
      ),
    )
    .limit(1);
  return completedRow ?? null;
}

export async function userHasActiveMembershipPlan(
  db: MySql2Database<typeof schema>,
  userId: number,
  planId: number,
): Promise<boolean> {
  const now = Date.now();
  const [sub] = await db
    .select()
    .from(membershipSubscriptions)
    .where(
      and(
        eq(membershipSubscriptions.userId, userId),
        eq(membershipSubscriptions.planId, planId),
        inArray(membershipSubscriptions.status, ["active", "trialing"]),
      ),
    )
    .limit(1);
  if (!sub) return false;
  if (sub.currentPeriodEnd != null && sub.currentPeriodEnd < now) return false;
  return true;
}

/** Block checkout when user already has active membership or non-expired enrollment for plan content */
export async function userHasActivePlanAccess(
  db: MySql2Database<typeof schema>,
  userId: number,
  planId: number,
): Promise<{ hasAccess: boolean; reason: string | null }> {
  if (await userHasActiveMembershipPlan(db, userId, planId)) {
    return { hasAccess: true, reason: "active_membership_subscription" };
  }

  const items = await db
    .select()
    .from(membershipPlanAccess)
    .where(eq(membershipPlanAccess.planId, planId));

  for (const item of items) {
    if ((item.itemType === "course" || item.itemType === "quiz") && item.itemId) {
      const active = await getActiveEnrollment(db, userId, item.itemId);
      if (active && active.enrollmentType === "full") {
        return { hasAccess: true, reason: `active_enrollment_course_${item.itemId}` };
      }
    }
  }

  return { hasAccess: false, reason: null };
}
