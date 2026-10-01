type StripeErrorLike = {
  code?: unknown;
  message?: unknown;
  type?: unknown;
};

/** Normalizes a customer-facing promotion code consistently for Stripe lookups and creation. */
export function normalizePromotionCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || null;
}

/** Identifies Stripe's duplicate promotion-code response without relying on raw provider wording alone. */
export function isStripePromotionCodeConflict(error: unknown): boolean {
  const candidate = error as StripeErrorLike | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  return candidate?.code === "resource_already_exists"
    || (candidate?.type === "invalid_request_error" && /promotion code.*already exists|code.*already exists/i.test(message))
    || /promotion code.*already exists/i.test(message);
}

/** Friendly, actionable message used for pre-flight and race-condition duplicate errors. */
export function promotionCodeConflictMessage(code: string): string {
  return `The promo code ${code} already exists and is active. Use the existing code in the Discounts list or choose a different code.`;
}
