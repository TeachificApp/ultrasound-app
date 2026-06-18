/**
 * Cohort live-session recurrence expansion (server-side).
 */
import {
  addCalendarDays,
  getLocalHms,
  getLocalWeekday,
  getLocalYmd,
  zonedTimeToUtc,
  type Hms,
  type Ymd,
} from "../../shared/cohortSessionDates";

export type RecurrenceParent = {
  id: number;
  courseId: number;
  cohortGroupId: number | null;
  title: string;
  description: string | null;
  sessionDate: Date;
  durationMinutes: number | null;
  meetingUrl: string | null;
  status: "draft" | "published" | "cancelled";
  timezone: string | null;
  recurrenceRule: "weekly" | "biweekly" | "monthly";
  recurrenceDaysOfWeek: string | null;
  recurrenceEndDate: Date | null;
  recurrenceOccurrenceCount: number | null;
};

export type ExpandedCohortSession = {
  courseId: number;
  cohortGroupId: number | null;
  title: string;
  description: string | null;
  sessionDate: Date;
  durationMinutes: number | null;
  meetingUrl: string | null;
  recordingUrl: null;
  status: "draft" | "published" | "cancelled";
  timezone: string;
  recurrenceRule: null;
  recurrenceDaysOfWeek: null;
  recurrenceInterval: null;
  recurrenceEndDate: null;
  recurrenceOccurrenceCount: null;
  parentSessionId: number;
};

export function parseRecurrenceDays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !Number.isNaN(n) && n >= 0 && n <= 6);
}

export function expandCohortRecurrence(parent: RecurrenceParent): ExpandedCohortSession[] {
  const tz = parent.timezone ?? "America/New_York";
  const parentInstant = new Date(parent.sessionDate);
  const endDate = parent.recurrenceEndDate ? new Date(parent.recurrenceEndDate) : null;
  const maxCount = parent.recurrenceOccurrenceCount ?? 999;
  const allowedDays = parseRecurrenceDays(parent.recurrenceDaysOfWeek);

  const instances: ExpandedCohortSession[] = [];
  let occurrenceNum = 1;

  const pushInstance = (sessionDate: Date) => {
    occurrenceNum++;
    instances.push({
      courseId: parent.courseId,
      cohortGroupId: parent.cohortGroupId,
      title: `${parent.title} (${occurrenceNum})`,
      description: parent.description,
      sessionDate,
      durationMinutes: parent.durationMinutes,
      meetingUrl: parent.meetingUrl,
      recordingUrl: null,
      status: parent.status,
      timezone: tz,
      recurrenceRule: null,
      recurrenceDaysOfWeek: null,
      recurrenceInterval: null,
      recurrenceEndDate: null,
      recurrenceOccurrenceCount: null,
      parentSessionId: parent.id,
    });
  };

  if (parent.recurrenceRule === "monthly") {
    let current = new Date(parentInstant);
    while (occurrenceNum < maxCount) {
      current = new Date(current);
      current.setUTCMonth(current.getUTCMonth() + 1);
      if (endDate && current > endDate) break;
      pushInstance(current);
    }
    return instances;
  }

  const weekStepDays = parent.recurrenceRule === "biweekly" ? 14 : 7;
  const parentYmd = getLocalYmd(parentInstant, tz);
  const parentDow = getLocalWeekday(parentInstant, tz);
  const localTime = getLocalHms(parentInstant, tz);
  const weekStart = addCalendarDays(parentYmd, -parentDow);

  const inclusiveEndInstant = endDate
    ? zonedTimeToUtc(
        addCalendarDays(getLocalYmd(endDate, tz), 1),
        { h: 23, mi: 59, s: 59 },
        tz,
      )
    : null;

  if (allowedDays.length >= 1) {
    const sortedDays = [...new Set(allowedDays)].sort((a, b) => a - b);
    let weekOffset = 0;
    let done = false;

    while (!done && occurrenceNum < maxCount) {
      for (const dow of sortedDays) {
        const targetYmd = addCalendarDays(weekStart, weekOffset * weekStepDays + dow);
        const candidate = zonedTimeToUtc(targetYmd, localTime, tz);

        if (candidate.getTime() <= parentInstant.getTime()) continue;
        if (inclusiveEndInstant && candidate.getTime() >= inclusiveEndInstant.getTime()) {
          done = true;
          break;
        }
        if (occurrenceNum >= maxCount) {
          done = true;
          break;
        }

        if (getLocalWeekday(candidate, tz) !== dow) continue;

        pushInstance(candidate);
      }
      weekOffset++;
      if (weekOffset > 520) break;
    }
    return instances;
  }

  let current = new Date(parentInstant);
  while (occurrenceNum < maxCount) {
    current = new Date(current.getTime() + weekStepDays * 24 * 60 * 60 * 1000);
    if (endDate && current > endDate) break;
    pushInstance(current);
  }
  return instances;
}

// Re-export for tests
export { getLocalWeekday, getLocalYmd, zonedTimeToUtc, type Hms, type Ymd };
