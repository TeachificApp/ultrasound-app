import { describe, expect, it } from "vitest";
import {
  formatSponsorshipAmount,
  resolveSponsorshipAmountCents,
  SPONSORSHIP_TIERS,
  sponsorshipTargetLabel,
} from "../shared/sponsorship";
import { buildAdminSponsorshipAlertEmail, buildSponsorThankYouEmail } from "./lib/sponsorshipEmail";

describe("sponsorship definitions", () => {
  it("keeps the published workshop sponsorship tiers at their approved amounts", () => {
    expect(SPONSORSHIP_TIERS.silver.amountCents).toBe(250_000);
    expect(SPONSORSHIP_TIERS.gold.amountCents).toBe(500_000);
    expect(SPONSORSHIP_TIERS.platinum.amountCents).toBe(800_000);
    expect(resolveSponsorshipAmountCents({ tier: "other", customAmountCents: 12_345 })).toBe(12_345);
  });

  it("labels a selected workshop instance with the workshop and instance title", () => {
    expect(sponsorshipTargetLabel({ scope: "workshop_instance", workshopTitle: "Fetal Echo", workshopInstanceTitle: "Orlando 2027" }))
      .toBe("Fetal Echo — Orlando 2027");
    expect(formatSponsorshipAmount(250_000)).toBe("$2,500.00");
  });

  it("offers Sonographer’s After Dark podcast sponsorship as a named support option", () => {
    expect(sponsorshipTargetLabel({ scope: "podcast" })).toBe("Sonographer’s After Dark podcast sponsorship");
  });
});

describe("sponsorship transactional emails", () => {
  const record = {
    contactName: "Avery <Vendor>",
    contactEmail: "avery@example.test",
    organizationName: "Acme & Co.",
    tier: "platinum" as const,
    scope: "workshop_instance" as const,
    amountCents: 800_000,
    currency: "usd",
    workshopTitle: "Fetal Echocardiography",
    workshopInstanceTitle: "Daytona Beach 2027",
  };

  it("provides a branded sponsor thank-you with support contact details", () => {
    const email = buildSponsorThankYouEmail(record);
    expect(email.subject).toContain("Thank you");
    expect(email.htmlBody).toContain("support@allaboutultrasound.com");
    expect(email.htmlBody).toContain("$8,000.00");
    expect(email.htmlBody).toContain("Fetal Echocardiography — Daytona Beach 2027");
    expect(email.htmlBody).not.toContain("Avery <Vendor>");
    expect(email.htmlBody).toContain("Avery &lt;Vendor&gt;");
  });

  it("gives administrators the organization, contact, amount, and selected support target", () => {
    const email = buildAdminSponsorshipAlertEmail(record);
    expect(email.subject).toContain("Acme & Co.");
    expect(email.htmlBody).toContain("avery@example.test");
    expect(email.htmlBody).toContain("Platinum");
    expect(email.htmlBody).toContain("$8,000.00");
    expect(email.htmlBody).toContain("Daytona Beach 2027");
  });
});
