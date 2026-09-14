/** Learner quiz-result analytics split by native quiz, mock exam, or Flashcards. */
export type QuizResultsKind = "native_quiz" | "mock_exam" | "flashcards";

export type QuizResultsKindAnalytics = {
  attemptCount: number;
  passedCount: number;
  averageScore: number | null;
  bestScore: number | null;
};

export type MyQuizResultsSummary = {
  /** Legacy aggregate that includes standalone, LMS, and inline native quiz attempts. */
  hasNativeQuizAttempts: boolean;
  /** Show the My Content → Quizzes results tab only after a completed standalone-system quiz attempt. */
  hasStandaloneSystemQuizAttempts: boolean;
  hasMockExamAttempts: boolean;
  hasFlashcardAttempts: boolean;
  nativeQuizzes: QuizResultsKindAnalytics;
  standaloneSystemQuizzes: QuizResultsKindAnalytics;
  mockExams: QuizResultsKindAnalytics;
  flashcards: QuizResultsKindAnalytics;
};

export function emptyQuizResultsKindAnalytics(): QuizResultsKindAnalytics {
  return {
    attemptCount: 0,
    passedCount: 0,
    averageScore: null,
    bestScore: null,
  };
}
