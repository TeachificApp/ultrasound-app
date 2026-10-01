import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AdminDiscountCodesPage.tsx", import.meta.url), "utf8");

describe("discount-code targeting controls", () => {
  it("offers catalog-wide, content-type, and multi-product targeting controls", () => {
    expect(source).toContain("All Products");
    expect(source).toContain("Content Types");
    expect(source).toContain("Specific Products");
    expect(source).toContain("Search products");
    expect(source).toContain("productKeys");
    expect(source).toContain("contentTypes");
  });

  it("shows customer-facing promo code values and a recoverable Stripe refresh state", () => {
    expect(source).toContain("visiblePromoCodes");
    expect(source).toContain("No customer-facing promo code");
    expect(source).toContain("Refresh from Stripe");
    expect(source).toContain("Discount codes could not be loaded from Stripe");
  });
});
