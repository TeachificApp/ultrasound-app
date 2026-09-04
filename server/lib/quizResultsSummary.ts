import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  lmsQuizAttempts,
  lmsQuizzes,
  standaloneQuizAttempts,
  standaloneQuizzes,
} from "../../drizzle/schema";
import {
  emptyQuizResultsKindAnalytics,
  type MyQuizResultsSummary,
  type QuizResultsKindAnalytics,
} from "../../shared/quizResultsAnalytics";

type ScoreRow = { score: string | number | null; passed: boolean | null };

export function aggregateScoresFromRows(rows: ScoreRow[]): QuizResultsKindAnalytics {
  if (rows.length === 0) return emptyQuizResultsKindAnalytics();
  const scores = rows
    .map((r) => (r.score === null || r.score === undefined ? null : Number(r.score)))
    .filter((s): s is number => s !== null && !Number.isNaN(s));
  const passedCount = rows.filter((r) => r.passed === true).length;
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;
  const averageScore =
    scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  return {
    attemptCount: rows.length,
    passedCount,
    averageScore,
    bestScore,
  };
}

/** Aggregate standalone + LMS attempts, split native quiz, mock exam, and Flashcards. */
export async function loadMyQuizResultsSummary(
  db: MySql2Database<any>,
  userId: number,
): Promise<MyQuizResultsSummary> {
  const [standaloneRows, lmsRows] = await Promise.all([
    db
      .select({
        score: standaloneQuizAttempts.score,
        passed: standaloneQuizAttempts.passed,
        quizType: standaloneQuizzes.type,
      })
      .from(standaloneQuizAttempts)
      .innerJoin(standaloneQuizzes, eq(standaloneQuizAttempts.quizId, standaloneQuizzes.id))
      .where(and(eq(standaloneQuizAttempts.userId, userId), isNotNull(standaloneQuizAttempts.completedAt))),
    db
      .select({
        score: lmsQuizAttempts.score,
        passed: lmsQuizAttempts.passed,
        isMockExam: sql<boolean>`COALESCE(${lmsQuizzes.isMockExam}, false)`,
      })
      .from(lmsQuizAttempts)
      .leftJoin(lmsQuizzes, eq(lmsQuizAttempts.lessonId, lmsQuizzes.lessonId))
      .where(eq(lmsQuizAttempts.userId, userId)),
  ]);

  const nativeStandalone = standaloneRows.filter((r) => r.quizType === "quiz");
  const mockStandalone = standaloneRows.filter((r) => r.quizType === "mock_exam");
  const flashcardStandalone = standaloneRows.filter((r) => r.quizType === "flashcards");
  const nativeLms = lmsRows.filter((r) => !r.isMockExam);
  const mockLms = lmsRows.filter((r) => r.isMockExam);

  const nativeQuizzes = aggregateScoresFromRows([...nativeStandalone, ...nativeLms]);
  const mockExams = aggregateScoresFromRows([...mockStandalone, ...mockLms]);
  const flashcards = aggregateScoresFromRows(flashcardStandalone);

  return {
    hasNativeQuizAttempts: nativeQuizzes.attemptCount > 0,
    hasMockExamAttempts: mockExams.attemptCount > 0,
    hasFlashcardAttempts: flashcards.attemptCount > 0,
    nativeQuizzes,
    mockExams,
    flashcards,
  };
}
