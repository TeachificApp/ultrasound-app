import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isInternalHost(host: string): boolean {
  if (!host) return true;
  if (LOCAL_HOSTS.has(host)) return false; // local is not "internal" in the Cloud Run sense
  return (
    host.endsWith(".run.app") ||
    host.endsWith(".cloudfunctions.net") ||
    host.endsWith(".appspot.com")
  );
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Derive the root domain for cookie sharing across subdomains.
 * e.g. "app.allaboutultrasound.com" → ".allaboutultrasound.com"
 *      "learn.allaboutultrasound.com" → ".allaboutultrasound.com"
 *      "app.iheartecho.net" → ".iheartecho.net"
 *      "localhost" → undefined (no domain attribute)
 */
function getRootDomain(hostname: string): string | undefined {
  if (!hostname || LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) return undefined;
  const host = hostname.split(":")[0];
  // Internal Cloud Run / GCP domains — never use as cookie domain
  if (isInternalHost(host)) return undefined;
  // Sandbox/preview domains — don't share cookies across subdomains
  if (host.endsWith(".manus.space") || host.endsWith(".manus.computer") || host.endsWith(".us2.manus.computer")) return undefined;
  const parts = host.split(".");
  if (parts.length >= 2) {
    return "." + parts.slice(-2).join(".");
  }
  return undefined;
}

/**
 * Resolve the public-facing hostname from the request.
 *
 * Priority order (highest to lowest reliability):
 * 1. x-forwarded-host  — set by Cloudflare/nginx (NOT forwarded by Cloudflare in some configs)
 * 2. x-app-hostname    — sent by tRPC client JS (only available for fetch/XHR, not browser redirects)
 * 3. Origin header     — present on cross-origin requests (not on same-origin GET redirects)
 * 4. Referer header    — present on navigation but stripped on cross-origin redirects
 * 5. CANONICAL_ROOT_DOMAIN env var — hardcoded production fallback (most reliable for OAuth/magic-link)
 * 6. req.hostname      — internal Cloud Run hostname (.run.app) — last resort
 */
function extractHostFromUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function getPublicHostname(req: Request): string {
  // 1. x-forwarded-host is set by Cloudflare/nginx to the original public hostname
  const xForwardedHost = req.headers["x-forwarded-host"];
  if (xForwardedHost) {
    const fwdHost = Array.isArray(xForwardedHost) ? xForwardedHost[0] : xForwardedHost;
    const cleaned = fwdHost.split(",")[0].trim().split(":")[0];
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned) && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }

  // 2. x-app-hostname is sent by the tRPC client and contains window.location.hostname
  const xAppHostname = req.headers["x-app-hostname"];
  if (xAppHostname) {
    const appHost = Array.isArray(xAppHostname) ? xAppHostname[0] : xAppHostname;
    const cleaned = appHost.split(",")[0].trim().split(":")[0];
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned) && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }

  // 3. Origin header is present on cross-origin fetch/XHR requests
  const origin = req.headers["origin"];
  if (origin) {
    const originHost = extractHostFromUrl(Array.isArray(origin) ? origin[0] : origin);
    if (originHost && !LOCAL_HOSTS.has(originHost) && !isIpAddress(originHost) && !isInternalHost(originHost)) {
      return originHost;
    }
  }

  // 4. Referer header as last resort before env fallback
  const referer = req.headers["referer"];
  if (referer) {
    const refHost = extractHostFromUrl(Array.isArray(referer) ? referer[0] : referer);
    if (refHost && !LOCAL_HOSTS.has(refHost) && !isIpAddress(refHost) && !isInternalHost(refHost)) {
      return refHost;
    }
  }

  // 5. CANONICAL_ROOT_DOMAIN env var — hardcoded production domain.
  //    This is the most reliable fallback for browser GET requests (OAuth callback,
  //    magic-link redirect, auto-login) where no JS headers are available.
  //    When set, it contains the primary public hostname e.g. "app.allaboutultrasound.com".
  const canonicalDomain = process.env.CANONICAL_ROOT_DOMAIN;
  if (canonicalDomain) {
    // Strip protocol if present (e.g. "https://app.allaboutultrasound.com" → "app.allaboutultrasound.com")
    const cleaned = canonicalDomain.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (cleaned && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }

  // 6. Fall back to req.hostname — may be internal Cloud Run hostname in production
  return req.hostname || (req.headers.host ?? "").split(":")[0];
}

export function getSessionCookieOptions(
  req: Request,
  hostnameOverride?: string
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = hostnameOverride || getPublicHostname(req);
  const domain = getRootDomain(hostname);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
    ...(domain ? { domain } : {}),
  };
}
