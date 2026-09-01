export const DISCOUNT_CONTENT_TYPES = [
  "course",
  "quiz",
  "download",
  "physical_product",
  "bundle",
  "membership",
  "webinar",
  "workshop",
] as const;

export type DiscountContentType = (typeof DISCOUNT_CONTENT_TYPES)[number];
export type DiscountScope = "site_wide" | "content_types" | "specific_products";

export type CouponTargetInput = {
  scope?: DiscountScope;
  contentTypes?: readonly string[];
  productKeys?: readonly string[];
};

export type ValidatedCouponTargeting = {
  scope: DiscountScope;
  contentTypes: DiscountContentType[];
  productKeys: string[];
};

const validContentTypes = new Set<string>(DISCOUNT_CONTENT_TYPES);
const productKeyPattern = /^(course|quiz|download|physical_product|bundle|membership|webinar|workshop):[1-9]\d*$/;

/**
 * Validates one coupon targeting choice before Stripe resources are created.
 * Product keys are internal catalog identities; their Stripe applicability is
 * resolved separately and never accepted directly from the browser.
 */
export function validateCouponTargeting(input: CouponTargetInput): ValidatedCouponTargeting {
  const scope = input.scope ?? "site_wide";
  const contentTypes = [...new Set(input.contentTypes ?? [])];
  const productKeys = [...new Set(input.productKeys ?? [])];

  if (scope === "site_wide") {
    if (contentTypes.length || productKeys.length) {
      throw new Error("A catalog-wide coupon cannot include content-type or product selections.");
    }
    return { scope, contentTypes: [], productKeys: [] };
  }

  if (scope === "content_types") {
    if (!contentTypes.length) throw new Error("Select at least one content type for this coupon.");
    if (productKeys.length) throw new Error("Content-type coupons cannot include individual product selections.");
    if (contentTypes.some(type => !validContentTypes.has(type))) {
      throw new Error("One or more selected content types are not supported.");
    }
    return { scope, contentTypes: contentTypes as DiscountContentType[], productKeys: [] };
  }

  if (scope === "specific_products") {
    if (!productKeys.length) throw new Error("Select at least one product for this coupon.");
    if (contentTypes.length) throw new Error("Product-specific coupons cannot include content-type selections.");
    if (productKeys.some(key => !productKeyPattern.test(key))) {
      throw new Error("One or more selected products are not valid discount targets.");
    }
    return { scope, contentTypes: [], productKeys };
  }

  throw new Error("Coupon targeting scope is not supported.");
}

/** Keeps saved content-type scopes in the existing product-key metadata column. */
export function serializeCouponTargeting(targeting: ValidatedCouponTargeting): string[] {
  return targeting.scope === "content_types"
    ? targeting.contentTypes.map(type => `type:${type}`)
    : targeting.productKeys;
}

export function parseCouponTargeting(scope: string | null | undefined, productKeys: string | null | undefined): ValidatedCouponTargeting {
  const keys = productKeys ? JSON.parse(productKeys) : [];
  return validateCouponTargeting({
    scope: scope as DiscountScope | undefined,
    contentTypes: Array.isArray(keys) ? keys.filter(key => typeof key === "string" && key.startsWith("type:")).map(key => key.slice(5)) : [],
    productKeys: Array.isArray(keys) ? keys.filter(key => typeof key === "string" && !key.startsWith("type:")) : [],
  });
}

export function isCouponTargetEligible(
  targeting: ValidatedCouponTargeting | null | undefined,
  target: { contentType: string; productKey: string },
): boolean {
  if (!targeting || targeting.scope === "site_wide") return true;
  if (targeting.scope === "content_types") return targeting.contentTypes.includes(target.contentType as DiscountContentType);
  return targeting.productKeys.includes(target.productKey);
}
