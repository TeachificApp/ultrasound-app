/**
 * Drip-out expiry — must match CoursePlayer sidebar (`dripBypassed = !course.isDrip`).
 * Per-lesson dripOutDays in the DB are ignored when the course drip schedule is off.
 */

export function isLessonDripOutExpired(opts: {
  courseIsDrip: boolean;
  dripOutDays: number | null | undefined;
  daysSinceEnroll: number;
}): boolean {
  if (!opts.courseIsDrip) return false;
  const days = opts.dripOutDays ?? 0;
  if (days <= 0) return false;
  return opts.daysSinceEnroll >= days;
}

export function daysSinceEnrollment(enrolledAt: Date | string): number {
  return Math.floor((Date.now() - new Date(enrolledAt).getTime()) / 86400000);
}
