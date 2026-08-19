import { describe, expect, it } from "vitest";
import { findUnapprovedPremiumFreePlanEntitlements } from "../scripts/recurringPaymentAuditRules.mjs";

describe("recurring payment audit premium-free-plan rule", () => {
  it("flags premium brand access linked to an active free membership subscription", () => {
    const exceptions = findUnapprovedPremiumFreePlanEntitlements([
      { family: "brand", stripeStatus: "active", brandTier: "premium", entitlementSource: "membership", priceAmounts: [0] },
      { family: "brand", stripeStatus: "active", brandTier: "free", entitlementSource: "membership", priceAmounts: [0] },
      { family: "brand", stripeStatus: "active", brandTier: "premium", entitlementSource: "stripe", priceAmounts: [997] },
    ]);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].brandTier).toBe("premium");
  });
});
