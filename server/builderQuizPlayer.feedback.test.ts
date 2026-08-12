import { describe, expect, it } from "vitest";
import { getFeedbackMessage } from "../client/src/components/quiz/BuilderQuizPlayer";

describe("builder instant feedback", () => {
  it("uses the selected multiple-choice option feedback before the overall explanation", () => {
    const result = getFeedbackMessage({
      type: "mcq",
      explanation: "Overall explanation",
      data: { choices: [{ id: "a", correct: false, feedback: "Option A is incorrect because it does not meet the diagnostic threshold." }, { id: "b", correct: true, feedback: "Option B is correct." }] },
    }, JSON.stringify(["a"]));
    expect(result).toEqual({ type: "incorrect", message: "Option A is incorrect because it does not meet the diagnostic threshold." });
  });

  it("uses the selected true-false answer feedback before the overall explanation", () => {
    const result = getFeedbackMessage({
      type: "tf",
      explanation: "Overall explanation",
      data: { correct: true, trueFeedback: "True is correct because the criterion is met.", falseFeedback: "False is incorrect because the criterion is met." },
    }, JSON.stringify(false));
    expect(result).toEqual({ type: "incorrect", message: "False is incorrect because the criterion is met." });
  });
});
