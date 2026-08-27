import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk, type AuthenticatedUser } from "./sdk";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { DEMO_COOKIE_NAME } from "@shared/const";
import { type Brand, type BrandMode, detectBrandMode } from "@shared/brands";

export type { Brand, BrandMode };

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  /** Detected brand based on request hostname (for data/auth: aaus or iheartecho) */
  brand: Brand;
  /** Detected brand mode based on request hostname (for visual branding: aaus, iheartecho, or combined) */
  brandMode: BrandMode;
  /** True when the current request is running under a demo impersonation session */
  demoMode: boolean;
  /** The real admin's user ID when demoMode is true */
  realAdminId: number | null;
};

// ─── Default brand cache (5-minute TTL) ──────────────────────────────────────
// Avoids a DB query on every request while still respecting admin changes.
let _defaultBrandCache: Brand = "aaus";
let _defaultBrandCacheAt = 0;
const DEFAULT_BRAND_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getDefaultBrand(): Promise<Brand> {
  const now = Date.now();
  if (now - _defaultBrandCacheAt < DEFAULT_BRAND_TTL_MS) return _defaultBrandCache;
  try {
    const { getDb } = await import("../db");
    const { platformSettings } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      const [row] = await db.select({ defaultBrand: platformSettings.defaultBrand })
        .from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
      if (row?.defaultBrand === "iheartecho") _defaultBrandCache = "iheartecho";
      else _defaultBrandCache = "aaus";
    }
  } catch {
    // DB unavailable — keep existing cache value
  }
  _defaultBrandCacheAt = now;
  return _defaultBrandCache;
}

/** Invalidate the default brand cache (call after updatePlatformSettings) */
export function invalidateDefaultBrandCache(): void {
  _defaultBrandCacheAt = 0;
}

/** Detect brand from request hostname, with DB-stored default as fallback */
function detectBrand(hostname: string, defaultBrand: Brand): Brand {
  const h = hostname.toLowerCase();
  if (h.includes("iheartecho")) return "iheartecho";
  if (h.includes("allaboutultrasound") || h.includes("aaus")) return "aaus";
  return defaultBrand;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;
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
    } catch {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  // Behind a reverse proxy (trust proxy=1), req.hostname may return the internal host.
  // Priority (highest to lowest):
  //   1. X-App-Brand header (set by frontend headers() callback — re-evaluated per request)
  //   2. _brand query param (set at app init from initial pathname — stale after SPA navigation)
  //   3. X-App-Hostname header (may be stripped by Cloud Run proxy)
  //   4. X-Forwarded-Host header
  //   5. Origin header (not sent for same-origin requests)
  //   6. Referer header
  //   7. Host header / req.hostname
  const appBrandHeader = (opts.req.headers["x-app-brand"] as string | undefined) || "";
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
  // Determine brand: X-App-Brand header takes highest priority (re-evaluated per request),
  // falling back to _brand query param (set at app init), then hostname detection.
  const effectiveBrandSignal = appBrandHeader || brandQueryParam;
  let brand: Brand;
  let brandMode: BrandMode;
  if (effectiveBrandSignal === "iheartecho") {
    brand = "iheartecho";
    brandMode = "iheartecho";
  } else if (effectiveBrandSignal === "aaus") {
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
    const defaultBrand = await getDefaultBrand();
    brand = detectBrand(hostname, defaultBrand);
    brandMode = detectBrandMode(hostname, defaultBrand);
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
