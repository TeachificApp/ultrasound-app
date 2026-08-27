export function evaluateInlineLessonQuizScore(score: number, passingScore: number) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const normalizedPassingScore = Math.max(0, Math.min(100, Math.round(passingScore)));
  return {
    score: normalizedScore,
    passingScore: normalizedPassingScore,
    passed: normalizedScore >= normalizedPassingScore,
  };
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
