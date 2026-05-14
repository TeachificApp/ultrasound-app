/**
 * lms.overview.test.ts
 * Unit tests for Course Overview and Prerequisite Gating logic
 */
import { describe, it, expect } from "vitest";

// ─── Prerequisite gating logic (mirrors CoursePlayer.tsx) ────────────────────

function isPrereqLocked(lesson: { prerequisiteLessonId?: number | null }, completedIds: Set<number>, dripBypassed: boolean): boolean {
  if (dripBypassed) return false;
  if (!lesson.prerequisiteLessonId) return false;
  return !completedIds.has(lesson.prerequisiteLessonId);
}

function isDripLocked(lesson: { dripDays?: number | null }, daysSinceEnroll: number, dripBypassed: boolean, isDrip: boolean): boolean {
  if (dripBypassed) return false;
  if (!isDrip) return false;
  return (lesson.dripDays ?? 0) > 0 && daysSinceEnroll < (lesson.dripDays ?? 0);
}

// ─── showInstructor override logic (mirrors CoursePlayer.tsx) ─────────────────

function resolveShowInstructor(lessonOverride: "inherit" | "show" | "hide", courseShow: boolean): boolean {
  if (lessonOverride === "show") return true;
  if (lessonOverride === "hide") return false;
  return courseShow; // inherit
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Prerequisite gating", () => {
  it("should lock a lesson when prerequisite is not completed", () => {
    const lesson = { id: 2, prerequisiteLessonId: 1 };
    const completedIds = new Set<number>(); // nothing completed
    expect(isPrereqLocked(lesson, completedIds, false)).toBe(true);
  });

  it("should unlock a lesson when prerequisite is completed", () => {
    const lesson = { id: 2, prerequisiteLessonId: 1 };
    const completedIds = new Set<number>([1]); // lesson 1 completed
    expect(isPrereqLocked(lesson, completedIds, false)).toBe(false);
  });

  it("should not lock when no prerequisite is set", () => {
    const lesson = { id: 2, prerequisiteLessonId: null };
    const completedIds = new Set<number>();
    expect(isPrereqLocked(lesson, completedIds, false)).toBe(false);
  });

  it("should bypass prerequisite lock for admins (dripBypassed = true)", () => {
    const lesson = { id: 2, prerequisiteLessonId: 1 };
    const completedIds = new Set<number>(); // nothing completed
    expect(isPrereqLocked(lesson, completedIds, true)).toBe(false);
  });
});

describe("Drip locking", () => {
  it("should lock a lesson when drip days not yet passed", () => {
    const lesson = { dripDays: 7 };
    expect(isDripLocked(lesson, 3, false, true)).toBe(true);
  });

  it("should unlock a lesson when drip days have passed", () => {
    const lesson = { dripDays: 7 };
    expect(isDripLocked(lesson, 10, false, true)).toBe(false);
  });

  it("should not lock when course is not drip", () => {
    const lesson = { dripDays: 7 };
    expect(isDripLocked(lesson, 0, false, false)).toBe(false);
  });

  it("should bypass drip lock for admins", () => {
    const lesson = { dripDays: 7 };
    expect(isDripLocked(lesson, 0, true, true)).toBe(false);
  });
});

describe("showInstructor override", () => {
  it("should show instructor when lesson override is 'show' regardless of course setting", () => {
    expect(resolveShowInstructor("show", false)).toBe(true);
  });

  it("should hide instructor when lesson override is 'hide' regardless of course setting", () => {
    expect(resolveShowInstructor("hide", true)).toBe(false);
  });

  it("should inherit course setting when lesson override is 'inherit'", () => {
    expect(resolveShowInstructor("inherit", true)).toBe(true);
    expect(resolveShowInstructor("inherit", false)).toBe(false);
  });
});

describe("Course overview block parsing", () => {
  it("should parse valid JSON blocks array", () => {
    const blocks = [{ id: "1", type: "text", data: { text: "Hello" } }];
    const json = JSON.stringify(blocks);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("text");
  });

  it("should return empty array for null/empty courseOverviewBlocks", () => {
    const parseBlocks = (raw: string | null | undefined) => {
      try { return raw ? JSON.parse(raw) : []; }
      catch { return []; }
    };
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks(undefined)).toEqual([]);
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("invalid json")).toEqual([]);
  });
});
