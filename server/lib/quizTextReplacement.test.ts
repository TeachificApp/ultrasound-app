import { describe, expect, it } from "vitest";
import { replaceQuizQuestionText } from "./quizTextReplacement";

describe("quiz text replacement", () => {
  it("replaces learner-visible builder text while preserving media and technical fields", () => {
    const question = {
      id: "bank-42",
      stem: "Greater Saphenous Vein reflux",
      explanation: "The Greater Saphenous Vein is assessed.",
      feedback: { correct: "Great work: Greater Saphenous Vein.", incorrect: "Review the Greater Saphenous Vein." },
      image: { url: "https://cdn.example/Greater%20Saphenous%20Vein.png" },
      data: { choices: [{ id: "a", text: "Greater Saphenous Vein", feedback: "Correct Greater Saphenous Vein." }], template: "Greater Saphenous Vein" },
    };
    const result = replaceQuizQuestionText(question, "Greater Saphenous Vein", "Great Saphenous Vein");
    expect(result.replacements).toBe(7);
    expect(result.value.stem).toBe("Great Saphenous Vein reflux");
    expect((result.value.data as any).choices[0].text).toBe("Great Saphenous Vein");
    expect(result.value.image).toEqual(question.image);
    expect(result.value.id).toBe("bank-42");
  });

  it("leaves content unchanged when the exact phrase does not occur", () => {
    const result = replaceQuizQuestionText({ id: "local-1", stem: "Venous reflux", data: {} }, "arterial", "venous");
    expect(result.replacements).toBe(0);
    expect(result.value.stem).toBe("Venous reflux");
  });
});
