/**
 * Matches the Students tab cohort-group column: unassigned when no
 * lms_cohort_group_enrollments row exists for that enrollment id.
 */
export function filterUnassignedCohortEnrollments<
  T extends { enrollmentId: number },
>(enrolled: T[], assignedEnrollmentIds: Iterable<number>): T[] {
  const assigned = new Set(assignedEnrollmentIds);
  return enrolled.filter((row) => !assigned.has(row.enrollmentId));
}
