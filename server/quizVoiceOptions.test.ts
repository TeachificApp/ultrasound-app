import { describe, expect, it } from "vitest";
import {
  buildQuizVoiceSampleScript,
  getQuizVoiceLabel,
  getQuizVoiceSpokenName,
} from "../shared/quizVoiceOptions";

describe("quizVoiceOptions", () => {
  it("builds the Manus AI voice sample intro script", () => {
    expect(buildQuizVoiceSampleScript("nova", "RPhS Test & Learn Quiz")).toBe(
      "Hello, I am Nova. I will read the questions for the RPhS Test & Learn Quiz quiz.",
    );
  });

  it("falls back when quiz title is empty", () => {
    expect(buildQuizVoiceSampleScript("alloy", "   ")).toBe(
      "Hello, I am Alloy. I will read the questions for this quiz.",
    );
  });

  it("resolves labels and spoken names", () => {
    expect(getQuizVoiceLabel("fable")).toBe("Fable — expressive");
    expect(getQuizVoiceSpokenName("fable")).toBe("Fable");
  });
});
