import { describe, it, expect } from "vitest";
import {
  filterLessonsForPlayer,
  findFirstPlayerLesson,
  flattenCourseLessons,
  isLessonHiddenAfterPurchase,
} from "../shared/lmsPreviewAccess";

function lesson(id: number, previewMode: string, isPreview = false) {
  return { id, previewMode, isPreview };
}

describe("lmsPreviewAccess", () => {
  const sections = [
    {
      id: 1,
      lessons: [
        lesson(1, "preview_hide_after_purchase"),
        lesson(2, "preview_hide_after_purchase"),
        lesson(3, "preview_hide_after_purchase"),
        lesson(4, "none"),
        lesson(5, "none"),
      ],
    },
  ];

  it("hides preview_hide_after_purchase for full enrollees only", () => {
    expect(isLessonHiddenAfterPurchase(lesson(1, "preview_hide_after_purchase"), { enrollmentType: "full" })).toBe(true);
    expect(isLessonHiddenAfterPurchase(lesson(1, "preview_hide_after_purchase"), { enrollmentType: "free_preview" })).toBe(false);
    expect(isLessonHiddenAfterPurchase(lesson(1, "preview_hide_after_purchase"), null)).toBe(false);
    expect(isLessonHiddenAfterPurchase(lesson(4, "none"), { enrollmentType: "full" })).toBe(false);
  });

  it("filters hidden preview lessons out of the player list for paid students", () => {
    const all = flattenCourseLessons([], sections);
    const visible = filterLessonsForPlayer(all, { enrollmentType: "full" });
    expect(visible.map((l) => l.id)).toEqual([4, 5]);
  });

  it("opens the first non-hidden lesson for enrolled students when early lessons hide after purchase", () => {
    const id = findFirstPlayerLesson([], sections, {
      enrollment: { enrollmentType: "full" },
      isEnrolled: true,
    });
    expect(id).toBe(4);
  });

  it("skips hidden lesson id from URL for full enrollees", () => {
    const id = findFirstPlayerLesson([], sections, {
      enrollment: { enrollmentType: "full" },
      lessonIdParam: 2,
      isEnrolled: true,
    });
    expect(id).toBe(4);
  });

  it("honors accessible lesson id from URL for full enrollees", () => {
    const id = findFirstPlayerLesson([], sections, {
      enrollment: { enrollmentType: "full" },
      lessonIdParam: 5,
      isEnrolled: true,
    });
    expect(id).toBe(5);
  });

  it("still opens hide-after-purchase lessons for free_preview enrollees", () => {
    const id = findFirstPlayerLesson([], sections, {
      enrollment: { enrollmentType: "free_preview" },
      isEnrolled: true,
    });
    expect(id).toBe(1);
  });

  it("opens first preview lesson for guests", () => {
    const id = findFirstPlayerLesson([], sections, {
      enrollment: null,
      isEnrolled: false,
    });
    expect(id).toBe(1);
  });
});
