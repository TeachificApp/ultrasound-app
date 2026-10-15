import { formatInTimeZone } from "@shared/platformTime";

/**
 * Renders the schedule details for the webinar configured on the purchased
 * webinar record. This is shared by delivery and safe admin previews so the
 * visible date, time zone, duration, and live-access guidance stay identical.
 */
export function renderCurrentWebinarSchedule(webinar: {
  scheduledAt?: Date | string | number | null;
  durationMinutes?: number | null;
  timezone?: string | null;
  type?: string | null;
  meetingUrl?: string | null;
}): string {
  const timezone = webinar.timezone || "America/New_York";
  const scheduledAt = webinar.scheduledAt == null ? null : new Date(webinar.scheduledAt);
  const hasSchedule = scheduledAt != null && Number.isFinite(scheduledAt.getTime());
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const dateText = hasSchedule ? formatInTimeZone(scheduledAt, dateOptions, timezone) : null;
  const startTime = hasSchedule ? formatInTimeZone(scheduledAt, timeOptions, timezone) : null;
  const endTime = hasSchedule && webinar.durationMinutes && webinar.durationMinutes > 0
    ? formatInTimeZone(new Date(scheduledAt.getTime() + webinar.durationMinutes * 60_000), timeOptions, timezone)
    : null;
  const schedule = dateText && startTime ? `${dateText}, ${startTime}${endTime ? ` – ${endTime}` : ""}` : null;
  const liveAccess = webinar.type === "live"
    ? "the session details are available from your webinar page."
    : null;

  return `<div style="background:#f0fbfc;border-left:3px solid #0d9488;padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
    ${schedule ? `<p style="margin:0${liveAccess ? " 0 8px" : ""};"><strong>When:</strong> ${schedule}</p>` : "<p style=\"margin:0;\"><strong>When:</strong> Date and time to be announced</p>"}
    ${liveAccess ? `<p style="margin:0;"><strong>Live access:</strong> ${liveAccess}</p>` : ""}
  </div>`;
}
