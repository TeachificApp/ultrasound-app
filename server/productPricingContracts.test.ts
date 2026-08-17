import { describe, expect, it } from "vitest";
import { dollarsToStripeCents } from "./lib/stripePriceUnits";
import { resolveWebinarPricing } from "./routers/webinarRouter";

describe("cross-product price contracts", () => {
  it("converts dollar-priced downloads, physical products, bundles, and cohort/course prices once for Stripe", () => {
    for (const price of ["7.00", "97.00", "299.97", "2297.00"]) {
      expect(dollarsToStripeCents(price)).toBe(Math.round(Number(price) * 100));
    }
  });

  it("converts webinar pricing-option dollars once while retaining a cents payload for Stripe", () => {
    expect(resolveWebinarPricing({ accessType: "paid", pricingOptions: JSON.stringify([{ id: "standard", price: 99.97 }]) }, "standard"))
      .toMatchObject({ isFree: false, priceCents: 9997 });
  });

  it("keeps a free webinar at zero cents without a Stripe payment amount", () => {
    expect(resolveWebinarPricing({ accessType: "free", pricingOptions: null })).toMatchObject({ isFree: true, priceCents: 0 });
  });
});
