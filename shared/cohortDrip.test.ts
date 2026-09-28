import { describe, expect, it } from "vitest";
import {
  cohortDaysSinceEnrollment,
  cohortLessonReleaseDay,
  isCohortItemReleased,
} from "./cohortDrip";

describe("cohort drip timing", () => {
  const enrolledAt = new Date("2026-01-01T00:00:00Z");
  const daySeven = new Date("2026-01-08T00:00:00Z");
  it("calculates whole days since enrollment", () =>
    expect(cohortDaysSinceEnrollment(enrolledAt, daySeven)).toBe(7));
  it("releases on the configured day", () => {
    expect(isCohortItemReleased(enrolledAt, 7, daySeven)).toBe(true);
    expect(isCohortItemReleased(enrolledAt, 8, daySeven)).toBe(false);
  });
  it("uses the later linked-lesson or item release day", () =>
    expect(cohortLessonReleaseDay(3, 10)).toBe(10));
  it("supports release after publish", () => {
    const publishedAt = new Date("2026-01-05T00:00:00Z");
    expect(
      isCohortItemReleased(
        { enrolledAt, releaseMode: "after_publish", publishedAt, dripDays: 2 },
        new Date("2026-01-07T00:00:00Z")
      )
    ).toBe(true);
  });
  it("supports release after cohort start date", () => {
    const cohortStartDate = new Date("2026-01-10T00:00:00Z");
    expect(
      isCohortItemReleased(
        {
          enrolledAt,
          releaseMode: "after_cohort_start",
          cohortStartDate,
          dripDays: 1,
        },
        new Date("2026-01-11T00:00:00Z")
      )
    ).toBe(true);
    expect(
      isCohortItemReleased(
        {
          enrolledAt,
          releaseMode: "after_cohort_start",
          cohortStartDate,
          dripDays: 1,
        },
        new Date("2026-01-10T12:00:00Z")
      )
    ).toBe(false);
  });
});
