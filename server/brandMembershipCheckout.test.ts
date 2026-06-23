/**
 * Brand membership checkout helpers — price ID validation and line-item fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateStripePriceId,
  BRAND_PRODUCTS,
} from "./routers/brandMembershipRouter";

describe("validateStripePriceId", () => {
  const mockStripe = {
    prices: {
      retrieve: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when priceId is empty", async () => {
    expect(await validateStripePriceId(mockStripe as any, null)).toBeNull();
    expect(await validateStripePriceId(mockStripe as any, undefined)).toBeNull();
    expect(mockStripe.prices.retrieve).not.toHaveBeenCalled();
  });

  it("returns the price ID when Stripe has the price", async () => {
    mockStripe.prices.retrieve.mockResolvedValue({ id: "price_123" });
    const result = await validateStripePriceId(mockStripe as any, "price_123");
    expect(result).toBe("price_123");
  });

  it("returns null when Stripe reports resource_missing (test vs live mismatch)", async () => {
    mockStripe.prices.retrieve.mockRejectedValue({
      code: "resource_missing",
      message: "No such price: 'price_test_only'",
    });
    const result = await validateStripePriceId(
      mockStripe as any,
      BRAND_PRODUCTS.aaus.monthlyPriceId,
    );
    expect(result).toBeNull();
  });

  it("rethrows unexpected Stripe errors", async () => {
    mockStripe.prices.retrieve.mockRejectedValue(new Error("Stripe API down"));
    await expect(
      validateStripePriceId(mockStripe as any, "price_123"),
    ).rejects.toThrow("Stripe API down");
  });
});
