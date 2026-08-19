import { describe, expect, it } from "vitest";
import { BRAND_PRODUCTS, DUAL_MEMBERSHIP_PRODUCT } from "../server/routers/brandMembershipRouter";

describe("live brand membership recurring price configuration", () => {
  it("uses the verified live monthly prices for each current-platform app membership", () => {
    expect(BRAND_PRODUCTS.aaus.monthlyPrice).toBe(997);
    expect(BRAND_PRODUCTS.aaus.monthlyPriceId).toBe("price_1U5xVtBj9HgnkZLK6pvUcG4P");
    expect(BRAND_PRODUCTS.iheartecho.monthlyPrice).toBe(997);
    expect(BRAND_PRODUCTS.iheartecho.monthlyPriceId).toBe("price_1U5xVtBj9HgnkZLKzl3Qo0pE");
    expect(DUAL_MEMBERSHIP_PRODUCT.monthlyPrice).toBe(1299);
    expect(DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId).toBe("price_1U5xVuBj9HgnkZLKEL1A9qkU");
  });

  it("does not restore sandbox-only recurring price identifiers", () => {
    const configured = [
      BRAND_PRODUCTS.aaus.monthlyPriceId,
      BRAND_PRODUCTS.iheartecho.monthlyPriceId,
      DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId,
    ];
    expect(configured).not.toContain("price_1Tl7paPvVOPkJOleJ54i6mht");
    expect(configured).not.toContain("price_1Tl7pbPvVOPkJOleNx8QfKEJ");
    expect(configured).not.toContain("price_1Tl7pcPvVOPkJOleacNhh6ki");
  });
});
