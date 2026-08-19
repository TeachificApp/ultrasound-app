import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  MAINTENANCE_BANNER_DISMISSAL_KEY,
  MAINTENANCE_BANNER_EXPIRES_AT,
  shouldShowMaintenanceBanner,
} from "@shared/maintenanceBanner";

export default function MaintenanceBanner() {
  const { user, loading } = useAuth();
  const [isDismissed, setIsDismissed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(MAINTENANCE_BANNER_DISMISSAL_KEY) === "true",
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const remaining = MAINTENANCE_BANNER_EXPIRES_AT - Date.now();
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(timeout);
  }, []);

  if (loading || !shouldShowMaintenanceBanner({ isAuthenticated: Boolean(user), isDismissed, now })) return null;

  const dismiss = () => {
    window.localStorage.setItem(MAINTENANCE_BANNER_DISMISSAL_KEY, "true");
    setIsDismissed(true);
  };

  return (
    <div className="relative z-[70] flex min-h-9 items-center justify-center border-b border-amber-400 bg-amber-200 px-10 py-1.5 text-center text-xs font-medium leading-5 text-amber-950 sm:text-sm" role="status">
      <p>
        <strong>Scheduled Server Maintenance Aug 22–24, 2026:</strong>{" "}
        Service disruptions may occur as our servers are upgraded. We appreciate your patience as we make improvements to our platform.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss maintenance notice"
        className="absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded text-amber-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
