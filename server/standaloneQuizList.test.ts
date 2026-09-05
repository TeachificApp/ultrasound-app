import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("standaloneQuizAdmin listQuizzes", () => {
  it("uses a slim column list and batch counts instead of selecting the full row with correlated subqueries", () => {
    const source = readFileSync(resolve(import.meta.dirname, "routers/standaloneQuizRouter.ts"), "utf8");
    expect(source).toContain("STANDALONE_QUIZ_LIST_COLUMNS");
    expect(source).toContain(".select(STANDALONE_QUIZ_LIST_COLUMNS)");
    expect(source).toContain(".groupBy(standaloneQuizQuestions.quizId)");
    expect(source).toContain("0059_standalone_quiz_schema_sync.sql");
    expect(source).not.toContain("quiz: standaloneQuizzes");
  });
});

describe("QuizCreatorAdmin tabs", () => {
  it("shows separate tabs for quizzes, mock exams, flashcards, and results", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/admin/QuizCreatorAdmin.tsx"), "utf8");
    expect(source).toContain('["quiz", "Quizzes"]');
    expect(source).toContain('["mock_exam", "Mock Exams"]');
    expect(source).toContain('["flashcards", "Flashcards"]');
    expect(source).toContain('type: activeTab === "results" ? undefined : activeTab');
  });
});
