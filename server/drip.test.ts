import { describe, it, expect } from "vitest";

// Unit test for drip content unlock logic (mirrors CoursePlayer logic)
function isDripLocked(dripDays: number | null | undefined, daysSinceEnroll: number, bypass: boolean): boolean {
  if (bypass) return false;
  if (!dripDays || dripDays <= 0) return false;
  return daysSinceEnroll < dripDays;
}

describe("Drip content unlock logic", () => {
  it("unlocks immediately when dripDays is 0 or null", () => {
    expect(isDripLocked(0, 0, false)).toBe(false);
    expect(isDripLocked(null, 0, false)).toBe(false);
    expect(isDripLocked(undefined, 0, false)).toBe(false);
  });

  it("locks content before dripDays threshold", () => {
    expect(isDripLocked(7, 3, false)).toBe(true);
    expect(isDripLocked(7, 6, false)).toBe(true);
  });

  it("unlocks content on or after dripDays threshold", () => {
    expect(isDripLocked(7, 7, false)).toBe(false);
    expect(isDripLocked(7, 10, false)).toBe(false);
  });

  it("bypasses drip for admin preview", () => {
    expect(isDripLocked(7, 0, true)).toBe(false);
    expect(isDripLocked(30, 1, true)).toBe(false);
  });

  it("handles single day drip", () => {
    expect(isDripLocked(1, 0, false)).toBe(true);
    expect(isDripLocked(1, 1, false)).toBe(false);
  });
});
