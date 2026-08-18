export const PLATFORM_TIMEZONE = "America/New_York";

function partsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

/**
 * MySQL legacy TIMESTAMP values for scheduled content contain the administrator's wall-clock
 * time. Convert those UTC-looking date components into the actual instant for the instance's
 * configured timezone before comparing them with server UTC time.
 */
export function scheduledWallTimeToUtc(date: Date, timeZone = PLATFORM_TIMEZONE): Date {
  const wall = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  };
  const intendedUtcSeconds = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const rendered = partsInTimeZone(new Date(intendedUtcSeconds), timeZone);
  const offsetMs = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, rendered.second) - intendedUtcSeconds;
  return new Date(intendedUtcSeconds - offsetMs + wall.millisecond);
}

export function isScheduledDeadlineOpen(deadline: Date, timeZone: string | null | undefined, now = new Date()): boolean {
  return now < scheduledWallTimeToUtc(deadline, timeZone || PLATFORM_TIMEZONE);
}

/**
 * Accepts an ISO instant unchanged, but interprets zone-less administrator inputs as
 * scheduled wall-clock time in the configured platform timezone. A date-only deadline
 * closes at the end of that platform calendar day.
 */
export function parseScheduledTimestamp(
  value: string | Date,
  timeZone = PLATFORM_TIMEZONE,
  dateOnlyBoundary: "start" | "end" = "end",
): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return platformCalendarDayBoundaryToUtc(value, dateOnlyBoundary, timeZone);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute, second = "0", milliseconds = "0"] = match;
  const wall = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number(milliseconds.padEnd(3, "0"))));
  return scheduledWallTimeToUtc(wall, timeZone);
}

export function formatInTimeZone(
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
  timeZone = PLATFORM_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(value));
}

export function platformCalendarDayBoundaryToUtc(
  dateOnly: string,
  boundary: "start" | "end",
  timeZone = PLATFORM_TIMEZONE,
): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const wallTime = new Date(Date.UTC(
    year,
    month - 1,
    day,
    boundary === "start" ? 0 : 23,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 999,
  ));
  return scheduledWallTimeToUtc(wallTime, timeZone);
}
