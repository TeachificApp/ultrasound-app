/**
 * One-click unsubscribe endpoint.
 * GET /api/unsubscribe?token=<hmac-signed-token>
 *
 * Token format (base64url): userId:timestamp:hmac
 * HMAC uses JWT_SECRET so tokens cannot be forged.
 * Tokens expire after 30 days.
 */
import type { Express } from "express";
import crypto from "crypto";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../_core/env";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(userId: number, timestamp: number): string {
  const payload = `${userId}:${timestamp}`;
  const hmac = crypto
    .createHmac("sha256", ENV.cookieSecret)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

function verify(token: string): { userId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userIdStr, timestampStr, hmac] = parts;
    const userId = parseInt(userIdStr, 10);
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(userId) || isNaN(timestamp)) return null;
    // Check expiry
    if (Date.now() - timestamp > TOKEN_TTL_MS) return null;
    // Verify HMAC
    const expected = crypto
      .createHmac("sha256", ENV.cookieSecret)
      .update(`${userId}:${timestamp}`)
      .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"))) return null;
    return { userId };
  } catch {
    return null;
  }
}

export function generateUnsubscribeToken(userId: number): string {
  return sign(userId, Date.now());
}

export function registerUnsubscribeRoute(app: Express) {
  app.get("/api/unsubscribe", async (req, res) => {
    const token = req.query.token as string | undefined;

    if (!token) {
      return res.redirect(302, "/profile#notifications?unsubscribe=invalid");
    }

    const parsed = verify(token);
    if (!parsed) {
      return res.redirect(302, "/profile#notifications?unsubscribe=invalid");
    }

    try {
      // Parse current notificationPrefs and disable quickfireReminder
      const db = await getDb();
      if (!db) return res.redirect(302, "/profile#notifications?unsubscribe=error");

      const [userRow] = await db
        .select({ notificationPrefs: users.notificationPrefs })
        .from(users)
        .where(eq(users.id, parsed.userId))
        .limit(1);

      if (!userRow) {
        return res.redirect(302, "/profile#notifications?unsubscribe=notfound");
      }

      let prefs: Record<string, unknown> = {};
      try {
        prefs = JSON.parse(userRow.notificationPrefs ?? "{}");
      } catch {
        prefs = {};
      }
      prefs.quickfireReminder = false;

      await db
        .update(users)
        .set({ notificationPrefs: JSON.stringify(prefs) })
        .where(eq(users.id, parsed.userId));

      return res.redirect(302, "/profile#notifications?unsubscribe=success");
    } catch (err) {
      console.error("[Unsubscribe] Error:", err);
      return res.redirect(302, "/profile#notifications?unsubscribe=error");
    }
  });
}
