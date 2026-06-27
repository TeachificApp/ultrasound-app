/**
 * useSsoBridge — Redirect-based cross-domain SSO fallback
 *
 * When the user is not logged in on a secondary domain (e.g. app.iheartecho.com),
 * redirect to app.allaboutultrasound.com/api/sso/bridge which reads the shared
 * session cookie and returns with ?sso=TOKEN.
 *
 * Loop prevention (belt-and-suspenders):
 *  1. isSsoBridgeBlocked()  — localStorage TTL (5 min) set when bridge fires.
 *     localStorage survives page reloads (unlike sessionStorage which was the
 *     original bug — sessionStorage cleared on reload → bridge re-triggered).
 *  2. isSsoSuccessRecent()  — localStorage flag set by useSsoConsumer BEFORE
 *     window.location.reload(). If the exchange succeeded, skip the bridge even
 *     if the cookie hasn't been read yet by auth.me.
 *  3. ?sso_failed=1 URL param — set by the bridge when AAUS has no session.
 *     Cleaned from URL and stops retrying until the TTL expires.
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

/** Primary SSO domain (AAUS) — hosts the /api/sso/bridge endpoint */
const PRIMARY_SSO_DOMAIN = "https://app.allaboutultrasound.com";

/** Secondary domains that need cross-domain SSO via the bridge */
const SECONDARY_DOMAINS = new Set([
  "app.iheartecho.com",
  "app.iheartecho.net",
  "accreditation.iheartecho.com",
  "members.allaboutultrasound.com",
  "learn.allaboutultrasound.com",
]);

/**
 * Returns true if the current hostname is a secondary domain that should
 * attempt the SSO bridge when unauthenticated.
 *
 * Also matches *.manus.space and *.manus.computer staging previews so the
 * bridge works during development/QA without requiring production domains.
 * Excludes app.allaboutultrasound.com and its staging variants (those are
 * the PRIMARY domain — they host the bridge, not consume it).
 */
function isSecondaryDomain(): boolean {
  const host = window.location.hostname;
  if (SECONDARY_DOMAINS.has(host)) return true;
  // Staging preview domains: any *.manus.space or *.manus.computer that is NOT
  // the AAUS primary app (which hosts the bridge endpoint).
  if (host.endsWith(".manus.space") || host.endsWith(".manus.computer")) {
    // AAUS staging domains — these ARE the primary; skip bridge
    if (host.includes("ultrasound")) return false;
    return true;
  }
  return false;
}

export function useSsoBridge() {
  const { user, loading } = useAuth();
  const hasRun = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Authenticated — clear the bridge lock so future logouts can re-trigger
      clearSsoBridgeLock();
      return;
    }

    if (!isSecondaryDomain()) return;

    const params = new URLSearchParams(window.location.search);

    // Already have a token in the URL — useSsoConsumer will handle it
    if (params.has("sso")) return;

    // Bridge returned sso_failed=1 — AAUS has no session, user must log in manually.
    // Replace the 5-min bridge lock with a short 30s "failed" lock so the
    // visibilitychange handler can retry quickly after the user logs in on AAUS
    // in another tab and switches back here.
    if (params.has("sso_failed")) {
      params.delete("sso_failed");
      const cleanSearch = params.toString();
      const cleanUrl =
        window.location.pathname +
        (cleanSearch ? `?${cleanSearch}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
      clearSsoBridgeLock();
      markSsoBridgeFailed();
      return;
    }

    // A successful SSO exchange just happened (set by useSsoConsumer before reload).
    // The cookie may not be visible to auth.me yet — don't re-trigger the bridge.
    if (isSsoSuccessRecent()) return;
    // If bridge failed recently (AAUS had no session), wait 30s before retrying.
    // Shorter than the 5-min bridge lock so the user can log in on AAUS and
    // switch back here to get auto-signed in quickly.
    if (isSsoBridgeFailedRecently()) return;

    const attemptBridge = () => {
      if (hasRun.current || userRef.current) return;
      // localStorage-based lock — survives page reloads (the original bug was
      // sessionStorage which is cleared on reload, causing the infinite loop)
      if (isSsoBridgeBlocked()) return;

      hasRun.current = true;
      markSsoBridgeAttempted();

      const returnUrl = window.location.href;
      const bridgeUrl = `${PRIMARY_SSO_DOMAIN}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}`;
      console.log("[SsoBridge] Redirecting to bridge:", bridgeUrl);
      window.location.href = bridgeUrl;
    };

    attemptBridge();

    // Re-attempt on tab focus (e.g. user logged in on AAUS in another tab)
    const onVisible = () => {
      if (document.visibilityState !== "visible" || userRef.current) return;
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
