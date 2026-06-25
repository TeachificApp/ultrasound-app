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
      if (new URLSearchParams(window.location.search).has("sso")) return;
      if (!isSsoBridgeBlocked()) {
        hasRun.current = false;
        attemptBridge();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading, user]);
}
