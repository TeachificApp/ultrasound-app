/**
 * Cross-domain SSO bridge configuration.
 *
 * Users often sign in on learn.allaboutultrasound.com. Other app hostnames
 * (app.allaboutultrasound.com, app.iheartecho.com, …) use redirect-based
 * /api/sso/bridge on an origin that already has a session cookie.
 */

/** Bridge hosts tried in order — learn first (primary login domain). */
export const SSO_BRIDGE_ORIGINS = [
  "https://learn.allaboutultrasound.com",
  "https://app.allaboutultrasound.com",
] as const;

/** Hostnames that should redirect to a bridge origin when unauthenticated. */
export const SSO_BRIDGE_CLIENT_HOSTS = new Set([
  "app.allaboutultrasound.com",
  "app.iheartecho.com",
  "app.iheartecho.net",
  "accreditation.iheartecho.com",
  "members.allaboutultrasound.com",
]);

/** Bridge origins to try from the current hostname (never bridge to self). */
export function getSsoBridgeOrigins(currentHostname: string): string[] {
  const host = currentHostname.toLowerCase();
  return SSO_BRIDGE_ORIGINS.filter((origin) => new URL(origin).hostname !== host);
}

/** True when this hostname should attempt redirect-based SSO from a peer domain. */
export function hostnameNeedsSsoBridge(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SSO_BRIDGE_CLIENT_HOSTS.has(host)) return true;
  if (host.endsWith(".manus.space") || host.endsWith(".manus.computer")) {
    // AAU staging hosts are bridge origins, not clients
    if (host.includes("ultrasound")) return false;
    return true;
  }
  return false;
}
