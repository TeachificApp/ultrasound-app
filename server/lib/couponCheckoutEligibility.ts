import { couponMetadata } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { isCouponTargetEligible, parseCouponTargeting } from "./couponTargeting";

type PromotionCode = { coupon?: { id?: string } | string };

/**
 * Checks local scope metadata for a Stripe promotion code. Legacy coupons with
 * no metadata retain their original catalog-wide behavior.
 */
export async function isPromotionCodeEligibleForTarget(
  db: any,
  promotionCode: PromotionCode,
  target: { contentType: string; productKey: string },
): Promise<boolean> {
  const couponId = typeof promotionCode.coupon === "string"
    ? promotionCode.coupon
    : promotionCode.coupon?.id;
  if (!couponId) return false;

  const [metadata] = await db.select().from(couponMetadata)
    .where(eq(couponMetadata.stripeCouponId, couponId)).limit(1);
  if (!metadata) return true;

  try {
    return isCouponTargetEligible(parseCouponTargeting(metadata.scope, metadata.productKeys), target);
  } catch {
    return false;
  }
}
