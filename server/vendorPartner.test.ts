import { describe, expect, it } from "vitest";
import { isApprovedVendorForScope, parseVendorPartnerValues } from "../shared/vendorPartner";
import { formatExpoEventInterests, normalizeExpoEventInterests } from "../shared/expoTenant";
import { isExpoPublicRegistrationType } from "../shared/ultrasoundExpo";
import { getVerifiedSharedAccountLink, normalizeOrganizationWebsiteInput } from "./routers/vendorPortalRouter";

describe("approved vendor partner access", () => {
  const approvedExpoVendor = {
    status: "approved",
    linkedUserId: 42,
    aausAccess: false,
    expoAccess: true,
  };

  it("ties access to the approved shared-account user and scope, not a submitted email", () => {
    expect(isApprovedVendorForScope(approvedExpoVendor, 42, "ultrasound_expo")).toBe(true);
    expect(isApprovedVendorForScope(approvedExpoVendor, 41, "ultrasound_expo")).toBe(false);
    expect(isApprovedVendorForScope(approvedExpoVendor, 42, "aaus_ihe")).toBe(false);
    expect(isApprovedVendorForScope({ ...approvedExpoVendor, status: "pending" }, 42, "ultrasound_expo")).toBe(false);
  });

  it("keeps public Expo registration pending while partner categories remain private", () => {
    expect(isExpoPublicRegistrationType("registrant")).toBe(false);
    expect(isExpoPublicRegistrationType("exhibitor")).toBe(false);
    expect(isExpoPublicRegistrationType("sponsor")).toBe(false);
  });

  it("parses only recognized application scopes and partner types", () => {
    expect(parseVendorPartnerValues('["aaus_ihe","untrusted","ultrasound_expo"]', ["aaus_ihe", "ultrasound_expo"] as const))
      .toEqual(["aaus_ihe", "ultrasound_expo"]);
    expect(parseVendorPartnerValues('["vendor","exhibitor","sponsor"]', ["vendor", "exhibitor", "sponsor"] as const))
      .toEqual(["vendor", "exhibitor", "sponsor"]);
  });

  it("retains both distinct Expo interests while preserving legacy single-focus applications", () => {
    expect(normalizeExpoEventInterests('["ultrasound_expo","echo_expo","untrusted"]'))
      .toEqual(["ultrasound_expo", "echo_expo"]);
    expect(normalizeExpoEventInterests(null, "echo_expo")).toEqual(["echo_expo"]);
    expect(formatExpoEventInterests(["ultrasound_expo", "echo_expo"]))
      .toBe("UltrasoundExpo™ · EchoExpo™");
  });

  it("accepts a domain-only organization website and normalizes it for storage", () => {
    expect(normalizeOrganizationWebsiteInput("sonamedicalsolutions.com")).toBe("https://sonamedicalsolutions.com");
    expect(normalizeOrganizationWebsiteInput(" www.sonamedicalsolutions.com ")).toBe("https://www.sonamedicalsolutions.com");
    expect(normalizeOrganizationWebsiteInput("https://sonamedicalsolutions.com")).toBe("https://sonamedicalsolutions.com");
    expect(normalizeOrganizationWebsiteInput("")).toBe("");
  });

  it("links an exhibitor application only to the matching signed-in Learn account", () => {
    expect(getVerifiedSharedAccountLink("learner@example.com", { id: 42, email: "LEARNER@example.com" })).toBe(42);
    expect(getVerifiedSharedAccountLink("vendor@example.com", { id: 42, email: "learner@example.com" })).toBeNull();
    expect(getVerifiedSharedAccountLink("learner@example.com", null)).toBeNull();
  });
});
