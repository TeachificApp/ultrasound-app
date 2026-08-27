/** Legacy Thinkific member billing portal (subscriptions migrated from Thinkific). */
export const THINKIFIC_LEGACY_BILLING_URL = "https://member.allaboutultrasound.com/account/billing";

export const THINKIFIC_LEGACY_BILLING_LABEL = "Manage Legacy Billing";

/** True when the user still has an active membership sourced from legacy Thinkific. */
export function isActiveThinkificMembership(m: {
  source?: string | null;
  status?: string | null;
  expiresAt?: Date | string | null;
}): boolean {
  if (m.source !== "thinkific") return false;
  if (m.status !== "active") return false;
  if (m.expiresAt && new Date(m.expiresAt) <= new Date()) return false;
  return true;
}
