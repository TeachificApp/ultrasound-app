/**
 * ProfileNameBanner
 * Shown to logged-in users who have not set a real First + Last name.
 * Certificates use the legal name, so this is important for CME records.
 * Dismissed per-session via localStorage (reappears next login until fixed).
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, X, UserCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

const DISMISS_KEY = "profile_name_banner_dismissed";

function hasRealName(user: any): boolean {
  if (!user) return true; // not logged in — don't show
  const fn = (user.firstName ?? "").trim();
  const ln = (user.lastName ?? "").trim();
  // Has both first and last name — good
  if (fn && ln) return true;
  // Has a display name or name with a space — acceptable
  const dn = (user.displayName ?? user.name ?? "").trim();
  if (dn.includes(" ")) return true;
  return false;
}

export default function ProfileNameBanner() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try { return !!sessionStorage.getItem(DISMISS_KEY); } catch { return false; }
  });

  if (loading || !user || dismissed || hasRealName(user)) return null;

  function handleDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  }

  function handleGoToProfile() {
    handleDismiss();
    navigate("/profile");
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-between gap-3 px-4 py-2 text-white text-sm font-medium shadow-lg"
      style={{ background: "linear-gradient(90deg, #92400e 0%, #d97706 100%)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          <span className="font-bold">Action needed:</span>
          {" Your profile is missing a real first and last name. "}
          <span className="opacity-80 font-normal">
            CME certificates require your legal name.
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleGoToProfile}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Update Profile
        </button>
        <button
          onClick={handleDismiss}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
