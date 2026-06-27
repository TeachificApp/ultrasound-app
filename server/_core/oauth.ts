import { COOKIE_NAME, LAX_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions, getLaxSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { userLoginEvents } from "../../drizzle/schema";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Decode the state (base64-encoded redirect URI) to get the public hostname.
      // Cloudflare rewrites the Host header to the internal Cloud Run hostname,
      // so we extract the hostname from the state parameter instead.
      let stateHostname: string | undefined;
      try {
        const decodedState = Buffer.from(state, 'base64').toString('utf8');
        const stateUrl = new URL(decodedState);
        stateHostname = stateUrl.hostname || undefined;
      } catch { /* ignore decode errors */ }
      const cookieOptions = getSessionCookieOptions(req, stateHostname);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      // Also set a SameSite=Lax fallback cookie so browsers that block SameSite=None
      // (Chrome 3rd-party cookie blocking, Firefox Strict ETP, Brave, Safari ITP)
      // can still authenticate on the same domain after a direct OAuth login.
      const laxOptions = getLaxSessionCookieOptions(req, stateHostname);
      res.cookie(LAX_COOKIE_NAME, sessionToken, { ...laxOptions, maxAge: ONE_YEAR_MS });

      // Track login event + Thinkific free-member sync (fire-and-forget, non-blocking)
      db.getUserByOpenId(userInfo.openId).then(async (user) => {
        if (!user) return;
        const dbConn = await getDb();
        if (!dbConn) return;
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
                   req.socket.remoteAddress || null;
        await dbConn.insert(userLoginEvents).values({
          userId: user.id,
          ipAddress: ip ? ip.substring(0, 64) : null,
          userAgent: req.headers["user-agent"]?.substring(0, 500) ?? null,
        });
        // Also log to unified activity table
        try {
          const { userActivityLogs } = await import("../../drizzle/schema");
          await dbConn.insert(userActivityLogs).values({
            userId: user.id,
            eventType: 'login',
            description: `Logged in from ${ip || 'unknown IP'}`,
            ipAddress: ip ? ip.substring(0, 64) : null,
            userAgent: req.headers["user-agent"]?.substring(0, 500) ?? null,
            metadata: { country: null },
          });
        } catch (e) { /* non-blocking */ }

        // Sync user to Thinkific free membership if not already enrolled
        if (user.email && !user.thinkificEnrolledAt) {
          try {
            const { enrollInFreeMembership } = await import("../thinkific");
            const { markThinkificEnrolled } = await import("../db");
            const nameParts = (user.name ?? "").trim().split(" ");
            const firstName = nameParts[0] ?? "Member";
            const lastName = nameParts.slice(1).join(" ");
            await enrollInFreeMembership(user.email, firstName, lastName);
            await markThinkificEnrolled(user.id);
            console.log(`[OAuth] Thinkific free membership synced for user ${user.id} (${user.email})`);
          } catch (err) {
            console.error(`[OAuth] Thinkific sync failed for user ${user.id}:`, err);
          }
        }
      }).catch(() => { /* silent */ });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
