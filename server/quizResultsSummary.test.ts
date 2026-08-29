import { describe, expect, it } from "vitest";
import { aggregateScoresFromRows } from "./lib/quizResultsSummary";
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
});
