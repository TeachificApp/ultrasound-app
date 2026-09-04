import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  lmsInlineQuizAttempts,
  lmsLessons,
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

export function getInlineModuleResultKind(contentBlocks: unknown, blockId: string): "native_quiz" | "flashcards" | null {
  let blocks: any[] = [];
  try {
    blocks = Array.isArray(contentBlocks) ? contentBlocks as any[] : JSON.parse(String(contentBlocks ?? "[]"));
  } catch {
    return null;
  }
  const block = blocks.find(candidate => String(candidate?.id) === blockId);
  if (block?.type === "lesson_flashcard") return "flashcards";
  if (block?.type === "lesson_quiz" && block?.data?.isSurvey !== true && block?.data?.requireSurveyCompletion !== true) return "native_quiz";
  return null;
}

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
  const [standaloneRows, lmsRows, inlineRows] = await Promise.all([
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
    db
      .select({
        score: lmsInlineQuizAttempts.score,
        passed: lmsInlineQuizAttempts.passed,
        quizBlockId: lmsInlineQuizAttempts.quizBlockId,
        contentBlocks: lmsLessons.contentBlocks,
      })
      .from(lmsInlineQuizAttempts)
      .innerJoin(lmsLessons, eq(lmsInlineQuizAttempts.lessonId, lmsLessons.id))
      .where(eq(lmsInlineQuizAttempts.userId, userId)),
  ]);

  const nativeStandalone = standaloneRows.filter((r) => r.quizType === "quiz");
  const mockStandalone = standaloneRows.filter((r) => r.quizType === "mock_exam");
  const flashcardStandalone = standaloneRows.filter((r) => r.quizType === "flashcards");
  const nativeLms = lmsRows.filter((r) => !r.isMockExam);
  const mockLms = lmsRows.filter((r) => r.isMockExam);
  const nativeInline = inlineRows.filter((row) => getInlineModuleResultKind(row.contentBlocks, row.quizBlockId) === "native_quiz");
  const flashcardInline = inlineRows.filter((row) => getInlineModuleResultKind(row.contentBlocks, row.quizBlockId) === "flashcards");

  const nativeQuizzes = aggregateScoresFromRows([...nativeStandalone, ...nativeLms, ...nativeInline]);
  const mockExams = aggregateScoresFromRows([...mockStandalone, ...mockLms]);
  const flashcards = aggregateScoresFromRows([...flashcardStandalone, ...flashcardInline]);

  return {
    hasNativeQuizAttempts: nativeQuizzes.attemptCount > 0,
    hasMockExamAttempts: mockExams.attemptCount > 0,
    hasFlashcardAttempts: flashcards.attemptCount > 0,
    nativeQuizzes,
    mockExams,
    flashcards,
  };
}
