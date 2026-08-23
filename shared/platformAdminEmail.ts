/** Default inbox for platform administrator notifications (SendGrid + in-app alerts). */
export const DEFAULT_PLATFORM_ADMIN_EMAIL = "admin@allaboutultrasound.com";

export function resolvePlatformAdminEmail(configured?: string | null): string {
  const trimmed = configured?.trim().toLowerCase();
  return trimmed || DEFAULT_PLATFORM_ADMIN_EMAIL;
}
