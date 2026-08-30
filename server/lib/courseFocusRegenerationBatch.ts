export const COURSE_FOCUS_REGENERATION_BATCH_SIZE = 5;

export function getCourseFocusRegenerationBatch(totalLessons: number, requestedOffset = 0) {
  const offset = Math.max(0, Math.floor(requestedOffset));
  if (offset >= totalLessons) {
    throw new Error("No lessons remain in this course regeneration preview.");
  }

  const end = Math.min(offset + COURSE_FOCUS_REGENERATION_BATCH_SIZE, totalLessons);
  return {
    offset,
    end,
    count: end - offset,
    nextOffset: end < totalLessons ? end : null,
  };
}
