/**
 * useSsoBridge — Redirect-based cross-domain SSO fallback
 *
 * When the user is not logged in on a secondary domain (e.g. app.iheartecho.com),
 * redirect to app.allaboutultrasound.com/api/sso/bridge which reads the shared
 * session cookie and returns with ?sso=TOKEN.
 *
 * NEVER runs on auth pages (/login, /magic-link, etc.) — the user is actively
 * signing in and the bridge would hijack magic-link / password flows.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  clearSsoBridgeLock,
  isSsoBridgeBlocked,
  isSsoBridgeFailedRecently,
  isSsoSuccessRecent,
  markSsoBridgeAttempted,
  markSsoBridgeFailed,
} from "@/lib/ssoSession";

/** Primary SSO domains (AAU family) — hosts /api/sso/bridge; tried in order */
const BRIDGE_ORIGINS = [
  "https://app.allaboutultrasound.com",
  "https://learn.allaboutultrasound.com",
] as const;

const SECONDARY_DOMAINS = new Set([
  "app.iheartecho.com",
  "app.iheartecho.net",
  "accreditation.iheartecho.com",
  "members.allaboutultrasound.com",
]);

const AUTH_PATH_PREFIXES = [
  "/login",
  "/register",
  "/magic-link",
  "/auth/",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function isAuthPage(): boolean {
  const path = window.location.pathname;
  return AUTH_PATH_PREFIXES.some((p) => path === p || path.startsWith(p));
}

function isSecondaryDomain(): boolean {
  const host = window.location.hostname;
  if (SECONDARY_DOMAINS.has(host)) return true;
  if (host.endsWith(".manus.space") || host.endsWith(".manus.computer")) {
    if (host.includes("ultrasound")) return false;
    return true;
  }
  return false;
}

/** Bridge return URL — never the login page (would loop after SSO exchange). */
function getBridgeReturnUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") ?? params.get("return");
  if (
    returnTo &&
    returnTo.startsWith("/") &&
    !AUTH_PATH_PREFIXES.some((p) => returnTo === p || returnTo.startsWith(p + "?"))
  ) {
    return new URL(returnTo, window.location.origin).toString();
  }
  return `${window.location.origin}/my-dashboard`;
}

export function useSsoBridge() {
  const { user, loading } = useAuth();
  const hasRun = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (loading) return;

    if (user) {
      clearSsoBridgeLock();
      return;
    }

    if (!isSecondaryDomain()) return;

    // User is on login / magic-link / etc. — do not hijack with cross-domain bridge
    if (isAuthPage()) return;

    const params = new URLSearchParams(window.location.search);

    // Magic-link / SSO exchange just set cookies — do not redirect to AAUS bridge
    if (params.get("auth_pending") === "1") return;

    if (params.has("sso")) return;

    if (params.has("sso_failed")) {
      const tryIndex = Number(params.get("bridge_try") ?? "0");
      params.delete("sso_failed");
      params.delete("bridge_try");
      const cleanSearch = params.toString();
      const cleanUrl =
        window.location.pathname +
        (cleanSearch ? `?${cleanSearch}` : "") +
        window.location.hash;

      if (tryIndex + 1 < BRIDGE_ORIGINS.length) {
        const returnUrl = getBridgeReturnUrl();
        const bridgeUrl = `${BRIDGE_ORIGINS[tryIndex + 1]}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}&bridge_try=${tryIndex + 1}`;
        console.log("[SsoBridge] Retrying bridge via", BRIDGE_ORIGINS[tryIndex + 1]);
        window.location.href = bridgeUrl;
        return;
      }

      window.history.replaceState({}, "", cleanUrl);
      clearSsoBridgeLock();
      markSsoBridgeFailed();
      return;
    }

    if (isSsoSuccessRecent()) return;
    if (isSsoBridgeFailedRecently()) return;

    const attemptBridge = () => {
      if (hasRun.current || userRef.current) return;
      if (isSsoBridgeBlocked()) return;

      hasRun.current = true;
      markSsoBridgeAttempted();

      const tryIndex = Number(params.get("bridge_try") ?? "0");
      const bridgeOrigin = BRIDGE_ORIGINS[tryIndex] ?? BRIDGE_ORIGINS[0];
      const returnUrl = getBridgeReturnUrl();
      const bridgeUrl = `${bridgeOrigin}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}&bridge_try=${tryIndex}`;
      console.log("[SsoBridge] Redirecting to bridge:", bridgeUrl);
      window.location.href = bridgeUrl;
    };

    attemptBridge();

    const onVisible = () => {
      if (document.visibilityState !== "visible" || userRef.current) return;
      if (isAuthPage()) return;
      const visParams = new URLSearchParams(window.location.search);
      if (visParams.has("sso") || visParams.has("sso_failed")) return;
      if (isSsoSuccessRecent()) return;
      if (!isSsoBridgeBlocked() && !isSsoBridgeFailedRecently()) {
        hasRun.current = false;
        attemptBridge();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading, user]);
}
