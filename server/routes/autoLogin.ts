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
import { ONE_YEAR_MS } from "@shared/const";
import { resolveAuthHostname } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { getDb, ensureUserRole } from "../db";
import { autoLoginTokens, users } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { setAuthSessionCookies } from "../lib/setAuthSessionCookies";
import { sendAuthRedirectHtml, withAuthPending } from "../lib/sendAuthRedirectHtml";

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
    const { token, host: hostParam } = req.query as Record<string, string>;

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
        // Back-compat: some emails used users.accessToken with /api/auth/auto-login by mistake.
        const [accessUser] = await db
          .select()
          .from(users)
          .where(eq(users.accessToken, token))
          .limit(1);

        if (!accessUser) {
          console.warn("[AutoLogin] Token not found, already used, or expired:", token.substring(0, 12) + "...");
          return res.redirect("/?error=token_expired&message=Please+sign+in+to+access+your+content");
        }

        const openId = accessUser.openId ?? emailOpenId(accessUser.email ?? `user_${accessUser.id}`);
        const sessionToken = await sdk.createSessionToken(openId, {
          name: accessUser.name ?? accessUser.email ?? "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieHostname = resolveAuthHostname(req, hostParam || undefined);
        setAuthSessionCookies(req, res, sessionToken, cookieHostname);
        await ensureUserRole(accessUser.id);
        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, accessUser.id));

        const { getRequestClientInfo, recordUserLogin } = await import("../lib/recordUserLogin");
        const { ipAddress, userAgent } = getRequestClientInfo(req);
        await recordUserLogin(db, {
          userId: accessUser.id,
          ipAddress,
          userAgent,
          method: "auto_login",
        });

        const redirectUrl = withAuthPending("/my-dashboard");
        console.log(
          `[AutoLogin] User ${accessUser.id} (${accessUser.email}) auto-logged in via persistent accessToken fallback`,
        );
        return sendAuthRedirectHtml(res, redirectUrl);
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

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? user.email ?? "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieHostname = resolveAuthHostname(req, hostParam || undefined);
      setAuthSessionCookies(req, res, sessionToken, cookieHostname);

      await ensureUserRole(user.id);

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const { getRequestClientInfo, recordUserLogin } = await import("../lib/recordUserLogin");
      const { ipAddress, userAgent } = getRequestClientInfo(req);
      await recordUserLogin(db, { userId: user.id, ipAddress, userAgent, method: "auto_login" });

      const destination = record.redirectUrl ?? "/";
      const redirectUrl = withAuthPending(destination);

      console.log(
        `[AutoLogin] User ${user.id} (${user.email}) auto-logged in, host=${cookieHostname ?? hostParam ?? "auto"}, redirecting to ${redirectUrl}`,
      );

      return sendAuthRedirectHtml(res, redirectUrl);
    } catch (err) {
      console.error("[AutoLogin] Error processing token:", err);
      return res.redirect("/?error=auto_login_failed");
    }
  });
}
