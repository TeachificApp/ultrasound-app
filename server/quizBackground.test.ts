import { describe, expect, it } from "vitest";
import { resolveQuizBackground } from "../shared/quizBackground";

describe("quiz background resolution", () => {
  it("resolves a solid quiz background", () => {
    expect(resolveQuizBackground({ backgroundMode: "solid", backgroundColor: "#189aa1" })).toBe("#189aa1");
  });

  it("resolves a saved gradient quiz background", () => {
    expect(resolveQuizBackground({ backgroundMode: "gradient", backgroundGradient: "linear-gradient(135deg, #189aa1, #4ad9e0)" }))
      .toBe("linear-gradient(135deg, #189aa1, #4ad9e0)");
  });

  it("resolves a saved image background and honors a question-specific surface override", () => {
    expect(resolveQuizBackground({ backgroundMode: "image", backgroundImageUrl: "https://cdn.example/quiz.jpg" }))
      .toContain("https://cdn.example/quiz.jpg");
    expect(resolveQuizBackground({ backgroundMode: "gradient", backgroundGradient: "linear-gradient(red, blue)" }, { backgroundColor: "#ffffff" }))
      .toBe("#ffffff");
  });
});
