import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { DEMO_COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** True when the current request is running under a demo impersonation session */
  demoMode: boolean;
  /** The real admin's user ID when demoMode is true */
  realAdminId: number | null;
};

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

  return {
    req: opts.req,
    res: opts.res,
    user,
    demoMode,
    realAdminId,
  };
}
