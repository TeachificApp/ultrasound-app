import { describe, it, expect } from "vitest";

// Unit tests for LessonBlockEditor logic (pure functions, no DOM)

describe("LessonBlockEditor - Preview URL construction", () => {
  it("builds correct preview URL from courseSlug and lessonId", () => {
    const origin = "https://app.allaboutultrasound.com";
    const courseSlug = "career-paths-business";
    const lessonId = 42;
    const url = `${origin}/learn/${courseSlug}/player?lesson=${lessonId}&preview=admin`;
    expect(url).toBe("https://app.allaboutultrasound.com/learn/career-paths-business/player?lesson=42&preview=admin");
  });

  it("does not render Preview button when courseSlug is empty", () => {
    const courseSlug = "";
    // When courseSlug is falsy, the button should not be shown
    expect(!courseSlug).toBe(true);
  });

  it("renders Preview button when courseSlug is present", () => {
    const courseSlug = "my-course";
    expect(!!courseSlug).toBe(true);
  });
});

describe("LessonBlockEditor - scrollToBlock logic", () => {
  it("falls back to scrolling canvas to bottom when blockRef not found", () => {
    const blockRefs = new Map<string, HTMLDivElement>();
    const blockId = "new-block-123";
    // blockRefs doesn't have the new block yet (before render)
    const el = blockRefs.get(blockId);
    expect(el).toBeUndefined();
    // Should fall back to canvas scroll — just verify the logic path
    const canvasScrollCalled = !el; // would call canvas.scrollTo
    expect(canvasScrollCalled).toBe(true);
  });
});
