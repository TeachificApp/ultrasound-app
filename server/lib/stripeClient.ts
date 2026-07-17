import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Lazy Stripe client.
 * Prefers STRIPE_LIVE_SECRET_KEY when available (production subscriptions live there).
 * Falls back to STRIPE_SECRET_KEY (test mode) if the live key is not set.
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  // Reset cached client if the key has changed (e.g., env hot-reload in dev)
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
  }
  return stripeClient;
}

/**
 * Always returns a test-mode Stripe client using STRIPE_SECRET_KEY.
 * Use this only for test webhook verification.
 */
export function getTestStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
}
