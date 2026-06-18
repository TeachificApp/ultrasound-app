/** Matches RoleGuard + community admin API access for platform operators. */
export function isCommunityPlatformAdmin(
  user: { role?: string; appRoles?: string[] } | null | undefined,
): boolean {
  if (!user) return false;
  const appRoles = user.appRoles ?? [];
  return (
    user.role === "admin" ||
    appRoles.includes("platform_admin") ||
    appRoles.includes("platform_owner")
  );
}
