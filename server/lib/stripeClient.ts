import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Lazy Stripe client — avoids throwing at module load when STRIPE_SECRET_KEY is unset. */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
  }
  return stripeClient;
}
