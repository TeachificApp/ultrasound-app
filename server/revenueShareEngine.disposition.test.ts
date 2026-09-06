import { describe, expect, it } from "vitest";
import { getPartnerShareDisposition } from "./lib/revenueShareEngine";

describe("revenue share partner disposition", () => {
  it("holds an assigned share as pending until Stripe onboarding is active", () => {
    expect(getPartnerShareDisposition({ stripeAccountId: "acct_partner", onboardingStatus: "onboarding" })).toEqual({
      canTransfer: false,
      pendingReason: "Partner Stripe onboarding is not complete",
    });
  });

  it("allows a transfer only for an active connected partner", () => {
    expect(getPartnerShareDisposition({ stripeAccountId: "acct_partner", onboardingStatus: "active" })).toEqual({
      canTransfer: true,
      pendingReason: null,
    });
  });

  it("does not lose an assigned share when no Stripe account has been connected", () => {
    expect(getPartnerShareDisposition({ onboardingStatus: "onboarding" })).toEqual({
      canTransfer: false,
      pendingReason: "Partner has no connected Stripe account",
    });
  });
});
