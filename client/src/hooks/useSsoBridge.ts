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
 *   - Only runs once per browser session (sessionStorage flag)
 *   - Only runs on known secondary domains (not on the primary AAUS domain)
 *   - Does NOT run if ?sso= is already in the URL (useSsoConsumer handles that)
 *   - Does NOT run if user is already logged in
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

/** The primary domain that holds the authoritative session */
const PRIMARY_SSO_DOMAIN = "https://app.allaboutultrasound.com";

/** Session storage key to prevent redirect loops */
const SSO_BRIDGE_KEY = "sso_bridge_attempted";

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

export function useSsoBridge() {
  const { user, loading } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    // Wait for auth state to resolve
    if (loading) return;

    // If user is already logged in, no bridge needed
    if (user) return;

    // Only run on secondary domains
    if (!isSecondaryDomain()) return;

    // Only run once per component mount
    if (hasRun.current) return;
    hasRun.current = true;

    // Don't run if ?sso= is already in the URL (useSsoConsumer will handle it)
    const params = new URLSearchParams(window.location.search);
    if (params.has("sso")) return;

    // Don't run if we've already attempted the bridge this session (prevent loops)
    if (sessionStorage.getItem(SSO_BRIDGE_KEY)) return;

    // Mark as attempted before redirecting to prevent loops
    sessionStorage.setItem(SSO_BRIDGE_KEY, "1");

    // Build the return URL (current page)
    const returnUrl = window.location.href;

    // Redirect to the primary domain's bridge endpoint
    const bridgeUrl = `${PRIMARY_SSO_DOMAIN}/api/sso/bridge?return=${encodeURIComponent(returnUrl)}`;
    window.location.href = bridgeUrl;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);
}
