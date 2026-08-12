import { describe, expect, it } from "vitest";
import { getStandaloneSelectedOptionFeedback } from "../client/src/pages/StandaloneQuizPlayer";

describe("non-builder instant feedback", () => {
  it("returns selected MCQ answer feedback", () => {
    expect(getStandaloneSelectedOptionFeedback("mcq", [{ text: "A", feedback: "A is not correct." }, { text: "B", feedback: "B is correct." }], "0"))
      .toBe("A is not correct.");
  });

  it("returns selected true-false answer feedback from stored options", () => {
    expect(getStandaloneSelectedOptionFeedback("truefalse", [{ text: "True", feedback: "True is correct." }, { text: "False", feedback: "False is incorrect." }], "false"))
      .toBe("False is incorrect.");
  });

  it("labels the selected answer for legacy true-false questions without stored options", () => {
    expect(getStandaloneSelectedOptionFeedback("truefalse", [], "false", "The diagnostic criterion is present."))
      .toBe("You selected False. The diagnostic criterion is present.");
  });
});
