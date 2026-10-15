import { describe, expect, it } from "vitest";
import {
  EXPO_PACKAGE_TYPE_META,
  ULTRASOUND_EXPO_LAUNCH_EVENT,
  formatExpoMoney,
  isExpoPackageType,
} from "../shared/ultrasoundExpo";
import { buildUltrasoundExpoAdminAlertEmail, buildUltrasoundExpoThankYouEmail } from "./lib/ultrasoundExpoEmail";
import { hasKnownStripeCheckoutRoute } from "./lib/unmatchedStripePayment";

describe("UltrasoundExpo annual-event platform", () => {
  it("keeps the inaugural annual event configured for Orlando on January 16–17, 2028", () => {
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.startsAtIso).toContain("2028-01-16");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.endsAtIso).toContain("2028-01-17");
    expect(ULTRASOUND_EXPO_LAUNCH_EVENT.locationLabel).toBe("Orlando, FL · Venue to be announced");
  });

  it("keeps Expo event registrations, exhibits, sponsors, products, and other options distinct", () => {
    expect(isExpoPackageType("registrant")).toBe(true);
    expect(isExpoPackageType("exhibitor")).toBe(true);
    expect(isExpoPackageType("sponsor")).toBe(true);
    expect(isExpoPackageType("product")).toBe(true);
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
