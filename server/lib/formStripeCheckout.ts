/**
 * formStripeCheckout.ts
 * Creates a Stripe Checkout session for a form submission.
 * Used by both generalFormRouter and formBuilderRouter.
 */
import { getStripeClient } from "./stripeClient";

export interface FormStripeCheckoutConfig {
  stripeEnabled: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stripeAmount: number | null; // in cents
  stripeCheckoutMode: string | null;
  stripeSuccessUrl: string | null;
  stripeCancelUrl: string | null;
  formName: string;
  formId: number;
}

export interface FormStripeCheckoutInput {
  config: FormStripeCheckoutConfig;
  submissionId: number;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  origin: string;
}

/**
 * Creates a Stripe Checkout session and returns the session URL.
 * Returns null if Stripe is not configured or an error occurs.
 */
export async function createFormStripeCheckout(input: FormStripeCheckoutInput): Promise<string | null> {
  const { config, submissionId, userId, userEmail, userName, origin } = input;

  if (!config.stripeEnabled) return null;

  const stripe = getStripeClient();
  const mode = (config.stripeCheckoutMode === "subscription" ? "subscription" : "payment") as "payment" | "subscription";

  // Build line items
  let lineItems: any[];
  if (config.stripePriceId) {
    lineItems = [{ price: config.stripePriceId, quantity: 1 }];
  } else if (config.stripeAmount && config.stripeAmount > 0) {
    lineItems = [{
      price_data: {
        currency: "usd",
        unit_amount: config.stripeAmount,
        product_data: { name: config.formName },
        ...(mode === "subscription" ? { recurring: { interval: "month" } } : {}),
      },
      quantity: 1,
    }];
  } else {
    console.warn("[FormStripe] No price ID or amount configured for form", config.formId);
    return null;
  }

  const successUrl = config.stripeSuccessUrl
    ? config.stripeSuccessUrl.replace("{{submission_id}}", String(submissionId))
    : `${origin}/?form_submission=${submissionId}&checkout=success`;

  const cancelUrl = config.stripeCancelUrl || `${origin}/`;

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    ...(userEmail ? { customer_email: userEmail } : {}),
    client_reference_id: String(userId),
    metadata: {
      user_id: String(userId),
      customer_email: userEmail ?? "",
      customer_name: userName ?? "",
      form_id: String(config.formId),
      submission_id: String(submissionId),
      source: "form_submission",
    },
    ...(mode === "payment"
      ? { payment_intent_data: { description: `${config.formName} — Form Payment` } }
      : { subscription_data: { description: `${config.formName} — Form Subscription — Initial` } }),
  });

  return session.url;
}
