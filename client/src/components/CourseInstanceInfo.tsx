/**
 * CourseInstanceInfo.tsx
 * Shared component that renders date/venue/waitlist info on workshop and cohort course cards.
 *
 * - Workshop: shows next upcoming instance start–end date, venue name, city/state
 * - Cohort: shows primary open/active cohort group name, start–end date
 * - If no instance/group: shows "Enrollment Closed — Join Waitlist"
 */
import { Calendar, MapPin, Clock } from "lucide-react";

interface NextInstance {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  locationType?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
}

interface PrimaryCohortGroup {
  name?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

interface Props {
  type: "workshop" | "cohort";
  nextInstance?: NextInstance | null;
  primaryCohortGroup?: PrimaryCohortGroup | null;
  accentColor?: string;
  compact?: boolean;
}

function formatDateRange(start: Date | string | null | undefined, end: Date | string | null | undefined): string {
  if (!start) return "";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!end) return s.toLocaleDateString("en-US", opts);
  const e = new Date(end);
  // Same year: "Jun 12 – 14, 2026" or "Jun 12 – Jul 5, 2026"
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

export function CourseInstanceInfo({ type, nextInstance, primaryCohortGroup, accentColor = "#179ca3", compact = false }: Props) {
  const accent = accentColor;

  if (type === "workshop") {
    if (!nextInstance || !nextInstance.startDate) {
      return (
        <div className={`flex items-center gap-1.5 ${compact ? "text-[10px]" : "text-xs"} text-amber-600 font-medium`}>
          <Clock size={compact ? 10 : 12} className="flex-shrink-0" />
          <span>Enrollment Closed — Join Waitlist</span>
        </div>
      );
    }
    const dateStr = formatDateRange(nextInstance.startDate, nextInstance.endDate);
    const isVirtual = nextInstance.locationType === "virtual" || nextInstance.locationType === "online";
    const locationParts = isVirtual
      ? ["Virtual / Online"]
      : [nextInstance.venueName, [nextInstance.venueCity, nextInstance.venueState].filter(Boolean).join(", ")].filter(Boolean);
    const locationStr = locationParts.join(" · ");

    return (
      <div className={`space-y-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
        {dateStr && (
          <div className="flex items-center gap-1.5 font-medium" style={{ color: accent }}>
            <Calendar size={compact ? 10 : 12} className="flex-shrink-0" />
            <span>{dateStr}</span>
          </div>
        )}
        {locationStr && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <MapPin size={compact ? 10 : 12} className="flex-shrink-0" />
            <span className="truncate">{locationStr}</span>
          </div>
        )}
      </div>
    );
  }

  // Cohort
  if (!primaryCohortGroup || !primaryCohortGroup.startDate) {
    return (
      <div className={`flex items-center gap-1.5 ${compact ? "text-[10px]" : "text-xs"} text-amber-600 font-medium`}>
        <Clock size={compact ? 10 : 12} className="flex-shrink-0" />
        <span>Enrollment Closed — Join Waitlist</span>
      </div>
    );
  }

  const dateStr = formatDateRange(primaryCohortGroup.startDate, primaryCohortGroup.endDate);
  return (
    <div className={`space-y-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
      {primaryCohortGroup.name && (
        <div className="flex items-center gap-1.5 font-medium truncate" style={{ color: accent }}>
          <Calendar size={compact ? 10 : 12} className="flex-shrink-0" />
          <span className="truncate">{primaryCohortGroup.name}</span>
        </div>
      )}
      {dateStr && (
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock size={compact ? 10 : 12} className="flex-shrink-0" />
          <span>{dateStr}</span>
        </div>
      )}
    </div>
  );
}
