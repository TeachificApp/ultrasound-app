import type { CookieOptions, Request, Response } from "express";
import { COOKIE_NAME, DEMO_COOKIE_NAME, LAX_COOKIE_NAME } from "@shared/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Cookie domains that may have been used across AAUS / iHeartEcho deployments. */
export const KNOWN_COOKIE_DOMAINS = [
  ".allaboutultrasound.com",
  ".iheartecho.com",
  ".iheartecho.net",
] as const;

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

  // 5. host query param — encoded in magic-link / auto-login URLs for GET redirects
  const hostQuery = req.query?.host;
  if (typeof hostQuery === "string" && hostQuery.trim()) {
    const cleaned = hostQuery.trim().split(":")[0];
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned) && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }

  // 6. CANONICAL_ROOT_DOMAIN env var — production fallback when Cloudflare rewrites Host to .run.app
  const canonicalDomain = process.env.CANONICAL_ROOT_DOMAIN;
  if (canonicalDomain) {
    const cleaned = canonicalDomain.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (cleaned && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }

  // 7. IHE_CANONICAL_ROOT_DOMAIN — same for app.iheartecho.com GET auth flows
  const iheCanonical = process.env.IHE_CANONICAL_ROOT_DOMAIN;
  if (iheCanonical) {
    const cleaned = iheCanonical.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (cleaned && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }

  // 8. Fall back to req.hostname — may be internal Cloud Run hostname in production
  return req.hostname || (req.headers.host ?? "").split(":")[0];
}

/** Extract public hostname from Origin header (reliable on POST /api/auth/login). */
export function hostnameFromRequestOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (!origin) return undefined;
  const host = extractHostFromUrl(Array.isArray(origin) ? origin[0] : origin);
  if (host && !LOCAL_HOSTS.has(host) && !isIpAddress(host) && !isInternalHost(host)) {
    return host;
  }
  return undefined;
}

/** Resolve hostname override for cookie scoping on auth routes. */
export function resolveAuthHostname(req: Request, explicitHost?: string): string | undefined {
  if (explicitHost) {
    const cleaned = explicitHost.trim().split(":")[0].toLowerCase();
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned) && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }
  const hostQuery = req.query?.host;
  if (typeof hostQuery === "string" && hostQuery.trim()) {
    const cleaned = hostQuery.trim().split(":")[0].toLowerCase();
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned) && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }
  const fromOrigin = hostnameFromRequestOrigin(req);
  if (fromOrigin) return fromOrigin;
  const xApp = req.headers["x-app-hostname"];
  if (xApp) {
    const cleaned = (Array.isArray(xApp) ? xApp[0] : xApp).split(":")[0];
    if (cleaned && !isInternalHost(cleaned)) return cleaned;
  }
  const hostHeader = req.headers.host;
  if (hostHeader) {
    const cleaned = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader).split(":")[0];
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned) && !isInternalHost(cleaned)) {
      return cleaned;
    }
  }
  return undefined;
}

export function getSessionCookieOptions(
  req: Request,
  hostnameOverride?: string
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = hostnameOverride || getPublicHostname(req);
  const domain = getRootDomain(hostname);
  // In production behind Cloudflare/Cloud Run, req.protocol is always "http" (internal
  // container-to-container traffic). Cloudflare always terminates TLS on the public edge,
  // so we force secure:true whenever any proxy header is present or NODE_ENV=production.
  // SameSite=None cookies are silently dropped by browsers without the Secure flag.
  const isProduction = !!(  
    req.headers["x-forwarded-proto"] ||
    req.headers["x-forwarded-host"] ||
    process.env.NODE_ENV === "production"
  );
  const secure = isProduction ? true : isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Returns cookie options for the SameSite=Lax fallback cookie.
 * This cookie works in browsers that block SameSite=None (Chrome with 3rd-party
 * cookie blocking, Firefox Strict ETP, Brave, Safari ITP).
 * It is set alongside the SameSite=None cookie on every direct auth flow
 * (OAuth callback, magic link, password login). It cannot be used for
 * cross-domain SSO (that still requires SameSite=None), but it ensures
 * same-domain navigation always works.
 */
export function getLaxSessionCookieOptions(
  req: Request,
  hostnameOverride?: string
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = hostnameOverride || getPublicHostname(req);
  const domain = getRootDomain(hostname);
  const isProduction = !!(
    req.headers["x-forwarded-proto"] ||
    req.headers["x-forwarded-host"] ||
    process.env.NODE_ENV === "production"
  );
  const secure = isProduction ? true : isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Host-only Lax cookie (no Domain attribute).
 * Most reliable for magic-link email clicks — avoids Domain-scoped cookie rejection.
 */
export function getHostOnlyLaxSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  const isProduction = !!(
    req.headers["x-forwarded-proto"] ||
    req.headers["x-forwarded-host"] ||
    process.env.NODE_ENV === "production"
  );
  const secure = isProduction ? true : isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  };
}

/** Clear session cookies across every domain variant that may have been set. */
export function clearSessionCookies(
  res: Pick<Response, "clearCookie">,
  req: Request,
  cookieNames: string[] = [COOKIE_NAME, LAX_COOKIE_NAME, DEMO_COOKIE_NAME],
) {
  const opts = getSessionCookieOptions(req);
  const isProduction = !!(
    req.headers["x-forwarded-proto"] ||
    req.headers["x-forwarded-host"] ||
    process.env.NODE_ENV === "production"
  );
  const secure = isProduction ? true : opts.secure;
  const domains = new Set<string | undefined>([opts.domain, undefined, ...KNOWN_COOKIE_DOMAINS]);
  const sameSites: Array<"none" | "lax" | "strict"> = ["none", "lax"];

  for (const name of cookieNames) {
    for (const domain of domains) {
      for (const sameSite of sameSites) {
        const clearOpts: CookieOptions = { httpOnly: true, path: "/", sameSite, secure, maxAge: 0 };
        if (domain) clearOpts.domain = domain;
        res.clearCookie(name, clearOpts);
      }
    }
  }
}
