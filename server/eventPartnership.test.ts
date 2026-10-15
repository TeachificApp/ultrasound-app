import { describe, expect, it } from "vitest";
import { EVENT_PARTNERSHIP_TYPES, formatEventPartnershipAmount, isEventPartnershipType } from "../shared/eventPartnership";
import { buildAdminEventPartnershipAlertEmail, buildEventPartnershipThankYouEmail } from "./lib/eventPartnershipEmail";
import { hasKnownStripeCheckoutRoute } from "./lib/unmatchedStripePayment";

describe("event partnership program", () => {
  it("keeps workshop exhibits distinct from webinar sponsorships", () => {
    expect(EVENT_PARTNERSHIP_TYPES.workshop_exhibit.contactLabel).toBe("Exhibitor");
    expect(EVENT_PARTNERSHIP_TYPES.webinar_sponsor.contactLabel).toBe("Sponsor");
    expect(isEventPartnershipType("workshop_exhibit")).toBe(true);
    expect(isEventPartnershipType("sponsorship")).toBe(false);
  });

  it("formats configured package amounts for the public checkout", () => {
    expect(formatEventPartnershipAmount(250000)).toBe("$2,500.00");
  });

  it("renders a teal-branded thank-you and administrator alert with the event and paid amount", () => {
    const record = {
      targetType: "workshop_exhibit" as const,
      targetTitle: "Fetal Echo Workshop — Daytona Beach",
      packageName: "Tabletop exhibit",
      contactName: "Event Partner",
      contactEmail: "partner@example.com",
      organizationName: "Example Organization",
      amountCents: 250000,
      currency: "usd",
    };
    const thankYou = buildEventPartnershipThankYouEmail(record);
    const alert = buildAdminEventPartnershipAlertEmail(record);
    expect(thankYou.subject).toContain("Workshop exhibit");
    expect(thankYou.htmlBody).toContain("Fetal Echo Workshop");
    expect(thankYou.htmlBody).toContain("$2,500.00");
    expect(thankYou.htmlBody).toContain("support@allaboutultrasound.com");
    expect(alert.htmlBody).toContain("Example Organization");
  });

  it("recognizes event-partnership Stripe checkout metadata as fulfilled", () => {
    expect(hasKnownStripeCheckoutRoute({}, { type: "event_partnership" })).toBe(true);
  });
});
