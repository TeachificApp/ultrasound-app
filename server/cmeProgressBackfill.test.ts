import { describe, expect, it } from "vitest";
import {
  lessonsToBackfillComplete,
  resolveFinalAssessmentLessonIds,
} from "../shared/cmeProgressBackfill";

describe("CME progress backfill helpers", () => {
  const lessons = [
    { id: 1, type: "video", lessonStatus: "published", countTowardCompletion: 1 },
    { id: 2, type: "text", lessonStatus: "published", countTowardCompletion: 1 },
    {
      id: 3,
      type: "text",
      lessonStatus: "published",
      countTowardCompletion: 1,
      contentBlocks: JSON.stringify([{ type: "sdms_cme_module", data: {} }]),
    },
  ];

  it("treats the configured CME lesson as the final assessment", () => {
    const finalIds = resolveFinalAssessmentLessonIds(lessons, 3);
    expect(finalIds.has(3)).toBe(true);
  });

  it("backfills all lessons except the final CME assessment", () => {
    const finalIds = resolveFinalAssessmentLessonIds(lessons, 3);
    const toBackfill = lessonsToBackfillComplete(lessons, finalIds);
    expect(toBackfill.map((lesson) => lesson.id)).toEqual([1, 2]);
  });

  it("falls back to the last quiz lesson when no SDMS lesson exists", () => {
    const quizLessons = [
      { id: 10, type: "video", lessonStatus: "published", countTowardCompletion: 1 },
      { id: 11, type: "quiz", lessonStatus: "published", countTowardCompletion: 1 },
    ];
    const finalIds = resolveFinalAssessmentLessonIds(quizLessons, null);
    expect(finalIds.has(11)).toBe(true);
    expect(lessonsToBackfillComplete(quizLessons, finalIds).map((lesson) => lesson.id)).toEqual([10]);
  });
});
