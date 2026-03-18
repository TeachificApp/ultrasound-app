/**
 * Shared role-check helpers for iHeartEcho™.
 *
 * Role hierarchy:
 *   platform_admin  – full access to everything
 *   diy_admin       – Lab Admin + all premium features
 *   diy_user        – DIY Accreditation Tool™ + all premium features
 *   premium_user    – premium clinical features only (no DIY tool)
 *   user            – free tier (base clinical tools only)
 */

/** Roles that grant access to premium clinical features (Navigator TEE/ICE/Strain/Device, EchoAssist™ engines) */
const PREMIUM_ROLES = new Set(["premium_user", "diy_user", "diy_admin", "platform_admin"]);

/** Roles that grant access to the DIY Accreditation Tool™ */
const DIY_ROLES = new Set(["diy_user", "diy_admin", "platform_admin"]);

/** Roles that grant access to the Lab Admin dashboard */
const LAB_ADMIN_ROLES = new Set(["diy_admin", "platform_admin"]);

/** Roles that grant access to the Platform Admin dashboard */
const PLATFORM_ADMIN_ROLES = new Set(["platform_admin"]);

/**
 * Returns true if the user holds at least one role that grants premium
 * clinical feature access.
 */
export function hasPremiumAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => PREMIUM_ROLES.has(r));
}

/**
 * Returns true if the user holds at least one role that grants DIY
 * Accreditation Tool access.
 */
export function hasDiyAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => DIY_ROLES.has(r));
}

/**
 * Returns true if the user holds at least one role that grants Lab Admin
 * dashboard access.
 */
export function hasLabAdminAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => LAB_ADMIN_ROLES.has(r));
}

/**
 * Returns true if the user holds the platform_admin role.
 */
export function hasPlatformAdminAccess(appRoles: string[] | undefined | null): boolean {
  if (!appRoles || appRoles.length === 0) return false;
  return appRoles.some((r) => PLATFORM_ADMIN_ROLES.has(r));
}
