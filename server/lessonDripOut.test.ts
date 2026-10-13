import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysSinceEnrollment, isLessonDripOutExpired } from "./lib/lessonDripAccess";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("isLessonDripOutExpired", () => {
  it("does not expire when course drip schedule is off", () => {
    expect(
      isLessonDripOutExpired({ courseIsDrip: false, dripOutDays: 30, daysSinceEnroll: 100 }),
    ).toBe(false);
  });

  it("does not expire when dripOutDays is unset or zero", () => {
    expect(isLessonDripOutExpired({ courseIsDrip: true, dripOutDays: null, daysSinceEnroll: 100 })).toBe(
      false,
    );
    expect(isLessonDripOutExpired({ courseIsDrip: true, dripOutDays: 0, daysSinceEnroll: 100 })).toBe(false);
  });

  it("expires after dripOutDays when course drip is on", () => {
    expect(isLessonDripOutExpired({ courseIsDrip: true, dripOutDays: 7, daysSinceEnroll: 6 })).toBe(false);
    expect(isLessonDripOutExpired({ courseIsDrip: true, dripOutDays: 7, daysSinceEnroll: 7 })).toBe(true);
  });
});

describe("daysSinceEnrollment", () => {
  it("returns whole days since enrolledAt", () => {
    const enrolledAt = new Date(Date.now() - 3.5 * 86400000);
    expect(daysSinceEnrollment(enrolledAt)).toBe(3);
  });
});

describe("getLesson drip-out wiring", () => {
  it("uses course isDrip and shared drip-out helper", () => {
    const lmsRouter = readProjectFile("server/routers/lmsRouter.ts");
    expect(lmsRouter).toContain("isLessonDripOutExpired");
    expect(lmsRouter).toContain("courseForDrip?.isDrip");
    expect(lmsRouter).not.toMatch(/dripOutDays != null && enrollment\?\.enrolledAt/);
  });

  it("refreshes Stripe LMS access before course player and lesson load", () => {
    const lmsRouter = readProjectFile("server/routers/lmsRouter.ts");
    expect(lmsRouter).toContain("maybeRefreshLearnerLmsAccessFromStripe");
  });
});
