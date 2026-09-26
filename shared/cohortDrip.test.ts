import { describe, expect, it } from "vitest";
import { cohortDaysSinceEnrollment, cohortLessonReleaseDay, isCohortItemReleased } from "./cohortDrip";

describe("cohort drip timing", () => {
  const enrolledAt = new Date("2026-01-01T00:00:00Z");
  const daySeven = new Date("2026-01-08T00:00:00Z");
  it("calculates whole days since enrollment", () => expect(cohortDaysSinceEnrollment(enrolledAt, daySeven)).toBe(7));
  it("releases on the configured day", () => {
    expect(isCohortItemReleased(enrolledAt, 7, daySeven)).toBe(true);
    expect(isCohortItemReleased(enrolledAt, 8, daySeven)).toBe(false);
  });
  it("uses the later linked-lesson or item release day", () => expect(cohortLessonReleaseDay(3, 10)).toBe(10));
});
