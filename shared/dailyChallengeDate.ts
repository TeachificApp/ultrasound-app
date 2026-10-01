export const DAILY_CHALLENGE_TIME_ZONE = "America/New_York";

/**
 * Returns the calendar date used by Daily Challenge publishing, presentation,
 * and attempt tracking. Daily Challenge runs on Eastern Time, so no user sees
 * tomorrow's archive before the next 6 AM Eastern release window.
 */
export function getDailyChallengeDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_CHALLENGE_TIME_ZONE,
  }).format(now);
}
