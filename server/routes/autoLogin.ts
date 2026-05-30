/**
 * autoLogin.ts
 * One-time auto-login token system for post-purchase automatic sign-in.
 *
 * Flow:
 *   1. After a successful purchase, server calls `generateAutoLoginToken(userId, redirectUrl)`
 *   2. The returned token is embedded in the success redirect URL and confirmation email link
 *   3. When the user clicks the link, GET /api/auth/auto-login?token=... is called
 *   4. The server validates the token, issues a session cookie, marks the token as used, and redirects
 */

import type { Express, Request, Response } from "express";
import * as crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { autoLoginTokens, users } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

/** Generate a cryptographically secure random token */
function randomToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** Synthetic openId for email/password accounts (mirrors emailAuthRouter) */
function emailOpenId(email: string): string {
  return `email:${email.toLowerCase().trim()}`;
}

/**
 * Generate a one-time auto-login token for a user.
 * Returns the raw token string to embed in URLs.
 * Expires in 72 hours.
 */
export async function generateAutoLoginToken(
  userId: number,
  redirectUrl: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const token = randomToken();
  // Access email tokens never expire — users can always click their link to sign in
  const expiresAt = new Date('2037-12-31T23:59:59Z');

  await db.insert(autoLoginTokens).values({
    token,
    userId,
    redirectUrl,
    expiresAt,
  });

  return token;
}

/**
 * Register the GET /api/auth/auto-login route.
 * Must be registered BEFORE the SPA catch-all.
 */
export function registerAutoLoginRoute(app: Express) {
  app.get("/api/auth/auto-login", async (req: Request, res: Response) => {
    const { token } = req.query as Record<string, string>;

    if (!token) {
      return res.redirect("/?error=missing_token");
    }

    try {
      const db = await getDb();
      if (!db) return res.redirect("/?error=db_unavailable");

      // Find valid, non-expired token
      // Tokens are reusable — users can click their access link multiple times
      const now = new Date();
      const [record] = await db
        .select()
        .from(autoLoginTokens)
        .where(
          and(
            eq(autoLoginTokens.token, token),
            gt(autoLoginTokens.expiresAt, now)
          )
        )
        .limit(1);

      if (!record) {
        console.warn("[AutoLogin] Token not found, already used, or expired:", token.substring(0, 12) + "...");
        // Redirect to login page with a helpful message
        return res.redirect("/?error=token_expired&message=Please+sign+in+to+access+your+content");
      }

      // Look up the user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, record.userId))
        .limit(1);

      if (!user) {
        console.error("[AutoLogin] User not found for token, userId:", record.userId);
        return res.redirect("/?error=user_not_found");
      }

      // Tokens are intentionally NOT marked as used — access links are reusable
      // so users can always click their email link to sign in again.

      // Determine the openId to use for the session
      // Email/password users use synthetic openId; OAuth users use their real openId
      const openId = user.openId ?? emailOpenId(user.email ?? `user_${user.id}`);

      // Issue session cookie
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? user.email ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      console.log(`[AutoLogin] User ${user.id} (${user.email}) auto-logged in via purchase token`);

      // Redirect to the destination page
      const destination = record.redirectUrl ?? "/";
      return res.redirect(destination);
    } catch (err) {
      console.error("[AutoLogin] Error processing token:", err);
      return res.redirect("/?error=auto_login_failed");
    }
  });
}
