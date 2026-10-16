import { describe, expect, it } from "vitest";
import { isApprovedVendorForScope, parseVendorPartnerValues } from "../shared/vendorPartner";
import { isExpoPublicRegistrationType } from "../shared/ultrasoundExpo";

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
});
