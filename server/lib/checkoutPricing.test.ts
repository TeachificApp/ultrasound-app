import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  assertClientPriceMatches,
  computeFunnelCheckoutTotalCents,
} from "./checkoutPricing";

describe("checkoutPricing", () => {
  it("assertClientPriceMatches accepts matching cents", () => {
    expect(() => assertClientPriceMatches(9700, 9700)).not.toThrow();
  });

  it("assertClientPriceMatches rejects mismatch", () => {
    expect(() => assertClientPriceMatches(100, 9700)).toThrow(TRPCError);
  });

  it("computeFunnelCheckoutTotalCents sums product and bumps in cents", () => {
    const block = {
      data: {
        products: [{ name: "Course", price: 9700 }],
        orderBumps: [{ title: "Bump", price: 2700 }],
      },
    };
    const { totalCents } = computeFunnelCheckoutTotalCents(block, {
      selectedProductIndex: 0,
      addedBumpIndexes: [0],
    });
    expect(totalCents).toBe(12400);
  });
});
