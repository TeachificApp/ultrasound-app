export const ULTRASOUND_EXPO_EVENT_PAGE_TYPES = [
  "landing",
  "attendee",
  "exhibitor",
  "schedule",
  "prospectus",
  "custom",
] as const;

export type UltrasoundExpoEventPageType = (typeof ULTRASOUND_EXPO_EVENT_PAGE_TYPES)[number];

export const ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS = ["public", "registered", "partners"] as const;
export type UltrasoundExpoEventPageAccessLevel = (typeof ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS)[number];

export const ULTRASOUND_EXPO_EVENT_PAGE_TYPE_LABELS: Record<UltrasoundExpoEventPageType, string> = {
  landing: "Event landing page",
  attendee: "Attendee area",
  exhibitor: "Exhibitor area",
  schedule: "Schedule of events",
  prospectus: "Exhibitor prospectus",
  custom: "Custom event page",
};

export const ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LABELS: Record<UltrasoundExpoEventPageAccessLevel, string> = {
  public: "Public",
  registered: "Registered attendees and paid partners",
  partners: "Paid exhibitors and sponsors",
};

export type ExpoAgendaIcsItem = {
  id: number | string;
  title: string;
  startsAt: Date | string;
  endsAt?: Date | string | null;
  description?: string | null;
  locationLabel?: string | null;
};

function icsDate(value: Date | string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(".000", "");
}

function icsEscape(value: string) {
  return value.replace(/[\\;,]/g, (character) => `\\${character}`).replace(/\r?\n/g, "\\n");
}

/** Builds a standards-compatible schedule that imports into Apple, Outlook, and Google Calendar. */
export function buildUltrasoundExpoAgendaIcs(calendarName: string, items: ExpoAgendaIcsItem[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//All About Ultrasound//UltrasoundExpo Event Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];

  for (const item of items) {
    const start = new Date(item.startsAt);
    const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:ultrasoundexpo-agenda-${item.id}@allaboutultrasound.com`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(item.title)}`,
      item.description ? `DESCRIPTION:${icsEscape(item.description)}` : "",
      item.locationLabel ? `LOCATION:${icsEscape(item.locationLabel)}` : "",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export function buildExpoGoogleCalendarUrl(item: Omit<ExpoAgendaIcsItem, "id">) {
  const start = new Date(item.startsAt);
  const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${icsDate(start)}/${icsDate(end)}`,
  });
  if (item.description) params.set("details", item.description);
  if (item.locationLabel) params.set("location", item.locationLabel);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
