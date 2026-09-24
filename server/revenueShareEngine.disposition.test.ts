import { describe, expect, it } from "vitest";
import { derivePartnerOnboardingStatus, getPartnerShareDisposition, normalizeStripePaymentIntentId } from "./lib/revenueShareEngine";

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

  it("marks a fully enabled Stripe account active without treating eventually due fields as incomplete onboarding", () => {
    expect(derivePartnerOnboardingStatus({ detailsSubmitted: true, payoutsEnabled: true })).toBe("active");
    expect(derivePartnerOnboardingStatus({ detailsSubmitted: true, payoutsEnabled: false })).toBe("restricted");
    expect(derivePartnerOnboardingStatus({ detailsSubmitted: false, payoutsEnabled: false })).toBe("onboarding");
  });

  it("preserves the payment intent ID when Stripe returns an expanded checkout reference", () => {
    expect(normalizeStripePaymentIntentId("pi_string_reference")).toBe("pi_string_reference");
    expect(normalizeStripePaymentIntentId({ id: "pi_expanded_reference" })).toBe("pi_expanded_reference");
    expect(normalizeStripePaymentIntentId({ object: "payment_intent" })).toBeNull();
  });
});
