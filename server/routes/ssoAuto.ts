/**
 * ssoAuto.ts — Cross-domain silent SSO endpoint
 *
 * GET /api/sso/auto?token=TOKEN&origin=ORIGIN
 *
 * Called by the SsoAutoLogin component on every app load when the user is
 * already authenticated on another domain. It exchanges the short-lived SSO
 * token for a session cookie on THIS domain, signing the user in as a free
 * member (premium stays siloed to the originating app).
 *
 * The response is a 1×1 transparent GIF so it can be triggered via an <img>
 * tag — this sidesteps CORS preflight issues entirely, since image loads are
 * simple cross-origin requests that always carry cookies.
 *
 * Security notes:
 *  - Tokens are single-use (usedAt is set on first exchange)
 *  - Tokens expire after 60 seconds
 *  - The origin parameter is validated against the known app domains
 *  - CORS headers are set to allow credentials from known origins
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import { getDb } from "../db";
import { ssoTokens, users } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// 1×1 transparent GIF — used as the response body so <img> tags can trigger this
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/** Known app domains that are allowed to participate in cross-domain SSO */
const ALLOWED_ORIGINS = new Set([
  "https://app.iheartecho.net",
  "https://app.iheartecho.com",
  "https://app.allaboutultrasound.com",
  "https://learn.allaboutultrasound.com",
  "https://members.allaboutultrasound.com",
  "https://accreditation.iheartecho.com",
  // Staging / manus.space domains — allow any *.manus.space origin
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow any *.manus.space staging domain
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith(".manus.space")) return true;
    if (url.hostname.endsWith(".manus.computer")) return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  } catch {
    // ignore invalid URLs
  }
  return false;
}

export function registerSsoAutoRoute(app: Express) {
  /**
   * GET /api/sso/auto?token=TOKEN
   *
   * Exchanges a one-time SSO token for a session cookie on this domain.
   * Returns a 1×1 transparent GIF so it can be loaded via an <img> tag.
   *
   * The browser automatically sends cookies with the response because the
   * server sets Set-Cookie with SameSite=None;Secure.
   */
  app.get("/api/sso/auto", async (req: Request, res: Response) => {
    // Set CORS headers to allow the calling origin to read the response
    const origin = req.headers.origin as string | undefined;
    if (isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    const token = req.query.token as string | undefined;

    // Always respond with the GIF — never reveal token validity via HTTP status
    const sendGif = () => {
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Content-Length", String(TRANSPARENT_GIF.length));
      res.end(TRANSPARENT_GIF);
    };

    if (!token || token.length < 10) {
      return sendGif();
    }

    try {
      const db = await getDb();
      if (!db) return sendGif();

      const now = new Date();
      const [row] = await db
        .select()
        .from(ssoTokens)
        .where(
          and(
            eq(ssoTokens.token, token),
            isNull(ssoTokens.usedAt),
            gt(ssoTokens.expiresAt, now)
          )
        )
        .limit(1);

      if (!row) return sendGif(); // expired or already used — silently ignore

      // Mark as used immediately to prevent replay
      await db
        .update(ssoTokens)
        .set({ usedAt: now })
        .where(eq(ssoTokens.id, row.id));

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, row.userId))
        .limit(1);

      if (!user) return sendGif();

      // Issue a session token for this domain — same user, free membership
      const sessionToken = await sdk.signSession({
        openId: user.openId ?? String(user.id),
        appId: process.env.VITE_APP_ID ?? "",
        name: user.name ?? user.email ?? "User",
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log(`[SsoAuto] Signed in user ${user.id} via cross-domain SSO from ${origin ?? "unknown"}`);
    } catch (err) {
      console.error("[SsoAuto] Error:", err);
      // Fall through — still send the GIF
    }

    return sendGif();
  });

  /**
   * OPTIONS /api/sso/auto — preflight for fetch()-based callers
   */
  app.options("/api/sso/auto", (req: Request, res: Response) => {
    const origin = req.headers.origin as string | undefined;
    if (isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    res.sendStatus(204);
  });
}
