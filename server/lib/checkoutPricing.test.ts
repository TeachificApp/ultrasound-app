import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  assertClientPriceMatches,
  computeFunnelCheckoutTotalCents,
} from "./checkoutPricing";

describe("checkoutPricing", () => {
  it("assertClientPriceMatches accepts matching values", () => {
    expect(() => assertClientPriceMatches(9700, 9700)).not.toThrow();
  });

  it("assertClientPriceMatches rejects mismatch", () => {
    expect(() => assertClientPriceMatches(100, 9700)).toThrow(TRPCError);
  });

  it("computeFunnelCheckoutTotalCents sums product and bumps stored as dollars, returns cents", () => {
    const block = {
      data: {
        products: [{ name: "Course", price: 97 }],
        orderBumps: [{ title: "Bump", price: 27 }],
      },
    };
    const { totalCents } = computeFunnelCheckoutTotalCents(block, {
      selectedProductIndex: 0,
      addedBumpIndexes: [0],
    });
    expect(totalCents).toBe(12400);
  });
});
