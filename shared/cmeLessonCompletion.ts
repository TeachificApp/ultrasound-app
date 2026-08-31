/** CME / certificate courses are identified by the certificate toggle alone. */
export function isCertificateCourse(course: {
  hasCertificate?: boolean | number | null;
  creditHours?: string | number | null;
} | null | undefined): boolean {
  return Boolean(course?.hasCertificate);
}

export function lessonRequiresExplicitCompletion(
  lesson: { requireVideoCompletion?: number | null; requireManualComplete?: number | null },
  courseDefaultMarkComplete = true,
): boolean {
  if (lesson.requireVideoCompletion === 1) return true;
  const requireManual = lesson.requireManualComplete === null || lesson.requireManualComplete === undefined
    ? courseDefaultMarkComplete
    : lesson.requireManualComplete === 1;
  return requireManual;
}
export function hasReachedCmeVideoCompletionThreshold(currentTime: number, duration: number) {
  return Number.isFinite(currentTime)
    && Number.isFinite(duration)
    && duration > 0
    && currentTime / duration >= 0.9;
}

/**
 * Ordinary CME instruction, including video lessons without an explicitly
 * enabled viewing gate, completes when the learner advances. Quiz, SDMS, and
 * explicitly required video completions remain protected.
 */
export function shouldAutoCompleteCmeLessonOnAdvance({
  isCmeCourse,
  lessonType,
  requiresVideoCompletion,
  hasInlineQuiz,
  hasSdmsCmeModule,
  isCompleted,
}: {
  isCmeCourse: boolean;
  lessonType?: string | null;
  requiresVideoCompletion: boolean;
  hasInlineQuiz: boolean;
  hasSdmsCmeModule?: boolean;
  isCompleted: boolean;
}) {
  return isCmeCourse
    && !isCompleted
    && !requiresVideoCompletion
    && !hasInlineQuiz
    && !hasSdmsCmeModule
    && lessonType !== "quiz"
    && lessonType !== "standalone_quiz";
}
