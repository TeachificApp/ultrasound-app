import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LessonQuizBlockEditor Survey Mode", () => {
  const source = readFileSync(resolve(import.meta.dirname, "LessonQuizBlockEditor.tsx"), "utf8");

  it("offers Survey Mode independently from score-based quiz completion", () => {
    expect(source).toContain("Non-Scoring Survey");
    expect(source).toContain("isSurvey");
    expect(source).toContain("requireSurveyCompletion");
    expect(source).toContain("Require Pass to Complete");
  });

  it("prevents contradictory score enforcement while Survey Mode is enabled", () => {
    expect(source).toContain("disabled={data.isSurvey || data.requireSurveyCompletion}");
    expect(source).toContain("All responses are recorded only. There are no correct or incorrect answers, scores, passing scores, or graded feedback.");
  });
});
