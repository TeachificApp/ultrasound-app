import { formatInTimeZone } from "@shared/platformTime";

/**
 * Renders schedule details from the exact workshop instance fields. This markup is
 * shared by the delivery handler and the admin preview, so dates are never copied
 * manually from one workshop run to another.
 */
export function renderCurrentWorkshopSchedule(instance: {
  startDate: Date | string;
  endDate?: Date | string | null;
  timezone?: string | null;
  locationType?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
}): string {
  const timezone = instance.timezone || "America/New_York";
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const startDate = formatInTimeZone(instance.startDate, dateOptions, timezone);
  const startTime = formatInTimeZone(instance.startDate, timeOptions, timezone);
  const endDate = instance.endDate ? formatInTimeZone(instance.endDate, dateOptions, timezone) : null;
  const endTime = instance.endDate ? formatInTimeZone(instance.endDate, timeOptions, timezone) : null;
  const schedule = endDate && endDate !== startDate
    ? `${startDate}, ${startTime} – ${endDate}, ${endTime}`
    : `${startDate}, ${startTime}${endTime ? ` – ${endTime}` : ""}`;
  const location = instance.locationType === "virtual"
    ? "Virtual workshop"
    : [instance.venueName, [instance.venueCity, instance.venueState].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return `<div style="background:#f0fbfc;border-left:3px solid #0d9488;padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
    <p style="margin:0 0 8px;"><strong>When:</strong> ${schedule}</p>
    ${location ? `<p style="margin:0;"><strong>Location:</strong> ${location}</p>` : ""}
  </div>`;
}
