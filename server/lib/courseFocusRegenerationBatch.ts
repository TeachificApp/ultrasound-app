export const MAX_COURSE_FOCUS_REGENERATION_LESSONS = 25;

export function selectCourseFocusRegenerationLessons<T extends { id: number }>(
  lessons: T[],
  requestedLessonIds: number[],
) {
  const requested = new Set(requestedLessonIds);
  if (requested.size === 0) {
    throw new Error("Select at least one lesson to regenerate.");
  }
  if (requested.size !== requestedLessonIds.length) {
    throw new Error("Each selected lesson may be included only once.");
  }
  if (requested.size > MAX_COURSE_FOCUS_REGENERATION_LESSONS) {
    throw new Error(`Select no more than ${MAX_COURSE_FOCUS_REGENERATION_LESSONS} lessons to regenerate.`);
  }

  const selected = lessons.filter(lesson => requested.has(lesson.id));
  if (selected.length !== requested.size) {
    throw new Error("One or more selected lessons do not belong to this course.");
  }
  return selected;
}
