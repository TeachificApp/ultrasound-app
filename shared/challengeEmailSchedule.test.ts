import { describe, expect, it } from "vitest";
import {
  CHALLENGE_EMAIL_TIME_ZONE,
  challengeEmailWeekday,
  isChallengeEmailMonday,
} from "./challengeEmailSchedule";

describe("challenge email schedule", () => {
  it("uses Eastern Time as the single schedule authority", () => {
    expect(CHALLENGE_EMAIL_TIME_ZONE).toBe("America/New_York");
  });

  it("allows weekly challenge email delivery on Monday in Eastern Time", () => {
    const mondayEastern = new Date("2026-10-19T14:00:00.000Z");
    expect(challengeEmailWeekday(mondayEastern)).toBe("Monday");
    expect(isChallengeEmailMonday(mondayEastern)).toBe(true);
  });

  it("blocks weekly challenge email delivery on other Eastern Time weekdays", () => {
    const sundayEastern = new Date("2026-10-18T23:00:00.000Z");
    const tuesdayEastern = new Date("2026-10-20T14:00:00.000Z");
    expect(isChallengeEmailMonday(sundayEastern)).toBe(false);
    expect(isChallengeEmailMonday(tuesdayEastern)).toBe(false);
  });

  it("does not accidentally use UTC near the Eastern Time day boundary", () => {
    const mondayInUtcButSundayEastern = new Date("2026-10-19T02:30:00.000Z");
    expect(challengeEmailWeekday(mondayInUtcButSundayEastern)).toBe("Sunday");
    expect(isChallengeEmailMonday(mondayInUtcButSundayEastern)).toBe(false);
  });
});
