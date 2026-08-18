export type PreviewEligibilityLesson = {
  lessonStatus?: string | null;
  isPreview?: boolean | null;
  previewMode?: string | null;
};

export function isPublishedPreviewLesson(lesson: PreviewEligibilityLesson): boolean {
  if (lesson.lessonStatus !== "published") return false;
  const mode = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
  return mode === "preview" || mode === "preview_hide_after_purchase";
}

export function getFirstPublishedPreviewLesson<T extends PreviewEligibilityLesson>(lessons: T[]): T | null {
  return lessons.find(isPublishedPreviewLesson) ?? null;
}
