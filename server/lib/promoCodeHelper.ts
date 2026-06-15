/**
 * promoCodeHelper.ts
 * Shared utility for resolving Stripe promo codes and detecting 100% discounts.
 *
 * When a promo code results in a 100% discount, we bypass Stripe entirely and
 * enroll the user through the free path — avoiding unnecessary payment sessions.
 */

export interface PromoResolution {
  /** The Stripe promotion code ID (e.g. "promo_xxx") */
  promoCodeId: string;
  /** Coupon percent off (0–100), or null if amount-based */
  percentOff: number | null;
  /** Coupon amount off in cents, or null if percent-based */
  amountOff: number | null;
  /** True when this promo makes the total price $0.00 */
  isFullDiscount: boolean;
}

/**
 * Resolve a promo code string to its Stripe promotion code details.
 * Returns null if the code is invalid, expired, or the Stripe call fails.
 */
export async function resolvePromoCode(
  stripe: any,
  code: string
): Promise<PromoResolution | null> {
  try {
    const promoCodes = await stripe.promotionCodes.list({
      code: code.toUpperCase(),
      active: true,
      limit: 1,
    });
    const pc = promoCodes.data[0];
    if (!pc) return null;
    const coupon = pc.coupon as any;
    const percentOff: number | null = coupon.percent_off ?? null;
    const amountOff: number | null = coupon.amount_off ?? null;
    const isFullDiscount = percentOff === 100;
    return { promoCodeId: pc.id, percentOff, amountOff, isFullDiscount };
  } catch {
    return null;
  }
}

/**
 * Compute the effective price in cents after applying a promo resolution.
 * Returns the original amount if no promo is provided.
 */
export function applyPromoDiscount(
  originalCents: number,
  promo: PromoResolution | null
): number {
  if (!promo) return originalCents;
  if (promo.percentOff !== null) {
    return Math.max(0, Math.round(originalCents * (1 - promo.percentOff / 100)));
  }
  if (promo.amountOff !== null) {
    return Math.max(0, originalCents - promo.amountOff);
  }
  return originalCents;
}
