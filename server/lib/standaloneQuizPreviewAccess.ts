export type StandaloneQuizVisibilityStatus =
  | "draft"
  | "published"
  | "archived"
  | "enrollment_closed"
  | "waitlist"
  | "presale";

/**
 * Published quizzes retain their ordinary learner access checks. A draft or
 * otherwise unpublished quiz can be opened only when an authenticated admin
 * explicitly requests preview mode. This prevents preview URLs from exposing
 * unfinished content to learners.
 */
export function canOpenStandaloneQuiz(
  status: StandaloneQuizVisibilityStatus,
  role: string,
  adminPreview = false,
) {
  return status === "published" || (adminPreview && role === "admin");
}

export function requiresEmbeddedLearnerAccess(role: string, adminPreview = false) {
  return !(adminPreview && role === "admin");
}
