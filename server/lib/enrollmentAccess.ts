/**
 * Enrollment access helpers — expiry-aware active enrollment checks.
 */

import { and, eq, or, isNull, gt, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import {
  lmsEnrollments,
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
};

/** True when enrollment grants access right now */
export function isEnrollmentAccessActive(enrollment: {
  enrollmentType?: string;
  accessExpiresAt?: Date | null;
}): boolean {
  if (enrollment.enrollmentType === "free_preview") return true;
  if (!enrollment.accessExpiresAt) return true;
  return enrollment.accessExpiresAt.getTime() > Date.now();
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
  const [row] = await db
    .select({
      id: lmsEnrollments.id,
      userId: lmsEnrollments.userId,
      courseId: lmsEnrollments.courseId,
      enrollmentType: lmsEnrollments.enrollmentType,
      accessExpiresAt: lmsEnrollments.accessExpiresAt,
      enrolledAt: lmsEnrollments.enrolledAt,
    })
    .from(lmsEnrollments)
    .where(
      and(
        eq(lmsEnrollments.userId, userId),
        eq(lmsEnrollments.courseId, courseId),
        activeEnrollmentCondition(),
      ),
    )
    .limit(1);
  return row ?? null;
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
