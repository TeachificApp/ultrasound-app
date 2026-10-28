import { describe, expect, it } from "vitest";
import {
  EXPO_COMBINED_DISCOUNT_BASIS_POINTS,
  calculateExpoCombinedOfferPricing,
} from "../shared/expoCombinedOffer";

describe("Expo combined-event offer pricing", () => {
  it("applies a 20% discount while preserving an allocated line amount for each event", () => {
    const result = calculateExpoCombinedOfferPricing(250_000, 100_000);

    expect(EXPO_COMBINED_DISCOUNT_BASIS_POINTS).toBe(2_000);
    expect(result).toEqual({
      baseTotalCents: 350_000,
      discountCents: 70_000,
      totalCents: 280_000,
      discountedLineAmounts: [200_000, 80_000],
    });
  });

  it("keeps both discounted Stripe line items at or above Stripe's payment minimum", () => {
    expect(() => calculateExpoCombinedOfferPricing(50, 100)).toThrow("at least $0.63");
    expect(calculateExpoCombinedOfferPricing(63, 63).discountedLineAmounts).toEqual([50, 50]);
  });
});
