import { lazy, Suspense } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const PlatformAdmin = lazy(() => import("./PlatformAdmin"));
const PlatformManagerDashboard = lazy(() => import("./PlatformManagerDashboard"));

const adminFallback = (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
    Loading administrative access…
  </div>
);

export default function PlatformAdminEntry() {
  const { user, loading } = useAuth();
  const appRoles = user?.appRoles ?? [];
  const isRestrictedManager = appRoles.includes("platform_manager")
    && !appRoles.some((role) => role === "platform_admin" || role === "platform_owner")
    && user?.role !== "admin";

  if (loading) {
    return adminFallback;
  }

  return (
    <Suspense fallback={adminFallback}>
      {isRestrictedManager ? <PlatformManagerDashboard /> : <PlatformAdmin />}
    </Suspense>
  );
}
