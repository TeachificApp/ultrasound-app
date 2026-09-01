import { describe, expect, it } from "vitest";
import { isCouponTargetEligible, parseCouponTargeting, serializeCouponTargeting, validateCouponTargeting } from "./lib/couponTargeting";

describe("coupon targeting", () => {
  it("accepts an unrestricted all-products coupon", () => {
    expect(validateCouponTargeting({ scope: "site_wide" })).toEqual({ scope: "site_wide", contentTypes: [], productKeys: [] });
  });

  it("accepts multiple content-type targets and preserves them in existing metadata", () => {
    const targeting = validateCouponTargeting({ scope: "content_types", contentTypes: ["course", "download", "course"] });
    expect(targeting.contentTypes).toEqual(["course", "download"]);
    expect(serializeCouponTargeting(targeting)).toEqual(["type:course", "type:download"]);
  });

  it("accepts multiple individual product targets and removes duplicate selections", () => {
    expect(validateCouponTargeting({ scope: "specific_products", productKeys: ["course:42", "download:7", "course:42"] })).toEqual({
      scope: "specific_products", contentTypes: [], productKeys: ["course:42", "download:7"],
    });
  });

  it("rejects ambiguous, empty, and malformed restricted scopes", () => {
    expect(() => validateCouponTargeting({ scope: "content_types" })).toThrow("Select at least one content type");
    expect(() => validateCouponTargeting({ scope: "specific_products" })).toThrow("Select at least one product");
    expect(() => validateCouponTargeting({ scope: "site_wide", productKeys: ["course:1"] })).toThrow();
    expect(() => validateCouponTargeting({ scope: "specific_products", productKeys: ["other:1"] })).toThrow("not valid");
  });

  it("parses saved content-type metadata without interpreting it as individual products", () => {
    expect(parseCouponTargeting("content_types", JSON.stringify(["type:course", "type:webinar"]))).toEqual({
      scope: "content_types", contentTypes: ["course", "webinar"], productKeys: [],
    });
  });

  it("allows only selected content types or individual product keys at checkout", () => {
    expect(isCouponTargetEligible(validateCouponTargeting({ scope: "content_types", contentTypes: ["course"] }), { contentType: "course", productKey: "course:42" })).toBe(true);
    expect(isCouponTargetEligible(validateCouponTargeting({ scope: "content_types", contentTypes: ["course"] }), { contentType: "download", productKey: "download:7" })).toBe(false);
    expect(isCouponTargetEligible(validateCouponTargeting({ scope: "specific_products", productKeys: ["course:42", "download:7"] }), { contentType: "course", productKey: "course:42" })).toBe(true);
    expect(isCouponTargetEligible(validateCouponTargeting({ scope: "specific_products", productKeys: ["course:42"] }), { contentType: "course", productKey: "course:99" })).toBe(false);
    expect(isCouponTargetEligible(validateCouponTargeting({ scope: "content_types", contentTypes: ["quiz"] }), { contentType: "quiz", productKey: "quiz:13" })).toBe(true);
  });
});
