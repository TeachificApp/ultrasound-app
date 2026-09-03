/** Role helpers for the restricted Platform Manager administrative role. */
export const PLATFORM_MANAGER_ROLE = "platform_manager" as const;

export function hasPlatformManagerRole(appRoles: readonly string[] | null | undefined): boolean {
  return Boolean(appRoles?.includes(PLATFORM_MANAGER_ROLE));
}

export function hasPlatformManagerAccess(
  legacyRole: string | null | undefined,
  appRoles: readonly string[] | null | undefined,
): boolean {
  return legacyRole === "admin"
    || Boolean(appRoles?.some((role) => role === "platform_admin" || role === "platform_owner" || role === PLATFORM_MANAGER_ROLE));
}

export function isRestrictedPlatformManager(
  legacyRole: string | null | undefined,
  appRoles: readonly string[] | null | undefined,
): boolean {
  return legacyRole !== "admin"
    && !appRoles?.includes("platform_admin")
    && !appRoles?.includes("platform_owner")
    && hasPlatformManagerRole(appRoles);
}
