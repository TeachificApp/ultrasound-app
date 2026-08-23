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
import { users, accessTokenUses, ipSecurityFlags } from "../../drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { resolveAuthHostname } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { ensureUserOpenId } from "../lib/ensureUserOpenId";
import { setAuthSessionCookies } from "../lib/setAuthSessionCookies";
import { sendAuthRedirectHtml, withAuthPending } from "../lib/sendAuthRedirectHtml";
import { normalizeAuthEmail } from "../../shared/normalizeAuthEmail";

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

      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Service temporarily unavailable." });
      }

      // Look up user by access token
      const result = await db
        .select()
        .from(users)
        .where(eq(users.accessToken, String(token)))
        .limit(1);

      const user = result[0];
      if (!user) {
        return res.status(401).json({ error: "This access link is invalid. Please contact support." });
      }

      // Get client IP
      const ip = (
        (req.headers["cf-connecting-ip"] as string) ||
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown"
      );
      const userAgent = (req.headers["user-agent"] as string) || "";

      // Record this use
      await db.insert(accessTokenUses).values({
        userId: user.id,
        ipAddress: ip,
        userAgent,
      });

      // IP abuse check: count distinct IPs in the last 24 hours
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentUses = await db
        .select({ ip: accessTokenUses.ipAddress })
        .from(accessTokenUses)
        .where(
          and(
            eq(accessTokenUses.userId, user.id),
            gte(accessTokenUses.usedAt, since24h)
          )
        );

      const distinctIps = new Set(recentUses.map(r => r.ip));

      if (distinctIps.size > 3) {
        // Revoke the access token
        await db.update(users).set({ accessToken: null }).where(eq(users.id, user.id));

        // Create IP security flag
        await db.insert(ipSecurityFlags).values({
          userId: user.id,
          flagType: "access_token_ip_abuse",
          details: JSON.stringify({
            distinctIps: Array.from(distinctIps),
            windowStart: since24h.toISOString(),
            windowEnd: new Date().toISOString(),
            triggerIp: ip,
          }),
        });

        console.warn(`[access-verify] IP abuse detected for user ${user.id} (${user.email}) — ${distinctIps.size} distinct IPs in 24h. Token revoked.`);

        return res.status(403).json({
          error: "This access link has been disabled due to unusual activity. Please sign in directly or contact support.",
          revoked: true,
        });
      }

      // All good — issue session cookie
      const openId = await ensureUserOpenId(db, user);
      if (user.isPending) {
        await db.update(users).set({ isPending: false, emailVerified: true }).where(eq(users.id, user.id));
      }

      await ensureUserRole(user.id);

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? user.email ?? "User",
        expiresInMs: ONE_YEAR_MS,
      });
      // Use X-App-Hostname for cookie domain scoping on access-verify too
      const accessHostname = resolveAuthHostname(req);
      setAuthSessionCookies(req, res, sessionToken, accessHostname);

      const { getRequestClientInfo, recordUserLogin } = await import("../lib/recordUserLogin");
      const { ipAddress: atIp, userAgent: atUa } = getRequestClientInfo(req);
      await recordUserLogin(db, { userId: user.id, ipAddress: atIp, userAgent: atUa, method: "access_token" });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[access-verify] Error:", err);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  });
}
