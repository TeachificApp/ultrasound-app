export const MAINTENANCE_BANNER_DISMISSAL_KEY = "maintenance-banner-2026-08-dismissed";
export const MAINTENANCE_BANNER_EXPIRES_AT = new Date("2026-08-25T09:00:00-04:00").getTime();

export function shouldShowMaintenanceBanner({
  isAuthenticated,
  isDismissed,
  now = Date.now(),
}: {
  isAuthenticated: boolean;
  isDismissed: boolean;
  now?: number;
}) {
  return isAuthenticated && !isDismissed && now < MAINTENANCE_BANNER_EXPIRES_AT;
}
