/**
 * One-time password-reset link validity.
 *
 * Mail systems can defer a legitimate security message. A 24-hour window gives
 * the recipient time to receive and use the link without turning it into a
 * durable credential. Re-requesting a reset renews an active token instead of
 * invalidating the email already in transit; completing a reset always consumes
 * the token immediately.
 */
export const PASSWORD_RESET_VALIDITY_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_VALIDITY_LABEL = "24 hours";

export function getPasswordResetExpiry(now = new Date()): Date {
  return new Date(now.getTime() + PASSWORD_RESET_VALIDITY_MS);
}

export function canReusePasswordResetToken(
  token: string | null | undefined,
  expiry: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!token || !expiry) return false;
  const expiryTime = new Date(expiry).getTime();
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}
