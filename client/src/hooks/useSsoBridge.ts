/**
 * useSsoBridge — Redirect-based cross-domain SSO fallback
 *
 * Run this hook on secondary domains (app.iheartecho.com, etc.) when the user
 * is NOT logged in. It redirects the browser to the primary domain's
 * /api/sso/bridge endpoint, which checks if the user has a session there and
 * either issues an SSO token (redirecting back with ?sso=TOKEN) or redirects
 * back unchanged.
 *
 * This is a fallback for cases where the img-tag SSO ping (useCrossDomainSso)
 * was blocked by 3rd-party cookie restrictions or failed silently.
 *
 * Flow:
 *   1. User visits app.iheartecho.com — not logged in
 *   2. This hook fires after auth state resolves (loading=false, user=null)
 *   3. Browser is redirected to https://app.allaboutultrasound.com/api/sso/bridge?return=<current_url>
 *   4. AAUS checks its session cookie (first-party, always readable)
 *      a. If logged in: issues token, redirects back to IHE with ?sso=TOKEN
 *      b. If not logged in: redirects back to IHE unchanged
 *   5. useSsoConsumer on IHE picks up ?sso=TOKEN and exchanges it for a session cookie
 *
 * Guards:
 *   - Only runs once per 3 minutes (localStorage timestamp) — retries after that interval
 *   - Retries when the user returns to the tab (visibilitychange) after 3+ min
 *   - Clears the lock after a successful login so future visits re-sync
 *   - Only runs on known secondary domains (not on the primary AAUS domain)
 *   - Does NOT run if ?sso= is already in the URL (useSsoConsumer handles that)
 *   - Does NOT run if user is already logged in
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

/** The primary domain that holds the authoritative session */
const PRIMARY_SSO_DOMAIN = "https://app.allaboutultrasound.com";

/** localStorage key storing the timestamp of the last bridge attempt */
const SSO_BRIDGE_TS_KEY = "sso_bridge_ts";

/** Minimum milliseconds between bridge redirect attempts (3 minutes) */
const BRIDGE_RETRY_INTERVAL_MS = 3 * 60 * 1000;

/** Domains that should use the bridge (secondary domains) */
const SECONDARY_DOMAINS = new Set([
  "app.iheartecho.com",
  "app.iheartecho.net",
  "accreditation.iheartecho.com",
  "members.allaboutultrasound.com",
]);

function isSecondaryDomain(): boolean {
  const host = window.location.hostname;
  return SECONDARY_DOMAINS.has(host);
}

/** Returns true if enough time has passed since the last bridge attempt */
function canAttemptBridge(): boolean {
  const ts = localStorage.getItem(SSO_BRIDGE_TS_KEY);
  if (!ts) return true;
  return Date.now() - parseInt(ts, 10) > BRIDGE_RETRY_INTERVAL_MS;
}

function recordBridgeAttempt() {
  localStorage.setItem(SSO_BRIDGE_TS_KEY, String(Date.now()));
}

function clearBridgeLock() {
  localStorage.removeItem(SSO_BRIDGE_TS_KEY);
}

export function useSsoBridge() {
  const { user, loading } = useAuth();
  const hasRun = useRef(false);
  const prevUser = useRef<typeof user>(null);

  // Clear the bridge lock when the user successfully logs in
  useEffect(() => {
    if (!loading && user && !prevUser.current) {
      clearBridgeLock();
    }
    prevUser.current = user;
  }, [loading, user]);

  const attemptBridge = () => {
    if (!isSecondaryDomain()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("sso")) return;
    if (!canAttemptBridge()) return;
    recordBridgeAttempt();
    const returnUrl = window.location.href;
    const bridgeUrl = `${PRIMARY_SSO_DOMAIN}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}`;
    window.location.href = bridgeUrl;
  };

  useEffect(() => {
    // Wait for auth state to resolve
    if (loading) return;
    // If user is already logged in, no bridge needed
    if (user) return;
    // Only run once per component mount (visibilitychange handler covers retries)
    if (hasRun.current) return;
    hasRun.current = true;
    attemptBridge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Retry bridge when the user returns to the tab after being away for 3+ min
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (user || loading) return;
      if (!isSecondaryDomain()) return;
      const params = new URLSearchParams(window.location.search);
      if (params.has("sso")) return;
      if (!canAttemptBridge()) return;
      attemptBridge();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);
}
