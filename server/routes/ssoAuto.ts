/**
 * ssoAuto.ts — Cross-domain silent SSO endpoint
 *
 * GET /api/sso/auto?token=TOKEN&domain=app.iheartecho.com
 *
 * Called by the useCrossDomainSso hook on every app load when the user is
 * already authenticated on another domain. It exchanges the short-lived SSO
 * token for a session cookie on THIS domain, signing the user in as a free
 * member (premium stays siloed to the originating app).
 *
 * The response is a 1×1 transparent GIF so it can be triggered via an <img>
 * tag — this sidesteps CORS preflight issues entirely, since image loads are
 * simple cross-origin requests that always carry cookies.
 *
 * Cookie domain scoping:
 *  - The ?domain= query param is the authoritative source for cookie scoping.
 *    It is set by the calling client (useCrossDomainSso) to the exact target
 *    hostname (e.g. "app.iheartecho.com"). This is necessary because <img> tag
 *    requests carry no Origin, no Referer, and no x-forwarded-host headers, so
 *    getPublicHostname() would otherwise fall back to CANONICAL_ROOT_DOMAIN
 *    (which is the AAU domain) and scope the cookie to the wrong domain.
 *
 * Security notes:
 *  - Tokens are single-use (usedAt is set on first exchange)
 *  - Tokens expire after 60 seconds
 *  - The ?domain= value is validated against the known app domains whitelist
 *  - CORS headers are set to allow credentials from known origins
 */
import type { Express, Request, Response } from "express";
import { eq, and, isNull, gt } from "drizzle-orm";
import * as crypto from "crypto";
import { parse as parseCookieHeader } from "cookie";
import { getDb } from "../db";
import { ssoTokens, users } from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { ensureUserOpenId } from "../lib/ensureUserOpenId";
import { redeemSsoTokenAndSetCookies } from "../lib/ssoExchange";
import { resolveUserFromSessionOpenId } from "../lib/resolveUserFromSession";
import { resolveSessionFromCookies } from "../lib/resolveSessionCookie";
import { setAuthSessionCookies } from "../lib/setAuthSessionCookies";
import { sendAuthRedirectHtml, withAuthPending } from "../lib/sendAuthRedirectHtml";

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

/** Known hostnames that are valid ?domain= values for cookie scoping */
const ALLOWED_COOKIE_DOMAINS = new Set([
  "app.iheartecho.com",
  "app.iheartecho.net",
  "app.allaboutultrasound.com",
  "learn.allaboutultrasound.com",
  "members.allaboutultrasound.com",
  "accreditation.iheartecho.com",
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

/**
 * Validate and return the cookie hostname from the ?domain= query param.
 * Falls back to resolving from the request if not provided or invalid.
 */
function resolveCookieHostname(req: Request): string | undefined {
  const domainParam = req.query.domain as string | undefined;
  if (domainParam) {
    const cleaned = domainParam.trim().split(":")[0].toLowerCase();
    // Accept known production domains
    if (ALLOWED_COOKIE_DOMAINS.has(cleaned)) return cleaned;
    // Accept *.manus.space and *.manus.computer staging domains
    if (cleaned.endsWith(".manus.space") || cleaned.endsWith(".manus.computer")) return cleaned;
    // Accept localhost for dev
    if (cleaned === "localhost" || cleaned === "127.0.0.1") return cleaned;
  }
  // Fallback: try x-forwarded-host (set by Cloudflare/nginx)
  const xfh = req.headers["x-forwarded-host"];
  if (xfh) {
    const fwdHost = (Array.isArray(xfh) ? xfh[0] : xfh).split(",")[0].trim().split(":")[0];
    if (fwdHost) return fwdHost;
  }
  return undefined;
}

export function registerSsoAutoRoute(app: Express) {
  /**
   * GET /api/sso/auto?token=TOKEN&domain=HOSTNAME
   *
   * Exchanges a one-time SSO token for a session cookie on this domain.
   * Returns a 1×1 transparent GIF so it can be loaded via an <img> tag.
   *
   * The ?domain= param is used to scope the cookie to the correct domain
   * (critical for <img> tag requests which carry no Origin/Referer headers).
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

      const openId = await ensureUserOpenId(db, user);

      const sessionToken = await sdk.signSession({
        openId,
        appId: ENV.appId,
        name: user.name ?? user.email ?? "User",
      });

      const cookieHostname = resolveCookieHostname(req);
      setAuthSessionCookies(req, res, sessionToken, cookieHostname ?? undefined);

      console.log(
        `[SsoAuto] Signed in user ${user.id} via cross-domain SSO` +
        ` | domain=${cookieHostname ?? "auto"} | origin=${origin ?? "unknown"}`
      );
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

  /**
   * GET /api/sso/exchange?token=TOKEN&host=HOSTNAME&returnTo=/path
   *
   * Full-page SSO token exchange — mirrors GET /api/auth/magic-verify.
   * Cloudflare strips Set-Cookie from tRPC/fetch responses, so the client
   * must use a top-level navigation (not exchangeToken mutation) to receive
   * the session cookie on app.iheartecho.com and other secondary domains.
   */
  app.get("/api/sso/exchange", async (req: Request, res: Response) => {
    const { token, host: hostParam, returnTo } = req.query as Record<string, string>;
    const successRedirect =
      returnTo && returnTo.startsWith("/") ? returnTo : "/my-dashboard";

    if (!token) {
      return res.redirect(`/login?sso_failed=1&returnTo=${encodeURIComponent(successRedirect)}`);
    }

    try {
      const db = await getDb();
      if (!db) {
        return res.redirect(`/login?sso_failed=1&returnTo=${encodeURIComponent(successRedirect)}`);
      }

      const result = await redeemSsoTokenAndSetCookies(
        db,
        req,
        res,
        String(token),
        hostParam || undefined,
      );

      if (!result) {
        console.log("[SsoExchange] Invalid or expired SSO token");
        return res.redirect(`/login?sso_failed=1&returnTo=${encodeURIComponent(successRedirect)}`);
      }

      const redirectUrl = withAuthPending(successRedirect);

      console.log(
        `[SsoExchange] User ${result.userId} signed in | host=${hostParam ?? "auto"} | redirect=${redirectUrl}`,
      );
      return sendAuthRedirectHtml(res, redirectUrl);
    } catch (err) {
      console.error("[SsoExchange] Error:", err);
      return res.redirect(`/login?sso_failed=1&returnTo=${encodeURIComponent(successRedirect)}`);
    }
  });

  /**
   * GET /api/sso/bridge?return=<url>
   *
   * Redirect-based SSO bridge. Called by a client domain (e.g. app.iheartecho.com or
   * app.allaboutultrasound.com) when the user is not logged in locally. The browser is
   * redirected here (typically learn.allaboutultrasound.com first), which checks the
   * session cookie and either:
   *   - Issues a short-lived SSO token and redirects back to ?return= URL with ?sso=TOKEN appended
   *   - Redirects back to ?return= URL unchanged (no token) if not authenticated
   *
   * This works because it's a full-page redirect — the browser sends the first-party
   * session cookie with the request, bypassing 3rd-party cookie restrictions entirely.
   *
   * Security: The ?return= URL is validated against the known app domains whitelist
   * to prevent open redirect attacks.
   */
  app.get("/api/sso/bridge", async (req: Request, res: Response) => {
    const returnUrl = req.query.return as string | undefined;

    // Validate the return URL to prevent open redirect attacks
    const isValidReturnUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        if (ALLOWED_COOKIE_DOMAINS.has(host)) return true;
        if (host.endsWith(".manus.space") || host.endsWith(".manus.computer")) return true;
        if (host === "localhost" || host === "127.0.0.1") return true;
        return false;
      } catch {
        return false;
      }
    };

    if (!returnUrl || !isValidReturnUrl(returnUrl)) {
      // Invalid or missing return URL — redirect to home
      return res.redirect("/");
    }

    // Try to authenticate the request using the session cookie
    try {
      const cookieHeader = req.headers.cookie;
      const cookies = cookieHeader
        ? new Map(Object.entries(parseCookieHeader(cookieHeader)))
        : new Map<string, string>();
      const resolved = await resolveSessionFromCookies(cookies, (value) =>
        sdk.verifySession(value),
      );
      const session = resolved?.session ?? null;

      if (!session) {
        // Not authenticated — redirect back with ?sso_failed=1 so the client
        // knows the bridge was attempted and stops retrying (loop-breaker).
        console.log(`[SsoBridge] No session, redirecting back to ${returnUrl}`);
        const failUrl = new URL(returnUrl);
        failUrl.searchParams.set("sso_failed", "1");
        return res.redirect(failUrl.toString());
      }

      // Authenticated — look up user and issue a short-lived SSO token
      const db = await getDb();
      if (!db) {
        const failUrl = new URL(returnUrl);
        failUrl.searchParams.set("sso_failed", "1");
        return res.redirect(failUrl.toString());
      }

      const user = await resolveUserFromSessionOpenId(db, session.openId);

      if (!user) {
        console.log(`[SsoBridge] Session valid but user not found for openId=${session.openId}`);
        const failUrl = new URL(returnUrl);
        failUrl.searchParams.set("sso_failed", "1");
        return res.redirect(failUrl.toString());
      }

      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + 60_000); // 60-second TTL
      await db.insert(ssoTokens).values({ token, userId: user.id, expiresAt });

      // Append ?sso=TOKEN to the return URL
      const redirectUrl = new URL(returnUrl);
      redirectUrl.searchParams.set("sso", token);

      console.log(
        `[SsoBridge] Issued SSO token for user ${user.id}` +
        ` | return=${returnUrl}`
      );
      return res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error("[SsoBridge] Error:", err);
      // Fall through — redirect back with sso_failed so the client stops retrying
      const failUrl = new URL(returnUrl);
      failUrl.searchParams.set("sso_failed", "1");
      return res.redirect(failUrl.toString());
    }
  });
}
