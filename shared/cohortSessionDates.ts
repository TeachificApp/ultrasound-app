/**
 * Shared helpers for cohort session timezone-aware dates and calendar display.
 */

export type Ymd = { y: number; m: number; d: number };
export type Hms = { h: number; mi: number; s: number };

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function getLocalYmd(instant: Date, timeZone: string): Ymd {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant).split("-");
  return { y: parseInt(y, 10), m: parseInt(m, 10), d: parseInt(d, 10) };
}

export function getLocalWeekday(instant: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  return WEEKDAY_MAP[wd] ?? instant.getUTCDay();
}

export function getLocalHms(instant: Date, timeZone: string): Hms {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);
  return { h: get("hour") % 24, mi: get("minute"), s: get("second") };
}

export function addCalendarDays(ymd: Ymd, days: number): Ymd {
  const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Convert wall-clock local time in `timeZone` to a UTC instant */
export function zonedTimeToUtc(ymd: Ymd, hms: Hms, timeZone: string): Date {
  let utcMs = Date.UTC(ymd.y, ymd.m - 1, ymd.d, hms.h, hms.mi, hms.s);
  for (let i = 0; i < 6; i++) {
    const gotYmd = getLocalYmd(new Date(utcMs), timeZone);
    const gotHms = getLocalHms(new Date(utcMs), timeZone);
    const dayDiff =
      Date.UTC(ymd.y, ymd.m - 1, ymd.d) - Date.UTC(gotYmd.y, gotYmd.m - 1, gotYmd.d);
    const secDiff =
      (hms.h * 3600 + hms.mi * 60 + hms.s) -
      (gotHms.h * 3600 + gotHms.mi * 60 + gotHms.s);
    const adjustMs = dayDiff + secDiff * 1000;
    if (adjustMs === 0) break;
    utcMs += adjustMs;
  }
  return new Date(utcMs);
}

/** YYYY-MM-DD in the session's timezone */
export function sessionLocalDateKey(sessionDate: Date | string, timeZone: string): string {
  const ymd = getLocalYmd(new Date(sessionDate), timeZone);
  return `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
}

export function isSessionOnCalendarDay(
  sessionDate: Date | string,
  year: number,
  month: number, // 0-indexed
  day: number,
  timeZone: string,
): boolean {
  const key = sessionLocalDateKey(sessionDate, timeZone);
  const cellKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return key === cellKey;
}
