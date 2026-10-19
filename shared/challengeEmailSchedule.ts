/**
 * Challenge-email schedule helpers shared by server delivery paths and admin UI.
 * Daily challenges remain available every day; email reminders are Monday-only.
 */

export const CHALLENGE_EMAIL_TIME_ZONE = "America/New_York";

export function challengeEmailWeekday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHALLENGE_EMAIL_TIME_ZONE,
    weekday: "long",
  }).format(now);
}

export function isChallengeEmailMonday(now: Date = new Date()): boolean {
  return challengeEmailWeekday(now) === "Monday";
}
