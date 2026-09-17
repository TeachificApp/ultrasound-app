/**
 * Shared rules for the introductory Premium App trial.
 *
 * These helpers deliberately recognize only the app-level brand and dual
 * memberships. LMS, DIY, team, course, and product checkouts must never be
 * treated as an app Premium trial.
 */
export const BRAND_PREMIUM_TRIAL_DAYS = 3;

export type BrandMembershipCheckoutMetadata = {
  type?: string | null;
  trial_days?: string | number | null;
};

export function hasBrandMembershipTrial(metadata: BrandMembershipCheckoutMetadata | null | undefined): boolean {
  if (!metadata) return false;
  const type = metadata.type;
  const days = Number(metadata.trial_days ?? 0);
  return days === BRAND_PREMIUM_TRIAL_DAYS
    && (type === "brand_membership_upgrade" || type === "dual_membership");
}

/**
 * A Stripe Checkout subscription trial completes with no payment required.
 * It is a valid entitlement event, unlike other unpaid/delayed checkouts.
 */
export function isBrandMembershipTrialCheckout(session: {
  metadata?: BrandMembershipCheckoutMetadata | null;
  payment_status?: string | null;
}): boolean {
  return session.payment_status === "no_payment_required"
    && hasBrandMembershipTrial(session.metadata);
}

/** A previous Stripe-managed membership makes another introductory trial ineligible. */
export function hasPriorStripeBrandMembership(membership: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  source?: string | null;
} | null | undefined): boolean {
  if (!membership) return false;
  return Boolean(
    membership.stripeSubscriptionId
    || membership.stripeCustomerId
    || membership.source?.startsWith("stripe"),
  );
}

export function premiumTrialLabel(): string {
  return `${BRAND_PREMIUM_TRIAL_DAYS}-day free trial`;
}
