import { describe, expect, it } from "vitest";
import {
  EXPO_PACKAGE_TYPE_META,
  EXPO_PUBLIC_REGISTRATION_TYPES,
  ULTRASOUND_EXPO_AAUS_LOGO_URL,
  ULTRASOUND_EXPO_LAUNCH_EVENT,
  ULTRASOUND_EXPO_NAME,
  formatExpoMoney,
  isExpoPackageType,
  isExpoPublicRegistrationType,
} from "../shared/ultrasoundExpo";
import { buildUltrasoundExpoAdminAlertEmail, buildUltrasoundExpoThankYouEmail } from "./lib/ultrasoundExpoEmail";
import { hasKnownStripeCheckoutRoute } from "./lib/unmatchedStripePayment";

describe("UltrasoundExpo™ annual-event platform", () => {
  it("keeps the inaugural annual event configured for Orlando on January 16–17, 2028", () => {
    expect(ULTRASOUND_EXPO_NAME).toBe("UltrasoundExpo™");
    expect(ULTRASOUND_EXPO_AAUS_LOGO_URL).toContain("sono-ring4_orig.png");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.startsAtIso).toContain("2028-01-16");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.endsAtIso).toContain("2028-01-17");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.locationLabel).toBe("Orlando, FL · Venue to be announced");
  });

  it("keeps administrative offerings distinct while showing only attendee, exhibit, and sponsor opportunities publicly", () => {
    expect(isExpoPackageType("registrant")).toBe(true);
    expect(isExpoPackageType("exhibitor")).toBe(true);
    expect(isExpoPackageType("sponsor")).toBe(true);
    expect(isExpoPackageType("product")).toBe(true);
    expect(EXPO_PUBLIC_REGISTRATION_TYPES).toEqual(["registrant", "exhibitor", "sponsor"]);
    expect(isExpoPublicRegistrationType("registrant")).toBe(true);
    expect(isExpoPublicRegistrationType("product")).toBe(false);
    expect(isExpoPublicRegistrationType("other")).toBe(false);
    expect(isExpoPackageType("workshop_exhibit")).toBe(false);
    expect(EXPO_PACKAGE_TYPE_META.exhibitor.dashboardLabel).toBe("My exhibits");
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
    expect(formatExpoMoney(1000000)).toBe("$10,000.00");
  });
});
