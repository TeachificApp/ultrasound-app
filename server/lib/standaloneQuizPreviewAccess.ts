export type StandaloneQuizVisibilityStatus =
  | "draft"
  | "published"
  | "archived"
  | "enrollment_closed"
  | "waitlist"
  | "presale";

/**
 * Published quizzes retain their ordinary learner access checks. A draft or
 * otherwise unpublished quiz can be opened only when authenticated staff
 * explicitly request preview mode. This prevents preview URLs from exposing
 * unfinished content to learners.
 */
export function canOpenStandaloneQuiz(
  status: StandaloneQuizVisibilityStatus,
  adminPreview = false,
  isStaff = false,
) {
  return status === "published" || (adminPreview && isStaff);
}

export function requiresEmbeddedLearnerAccess(adminPreview = false, isStaff = false) {
  return !(adminPreview && isStaff);
}
