export const COHORT_DRIP_DAY_MS = 24 * 60 * 60 * 1000;

export type CohortDripReleaseMode =
  | "after_enrollment"
  | "after_publish"
  | "after_cohort_start";

export function cohortDaysSinceEnrollment(
  enrolledAt: Date | string | number,
  now = new Date()
): number {
  const elapsed = now.getTime() - new Date(enrolledAt).getTime();
  return Math.max(0, Math.floor(elapsed / COHORT_DRIP_DAY_MS));
}

export function cohortReleaseAt(input: {
  releaseMode?: CohortDripReleaseMode | null;
  enrolledAt: Date | string | number;
  publishedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
  cohortStartDate?: Date | string | number | null;
}): Date {
  const mode = input.releaseMode ?? "after_enrollment";
  if (mode === "after_publish") {
    // Existing published rows may not have published_at yet; created_at is a
    // safe migration fallback and keeps those records available immediately.
    return new Date(input.publishedAt ?? input.createdAt ?? input.enrolledAt);
  }
  if (mode === "after_cohort_start") {
    // A group without a start date cannot be held indefinitely. Fall back to
    // enrollment until an administrator sets the cohort start date.
    return new Date(input.cohortStartDate ?? input.enrolledAt);
  }
  return new Date(input.enrolledAt);
}

export function isCohortItemReleased(
  inputOrEnrolledAt:
    | {
        releaseMode?: CohortDripReleaseMode | null;
        enrolledAt: Date | string | number;
        publishedAt?: Date | string | number | null;
        createdAt?: Date | string | number | null;
        cohortStartDate?: Date | string | number | null;
        dripDays?: number | null;
      }
    | Date
    | string
    | number,
  dripDaysOrNow?: number | null | Date,
  now = new Date()
): boolean {
  const objectForm =
    typeof inputOrEnrolledAt === "object" &&
    inputOrEnrolledAt !== null &&
    "enrolledAt" in inputOrEnrolledAt;
  const input = objectForm
    ? inputOrEnrolledAt
    : {
        enrolledAt: inputOrEnrolledAt,
        dripDays: typeof dripDaysOrNow === "number" ? dripDaysOrNow : undefined,
      };
  const dripDays = Math.max(
    0,
    typeof input.dripDays === "number" ? input.dripDays : 0
  );
  const releaseAt = cohortReleaseAt(input);
  const effectiveNow =
    objectForm && dripDaysOrNow instanceof Date ? dripDaysOrNow : now;
  return (
    effectiveNow.getTime() >=
    releaseAt.getTime() + dripDays * COHORT_DRIP_DAY_MS
  );
}

export function cohortLessonReleaseDay(
  lessonDripDays: number | null | undefined,
  itemDripDays: number | null | undefined
): number {
  return Math.max(0, lessonDripDays ?? 0, itemDripDays ?? 0);
}
