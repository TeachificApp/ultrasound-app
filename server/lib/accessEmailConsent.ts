import type { SendEmailOptions } from "./email/types";

/**
 * Automatic access-grant / purchase confirmation emails (enrollment welcome, download
 * access, membership welcome, Stripe fulfillment copies, etc.).
 *
 * When unset or not "true", these emails are suppressed unless the caller sets
 * explicitAccessEmailConsent (admin clicked Send / Resend).
 *
 * Set ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS=true on Railway only when you intend
 * to resume webhook/checkout-driven access emails.
 */
export function automaticAccessGrantEmailsEnabled(): boolean {
  return process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS === "true";
}

export function isAccessGrantEmail(opts: Pick<SendEmailOptions, "accessGrantEmail" | "purchaseAccess">): boolean {
  return opts.accessGrantEmail === true || opts.purchaseAccess !== undefined;
}

export function shouldSendAccessGrantEmail(
  opts: Pick<SendEmailOptions, "explicitAccessEmailConsent" | "accessGrantEmail" | "purchaseAccess">,
): boolean {
  if (opts.explicitAccessEmailConsent) return true;
  if (!isAccessGrantEmail(opts)) return true;
  return automaticAccessGrantEmailsEnabled();
}
