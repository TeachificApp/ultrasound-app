import { describe, expect, it } from "vitest";
import {
  buildPrereqLockedIds,
  isLessonGateSatisfied,
  isLessonPrereqLocked,
  lessonHasAssessmentContent,
} from "../shared/lessonAccessGating";

describe("lesson access gating", () => {
  it("treats quiz and inline assessment lessons as assessment content", () => {
    expect(lessonHasAssessmentContent({ type: "quiz" })).toBe(true);
    expect(lessonHasAssessmentContent({
      type: "text",
      contentBlocks: JSON.stringify([{ type: "lesson_quiz", data: {} }]),
    })).toBe(true);
    expect(lessonHasAssessmentContent({
      type: "text",
      contentBlocks: JSON.stringify([{ type: "text", data: {} }]),
    })).toBe(false);
  });

  it("satisfies implicit gates when a lesson has been opened", () => {
    expect(isLessonGateSatisfied(
      { id: 1, requireManualComplete: 0 },
      new Set(),
      new Set([1]),
      true,
    )).toBe(true);
  });

  it("locks lessons after an unsatisfied prerequisite gate", () => {
    const allLessons = [
      { id: 1, isPrerequisite: true, requireManualComplete: 1 },
      { id: 2, type: "quiz", hasAssessmentContent: true },
    ];
    const locked = buildPrereqLockedIds({
      allLessons,
      completedIds: new Set(),
      openedIds: new Set(),
      courseDefaultMarkComplete: true,
    });
    expect(locked.has(2)).toBe(true);
  });

  it("unlocks the final assessment once all other countable lessons are complete", () => {
    const allLessons = [
      { id: 1, isPrerequisite: true, requireManualComplete: 1, countTowardCompletion: 1 },
      { id: 2, type: "text", countTowardCompletion: 1 },
      { id: 3, type: "quiz", hasAssessmentContent: true, countTowardCompletion: 1 },
    ];
    const locked = buildPrereqLockedIds({
      allLessons,
      completedIds: new Set([1, 2]),
      openedIds: new Set(),
      courseDefaultMarkComplete: true,
    });
    expect(locked.has(3)).toBe(false);
  });

  it("locks a lesson until its prerequisiteLessonId is complete", () => {
    const allLessons = [
      { id: 1, type: "text" },
      { id: 2, type: "quiz", prerequisiteLessonId: 1, hasAssessmentContent: true },
    ];
    expect(isLessonPrereqLocked(
      allLessons[1],
      allLessons,
      new Set(),
      new Set(),
      true,
      false,
    )).toBe(true);
    expect(isLessonPrereqLocked(
      allLessons[1],
      allLessons,
      new Set([1]),
      new Set(),
      true,
      false,
    )).toBe(false);
  });
});
