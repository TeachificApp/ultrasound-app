/** Learner quiz-result analytics split by native quiz, mock exam, or Flashcards. */
export type QuizResultsKind = "native_quiz" | "mock_exam" | "flashcards";

export type QuizResultsKindAnalytics = {
  attemptCount: number;
  passedCount: number;
  averageScore: number | null;
  bestScore: number | null;
};

export type MyQuizResultsSummary = {
  /** Show My Quiz Results nav/tab when the learner has at least one native quiz attempt. */
  hasNativeQuizAttempts: boolean;
  hasMockExamAttempts: boolean;
  hasFlashcardAttempts: boolean;
  nativeQuizzes: QuizResultsKindAnalytics;
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
