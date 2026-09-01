import { describe, expect, it } from "vitest";
import { isPromotionCodeEligibleForTarget } from "./lib/couponCheckoutEligibility";

function dbReturning(metadata?: { scope: string; productKeys: string | null }) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => metadata ? [metadata] : [],
        }),
      }),
    }),
  };
}

describe("promotion-code checkout eligibility", () => {
  it("allows a legacy coupon that has no local restriction metadata", async () => {
    await expect(isPromotionCodeEligibleForTarget(dbReturning(), { coupon: { id: "coupon_legacy" } }, { contentType: "course", productKey: "course:42" })).resolves.toBe(true);
  });

  it("allows a scoped code only for an included course or product", async () => {
    const byType = dbReturning({ scope: "content_types", productKeys: JSON.stringify(["type:course"]) });
    await expect(isPromotionCodeEligibleForTarget(byType, { coupon: { id: "coupon_type" } }, { contentType: "course", productKey: "course:42" })).resolves.toBe(true);
    await expect(isPromotionCodeEligibleForTarget(byType, { coupon: { id: "coupon_type" } }, { contentType: "download", productKey: "download:7" })).resolves.toBe(false);

    const byProduct = dbReturning({ scope: "specific_products", productKeys: JSON.stringify(["course:42", "download:7"]) });
    await expect(isPromotionCodeEligibleForTarget(byProduct, { coupon: { id: "coupon_product" } }, { contentType: "course", productKey: "course:42" })).resolves.toBe(true);
    await expect(isPromotionCodeEligibleForTarget(byProduct, { coupon: { id: "coupon_product" } }, { contentType: "course", productKey: "course:9" })).resolves.toBe(false);
  });

  it("rejects a malformed local scope record rather than applying it broadly", async () => {
    const malformed = dbReturning({ scope: "specific_products", productKeys: "not-json" });
    await expect(isPromotionCodeEligibleForTarget(malformed, { coupon: { id: "coupon_broken" } }, { contentType: "course", productKey: "course:42" })).resolves.toBe(false);
  });
});
