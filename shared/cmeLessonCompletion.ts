/** CME video lessons satisfy their completion prerequisite at 90% watched. */
export function hasReachedCmeVideoCompletionThreshold(currentTime: number, duration: number) {
  return Number.isFinite(currentTime)
    && Number.isFinite(duration)
    && duration > 0
    && currentTime / duration >= 0.9;
}

/**
 * Ordinary CME instruction completes when the learner advances. Video and quiz
 * requirements remain explicit so their completion gates cannot be bypassed.
 */
export function shouldAutoCompleteCmeLessonOnAdvance({
  isCmeCourse,
  lessonType,
  requiresVideoCompletion,
  hasInlineQuiz,
  isCompleted,
}: {
  isCmeCourse: boolean;
  lessonType?: string | null;
  requiresVideoCompletion: boolean;
  hasInlineQuiz: boolean;
  isCompleted: boolean;
}) {
  return isCmeCourse
    && !isCompleted
    && !requiresVideoCompletion
    && !hasInlineQuiz
    && lessonType !== "quiz"
    && lessonType !== "standalone_quiz"
    && lessonType !== "video"
    && lessonType !== "video_text";
}
