import { describe, expect, it } from "vitest";
import {
  buildExpoGoogleCalendarUrl,
  buildUltrasoundExpoAgendaIcs,
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPES,
} from "../shared/ultrasoundExpoEvent";
import { EXPO_TENANT_CONFIG, getExpoTenantForHostname } from "../shared/expoTenant";

describe("UltrasoundExpo™ event instances", () => {
  it("keeps EchoExpo marketing-only while sharing UltrasoundExpo administration", () => {
    expect(getExpoTenantForHostname("echocardiographyexpo.com")).toBe("echo_expo");
    expect(getExpoTenantForHostname("www.echocardiographyexpo.com")).toBe("echo_expo");
    expect(getExpoTenantForHostname("echoexpo.iheartecho.com")).toBe("echo_expo");
    expect(EXPO_TENANT_CONFIG.echo_expo.origin).toBe("https://echoexpo.iheartecho.com");
    expect(EXPO_TENANT_CONFIG.echo_expo.partnerScope).toBe("ultrasound_expo");
    expect(EXPO_TENANT_CONFIG.echo_expo.adminPath).toBe("/admin/ultrasound-expo");
  });

  it("serves Expo management on the app admin domain used by the profile menu", async () => {
    const [appSource, navSource] = await Promise.all([
      import("node:fs/promises").then(fs => fs.readFile("client/src/App.tsx", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("client/src/components/LMSLayout.tsx", "utf8")),
    ]);
    expect(navSource).toContain('getAdminUrl("/admin/ultrasound-expo")');
    expect(appSource).toContain('<Route path="/admin/ultrasound-expo">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><UltrasoundExpoAdmin /></RoleGuard>}</Route>');
    expect(appSource).toContain('<Route path="/admin/ultrasound-expo/events/:eventId/pages/:pageId/edit">');
  });

  it("gives EchoExpo a full public event navigation while tagging shared operations as EchoExpo", async () => {
    const [echoSite, appSource, registrationPage] = await Promise.all([
      import("node:fs/promises").then(fs => fs.readFile("client/src/pages/EchoExpoSite.tsx", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("client/src/App.tsx", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("client/src/pages/UltrasoundExpoRegister.tsx", "utf8")),
    ]);
    expect(echoSite).toContain('"/attend"');
    expect(echoSite).toContain('"/exhibit"');
    expect(echoSite).toContain('"/sponsor"');
    expect(echoSite).toContain('"/program"');
    expect(echoSite).toContain('"/expo"');
    expect(echoSite).toContain('event=echoexpo');
    expect(echoSite).toContain('ULTRASOUND_EXPO_ORIGIN');
    expect(appSource).toContain('function EchoExpoMarketingRouter()');
    expect(appSource).toContain('<Route path="/partner-application" component={PartnerApplication} />');
    expect(registrationPage).toContain('isEchoExpoDomain()');
  });

  it("features the cardiac EchoExpo pathway on UltrasoundExpo and uses a dedicated cardiac hero", async () => {
    const [ultrasoundSite, echoSite] = await Promise.all([
      import("node:fs/promises").then(fs => fs.readFile("client/src/pages/UltrasoundExpoSite.tsx", "utf8")),
      import("node:fs/promises").then(fs => fs.readFile("client/src/pages/EchoExpoSite.tsx", "utf8")),
    ]);
    expect(ultrasoundSite).toContain("Inside UltrasoundExpo™");
    expect(ultrasoundSite).toContain("Explore EchoExpo™");
    expect(ultrasoundSite).toContain("https://www.echocardiographyexpo.com/");
    expect(echoSite).toContain("by iHeartEcho™");
    expect(echoSite).toContain("echoexpo-logo_535dff69.png");
    expect(echoSite).toContain("Echo<span");
    expect(echoSite).toContain("h-12 w-12 shrink-0");
    expect(echoSite).toContain("echoexpo-tradeshow-hero-simplified_8272f5e4.png");
    expect(echoSite).toContain("discreet left-chest cardiac ultrasound demonstration");
    expect(echoSite).toContain("Everything Echo.");
    expect(echoSite).toContain("One Place.");
  });

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
