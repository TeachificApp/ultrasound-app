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
  // Priority: X-App-Hostname (sent by tRPC client with window.location.hostname — most reliable)
  //         → X-Forwarded-Host → Host header → req.hostname
  const appHostname = opts.req.headers["x-app-hostname"];
  const forwardedHost = opts.req.headers["x-forwarded-host"];
  const hostname = (Array.isArray(appHostname) ? appHostname[0] : appHostname)
    || (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
    || opts.req.headers.host
    || opts.req.hostname
    || "";
  const brand = detectBrand(hostname);
  const brandMode = detectBrandMode(hostname);

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
