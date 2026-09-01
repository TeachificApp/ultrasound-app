import { describe, expect, it } from "vitest";
import { filterVisibleDependentQuestions, matchesQuestionDependency } from "./quizQuestionDependency";

describe("matchesQuestionDependency", () => {
  it("shows a dependent question only for its configured selected answer", () => {
    expect(matchesQuestionDependency({ parentQuestionId: "q1", expectedAnswer: "yes" }, JSON.stringify(["yes"]))).toBe(true);
    expect(matchesQuestionDependency({ parentQuestionId: "q1", expectedAnswer: "yes" }, JSON.stringify(["no"]))).toBe(false);
  });

  it("supports true or false responses and hides a dependent question before its parent is answered", () => {
    expect(matchesQuestionDependency({ parentQuestionId: "q1", expectedAnswer: "true" }, "true")).toBe(true);
    expect(matchesQuestionDependency({ parentQuestionId: "q1", expectedAnswer: "true" }, undefined)).toBe(false);
  });

  it("omits a no-longer-relevant follow-up from the visible path", () => {
    const questions = [
      { id: "q1" },
      { id: "q2", showWhen: { parentQuestionId: "q1", expectedAnswer: "yes" } },
      { id: "q3" },
    ];
    expect(filterVisibleDependentQuestions(questions, () => JSON.stringify(["no"])).map((question) => question.id)).toEqual(["q1", "q3"]);
  });
});
