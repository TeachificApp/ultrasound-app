export type PreviewEligibilityLesson = {
  lessonStatus?: string | null;
  isPreview?: boolean | null;
  previewMode?: string | null;
};

/**
 * A preview-only lesson can introduce a course before purchase, but must not
 * appear in an enrolled learner's curriculum or launch target once paid access
 * is active. This intentionally leaves the normal `preview` mode visible.
 */
export function isVisibleAfterPurchase(lesson: PreviewEligibilityLesson): boolean {
  const mode = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
  return mode !== "preview_hide_after_purchase";
}

export function isPublishedPreviewLesson(lesson: PreviewEligibilityLesson): boolean {
  if (lesson.lessonStatus !== "published") return false;
  const mode = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
  return mode === "preview" || mode === "preview_hide_after_purchase";
}

export function getFirstPublishedPreviewLesson<T extends PreviewEligibilityLesson>(lessons: T[]): T | null {
  return lessons.find(isPublishedPreviewLesson) ?? null;
}

/** Return the first lesson an enrolled learner should be able to launch. */
export function getFirstLessonVisibleAfterPurchase<T extends PreviewEligibilityLesson>(lessons: T[]): T | null {
  return lessons.find(isVisibleAfterPurchase) ?? null;
}
