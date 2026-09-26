export const COHORT_DRIP_DAY_MS = 24 * 60 * 60 * 1000;

export function cohortDaysSinceEnrollment(enrolledAt: Date | string | number, now = new Date()): number {
  const elapsed = now.getTime() - new Date(enrolledAt).getTime();
  return Math.max(0, Math.floor(elapsed / COHORT_DRIP_DAY_MS));
}

export function isCohortItemReleased(
  enrolledAt: Date | string | number,
  dripDays: number | null | undefined,
  now = new Date(),
): boolean {
  return cohortDaysSinceEnrollment(enrolledAt, now) >= Math.max(0, dripDays ?? 0);
}

export function cohortLessonReleaseDay(lessonDripDays: number | null | undefined, itemDripDays: number | null | undefined): number {
  return Math.max(0, lessonDripDays ?? 0, itemDripDays ?? 0);
}
