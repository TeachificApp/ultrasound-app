/**
 * usePremium — shared hook for consistent premium access checks across iHeartEcho™.
 *
 * Returns:
 *   isPremium  — true if the user has any premium-tier role or the isPremium DB flag
 *   isDiyUser  — true if the user has DIY Accreditation access
 *   isLabAdmin — true if the user has Lab Admin access
 *   isAdmin    — true if the user is a platform admin
 *   appRoles   — raw array of role strings
 */
import { useAuth } from "@/_core/hooks/useAuth";
import {
  hasPremiumAccess,
  hasDiyAccess,
  hasLabAdminAccess,
  hasPlatformAdminAccess,
} from "@/lib/roles";

export function usePremium() {
  const { user, isAuthenticated, loading } = useAuth();
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  // isPremium is now returned directly from auth.me (DB flag OR role-based)
  const isPremium: boolean =
    (user as any)?.isPremium === true || hasPremiumAccess(appRoles);
  const isDiyUser = hasDiyAccess(appRoles);
  const isLabAdmin = hasLabAdminAccess(appRoles);
  const isAdmin = hasPlatformAdminAccess(appRoles) || (user as any)?.role === "admin";

  return {
    isPremium,
    isDiyUser,
    isLabAdmin,
    isAdmin,
    appRoles,
    isAuthenticated,
    loading,
    user,
  };
}
