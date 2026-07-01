export type PreviewMode = "none" | "preview" | "preview_hide_after_purchase";

export type LessonPreviewLike = {
  id?: number;
  previewMode?: PreviewMode | string | null;
  isPreview?: boolean | null;
};

export type EnrollmentPreviewLike = {
  enrollmentType?: "full" | "free_preview" | string;
} | null | undefined;

export function getLessonPreviewMode(lesson: LessonPreviewLike): PreviewMode {
  if (lesson.previewMode) return lesson.previewMode as PreviewMode;
  return lesson.isPreview ? "preview" : "none";
}

/** Guests and free_preview enrollees still see hide-after-purchase teasers; full enrollees do not. */
export function shouldShowHideAfterPurchaseLesson(enrollment: EnrollmentPreviewLike): boolean {
  if (!enrollment) return true;
  if (enrollment.enrollmentType === "free_preview") return true;
  return false;
}

export function isLessonHiddenAfterPurchase(
  lesson: LessonPreviewLike,
  enrollment: EnrollmentPreviewLike,
): boolean {
  if (getLessonPreviewMode(lesson) !== "preview_hide_after_purchase") return false;
  return !shouldShowHideAfterPurchaseLesson(enrollment);
}

export function isGuestPreviewAccessible(lesson: LessonPreviewLike): boolean {
  const pm = getLessonPreviewMode(lesson);
  return pm === "preview" || pm === "preview_hide_after_purchase";
}

export function filterLessonsForPlayer<T extends LessonPreviewLike>(
  lessons: T[],
  enrollment: EnrollmentPreviewLike,
): T[] {
  return lessons.filter((lesson) => !isLessonHiddenAfterPurchase(lesson, enrollment));
}

export function flattenCourseLessons<T extends { id: number }>(
  topLevelLessons: T[] | undefined,
  sections: Array<{ lessons?: T[] }> | undefined,
): T[] {
  return [...(topLevelLessons ?? []), ...(sections ?? []).flatMap((section) => section.lessons ?? [])];
}

/**
 * Resolve which lesson the player should open initially.
 * Skips preview_hide_after_purchase lessons for full (paid) enrollees.
 */
export function findFirstPlayerLesson<T extends LessonPreviewLike & { id: number }>(
  topLevelLessons: T[] | undefined,
  sections: Array<{ lessons?: T[] }> | undefined,
  options: {
    enrollment: EnrollmentPreviewLike;
    lessonIdParam?: number | null;
    isEnrolled: boolean;
    adminBypass?: boolean;
  },
): number | null {
  const allLessons = flattenCourseLessons(topLevelLessons, sections);
  const { enrollment, lessonIdParam, isEnrolled, adminBypass } = options;

  if (lessonIdParam != null && Number.isFinite(lessonIdParam)) {
    const found = allLessons.find((lesson) => lesson.id === lessonIdParam);
    if (found) {
      if (adminBypass) return lessonIdParam;
      if (!isEnrolled && isGuestPreviewAccessible(found)) return lessonIdParam;
      if (isEnrolled && !isLessonHiddenAfterPurchase(found, enrollment)) return lessonIdParam;
    }
  }

  if (!isEnrolled && !adminBypass) {
    const firstPreview = allLessons.find((lesson) => isGuestPreviewAccessible(lesson));
    if (firstPreview?.id != null) return firstPreview.id;
  }

  const visibleLessons = filterLessonsForPlayer(allLessons, enrollment);
  return visibleLessons[0]?.id ?? null;
}
