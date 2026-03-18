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
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

function emailOpenId(email: string) {
  return `email:${email.toLowerCase().trim()}`;
}

export function registerAuthLoginRoute(app: Express) {
  /**
   * POST /api/auth/login
   * Body: { email: string, password: string }
   * Returns: { success: true, emailVerified: boolean, name: string } | { error: string }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Service temporarily unavailable." });
      }

      const normalizedEmail = String(email).toLowerCase().trim();

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      const user = result[0];

      // Generic error to prevent email enumeration
      const invalidError = { error: "Invalid email or password." };

      if (!user || !user.passwordHash) {
        return res.status(401).json(invalidError);
      }

      const passwordMatch = await bcrypt.compare(String(password), user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json(invalidError);
      }

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // Issue session cookie
      const openId = user.openId ?? emailOpenId(normalizedEmail);
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? normalizedEmail,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

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
   * POST /api/auth/magic-verify
   * Body: { token: string }
   * Sets cookie and returns { success: true } so the browser can navigate.
   */
  app.post("/api/auth/magic-verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.body ?? {};
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

      // Consume the token
      await db
        .update(users)
        .set({ magicLinkToken: null, magicLinkExpiry: null, emailVerified: true })
        .where(eq(users.id, user.id));

      // Issue session cookie
      const openId = user.openId ?? emailOpenId(user.email ?? "");
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? user.email ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[magic-verify] Error:", err);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  });
}
