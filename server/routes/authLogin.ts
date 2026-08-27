/**
 * authLogin.ts
 *
 * Server-side login route at POST /api/auth/login
 *
 * Why this exists: Cloudflare strips Set-Cookie headers from JavaScript fetch
 * responses (XHR/fetch). Cookies set in tRPC mutation responses are silently
 * dropped by the browser. The fix is to handle login via a traditional form
 * POST → server redirect, which Cloudflare does NOT strip.
 *
 * Flow:
 *   1. Browser POSTs credentials as JSON to /api/auth/login
 *   2. Server verifies credentials
 *   3. On success: sets session cookie + returns 200 JSON { success: true }
 *      (the cookie is set on the redirect-like response that the browser follows)
 *   4. On failure: returns 401 JSON { error: "..." }
 *
 * The frontend Login.tsx calls this endpoint, reads the JSON result, and
 * does window.location.href = "/" on success — the cookie is already set.
 */

import type { Express, Request, Response } from "express";
import * as bcrypt from "bcryptjs";
import { getDb, ensureUserRole, getUserByEmail } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { resolveAuthHostname } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { ensureUserOpenId } from "../lib/ensureUserOpenId";
import { setAuthSessionCookies } from "../lib/setAuthSessionCookies";
import { sendAuthRedirectHtml, withAuthPending } from "../lib/sendAuthRedirectHtml";
import { normalizeAuthEmail } from "../../shared/normalizeAuthEmail";
import {
  completeAccessTokenLogin,
  resolveAccessRedirectUrl,
} from "../lib/accessTokenVerify";

export function registerAuthLoginRoute(app: Express) {
  /**
   * GET /api/auth/clear-session
   * Clears stale Manus-era JWT session cookies so magic-link login can succeed.
   */
  app.get("/api/auth/clear-session", async (req: Request, res: Response) => {
    const { clearSessionCookies } = await import("../_core/cookies");
    clearSessionCookies(res, req);
    res.setHeader("Cache-Control", "no-store");
    res.json({ cleared: true });
  });

  /**
   * POST /api/auth/login
   * Body: { email: string, password: string }
   * Returns: { success: true, emailVerified: boolean, name: string } | { error: string }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password, host } = req.body ?? {};

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Service temporarily unavailable." });
      }

      const normalizedEmail = normalizeAuthEmail(String(email));

      const user = await getUserByEmail(normalizedEmail);

      // Generic error to prevent email enumeration
      const invalidError = { error: "Invalid email or password." };

      if (!user) {
        return res.status(401).json(invalidError);
      }

      if (!user.passwordHash) {
        return res.status(401).json({
          error:
            "This account uses magic link sign-in. Use Forgot Password to set a password, or request a magic link.",
        });
      }

      const passwordMatch = await bcrypt.compare(String(password), user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json(invalidError);
      }

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // Ensure the user has the base "user" role (idempotent)
      await ensureUserRole(user.id);

      // Issue session cookie — persist openId so auth.me can resolve the session
      const openId = await ensureUserOpenId(db, user);
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? normalizedEmail,
        expiresInMs: ONE_YEAR_MS,
      });
      const hostnameOverride = resolveAuthHostname(req, typeof host === "string" ? host : undefined);
      setAuthSessionCookies(req, res, sessionToken, hostnameOverride);

      const { getRequestClientInfo, recordUserLogin } = await import("../lib/recordUserLogin");
      const { ipAddress, userAgent } = getRequestClientInfo(req);
      await recordUserLogin(db, { userId: user.id, ipAddress, userAgent, method: "password" });

      return res.status(200).json({
        success: true,
        emailVerified: user.emailVerified ?? false,
        name: user.name,
      });
    } catch (err) {
      console.error("[authLogin] Error:", err);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  });

  /**
   * GET /api/auth/magic-verify?token=...&returnTo=...
   * Server-side redirect flow — bypasses Cloudflare stripping Set-Cookie on XHR/fetch.
   * The browser follows a full page navigation so the cookie is preserved.
   */
  app.get("/api/auth/magic-verify", async (req: Request, res: Response) => {
    const { token, returnTo, host: hostParam } = req.query as Record<string, string>;
    const successRedirect = returnTo && returnTo.startsWith("/") ? returnTo : "/my-dashboard";
    if (!token) {
      return res.redirect(`/auth/magic-error?reason=missing_token`);
    }
    try {
      const db = await getDb();
      if (!db) return res.redirect(`/auth/magic-error?reason=db_unavailable`);

      const result = await db.select().from(users).where(eq(users.magicLinkToken, String(token))).limit(1);
      const user = result[0];

      if (!user) {
        return res.redirect(`/auth/magic-error?reason=invalid`);
      }
      if (!user.magicLinkExpiry || new Date() > user.magicLinkExpiry) {
        return res.redirect(`/auth/magic-error?reason=expired`);
      }

      const openId = await ensureUserOpenId(db, user);
      const updateFields: Record<string, unknown> = {
        magicLinkToken: null,
        magicLinkExpiry: null,
        emailVerified: true,
        lastSignedIn: new Date(),
      };
      await db.update(users).set(updateFields as any).where(eq(users.id, user.id));
      await ensureUserRole(user.id);

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? user.email ?? "User",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieHostname = resolveAuthHostname(req, hostParam);
      setAuthSessionCookies(req, res, sessionToken, cookieHostname);

      const redirectUrl = withAuthPending(successRedirect);

      console.log(`[magic-verify GET] User ${user.id} (${user.email}) signed in, host=${cookieHostname ?? hostParam ?? "auto"}, redirecting to ${redirectUrl}`);
      // Track login event via recordUserLogin
      const { getRequestClientInfo, recordUserLogin } = await import("../lib/recordUserLogin");
      const { ipAddress: mlIp, userAgent: mlUa } = getRequestClientInfo(req);
      await recordUserLogin(db, { userId: user.id, ipAddress: mlIp, userAgent: mlUa, method: "magic_link" });

      return sendAuthRedirectHtml(res, redirectUrl);
    } catch (err) {
      console.error("[magic-verify GET] Error:", err);
      return res.redirect(`/auth/magic-error?reason=server_error`);
    }
  });

  /**
   * POST /api/auth/magic-verify
   * Body: { token: string }
   * Sets cookie and returns { success: true } so the browser can navigate.
   */
  app.post("/api/auth/magic-verify", async (req: Request, res: Response) => {
    try {
      const { token, host: hostBody } = req.body ?? {};
      if (!token) {
        return res.status(400).json({ error: "Token is required." });
      }

      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Service temporarily unavailable." });
      }

      const result = await db
        .select()
        .from(users)
        .where(eq(users.magicLinkToken, String(token)))
        .limit(1);

      const user = result[0];

      if (!user) {
        return res.status(401).json({ error: "This magic link is invalid or has already been used." });
      }

      if (!user.magicLinkExpiry || new Date() > user.magicLinkExpiry) {
        return res.status(401).json({ error: "This magic link has expired. Please request a new one." });
      }

      // Consume the token — ensure openId is persisted for session lookup
      const openId = await ensureUserOpenId(db, user);
      const updateFields: Record<string, unknown> = {
        magicLinkToken: null,
        magicLinkExpiry: null,
        emailVerified: true,
        lastSignedIn: new Date(),
      };
      await db
        .update(users)
        .set(updateFields as any)
        .where(eq(users.id, user.id));

      // Ensure the user has the base "user" role (idempotent)
      await ensureUserRole(user.id);

      // Issue session cookie — use X-App-Hostname to scope to the correct domain
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? user.email ?? "User",
        expiresInMs: ONE_YEAR_MS,
      });
      const magicPostHostname = resolveAuthHostname(
        req,
        typeof hostBody === "string" ? hostBody : undefined,
      );
      setAuthSessionCookies(req, res, sessionToken, magicPostHostname);

      const { getRequestClientInfo, recordUserLogin } = await import("../lib/recordUserLogin");
      const { ipAddress, userAgent } = getRequestClientInfo(req);
      await recordUserLogin(db, { userId: user.id, ipAddress, userAgent, method: "magic_link" });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[magic-verify] Error:", err);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  });

  /**
   * GET /api/auth/access-verify?token=...&next=...
   * Server-side redirect flow — Cloudflare-safe (mirrors magic-verify GET).
   */
  app.get("/api/auth/access-verify", async (req: Request, res: Response) => {
    const { token, next, host: hostParam } = req.query as Record<string, string>;
    if (!token) {
      return res.redirect("/auth/access-error?reason=missing_token");
    }
    try {
      const status = await completeAccessTokenLogin(req, res, String(token), hostParam);
      if (status === "revoked") {
        return res.redirect("/auth/access-error?reason=revoked");
      }
      if (status === "invalid") {
        return res.redirect("/auth/access-error?reason=invalid");
      }
      if (status === "db_unavailable") {
        return res.redirect("/auth/access-error?reason=db_unavailable");
      }

      const redirectUrl = resolveAccessRedirectUrl(next);
      console.log(`[access-verify GET] Signed in via access token, redirecting to ${redirectUrl}`);
      return sendAuthRedirectHtml(res, redirectUrl);
    } catch (err) {
      console.error("[access-verify GET] Error:", err);
      return res.redirect("/auth/access-error?reason=server_error");
    }
  });

  /**
   * POST /api/auth/access-verify
   * Body: { token: string }
   * Persistent access token from purchase/access emails.
   * - Never expires, reusable across sessions.
   * - IP abuse detection: >3 distinct IPs in 24h revokes token and flags account.
   */
  app.post("/api/auth/access-verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.body ?? {};
      if (!token) {
        return res.status(400).json({ error: "Token is required." });
      }

      const status = await completeAccessTokenLogin(req, res, String(token));
      if (status === "revoked") {
        return res.status(403).json({
          error:
            "This access link has been disabled due to unusual activity. Please sign in directly or contact support.",
          revoked: true,
        });
      }
      if (status === "invalid") {
        return res.status(401).json({
          error: "This access link is invalid. Please contact support.",
        });
      }
      if (status === "db_unavailable") {
        return res.status(503).json({ error: "Service temporarily unavailable." });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[access-verify] Error:", err);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  });
}
