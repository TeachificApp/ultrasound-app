/**
 * useSsoBridge — Redirect-based cross-domain SSO fallback
 *
 * When a deliberately initiated cross-domain session recovery includes
 * ?sso_bridge=1, redirect to learn.allaboutultrasound.com (or
 * app.allaboutultrasound.com) /api/sso/bridge which reads an existing session
 * cookie and returns with ?sso=TOKEN.
 *
 * It must never run for an anonymous public-page visit. Public browsing stays
 * public; only an explicit sign-in or protected-action flow can request session
 * recovery. It also NEVER runs on auth pages (/login, /magic-link, etc.).
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

const SSO_BRIDGE_OPT_IN_PARAM = "sso_bridge";

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

/** Preserve the bridge attempt index on the return URL so a failed bridge can try the next approved origin. */
function getBridgeReturnUrlWithAttempt(tryIndex: number): string {
  const returnUrl = new URL(getBridgeReturnUrl());
  returnUrl.searchParams.set("bridge_try", String(tryIndex));
  return returnUrl.toString();
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

    // Do not redirect an anonymous visitor away from a public page. The normal
    // cross-domain broadcaster handles signed-in visitors; this fallback is
    // reserved for a future protected flow that deliberately requests recovery.
    if (params.get(SSO_BRIDGE_OPT_IN_PARAM) !== "1") return;

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
        const nextTryIndex = tryIndex + 1;
        const returnUrl = getBridgeReturnUrlWithAttempt(nextTryIndex);
        const bridgeUrl = `${bridgeOrigins[nextTryIndex]}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}&bridge_try=${nextTryIndex}`;
        console.log("[SsoBridge] Retrying bridge via", bridgeOrigins[nextTryIndex]);
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

      const returnUrl = getBridgeReturnUrlWithAttempt(tryIndex);
      const fallbackOrigin = bridgeOrigins[tryIndex + 1];
      const fallbackParam = fallbackOrigin ? `&fallback=${encodeURIComponent(fallbackOrigin)}` : "";
      const bridgeUrl = `${bridgeOrigin}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}&bridge_try=${tryIndex}${fallbackParam}`;
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
