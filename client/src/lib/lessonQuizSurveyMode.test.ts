import { describe, expect, it } from "vitest";
import { clearSurveyAnswerKeys, clearSurveyAnswerKeysFromQuestions, nonEmptySurveyChoices } from "./lessonQuizSurveyMode";

describe("lesson quiz Survey Mode", () => {
  it("removes every stored answer-key field when a question becomes a survey response", () => {
    const result = clearSurveyAnswerKeys({
      question: "Select your role",
      correctAnswer: 1,
      correctAnswers: [1, 2],
      hotspotMarkers: [{ id: "a", isCorrect: true }],
    });

    expect(result).not.toHaveProperty("correctAnswer");
    expect(result).not.toHaveProperty("correctAnswers");
    expect(result.hotspotMarkers).toEqual([{ id: "a", isCorrect: false }]);
  });

  it("clears answer keys across every existing survey question", () => {
    const result = clearSurveyAnswerKeysFromQuestions([
      { correctAnswer: 0 },
      { correctAnswers: [0, 1] },
    ]);

    expect(result.every(question => !("correctAnswer" in question) && !("correctAnswers" in question))).toBe(true);
  });

  it("filters empty dependent-answer choices before they reach Select items", () => {
    expect(nonEmptySurveyChoices(["Yes", "", "  ", "No", null])).toEqual(["Yes", "No"]);
  });
});
