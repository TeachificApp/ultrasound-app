import { describe, expect, it } from "vitest";
import {
  EXPO_PACKAGE_TYPE_META,
  EXPO_PUBLIC_REGISTRATION_TYPES,
  ULTRASOUND_EXPO_AAUS_LOGO_URL,
  ULTRASOUND_EXPO_BANNER_URL,
  ULTRASOUND_EXPO_EVENT_DATES_LABEL,
  ULTRASOUND_EXPO_LAUNCH_EVENT,
  ULTRASOUND_EXPO_LOCATION_LABEL,
  ULTRASOUND_EXPO_LOGO_URL,
  ULTRASOUND_EXPO_NAME,
  ULTRASOUND_EXPO_PAGE_EDITOR_PAGES,
  ULTRASOUND_EXPO_SCHEDULE,
  ULTRASOUND_EXPO_SITE_DOMAIN,
  formatExpoMoney,
  getUltrasoundExpoEditorPage,
  getUltrasoundExpoPageSeo,
  isExpoPackageType,
  isExpoPublicRegistrationType,
} from "../shared/ultrasoundExpo";
import { buildUltrasoundExpoAdminAlertEmail, buildUltrasoundExpoThankYouEmail } from "./lib/ultrasoundExpoEmail";
import { hasKnownStripeCheckoutRoute } from "./lib/unmatchedStripePayment";
import { ultrasoundExpoRouter } from "./routers/ultrasoundExpoRouter";
import { getPageSeoForRequest, injectPageSeoIntoHtml } from "./routes/funnelOgMeta";

describe("UltrasoundExpo™ annual-event platform", () => {
  it("keeps the inaugural annual event configured for Orlando with venue TBD on January 11–13, 2028", () => {
    expect(ULTRASOUND_EXPO_NAME).toBe("UltrasoundExpo™");
    expect(ULTRASOUND_EXPO_AAUS_LOGO_URL).toContain("sono-ring4_orig.png");
    expect(ULTRASOUND_EXPO_EVENT_DATES_LABEL).toBe("January 11–13, 2028");
    expect(ULTRASOUND_EXPO_LOCATION_LABEL).toBe("Orlando, Florida · Venue TBD");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.startsAtIso).toContain("2028-01-11");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.endsAtIso).toContain("2028-01-13");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.locationLabel).toBe("Orlando, Florida · Venue TBD");
  });

  it("publishes the Tuesday-through-Thursday standalone schedule before EchoExpo™ begins", () => {
    expect(ULTRASOUND_EXPO_SCHEDULE.days[0]).toMatchObject({
      label: "Tuesday, January 11",
      title: "Opening Day & Destination Evening",
    });
    expect(ULTRASOUND_EXPO_SCHEDULE.days[1]).toMatchObject({
      label: "Wednesday, January 12",
      title: "Education, Expo & Innovation",
    });
    expect(ULTRASOUND_EXPO_SCHEDULE.days[2]).toMatchObject({
      label: "Thursday, January 13",
      title: "CME, ScanLabs & Closing Celebration",
    });
    expect(ULTRASOUND_EXPO_SCHEDULE.days[0].items).toContain("5–8 PM – Expo + Opening Reception");
    expect(ULTRASOUND_EXPO_SCHEDULE.days[1].items).toContain("4 PM – Innovation Stage");
    expect(ULTRASOUND_EXPO_SCHEDULE.days[2].items).toContain("12:30 PM – Closing keynote / awards");
    expect(getUltrasoundExpoEditorPage("program")?.zones.map((zone) => zone.key)).toEqual(expect.arrayContaining([
      "schedule_heading", "schedule_introduction", "friday_schedule", "saturday_schedule", "sunday_schedule",
    ]));
  });

  it("keeps all attendee registration options pending while retaining private partner categories", () => {
    expect(isExpoPackageType("registrant")).toBe(true);
    expect(isExpoPackageType("exhibitor")).toBe(true);
    expect(isExpoPackageType("sponsor")).toBe(true);
    expect(isExpoPackageType("product")).toBe(true);
    expect(EXPO_PUBLIC_REGISTRATION_TYPES).toEqual([]);
    expect(isExpoPublicRegistrationType("registrant")).toBe(false);
    expect(isExpoPublicRegistrationType("exhibitor")).toBe(false);
    expect(isExpoPublicRegistrationType("sponsor")).toBe(false);
    expect(isExpoPublicRegistrationType("product")).toBe(false);
    expect(isExpoPublicRegistrationType("other")).toBe(false);
    expect(isExpoPackageType("workshop_exhibit")).toBe(false);
    expect(EXPO_PACKAGE_TYPE_META.exhibitor.dashboardLabel).toBe("My exhibits");
  });

  it("routes public exhibitor calls to the approval application rather than commerce", async () => {
    const publicSite = await import("node:fs/promises").then(fs => fs.readFile("client/src/pages/UltrasoundExpoSite.tsx", "utf8"));
    expect(publicSite).toContain('const EXHIBITOR_APPLICATION_HREF = "/partner-application?scope=ultrasound_expo&type=exhibitor"');
    expect(publicSite).toContain('Applications open now');
    expect(publicSite).toContain('Apply to Exhibit Now');
    expect(publicSite).not.toContain('href="/exhibit"');
  });

  it("rejects public attendee checkout while registration is coming soon", async () => {
    const caller = ultrasoundExpoRouter.createCaller({} as any);
    await expect(caller.createCheckout({
      packageId: 1,
      attendeeName: "Expo Participant",
      attendeeEmail: "participant@example.com",
      origin: "https://ultrasoundexpo.com",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Attendee registration is coming soon.",
    });
  });

  it("keeps supplied Expo logo and banner artwork separate from the existing hero image", () => {
    expect(ULTRASOUND_EXPO_LOGO_URL).toContain("files.manuscdn.com");
    expect(ULTRASOUND_EXPO_BANNER_URL).toContain("files.manuscdn.com");
  });

  it("builds teal-branded confirmation and admin notices with the actual paid amount", () => {
    const record = {
      attendeeName: "Expo Participant",
      attendeeEmail: "participant@example.com",
      organizationName: "Example Imaging",
      eventName: "UltrasoundExpo™ 2028",
      packageName: "Founding Exhibitor",
      packageType: "exhibitor",
      amountCents: 250000,
      currency: "usd",
      ticketCode: "UEX-1-12",
    };
    const confirmation = buildUltrasoundExpoThankYouEmail(record);
    const alert = buildUltrasoundExpoAdminAlertEmail(record);

    expect(confirmation.subject).toContain("UltrasoundExpo™");
    expect(confirmation.htmlBody).toContain("UltrasoundExpo™ Dashboard");
    expect(alert.htmlBody).toContain("UltrasoundExpo™ administration dashboard");
    expect(confirmation.subject).toContain("Founding Exhibitor");
    expect(confirmation.htmlBody).toContain("$2,500.00");
    expect(confirmation.htmlBody).toContain("UEX-1-12");
    expect(confirmation.htmlBody).toContain("support@allaboutultrasound.com");
    expect(alert.htmlBody).toContain("Example Imaging");
  });

  it("recognizes Expo Stripe checkouts as deliberate fulfillment routes", () => {
    expect(hasKnownStripeCheckoutRoute({}, { type: "ultrasound_expo" })).toBe(true);
    expect(hasKnownStripeCheckoutRoute({}, { type: "ultrasound_expo_combined" })).toBe(true);
    expect(formatExpoMoney(1000000)).toBe("$10,000.00");
  });

  it("defines customer-facing SEO and editable entries for every public Expo screen", () => {
    expect(ULTRASOUND_EXPO_SITE_DOMAIN).toBe("ultrasoundexpo.com");
    expect(ULTRASOUND_EXPO_PAGE_EDITOR_PAGES.map((page) => page.slug)).toEqual([
      "home", "attend", "exhibit", "sponsor", "program", "expo", "connect", "about", "register", "expo-dashboard",
    ]);
    expect(getUltrasoundExpoEditorPage("register")?.zones.map((zone) => zone.key)).toContain("checkout_headline");
    expect(getUltrasoundExpoPageSeo("home").title).toBe("UltrasoundExpo™ | The Annual Event for Ultrasound Professionals");
    expect(getUltrasoundExpoPageSeo("home").description).toContain("All About Ultrasound™");
  });

  it("serves an Expo-specific search preview without relying on the generic app metadata", async () => {
    const request = {
      hostname: "ultrasoundexpo.com",
      path: "/register",
      originalUrl: "/register",
      protocol: "https",
      headers: {},
      get: (header: string) => (header.toLowerCase() === "host" ? "ultrasoundexpo.com" : undefined),
    } as any;
    const seo = await getPageSeoForRequest(request);
    expect(seo?.title).toBe("UltrasoundExpo™ Attendee Registration Coming Soon");
    const rendered = injectPageSeoIntoHtml(
      '<html><head><title>Generic</title><meta property="og:url" content="https://ultrasoundexpo.com" /></head><body></body></html>',
      seo!,
      request,
    );
    expect(rendered).toContain('content="https://ultrasoundexpo.com/register"');
    expect(rendered.match(/property="og:url"/g)).toHaveLength(1);
    expect(rendered).toContain('data-page-seo="1"');
  });

  it("serves UltrasoundExpo™ metadata at the root domain instead of UltrasoundAssist™ metadata", async () => {
    const request = {
      hostname: "ultrasoundexpo.com",
      path: "/",
      originalUrl: "/",
      protocol: "https",
      headers: {},
      get: (header: string) => (header.toLowerCase() === "host" ? "ultrasoundexpo.com" : undefined),
    } as any;
    const seo = await getPageSeoForRequest(request);
    expect(seo?.title).toBe("UltrasoundExpo™ | The Annual Event for Ultrasound Professionals");
    const rendered = injectPageSeoIntoHtml(
      '<html><head><title>UltrasoundAssist™ — Clinical Ultrasound App</title><meta name="description" content="Clinical app" /><meta property="og:title" content="UltrasoundAssist™ — Clinical Ultrasound App" /></head><body></body></html>',
      seo!,
      request,
    );
    expect(rendered).toContain('<title>UltrasoundExpo™ | The Annual Event for Ultrasound Professionals</title>');
    expect(rendered).not.toContain('UltrasoundAssist™ — Clinical Ultrasound App');
  });
});
