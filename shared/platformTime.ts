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
  };
  const intendedUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const rendered = partsInTimeZone(new Date(intendedUtc), timeZone);
  const offsetMs = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, rendered.second) - intendedUtc;
  return new Date(intendedUtc - offsetMs);
}

export function isScheduledDeadlineOpen(deadline: Date, timeZone: string | null | undefined, now = new Date()): boolean {
  return now < scheduledWallTimeToUtc(deadline, timeZone || PLATFORM_TIMEZONE);
}
