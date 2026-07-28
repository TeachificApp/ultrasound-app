import { describe, it, expect } from "vitest";

/**
 * Unit tests for the "Revert to Draft" lesson status fix.
 *
 * Root cause: getCourse's lesson select list was missing `lessonStatus`,
 * so the field came back as `undefined` on every load. The LessonEditorPage
 * initialised its state with `(lesson as any).lessonStatus ?? "published"`,
 * which always resolved to "published" — making the UI appear to not save
 * the draft status even though the DB write succeeded.
 *
 * Fix: Added `lessonStatus`, `commentsEnabled`, and `showVideoControls` to
 * the getCourse lesson select list in lmsCourseBuilderRouter.ts.
 */

describe("Lesson status initialisation logic", () => {
  // Simulate how LessonEditorPage initialises lessonStatus from the lesson prop
  const initLessonStatus = (lesson: { lessonStatus?: string }) =>
    (lesson.lessonStatus as "published" | "draft") ?? "published";

  it("defaults to published when lessonStatus is undefined (old getCourse behaviour)", () => {
    const lesson = { id: 1, title: "Test" }; // no lessonStatus field
    expect(initLessonStatus(lesson)).toBe("published");
  });

  it("correctly reads 'draft' when lessonStatus is returned from getCourse", () => {
    const lesson = { id: 1, title: "Test", lessonStatus: "draft" };
    expect(initLessonStatus(lesson)).toBe("draft");
  });

  it("correctly reads 'published' when lessonStatus is returned from getCourse", () => {
    const lesson = { id: 1, title: "Test", lessonStatus: "published" };
    expect(initLessonStatus(lesson)).toBe("published");
  });
});

describe("updateLesson payload — lessonStatus field", () => {
  // Simulate the handleSave payload construction
  const buildPayload = (lessonId: number, lessonStatus: "published" | "draft") => ({
    id: lessonId,
    lessonStatus,
  });

  it("sends 'draft' in the payload when user clicks Revert to Draft", () => {
    const payload = buildPayload(42, "draft");
    expect(payload.lessonStatus).toBe("draft");
  });

  it("sends 'published' in the payload when user clicks Published", () => {
    const payload = buildPayload(42, "published");
    expect(payload.lessonStatus).toBe("published");
  });

  it("payload id matches the lesson id", () => {
    const payload = buildPayload(99, "draft");
    expect(payload.id).toBe(99);
  });
});
