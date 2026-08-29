import { describe, expect, it } from "vitest";
import { builderConfigFromQuizRow } from "./lib/quizBuilderConfig";
import { quizReadAloudVoiceToTtsVoice } from "../shared/quizVoiceOptions";

const baseQuiz = {
  id: 77,
  title: "Read-aloud controls",
  description: null,
  passingScore: 70,
  timeLimitMinutes: null,
  shuffleQuestions: false,
  shuffleAnswers: false,
  allowRetakes: true,
  maxAttempts: 3,
  brand: "aaus" as const,
  builderConfig: null,
};

describe("creator-controlled quiz read-aloud settings", () => {
  it("preserves enabled and selected Male voice settings in builder metadata", () => {
    const config = builderConfigFromQuizRow({
      ...baseQuiz,
      readAloudEnabled: true,
      readAloudVoice: "male",
    });

    expect(config.meta.readAloudEnabled).toBe(true);
    expect(config.meta.readAloudVoice).toBe("male");
    expect(quizReadAloudVoiceToTtsVoice(config.meta.readAloudVoice!)).toBe("onyx");
  });

  it("keeps existing quizzes read-aloud enabled with the Female default", () => {
    const config = builderConfigFromQuizRow(baseQuiz);

    expect(config.meta.readAloudEnabled).toBe(true);
    expect(config.meta.readAloudVoice).toBe("female");
    expect(quizReadAloudVoiceToTtsVoice(config.meta.readAloudVoice!)).toBe("nova");
  });
});
