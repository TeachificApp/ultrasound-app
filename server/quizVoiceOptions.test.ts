import { describe, expect, it } from "vitest";
import {
  buildQuizVoiceSampleScript,
  getQuizVoiceLabel,
  getQuizVoiceSpokenName,
} from "../shared/quizVoiceOptions";

describe("quizVoiceOptions", () => {
  it("builds the Manus AI voice sample intro script", () => {
    expect(buildQuizVoiceSampleScript("nova", "RPhS Test & Learn Quiz")).toBe(
      "Hello, I am Female. I will read the questions for the RPhS Test & Learn Quiz quiz.",
    );
  });

  it("falls back when quiz title is empty", () => {
    expect(buildQuizVoiceSampleScript("onyx", "   ")).toBe(
      "Hello, I am Male. I will read the questions for this quiz.",
    );
  });

  it("resolves labels and spoken names", () => {
    expect(getQuizVoiceLabel("nova")).toBe("Female");
    expect(getQuizVoiceSpokenName("onyx")).toBe("Male");
  });
});
