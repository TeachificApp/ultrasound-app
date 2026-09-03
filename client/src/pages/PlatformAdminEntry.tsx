import { useAuth } from "@/_core/hooks/useAuth";
import PlatformManagerDashboard from "./PlatformManagerDashboard";
import PlatformAdmin from "./PlatformAdmin";

export default function PlatformAdminEntry() {
  const { user, loading } = useAuth();
  const appRoles = user?.appRoles ?? [];
  const isRestrictedManager = appRoles.includes("platform_manager")
    && !appRoles.some((role) => role === "platform_admin" || role === "platform_owner")
    && user?.role !== "admin";

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading administrative access…</div>;
  }

  return isRestrictedManager ? <PlatformManagerDashboard /> : <PlatformAdmin />;
}
