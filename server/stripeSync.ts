/**
 * stripeSync.ts
 * Shared helper for auto-creating / updating Stripe products and prices.
 *
 * Usage:
 *   const { stripeProductId, stripePriceId } = await syncStripeProduct({
 *     existingProductId: row.stripeProductId,
 *     existingPriceId:   row.stripePriceId,
 *     name:              "My Course",
 *     description:       "Optional subtitle",
 *     imageUrl:          "https://...",
 *     price:             49.00,          // dollars (not cents)
 *     currency:          "usd",
 *     billingInterval:   "one_time",     // "one_time" | "monthly" | "quarterly" | "annual" | "lifetime"
 *     metadata:          { product_type: "course", product_id: "123" },
 *   });
 *
 * - If the Stripe product already exists it is updated in place.
 * - If the price changed (or didn't exist) a new Price is created and the old one archived.
 * - Free products ($0) skip Stripe entirely and return nulls.
 */

import type Stripe from "stripe";

export interface SyncStripeProductInput {
  /** Existing Stripe product ID (if any) */
  existingProductId?: string | null;
  /** Existing Stripe price ID (if any) */
  existingPriceId?: string | null;
  /** Product display name */
  name: string;
  /** Optional subtitle / description */
  description?: string | null;
  /** Optional cover image URL */
  imageUrl?: string | null;
  /** Price in dollars (0 = free, skip Stripe) */
  price: number;
  /** ISO currency code, default "usd" */
  currency?: string;
  /**
   * Billing interval:
   *   "one_time"  → one-time payment
   *   "monthly"   → recurring monthly
   *   "quarterly" → recurring every 3 months
   *   "annual"    → recurring yearly
   *   "lifetime"  → one-time payment (alias)
   */
  billingInterval?: "one_time" | "monthly" | "quarterly" | "annual" | "lifetime";
  /** Extra metadata to attach to the Stripe product */
  metadata?: Record<string, string>;
}

export interface SyncStripeProductResult {
  stripeProductId: string | null;
  stripePriceId: string | null;
}

const INTERVAL_MAP: Record<string, { interval: "month" | "year"; interval_count: number }> = {
  monthly:   { interval: "month", interval_count: 1 },
  quarterly: { interval: "month", interval_count: 3 },
  annual:    { interval: "year",  interval_count: 1 },
};

/**
 * Lazily import Stripe so the module doesn't fail when STRIPE_SECRET_KEY is absent.
 */
async function getStripe(): Promise<Stripe | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const { default: StripeClass } = await import("stripe");
  return new StripeClass(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
}

export async function syncStripeProduct(
  input: SyncStripeProductInput
): Promise<SyncStripeProductResult> {
  const {
    existingProductId,
    existingPriceId,
    name,
    description,
    imageUrl,
    price,
    currency = "usd",
    billingInterval = "one_time",
    metadata = {},
  } = input;

  // Free products don't need Stripe objects
  if (!price || price <= 0) {
    return { stripeProductId: null, stripePriceId: null };
  }

  const stripe = await getStripe();
  if (!stripe) return { stripeProductId: null, stripePriceId: null };

  // ── 1. Upsert Stripe Product ────────────────────────────────────────────────
  let stripeProductId = existingProductId ?? null;
  const productParams: Stripe.ProductCreateParams = {
    name,
    description: description ?? undefined,
    images: imageUrl ? [imageUrl] : [],
    metadata,
  };

  if (stripeProductId) {
    try {
      await stripe.products.update(stripeProductId, {
        name: productParams.name,
        description: productParams.description,
        images: productParams.images,
        metadata: productParams.metadata,
      });
    } catch {
      // Product may have been deleted on Stripe side — recreate
      stripeProductId = null;
    }
  }

  if (!stripeProductId) {
    const product = await stripe.products.create(productParams);
    stripeProductId = product.id;
  }

  // ── 2. Determine if we need a new Price ────────────────────────────────────
  const amountCents = Math.round(price * 100);
  const isRecurring = billingInterval !== "one_time" && billingInterval !== "lifetime";

  let stripePriceId = existingPriceId ?? null;
  let needNewPrice = !stripePriceId;

  if (stripePriceId && !needNewPrice) {
    try {
      const existingPrice = await stripe.prices.retrieve(stripePriceId);
      const amountMatch = existingPrice.unit_amount === amountCents;
      const currencyMatch = existingPrice.currency === currency.toLowerCase();
      const recurringMatch = isRecurring
        ? existingPrice.recurring?.interval === INTERVAL_MAP[billingInterval]?.interval &&
          existingPrice.recurring?.interval_count === INTERVAL_MAP[billingInterval]?.interval_count
        : !existingPrice.recurring;
      needNewPrice = !amountMatch || !currencyMatch || !recurringMatch || !existingPrice.active;
    } catch {
      needNewPrice = true;
    }
  }

  if (needNewPrice) {
    // Archive old price if it exists
    if (stripePriceId) {
      try {
        await stripe.prices.update(stripePriceId, { active: false });
      } catch {
        // Ignore — may already be inactive
      }
    }

    const priceParams: Stripe.PriceCreateParams = {
      product: stripeProductId,
      unit_amount: amountCents,
      currency: currency.toLowerCase(),
      ...(isRecurring
        ? { recurring: INTERVAL_MAP[billingInterval] }
        : {}),
    };
    const newPrice = await stripe.prices.create(priceParams);
    stripePriceId = newPrice.id;
  }

  return { stripeProductId, stripePriceId };
}

/**
 * Convenience: sync a product and return only the price ID (for tables that
 * don't store a separate product ID).
 */
export async function syncStripePriceOnly(
  input: SyncStripeProductInput & { existingProductIdRef?: { value: string | null } }
): Promise<string | null> {
  const result = await syncStripeProduct(input);
  return result.stripePriceId;
}
