import { formatInTimeZone } from "@shared/platformTime";
import { TRANSACTIONAL_EMAIL_TEAL, TRANSACTIONAL_EMAIL_TINT } from "@shared/transactionalEmailPalette";

/**
 * Renders the schedule details for the exact cohort group assigned to the
 * learner. Used by both delivery and safe admin previews so a date range is
 * never copied manually between cohort runs.
 */
export function renderCurrentCohortGroupSchedule(group: {
  name: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  location?: string | null;
}): string {
  const timezone = "America/New_York";
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  const validDate = (value: Date | string | null | undefined) => value != null && Number.isFinite(new Date(value).getTime());
  const startDate = validDate(group.startDate) ? formatInTimeZone(group.startDate!, dateOptions, timezone) : null;
  const endDate = validDate(group.endDate) ? formatInTimeZone(group.endDate!, dateOptions, timezone) : null;
  const dateRange = startDate && endDate && endDate !== startDate
    ? `${startDate} – ${endDate}`
    : startDate ?? endDate;

  return `<div style="background:${TRANSACTIONAL_EMAIL_TINT};border-left:3px solid ${TRANSACTIONAL_EMAIL_TEAL};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
    <p style="margin:0 0 ${dateRange || group.location ? "8px" : "0"};"><strong>Cohort group:</strong> ${group.name}</p>
    ${dateRange ? `<p style="margin:0${group.location ? " 0 8px" : ""};"><strong>Dates:</strong> ${dateRange}</p>` : ""}
    ${group.location ? `<p style="margin:0;"><strong>Location:</strong> ${group.location}</p>` : ""}
  </div>`;
}
