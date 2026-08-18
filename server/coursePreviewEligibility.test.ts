import { describe, expect, it } from "vitest";
import { getFirstPublishedPreviewLesson, isPublishedPreviewLesson } from "../shared/coursePreviewEligibility";

describe("course free-preview eligibility", () => {
  it("does not allow a draft preview lesson to enable the public Free Preview CTA", () => {
    const lessons = [
      { id: 1, lessonStatus: "draft", isPreview: true, previewMode: "preview" },
      { id: 2, lessonStatus: "published", isPreview: false, previewMode: "none" },
    ];
    expect(getFirstPublishedPreviewLesson(lessons)).toBeNull();
    expect(isPublishedPreviewLesson(lessons[0])).toBe(false);
  });

  it("uses only a published preview lesson and supports preview-hide-after-purchase", () => {
    const lesson = { id: 3, lessonStatus: "published", isPreview: true, previewMode: "preview_hide_after_purchase" };
    expect(getFirstPublishedPreviewLesson([lesson])).toBe(lesson);
    expect(isPublishedPreviewLesson(lesson)).toBe(true);
  });
});
