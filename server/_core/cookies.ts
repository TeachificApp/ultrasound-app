import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
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
  if (host.endsWith(".run.app") || host.endsWith(".cloudfunctions.net") || host.endsWith(".appspot.com")) return undefined;
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
 * Cloudflare and other reverse proxies set x-forwarded-host to the original
 * public hostname. req.hostname may be the internal Cloud Run hostname (.run.app)
 * which is wrong for cookie domain scoping.
 */
function extractHostFromUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function getPublicHostname(req: Request): string {
  // x-forwarded-host is set by Cloudflare/nginx to the original public hostname
  const xForwardedHost = req.headers["x-forwarded-host"];
  if (xForwardedHost) {
    const fwdHost = Array.isArray(xForwardedHost) ? xForwardedHost[0] : xForwardedHost;
    const cleaned = fwdHost.split(",")[0].trim().split(":")[0];
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned)) {
      return cleaned;
    }
  }
  // x-app-hostname is sent by the tRPC client and contains window.location.hostname
  const xAppHostname = req.headers["x-app-hostname"];
  if (xAppHostname) {
    const appHost = Array.isArray(xAppHostname) ? xAppHostname[0] : xAppHostname;
    const cleaned = appHost.split(",")[0].trim().split(":")[0];
    if (cleaned && !LOCAL_HOSTS.has(cleaned) && !isIpAddress(cleaned)) {
      return cleaned;
    }
  }
  // Origin header is always present on cross-origin fetch/XHR requests and contains the real public hostname.
  // This is the most reliable fallback when Cloudflare does not forward x-forwarded-host.
  const origin = req.headers["origin"];
  if (origin) {
    const originHost = extractHostFromUrl(Array.isArray(origin) ? origin[0] : origin);
    if (originHost && !LOCAL_HOSTS.has(originHost) && !isIpAddress(originHost)) {
      return originHost;
    }
  }
  // Referer header as last resort before falling back to internal hostname
  const referer = req.headers["referer"];
  if (referer) {
    const refHost = extractHostFromUrl(Array.isArray(referer) ? referer[0] : referer);
    if (refHost && !LOCAL_HOSTS.has(refHost) && !isIpAddress(refHost)) {
      return refHost;
    }
  }
  // Fall back to req.hostname (Express with trust proxy=1 resolves this from x-forwarded-host too,
  // but only if the proxy is trusted — use our own resolution as belt-and-suspenders)
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
