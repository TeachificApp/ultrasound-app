import { describe, expect, it } from "vitest";
import { countRenderedWords, isCompleteFullLesson, MIN_FULL_LESSON_WORDS } from "./lib/lessonContentGeneration";

describe("full lesson AI content validation", () => {
  it("counts readable lesson words without including HTML markup or entities", () => {
    expect(countRenderedWords("<h2>Scanning &amp; assessment</h2><p>Use a focused clinical approach.</p>")).toBe(7);
  });

  it("accepts exactly 1,500 rendered words and rejects a shorter draft", () => {
    const complete = Array.from({ length: MIN_FULL_LESSON_WORDS }, (_, index) => `word${index + 1}`).join(" ");
    const short = Array.from({ length: MIN_FULL_LESSON_WORDS - 1 }, (_, index) => `word${index + 1}`).join(" ");
    expect(isCompleteFullLesson(`<p>${complete}</p>`)).toBe(true);
    expect(isCompleteFullLesson(`<p>${short}</p>`)).toBe(false);
  });
});
