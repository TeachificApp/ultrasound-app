export const AUTH_EMAIL_COOLDOWN_MS = 5 * 60 * 1000;
export const AUTH_EMAIL_MAX_PER_ADDRESS_HOUR = 3;
export const AUTH_EMAIL_MAX_PER_IP_HOUR = 15;

export type AuthEmailType = "magic_link" | "password_reset";

export type AuthEmailRateLimitReason = "cooldown" | "email_hourly" | "ip_hourly";

export type AuthEmailRateLimitResult = {
  allowed: boolean;
  reason?: AuthEmailRateLimitReason;
};

export function normalizeAuthEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}
