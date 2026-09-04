import { describe, expect, it } from "vitest";
import { aggregateScoresFromRows, getInlineModuleResultKind } from "./lib/quizResultsSummary";
import { emptyQuizResultsKindAnalytics } from "../shared/quizResultsAnalytics";

describe("quiz results summary helpers", () => {
  it("returns empty analytics for no rows", () => {
    expect(aggregateScoresFromRows([])).toEqual(emptyQuizResultsKindAnalytics());
  });

  it("aggregates attempt counts, pass rate, and scores", () => {
    expect(
      aggregateScoresFromRows([
        { score: "80", passed: true },
        { score: "60", passed: false },
        { score: 90, passed: true },
      ]),
    ).toEqual({
      attemptCount: 3,
      passedCount: 2,
      averageScore: 76.7,
      bestScore: 90,
    });
  });

  it("classifies embedded lesson quizzes and flashcards without treating surveys as scored quiz results", () => {
    const blocks = JSON.stringify([
      { id: "quiz", type: "lesson_quiz", data: { title: "Knowledge Check" } },
      { id: "survey", type: "lesson_quiz", data: { isSurvey: true } },
      { id: "deck", type: "lesson_flashcard", data: { title: "Review" } },
    ]);
    expect(getInlineModuleResultKind(blocks, "quiz")).toBe("native_quiz");
    expect(getInlineModuleResultKind(blocks, "survey")).toBeNull();
    expect(getInlineModuleResultKind(blocks, "deck")).toBe("flashcards");
    expect(getInlineModuleResultKind("not json", "deck")).toBeNull();
  });
});
