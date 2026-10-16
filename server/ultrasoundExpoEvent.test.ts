import { describe, expect, it } from "vitest";
import {
  buildExpoGoogleCalendarUrl,
  buildUltrasoundExpoAgendaIcs,
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPES,
} from "../shared/ultrasoundExpoEvent";

describe("UltrasoundExpo™ event instances", () => {
  it("exports a standards-compatible multi-session event calendar", () => {
    const ics = buildUltrasoundExpoAgendaIcs("UltrasoundExpo™ 2028", [{
      id: 8,
      title: "Opening reception",
      startsAt: new Date("2028-01-14T22:00:00.000Z"),
      endsAt: new Date("2028-01-15T00:00:00.000Z"),
      description: "Connect with peers, exhibitors, and sponsors.",
      locationLabel: "Orlando, FL",
    }]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Opening reception");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("creates a Google Calendar-ready link for individual agenda items", () => {
    const url = buildExpoGoogleCalendarUrl({
      title: "UltrasoundExpo™ session",
      startsAt: new Date("2028-01-14T22:00:00.000Z"),
      locationLabel: "Orlando, FL",
    });
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
  });

  it("supports public, registered, and paid-partner event pages without making access implicit", () => {
    expect(ULTRASOUND_EXPO_EVENT_PAGE_TYPES).toEqual(expect.arrayContaining(["landing", "attendee", "exhibitor", "schedule", "prospectus", "custom"]));
    expect(ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS).toEqual(["public", "registered", "partners"]);
  });

  it("keeps event-instance privacy enforcement and profile uploads in the dedicated Expo router", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile("server/routers/ultrasoundExpoEventRouter.ts", "utf8"));
    expect(source).toContain("assertPaidEventAccess");
    expect(source).toContain("getEventPage: publicProcedure");
    expect(source).toContain("accessLevel === \"partners\"");
    expect(source).toContain("saveMyPartnerProfile");
    expect(source).toContain("uploadPartnerDocument");
    expect(source).toContain("createRecordingCheckout");
    expect(source).toContain("buildUltrasoundExpoAgendaIcs");
  });

  it("keeps event-specific terms, pages, community access, and recordings additive", async () => {
    const [eventRouter, eventSchema, webhook] = await Promise.all([
      import("node:fs/promises").then(fs => fs.readFile("server/routers/ultrasoundExpoRouter.ts", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("drizzle/schema.ts", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("server/webhooks/stripe.ts", "utf8")),
    ]);
    expect(eventRouter).toContain("registrationTerms");
    expect(eventRouter).toContain("attendeeInstructions");
    expect(eventRouter).toContain("partnerInstructions");
    expect(eventSchema).toContain("ultrasoundExpoEventPages");
    expect(eventSchema).toContain("ultrasoundExpoPartnerProfiles");
    expect(eventSchema).toContain("ultrasoundExpoRecordings");
    expect(webhook).toContain("grantUltrasoundExpoEventCommunityAccess");
  });
});
