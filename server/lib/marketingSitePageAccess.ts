import { createHmac, timingSafeEqual } from "node:crypto";
import { parse as parseCookie } from "cookie";
import { ENV } from "../_core/env";

const PAGE_ACCESS_COOKIE = "public_site_page_access";
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 7;

type AccessPayload = { pageId: number; tenantKey: string; expiresAt: number };

function secret(): string {
  return ENV.cookieSecret || "public-site-preview-fallback-secret";
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPublicPageAccessCookie(pageId: number, tenantKey: string): string {
  const payload: AccessPayload = { pageId, tenantKey, expiresAt: Date.now() + ACCESS_TTL_SECONDS * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function hasPublicPageAccess(cookieHeader: string | undefined, pageId: number, tenantKey: string): boolean {
  const token = parseCookie(cookieHeader ?? "")[PAGE_ACCESS_COOKIE];
  if (!token) return false;
  const [encoded, providedSignature] = token.split(".");
  if (!encoded || !providedSignature) return false;
  const expectedSignature = signature(encoded);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AccessPayload;
    return payload.pageId === pageId && payload.tenantKey === tenantKey && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function publicPageAccessCookieHeader(token: string): string {
  // The installed cookie type declarations expose parsing but omit
  // serialization despite the runtime supporting it. The signed token is
  // base64url data plus a dot, so this compact RFC 6265 header is safe.
  return `${PAGE_ACCESS_COOKIE}=${encodeURIComponent(token)}; Max-Age=${ACCESS_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${ENV.isProduction ? "; Secure" : ""}`;
}

export const PUBLIC_PAGE_ACCESS_COOKIE_NAME = PAGE_ACCESS_COOKIE;
