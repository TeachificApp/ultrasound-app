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
  // Sandbox/preview domains — don't share cookies across subdomains
  if (host.endsWith(".manus.space") || host.endsWith(".manus.computer") || host.endsWith(".us2.manus.computer")) return undefined;
  const parts = host.split(".");
  if (parts.length >= 2) {
    return "." + parts.slice(-2).join(".");
  }
  return undefined;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname || (req.headers.host ?? "").split(":")[0];
  const domain = getRootDomain(hostname);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
    ...(domain ? { domain } : {}),
  };
}
