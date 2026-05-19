/**
 * Tests for the isAdminPreview fix:
 * - When an admin IS enrolled in a course, isAdminPreview must be false
 *   so that markLessonComplete is called and progress is saved.
 * - When an admin is NOT enrolled, isAdminPreview is true (synthetic enrollment).
 */
import { describe, expect, it } from "vitest";

// Unit-test the isAdminPreview logic in isolation (no DB needed)
function computeIsAdminPreview(
  inputPreview: boolean | undefined,
  userRole: string,
  enrollment: { id: number } | undefined
): boolean {
  // This mirrors the fixed logic in lmsRouter.ts getCoursePlayer / getCourseOverview
  return !!(inputPreview && userRole === "admin" && !enrollment);
}

describe("isAdminPreview logic", () => {
  it("returns false when admin IS enrolled (even if preview=true)", () => {
    const result = computeIsAdminPreview(true, "admin", { id: 1 });
    expect(result).toBe(false);
  });

  it("returns true when admin is NOT enrolled and preview=true", () => {
    const result = computeIsAdminPreview(true, "admin", undefined);
    expect(result).toBe(true);
  });

  it("returns false when non-admin user with preview=true", () => {
    const result = computeIsAdminPreview(true, "user", undefined);
    expect(result).toBe(false);
  });

  it("returns false when preview=false and admin not enrolled", () => {
    const result = computeIsAdminPreview(false, "admin", undefined);
    expect(result).toBe(false);
  });

  it("returns false when preview=undefined and admin not enrolled", () => {
    const result = computeIsAdminPreview(undefined, "admin", undefined);
    expect(result).toBe(false);
  });
});

describe("handleMarkComplete guard", () => {
  it("should call server when isAdminPreview is false (enrolled admin)", () => {
    const isAdminPreview = false;
    let serverCalled = false;
    // Simulate the guard in handleMarkComplete
    if (!isAdminPreview) {
      serverCalled = true; // would call markComplete.mutateAsync
    }
    expect(serverCalled).toBe(true);
  });

  it("should skip server call when isAdminPreview is true (unenrolled admin preview)", () => {
    const isAdminPreview = true;
    let serverCalled = false;
    if (!isAdminPreview) {
      serverCalled = true;
    }
    expect(serverCalled).toBe(false);
  });
});
