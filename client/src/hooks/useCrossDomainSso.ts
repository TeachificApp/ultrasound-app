/**
 * useCrossDomainSso — Silent cross-domain SSO broadcaster
 *
 * Run this hook once at the top level of each domain's router (LMS, IHE, AAUS, Accreditation).
 * When the user is authenticated, it:
 *   1. Issues one short-lived SSO token per target domain (60-second TTL, single-use each)
 *   2. Pings each of the other domains' /api/sso/auto?token=TOKEN&domain=HOSTNAME endpoint
 *      via a hidden <img> tag — the browser sends the request with credentials,
 *      and the server sets a session cookie for that domain
 *
 * Why ?domain= is required:
 *   <img> tag requests carry no Origin, no Referer, and no x-forwarded-host headers.
 *   Without the ?domain= param, the server's getPublicHostname() would fall back to
 *   CANONICAL_ROOT_DOMAIN (the AAU domain) and scope the IHE cookie to the wrong domain.
 *   By passing the target hostname explicitly, the server can always scope the cookie
 *   correctly regardless of request headers.
 *
 * Accreditation domain rules:
 *  - Broadcasting FROM accreditation.iheartecho.com: only users with an active
 *    accreditation subscription are signed into the other apps. If the server
 *    returns allowed:false, no tokens are issued and no pings are sent.
 *  - Broadcasting TO accreditation.iheartecho.com: always happens — users from
 *    other apps are signed in as free members and will see the upgrade prompt.
 *
 * Premium stays siloed: the session cookie issued on the target domain is a
 * free-tier session. Membership tier is determined per-domain by the server.
 *
 * The hook runs only once per browser session (sessionStorage flag).
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/** All known app domains that participate in cross-domain SSO */
const ALL_DOMAINS = [
  "https://app.iheartecho.com",   // canonical .com domain (primary)
  "https://app.iheartecho.net",   // legacy .net domain (still in use)
  "https://app.allaboutultrasound.com",
  "https://learn.allaboutultrasound.com",
  "https://members.allaboutultrasound.com",
  "https://accreditation.iheartecho.com",
] as const;

/**
 * localStorage key prefix for per-user broadcast tracking.
 * Stored as `sso_broadcast_<userId>` so a new login always re-broadcasts.
 */
const SSO_BROADCAST_KEY_PREFIX = "sso_broadcast_";

/** Detect if the current domain is the accreditation domain */
function isAccreditationDomain(): boolean {
  const host = window.location.hostname;
  return host === "accreditation.iheartecho.com" || host.includes("accreditation");
}

/**
 * Extract the hostname from a domain origin string.
 * e.g. "https://app.iheartecho.com" → "app.iheartecho.com"
 */
function hostnameFromOrigin(origin: string): string {
  try { return new URL(origin).hostname; } catch { return origin; }
}

/**
 * Returns the production domains that are NOT the current domain.
 * Always returns all non-current production domains regardless of
 * whether we're on a staging/dev hostname.
 */
function getTargetDomains(): string[] {
  const current = window.location.origin;
  return ALL_DOMAINS.filter(d => d !== current);
}

/**
 * Injects a hidden <img> element that loads /api/sso/auto?token=TOKEN&domain=HOSTNAME
 * on the target domain. The server sets a session cookie in the response.
 *
 * The ?domain= param is critical: <img> requests carry no Origin/Referer headers,
 * so the server needs the explicit hostname to scope the cookie correctly.
 *
 * The <img> is removed from the DOM after 15 seconds.
 */
function pingDomain(domain: string, token: string): void {
  const hostname = hostnameFromOrigin(domain);
  const url = `${domain}/api/sso/auto?token=${encodeURIComponent(token)}&domain=${encodeURIComponent(hostname)}`;

  // Try CORS fetch first; fall back to img-tag ping if fetch fails
  fetch(url, { method: "GET", credentials: "include", mode: "cors" }).catch(() => {
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
    img.setAttribute("aria-hidden", "true");
    document.body.appendChild(img);
    setTimeout(() => {
      try { document.body.removeChild(img); } catch { /* already removed */ }
    }, 15_000);
  });
}

export function useCrossDomainSso() {
  const { user, loading } = useAuth();
  const issueTokens = trpc.sso.issueTokens.useMutation();
  const hasRun = useRef(false);

  useEffect(() => {
    // Wait for auth state to resolve
    if (loading) return;
    // Only broadcast if authenticated
    if (!user) return;
    // Only run once per component mount
    if (hasRun.current) return;
    // Only broadcast once per user per browser session
    // Keyed by userId so a new login always re-broadcasts
    const broadcastKey = `${SSO_BROADCAST_KEY_PREFIX}${user.id}`;
    if (sessionStorage.getItem(broadcastKey)) return;

    hasRun.current = true;

    const targets = getTargetDomains();
    if (targets.length === 0) return;

    const sourceIsAccreditation = isAccreditationDomain();

    // Issue one token per target domain so each exchange is independent
    issueTokens.mutate(
      { count: targets.length, sourceIsAccreditation },
      {
        onSuccess: ({ tokens, allowed }) => {
          // If the server blocked broadcasting (e.g. no active accreditation sub), stop here
          if (!allowed || tokens.length === 0) return;

          // Mark as done so we don't re-broadcast on next navigation within this session
          sessionStorage.setItem(broadcastKey, "1");

          // Ping each target domain with its own unique token + explicit domain param
          targets.forEach((domain, i) => {
            const token = tokens[i];
            if (token) pingDomain(domain, token);
          });
        },
        onError: () => {
          // Token issuance failed — silently ignore
          // User stays logged in on current domain; they can log in manually on others
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);
}
