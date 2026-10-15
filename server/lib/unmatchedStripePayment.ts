/**
 * Identifies completed Stripe payments that do not have a supported platform
 * fulfillment route. These must be visible to a platform administrator rather
 * than silently disappearing after Stripe reports a successful charge.
 */

const KNOWN_CHECKOUT_TYPES = new Set([
  "digital_download",
  "digital_bundle",
  "physical_product",
  "workshop",
  "webinar",
  "membership",
  "lms_course",
  "brand_membership_upgrade",
  "dual_membership",
  "dual_membership_lifetime",
  "team_subscription",
  "funnel_form_purchase",
  "embedded_checkout_purchase",
]);

const KNOWN_PRODUCT_TYPES = new Set([
  "diy_accreditation",
  "employer_job_post",
  "employer_subscription",
]);

const KNOWN_STUDY_GROUP_CHECKOUT_TYPES = new Set([
  "study_group_organization",
  "study_group_content",
]);

/** Prefix stored on fulfillment exceptions that require human investigation. */
export const UNMATCHED_STRIPE_PAYMENT_MARKER = "UNMATCHED_STRIPE_PAYMENT:";

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Returns true when a completed Checkout Session has a deliberate fulfillment
 * path in this application. The actual handler may still create its own
 * exception when its required details are invalid.
 */
export function hasKnownStripeCheckoutRoute(
  session: Record<string, unknown>,
  metadata: Record<string, string>,
): boolean {
  const metadataType = nonEmptyString(metadata.type);
  if (metadataType && KNOWN_CHECKOUT_TYPES.has(metadataType)) return true;

  if (metadata.purchase_type === "bundle_purchase") return true;
  if (KNOWN_PRODUCT_TYPES.has(metadata.product_type ?? "")) return true;
  if (KNOWN_STUDY_GROUP_CHECKOUT_TYPES.has(metadata.checkout_type ?? "")) return true;

  // LMS purchases from older hosted checkout flows may identify their route by
  // an order, a course, or their source rather than an explicit type.
  if (nonEmptyString(metadata.course_id) || nonEmptyString(metadata.order_id)) return true;
  if (metadata.source?.startsWith("hosted_checkout")) return true;

  // The legacy Concierge payment link is intentionally recognized by its
  // payment link / amount handler in the webhook module.
  const paymentLink = nonEmptyString(session.payment_link);
  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
  return amountTotal === 499_700 || Boolean(paymentLink?.includes("7sYcN475Lcs94Nm3hH9R604"));
}

/**
 * A standalone PaymentIntent is only actionable as an unmatched platform
 * payment when it declares platform routing metadata. Generic Stripe Payment
 * Intents can belong to unrelated products and must not create false alerts.
 */
export function hasUnmatchedPlatformPaymentIntentMetadata(metadata: Record<string, string>): boolean {
  const declaresPlatformRoute = Boolean(
    nonEmptyString(metadata.type)
      || nonEmptyString(metadata.product_type)
      || nonEmptyString(metadata.purchase_type)
      || nonEmptyString(metadata.checkout_type),
  );
  return declaresPlatformRoute && !hasKnownStripeCheckoutRoute({}, metadata);
}

export function isUnmatchedStripePaymentException(record: {
  productType?: string | null;
  errorMessage?: string | null;
}): boolean {
  return record.productType === "other"
    && Boolean(record.errorMessage?.startsWith(UNMATCHED_STRIPE_PAYMENT_MARKER));
}

export function unmatchedStripePaymentMessage(routeSummary: string): string {
  return `${UNMATCHED_STRIPE_PAYMENT_MARKER} Successful Stripe payment has no recognized fulfillment route. ${routeSummary}`;
}
