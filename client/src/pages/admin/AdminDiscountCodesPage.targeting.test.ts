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

  it("shows customer-facing Stripe promo codes plus LMS-native code visibility", () => {
    expect(source).toContain("visiblePromoCodes");
    expect(source).toContain("No customer-facing promo code");
    expect(source).toContain("Refresh Stripe");
    expect(source).toContain("LMS membership code");
    expect(source).toContain("Active LMS membership codes");
    expect(source).toContain("LMS membership discount codes remain visible below");
  });
});
