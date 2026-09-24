import { describe, expect, it } from "vitest";
import {
  isCachedStripePriceCompatible,
  resolveExpectedCourseStripePrice,
  shouldInvalidateCourseStripeCache,
} from "./lib/stripePriceCache";

describe("LMS cached Stripe Price compatibility", () => {
  it("rejects an active old price when the course price has been reduced", () => {
    const terms = { currency: "usd", pricingType: "one_time", price: 24.97 };
    expect(isCachedStripePriceCompatible({ active: true, currency: "usd", unit_amount: 2997, recurring: null }, terms)).toBe(false);
    expect(isCachedStripePriceCompatible({ active: true, currency: "usd", unit_amount: 2497, recurring: null }, terms)).toBe(true);
  });

  it("requires matching subscription cadence as well as price", () => {
    const terms = { currency: "usd", pricingType: "subscription", price: 29.97, subscriptionInterval: "annual" };
    expect(resolveExpectedCourseStripePrice(terms)).toEqual({
      currency: "usd",
      unitAmount: 2997,
      recurring: { interval: "year", intervalCount: 1 },
    });
    expect(isCachedStripePriceCompatible({
      active: true,
      currency: "usd",
      unit_amount: 2997,
      recurring: { interval: "month", interval_count: 1 },
    }, terms)).toBe(false);
  });

  it("invalidates checkout cache fields only after price-sensitive edits", () => {
    expect(shouldInvalidateCourseStripeCache({ description: "Updated clinical description" })).toBe(false);
    expect(shouldInvalidateCourseStripeCache({ price: 24.97 })).toBe(true);
    expect(shouldInvalidateCourseStripeCache({ subscriptionInterval: "annual" })).toBe(true);
  });
});
