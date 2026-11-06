/** Password resets retain the longer anti-abuse cooldown. */
export const AUTH_EMAIL_COOLDOWN_MS = 5 * 60 * 1000;
/** Magic links may be resent quickly when a learner changes devices. */
export const AUTH_MAGIC_LINK_COOLDOWN_MS = 60 * 1000;
export const AUTH_EMAIL_MAX_PER_ADDRESS_HOUR = 3;
export const AUTH_EMAIL_MAX_PER_IP_HOUR = 15;
export const AUTH_EMAIL_HOURLY_WINDOW_MS = 60 * 60 * 1000;

export type AuthEmailType = "magic_link" | "password_reset";

export type AuthEmailRateLimitReason = "cooldown" | "email_hourly" | "ip_hourly";

export type AuthEmailDeliveryStatus = "sent" | "acknowledged" | "cooldown" | "hourly_limit" | "unavailable";

export type AuthEmailRateLimitResult = {
  allowed: boolean;
  reason?: AuthEmailRateLimitReason;
  retryAfterMs?: number;
};

/** Use a conservative window when the limiter only provides a reason. */
export function getAuthEmailRetryAfterMs(type: AuthEmailType, result: AuthEmailRateLimitResult): number {
  if (result.allowed) return 0;
  if (typeof result.retryAfterMs === "number" && Number.isFinite(result.retryAfterMs) && result.retryAfterMs > 0) {
    return result.retryAfterMs;
  }
  if (result.reason === "cooldown") {
    return type === "magic_link" ? AUTH_MAGIC_LINK_COOLDOWN_MS : AUTH_EMAIL_COOLDOWN_MS;
  }
  return AUTH_EMAIL_HOURLY_WINDOW_MS;
}

export function getAuthEmailThrottleMessage(status: AuthEmailDeliveryStatus | null, retryAfterMs: number): string | null {
  if (status !== "cooldown" && status !== "hourly_limit") return null;
  if (retryAfterMs <= 0) return "You can request another link now.";
  const seconds = Math.ceil(retryAfterMs / 1000);
  const minutes = Math.ceil(seconds / 60);
  const wait = seconds < 60 ? `${seconds} seconds` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return status === "hourly_limit"
    ? `The hourly request limit has been reached. Please wait ${wait} before trying again (up to one hour). No new email was sent.`
    : `A link was requested recently. Please wait ${wait} before requesting another link. No new email was sent.`;
}

export function normalizeAuthEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}
