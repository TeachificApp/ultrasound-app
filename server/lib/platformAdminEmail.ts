/** Canonical admin inbox for All About Ultrasound™ platform alerts. */
export const PLATFORM_ADMIN_EMAIL_DEFAULT = "admin@allaboutultrasound.com";

/** Legacy Manus project-owner inbox — must never receive client admin alerts. */
const BLOCKED_ADMIN_EMAILS = new Set([
  "larawilliams0501@gmail.com",
]);

function isBlockedAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return BLOCKED_ADMIN_EMAILS.has(normalized);
}

/**
 * Resolves the email address that should receive all platform admin notifications
 * (sales, transactions, fulfillment alerts, etc.).
 *
 * PLATFORM_ADMIN_EMAIL may be set per deployment, but personal / legacy owner
 * addresses are ignored so alerts always reach the client admin inbox.
 */
export function resolvePlatformAdminEmail(
  configured = process.env.PLATFORM_ADMIN_EMAIL,
): string {
  const candidate = configured?.trim();
  if (!candidate) return PLATFORM_ADMIN_EMAIL_DEFAULT;
  if (isBlockedAdminEmail(candidate)) return PLATFORM_ADMIN_EMAIL_DEFAULT;
  return candidate;
}
