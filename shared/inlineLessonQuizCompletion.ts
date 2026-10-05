export function evaluateInlineLessonQuizScore(score: number, passingScore: number) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const normalizedPassingScore = Math.max(0, Math.min(100, Math.round(passingScore)));
  return {
    score: normalizedScore,
    passingScore: normalizedPassingScore,
    passed: normalizedScore >= normalizedPassingScore,
  };
}

type InlineLessonQuizBlock = {
  type?: unknown;
  data?: {
    isSurvey?: unknown;
    requirePassToComplete?: unknown;
    requireSurveyCompletion?: unknown;
  };
};

/**
 * Required inline assessments own their completion state. A generic lesson
 * completion action must never bypass their pass/response requirement.
 */
export function lessonHasRequiredInlineQuiz(blocks: unknown): boolean {
  const parsedBlocks = Array.isArray(blocks)
    ? blocks
    : (() => {
        if (typeof blocks !== "string") return [];
        try {
          const parsed = JSON.parse(blocks);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

  return parsedBlocks.some((block: InlineLessonQuizBlock) => {
    if (block?.type !== "lesson_quiz") return false;
    const data = block.data ?? {};
    const isSurvey = data.isSurvey === true || data.requireSurveyCompletion === true;
    return isSurvey
      ? data.requireSurveyCompletion === true
      : data.requirePassToComplete !== false;
  });
}

export function shouldRestoreMissingCourseCertificate(input: {
  courseHasCertificate: boolean | number | null;
  courseHasCmeCredit?: boolean;
  enrollmentCompletedAt?: Date | null | undefined;
  enrollmentProgressPct?: number | null | undefined;
  hasCertificateRecord: boolean;
}) {
  const completed = Boolean(input.enrollmentCompletedAt)
    || Number(input.enrollmentProgressPct ?? 0) >= 100;
  return Boolean(input.courseHasCertificate)
    && completed
    && !input.hasCertificateRecord;
}
