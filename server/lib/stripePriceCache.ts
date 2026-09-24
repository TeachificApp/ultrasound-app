import { courseDollarsToStripeCents } from "./courseCheckoutPricing";

export type CourseStripePriceTerms = {
  currency: string;
  pricingType: string | null | undefined;
  price: number | string | null | undefined;
  subscriptionInterval?: string | null;
  installmentAmount?: number | string | null;
  installmentIntervalDays?: number | null;
};

type StripePriceSnapshot = {
  active?: boolean;
  currency?: string | null;
  unit_amount?: number | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
};

type ExpectedStripePrice = {
  currency: string;
  unitAmount: number;
  recurring: { interval: "month" | "year"; intervalCount: number } | null;
};

export function resolveExpectedCourseStripePrice(terms: CourseStripePriceTerms): ExpectedStripePrice {
  const pricingType = terms.pricingType ?? "one_time";
  const currency = (terms.currency || "usd").toLowerCase();
  const installmentAmount = Number(terms.installmentAmount ?? 0);
  const displayAmount = pricingType === "payment_plan" && installmentAmount > 0
    ? installmentAmount
    : Number(terms.price ?? 0);

  if (pricingType === "subscription") {
    const interval = terms.subscriptionInterval ?? "monthly";
    const intervalByPlan: Record<string, { interval: "month" | "year"; intervalCount: number }> = {
      monthly: { interval: "month", intervalCount: 1 },
      quarterly: { interval: "month", intervalCount: 3 },
      annual: { interval: "year", intervalCount: 1 },
    };
    return { currency, unitAmount: courseDollarsToStripeCents(displayAmount), recurring: intervalByPlan[interval] ?? intervalByPlan.monthly };
  }

  if (pricingType === "payment_plan") {
    return {
      currency,
      unitAmount: courseDollarsToStripeCents(displayAmount),
      recurring: {
        interval: "month",
        intervalCount: Math.max(1, Math.round((terms.installmentIntervalDays ?? 30) / 30)),
      },
    };
  }

  return { currency, unitAmount: courseDollarsToStripeCents(displayAmount), recurring: null };
}

/**
 * A cached Stripe Price is valid only when it is active and matches the current
 * LMS pricing configuration. Stripe prices are immutable, so a price change
 * must create a new Price rather than silently reusing the old one.
 */
export function isCachedStripePriceCompatible(
  price: StripePriceSnapshot,
  terms: CourseStripePriceTerms,
): boolean {
  const expected = resolveExpectedCourseStripePrice(terms);
  if (price.active === false) return false;
  if ((price.currency ?? "").toLowerCase() !== expected.currency) return false;
  if (price.unit_amount !== expected.unitAmount) return false;

  if (!expected.recurring) return price.recurring == null;
  return price.recurring?.interval === expected.recurring.interval
    && (price.recurring?.interval_count ?? 1) === expected.recurring.intervalCount;
}

const checkoutSensitiveFields = new Set([
  "price",
  "pricingType",
  "subscriptionInterval",
  "installmentAmount",
  "installmentIntervalDays",
  "currency",
  "isFree",
]);

/** Whether a saved course/pricing-option update must invalidate immutable Stripe cache IDs. */
export function shouldInvalidateCourseStripeCache(update: Record<string, unknown>): boolean {
  return Object.entries(update).some(([field, value]) => value !== undefined && checkoutSensitiveFields.has(field));
}
