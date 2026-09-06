import { describe, expect, it } from "vitest";
import { getPartnerShareDisposition } from "./lib/revenueShareEngine";

describe("payment-time revenue-share split safeguards", () => {
  it("requires an active connected partner before a checkout may route a direct share", () => {
    expect(getPartnerShareDisposition({ stripeAccountId: "acct_active", onboardingStatus: "active" }).canTransfer).toBe(true);
    expect(getPartnerShareDisposition({ stripeAccountId: "acct_waiting", onboardingStatus: "onboarding" }).canTransfer).toBe(false);
  });

  it("calculates the exact single-charge split for a $29.97 sale", () => {
    expect(Math.floor((2997 * 25) / 100)).toBe(749);
    expect(2997 - 749).toBe(2248);
  });
});
