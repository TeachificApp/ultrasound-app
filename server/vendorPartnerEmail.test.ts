import { describe, expect, it } from "vitest";
import {
  buildVendorApplicationAdminAlertEmail,
  buildVendorApplicationReceivedEmail,
} from "./lib/vendorPartnerEmail";

describe("vendor partner event-interest email content", () => {
  const application = {
    organizationName: "Example Organization",
    contactName: "Example Contact",
    contactEmail: "contact@example.test",
    contactPhone: "555-0100",
    requestedScopes: ["ultrasound_expo"] as const,
    partnerTypes: ["exhibitor"] as const,
    eventInterests: ["ultrasound_expo", "echo_expo"] as const,
  };

  it("shows both selected Expo interests to the applicant and administrator", () => {
    const received = buildVendorApplicationReceivedEmail(application);
    const adminAlert = buildVendorApplicationAdminAlertEmail(application);

    for (const html of [received.htmlBody, adminAlert.htmlBody]) {
      expect(html).toContain("UltrasoundExpo™");
      expect(html).toContain("EchoExpo™");
    }
  });
});
