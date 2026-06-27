/**
 * useSsoBridge — Redirect-based cross-domain SSO fallback
 *
 * When the user is not logged in on a secondary domain (e.g. app.iheartecho.com),
 * redirect to app.allaboutultrasound.com/api/sso/bridge which reads the shared
 * .allaboutultrasound.com session cookie and returns with ?sso=TOKEN.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  clearSsoBridgeLock,
  isSsoBridgeBlocked,
  markSsoBridgeAttempted,
} from "@/lib/ssoSession";

/** Domains that share the AAUS session cookie jar */
const PRIMARY_SSO_DOMAIN = "https://app.allaboutultrasound.com";

/** Secondary domains that need cross-domain SSO */
const SECONDARY_DOMAINS = new Set([
  "app.iheartecho.com",
  "app.iheartecho.net",
  "accreditation.iheartecho.com",
  "members.allaboutultrasound.com",
]);

function isSecondaryDomain(): boolean {
  return SECONDARY_DOMAINS.has(window.location.hostname);
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

    const params = new URLSearchParams(window.location.search);
    if (params.has("sso")) return;

    // If the bridge already returned sso_failed=1, the primary domain has no session.
    // Clean the param from the URL and stop retrying — the user needs to sign in manually.
    if (params.has("sso_failed")) {
      params.delete("sso_failed");
      const cleanSearch = params.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    const attemptBridge = () => {
      if (hasRun.current || userRef.current) return;
      if (isSsoBridgeBlocked()) return;

      hasRun.current = true;
      markSsoBridgeAttempted();

      const returnUrl = window.location.href;
      const bridgeUrl = `${PRIMARY_SSO_DOMAIN}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}`;
      window.location.href = bridgeUrl;
    };

    attemptBridge();

    const onVisible = () => {
      if (document.visibilityState !== "visible" || userRef.current) return;
      const visParams = new URLSearchParams(window.location.search);
      if (visParams.has("sso") || visParams.has("sso_failed")) return;
      if (!isSsoBridgeBlocked()) {
        hasRun.current = false;
        attemptBridge();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading, user]);
}
