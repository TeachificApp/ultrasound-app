export const EXPO_COMBINED_DISCOUNT_BASIS_POINTS = 2_000;
const BASIS_POINTS = 10_000;
const STRIPE_MINIMUM_PAYMENT_CENTS = 50;

export type ExpoCombinedOfferPricing = {
  baseTotalCents: number;
  discountCents: number;
  totalCents: number;
  discountedLineAmounts: [number, number];
};

/**
 * Prices a two-event package at exactly 20% off the configured individual
 * package prices. Each amount is kept as a separate Stripe line item so the
 * purchaser and each event record retain a clear, auditable allocation.
 */
export function calculateExpoCombinedOfferPricing(
  firstAmountCents: number,
  secondAmountCents: number,
): ExpoCombinedOfferPricing {
  const amounts = [firstAmountCents, secondAmountCents] as const;
  if (!amounts.every(amount => Number.isInteger(amount) && amount >= STRIPE_MINIMUM_PAYMENT_CENTS)) {
    throw new Error("Each Expo package must be priced at least $0.50.");
  }

  const discountedLineAmounts = amounts.map(amount => Math.round(amount * (BASIS_POINTS - EXPO_COMBINED_DISCOUNT_BASIS_POINTS) / BASIS_POINTS)) as [number, number];
  if (discountedLineAmounts.some(amount => amount < STRIPE_MINIMUM_PAYMENT_CENTS)) {
    throw new Error("Each Expo package must be at least $0.63 to be eligible for the combined 20% discount.");
  }

  const baseTotalCents = firstAmountCents + secondAmountCents;
  const totalCents = discountedLineAmounts[0] + discountedLineAmounts[1];
  return {
    baseTotalCents,
    discountCents: baseTotalCents - totalCents,
    totalCents,
    discountedLineAmounts,
  };
}
