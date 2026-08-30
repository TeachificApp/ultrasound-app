import { describe, expect, it, vi } from "vitest";
import { appendFullLessonHtml, countRenderedWords, extendFullLessonDraft, fullLessonWordsRemaining, isCompleteFullLesson, MIN_FULL_LESSON_WORDS, TARGET_FULL_LESSON_WORDS } from "./lib/lessonContentGeneration";

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

  it("adds a continuation to a short draft and calculates the remaining target words", () => {
    const initial = "<p>Initial clinical content.</p>";
    const continuation = "<h2>Scanning technique</h2><p>Additional clinical content.</p>";
    expect(appendFullLessonHtml(initial, continuation)).toBe(`${initial}\n${continuation}`);
    expect(fullLessonWordsRemaining(initial)).toBe(TARGET_FULL_LESSON_WORDS - 3);
  });

  it("recovers a short draft through bounded non-duplicative continuation requests", async () => {
    const firstDraft = Array.from({ length: 700 }, () => "initial").join(" ");
    const continuation = Array.from({ length: 800 }, () => "continuation").join(" ");
    const generateContinuation = vi.fn().mockResolvedValue(`<p>${continuation}</p>`);
    const completed = await extendFullLessonDraft(`<p>${firstDraft}</p>`, generateContinuation);
    expect(isCompleteFullLesson(completed)).toBe(true);
    expect(generateContinuation).toHaveBeenCalledTimes(1);
  });
});
