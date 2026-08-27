/**
 * useSsoBridge — Redirect-based cross-domain SSO fallback
 *
 * When the user is not logged in on a client domain (e.g. app.iheartecho.com or
 * app.allaboutultrasound.com), redirect to learn.allaboutultrasound.com (or
 * app.allaboutultrasound.com) /api/sso/bridge which reads an existing session
 * cookie and returns with ?sso=TOKEN.
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
import {
  getSsoBridgeOrigins,
  hostnameNeedsSsoBridge,
} from "@shared/ssoBridgeDomains";

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

    const bridgeOrigins = getSsoBridgeOrigins(window.location.hostname);
    if (!hostnameNeedsSsoBridge(window.location.hostname) || bridgeOrigins.length === 0) {
      return;
    }

    // User is on login / magic-link / etc. — do not hijack with cross-domain bridge
    if (isAuthPage()) return;

    const params = new URLSearchParams(window.location.search);

    // Magic-link / SSO exchange just set cookies — do not redirect to bridge
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

      if (tryIndex + 1 < bridgeOrigins.length) {
        const returnUrl = getBridgeReturnUrl();
        const bridgeUrl = `${bridgeOrigins[tryIndex + 1]}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}&bridge_try=${tryIndex + 1}`;
        console.log("[SsoBridge] Retrying bridge via", bridgeOrigins[tryIndex + 1]);
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
      const bridgeOrigin = bridgeOrigins[tryIndex] ?? bridgeOrigins[0];
      if (!bridgeOrigin) return;

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
