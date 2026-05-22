import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { DEMO_COOKIE_NAME } from "@shared/const";
import { type Brand, type BrandMode, detectBrandMode } from "@shared/brands";

export type { Brand, BrandMode };

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Detected brand based on request hostname (for data/auth: aaus or iheartecho) */
  brand: Brand;
  /** Detected brand mode based on request hostname (for visual branding: aaus, iheartecho, or combined) */
  brandMode: BrandMode;
  /** True when the current request is running under a demo impersonation session */
  demoMode: boolean;
  /** The real admin's user ID when demoMode is true */
  realAdminId: number | null;
};

/** Detect brand from request hostname */
function detectBrand(hostname: string): Brand {
  const h = hostname.toLowerCase();
  if (h.includes("iheartecho")) return "iheartecho";
  return "aaus";
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let demoMode = false;
  let realAdminId: number | null = null;

  // Check for demo session cookie first — takes precedence over normal session
  const rawCookies = parseCookieHeader(opts.req.headers.cookie ?? "");
  const demoCookieValue = rawCookies[DEMO_COOKIE_NAME];
  if (demoCookieValue) {
    try {
      const secretKey = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(demoCookieValue, secretKey, { algorithms: ["HS256"] });
      const { targetUserId, adminId } = payload as Record<string, unknown>;
      if (typeof targetUserId === "number" && typeof adminId === "number") {
        const { getUserById } = await import("../db");
        const targetUser = await getUserById(targetUserId);
        // Only allow impersonating users flagged as demo accounts
        if (targetUser?.isDemo) {
          user = targetUser;
          demoMode = true;
          realAdminId = adminId;
        }
      }
    } catch {
      // Invalid or expired demo cookie — fall through to normal auth
    }
  }

  if (!demoMode) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  // Behind a reverse proxy (trust proxy=1), req.hostname may return the internal host.
  // Priority (highest to lowest):
  //   1. _brand query param (set by frontend, cannot be stripped by any proxy)
  //   2. X-App-Hostname header (may be stripped by Cloud Run proxy)
  //   3. X-Forwarded-Host header
  //   4. Origin header (not sent for same-origin requests)
  //   5. Referer header
  //   6. Host header / req.hostname
  const brandQueryParam = (opts.req.query as Record<string, string>)?.["_brand"] || "";
  const appHostname = opts.req.headers["x-app-hostname"];
  const forwardedHost = opts.req.headers["x-forwarded-host"];
  const originHeader = opts.req.headers["origin"] || "";
  const refererHeader = opts.req.headers["referer"] || "";
  // Extract hostname from Origin/Referer URL
  function extractHostname(url: string): string {
    try { return new URL(url).hostname; } catch { return ""; }
  }
  const originHostname = extractHostname(Array.isArray(originHeader) ? originHeader[0] : originHeader);
  const refererHostname = extractHostname(Array.isArray(refererHeader) ? refererHeader[0] : refererHeader);
  // If _brand query param is set directly, use it as the brand (most reliable)
  let brand: Brand;
  let brandMode: BrandMode;
  if (brandQueryParam === "iheartecho") {
    brand = "iheartecho";
    brandMode = "iheartecho";
  } else if (brandQueryParam === "aaus") {
    brand = "aaus";
    brandMode = "aaus";
  } else {
    const hostname = (Array.isArray(appHostname) ? appHostname[0] : appHostname)
      || (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
      || originHostname
      || refererHostname
      || opts.req.headers.host
      || opts.req.hostname
      || "";
    brand = detectBrand(hostname);
    brandMode = detectBrandMode(hostname);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    brand,
    brandMode,
    demoMode,
    realAdminId,
  };
}
