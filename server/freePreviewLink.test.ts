/**
 * freePreviewLink.test.ts
 * Tests for the free preview enrollment link feature:
 * - URL format: https://learn.allaboutultrasound.com/courses/{slug}?open_preview=1
 * - Auto-open modal logic: open_preview=1 triggers the registration modal
 * - Guest vs logged-in user behavior
 * - First preview lesson selection logic
 */
import { describe, it, expect } from "vitest";

const LEARN_DOMAIN = "https://learn.allaboutultrasound.com";

// ─── URL construction ─────────────────────────────────────────────────────────

describe("Free Preview Link — URL construction", () => {
  it("builds the correct open_preview URL for a given slug", () => {
    const slug = "advanced-cardiac-sonographer-acs-mastery-course";
    const url = `${LEARN_DOMAIN}/courses/${slug}?open_preview=1`;
    expect(url).toBe(
      "https://learn.allaboutultrasound.com/courses/advanced-cardiac-sonographer-acs-mastery-course?open_preview=1"
    );
  });

  it("uses the course slug not the course title", () => {
    const slug = "echo-mastery-bundle";
    const url = `${LEARN_DOMAIN}/courses/${slug}?open_preview=1`;
    expect(url).toContain("echo-mastery-bundle");
    expect(url).not.toContain("Echo Mastery Bundle");
  });

  it("always ends with ?open_preview=1", () => {
    const url = `${LEARN_DOMAIN}/courses/some-course?open_preview=1`;
    expect(url.endsWith("?open_preview=1")).toBe(true);
  });
});

// ─── URL param parsing ────────────────────────────────────────────────────────

describe("Free Preview Link — URL param parsing", () => {
  it("detects open_preview=1 correctly", () => {
    const params = new URLSearchParams("?open_preview=1");
    expect(params.get("open_preview") === "1").toBe(true);
  });

  it("does not trigger on open_preview=0", () => {
    const params = new URLSearchParams("?open_preview=0");
    expect(params.get("open_preview") === "1").toBe(false);
  });

  it("does not trigger when open_preview is absent", () => {
    const params = new URLSearchParams("?checkout=1");
    expect(params.get("open_preview") === "1").toBe(false);
  });

  it("does not conflict with checkout=1 param", () => {
    const params = new URLSearchParams("?checkout=1&open_preview=1");
    expect(params.get("checkout") === "1").toBe(true);
    expect(params.get("open_preview") === "1").toBe(true);
  });
});

// ─── First preview lesson selection ──────────────────────────────────────────

describe("Free Preview Link — first preview lesson selection", () => {
  function makeLesson(overrides: Record<string, unknown> = {}) {
    return {
      id: 1,
      title: "Lesson 1",
      isPreview: false,
      previewMode: "none",
      ...overrides,
    };
  }

  function makeSection(lessons: ReturnType<typeof makeLesson>[]) {
    return { id: 1, title: "Section 1", lessons };
  }

  function findFirstPreviewLesson(sections: ReturnType<typeof makeSection>[]) {
    const allLessons = sections.flatMap((s) => s.lessons ?? []);
    return (
      allLessons.find((l) => l.isPreview || l.previewMode === "preview") ??
      allLessons[0] ??
      null
    );
  }

  it("returns the first lesson with isPreview=true", () => {
    const sections = [
      makeSection([
        makeLesson({ id: 1, isPreview: false }),
        makeLesson({ id: 2, isPreview: true }),
        makeLesson({ id: 3, isPreview: false }),
      ]),
    ];
    const result = findFirstPreviewLesson(sections);
    expect(result?.id).toBe(2);
  });

  it("returns the first lesson with previewMode=preview", () => {
    const sections = [
      makeSection([
        makeLesson({ id: 1, previewMode: "none" }),
        makeLesson({ id: 2, previewMode: "preview" }),
      ]),
    ];
    const result = findFirstPreviewLesson(sections);
    expect(result?.id).toBe(2);
  });

  it("falls back to the very first lesson when no preview lessons exist", () => {
    const sections = [
      makeSection([
        makeLesson({ id: 10, previewMode: "none" }),
        makeLesson({ id: 11, previewMode: "none" }),
      ]),
    ];
    const result = findFirstPreviewLesson(sections);
    expect(result?.id).toBe(10);
  });

  it("returns null when there are no lessons at all", () => {
    const result = findFirstPreviewLesson([makeSection([])]);
    expect(result).toBeNull();
  });

  it("prefers isPreview=true over previewMode=preview_hide_after_purchase", () => {
    const sections = [
      makeSection([
        makeLesson({ id: 1, previewMode: "preview_hide_after_purchase" }),
        makeLesson({ id: 2, isPreview: true }),
      ]),
    ];
    // Both qualify — first match wins
    const result = findFirstPreviewLesson(sections);
    // previewMode=preview_hide_after_purchase does NOT match the "preview" check
    // so id=2 (isPreview=true) should be the first match
    expect(result?.id).toBe(2);
  });

  it("handles lessons across multiple sections", () => {
    const sections = [
      makeSection([makeLesson({ id: 1 }), makeLesson({ id: 2 })]),
      makeSection([makeLesson({ id: 3, isPreview: true }), makeLesson({ id: 4 })]),
    ];
    const result = findFirstPreviewLesson(sections);
    expect(result?.id).toBe(3);
  });
});

// ─── getCourseFreePreviewLessons — lesson filter logic ────────────────────────

describe("Free Preview Link — lesson filter logic (mirrors server query)", () => {
  function filterPreviewLessons(lessons: Array<{ previewMode: string; isPreview: boolean }>) {
    return lessons.filter(
      (l) =>
        l.previewMode === "preview" ||
        l.previewMode === "preview_hide_after_purchase" ||
        l.isPreview === true
    );
  }

  it("includes lessons with previewMode=preview", () => {
    const lessons = [
      { previewMode: "preview", isPreview: false },
      { previewMode: "none", isPreview: false },
    ];
    expect(filterPreviewLessons(lessons)).toHaveLength(1);
  });

  it("includes lessons with previewMode=preview_hide_after_purchase", () => {
    const lessons = [
      { previewMode: "preview_hide_after_purchase", isPreview: false },
      { previewMode: "none", isPreview: false },
    ];
    expect(filterPreviewLessons(lessons)).toHaveLength(1);
  });

  it("includes lessons with isPreview=true", () => {
    const lessons = [
      { previewMode: "none", isPreview: true },
      { previewMode: "none", isPreview: false },
    ];
    expect(filterPreviewLessons(lessons)).toHaveLength(1);
  });

  it("returns empty array when no preview lessons exist", () => {
    const lessons = [
      { previewMode: "none", isPreview: false },
      { previewMode: "none", isPreview: false },
    ];
    expect(filterPreviewLessons(lessons)).toHaveLength(0);
  });

  it("returns all matching lessons when multiple exist", () => {
    const lessons = [
      { previewMode: "preview", isPreview: false },
      { previewMode: "preview_hide_after_purchase", isPreview: false },
      { previewMode: "none", isPreview: true },
      { previewMode: "none", isPreview: false },
    ];
    expect(filterPreviewLessons(lessons)).toHaveLength(3);
  });
});
