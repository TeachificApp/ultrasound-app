import type { Request, Response } from "express";
import { eq, and, gte } from "drizzle-orm";
import { ONE_YEAR_MS } from "@shared/const";
import { resolveAuthHostname } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ensureUserRole } from "../db";
import { users, accessTokenUses, ipSecurityFlags } from "../../drizzle/schema";
import { ensureUserOpenId } from "./ensureUserOpenId";
import { setAuthSessionCookies } from "./setAuthSessionCookies";
import { withAuthPending } from "./sendAuthRedirectHtml";

export type AccessVerifyStatus = "success" | "invalid" | "revoked" | "db_unavailable";

const ALLOWED_ACCESS_REDIRECT_HOSTS = new Set([
  "learn.allaboutultrasound.com",
  "app.allaboutultrasound.com",
  "app.iheartecho.com",
  "app.iheartecho.net",
  "site.allaboutultrasound.com",
]);

/** Safe redirect target after persistent access link login (path or same-brand URL). */
export function resolveAccessRedirectUrl(next: string | undefined): string {
  const fallback = withAuthPending("/my-dashboard");
  if (!next?.trim()) return fallback;

  const trimmed = next.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return withAuthPending(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (ALLOWED_ACCESS_REDIRECT_HOSTS.has(url.hostname)) {
      url.searchParams.set("auth_pending", "1");
      return url.toString();
    }
  } catch {
    /* ignore malformed URLs */
  }

  return fallback;
}

function clientIp(req: Request): string {
  return (
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Validate a persistent users.accessToken, enforce IP limits, and issue session cookies.
 */
export async function completeAccessTokenLogin(
  req: Request,
  res: Response,
  token: string,
  hostParam?: string,
): Promise<AccessVerifyStatus> {
  const db = await (await import("../db")).getDb();
  if (!db) return "db_unavailable";

  const result = await db
    .select()
    .from(users)
    .where(eq(users.accessToken, String(token)))
    .limit(1);

  const user = result[0];
  if (!user) return "invalid";

  const ip = clientIp(req);
  const userAgent = (req.headers["user-agent"] as string) || "";

  await db.insert(accessTokenUses).values({
    userId: user.id,
    ipAddress: ip,
    userAgent,
  });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentUses = await db
    .select({ ip: accessTokenUses.ipAddress })
    .from(accessTokenUses)
    .where(
      and(eq(accessTokenUses.userId, user.id), gte(accessTokenUses.usedAt, since24h)),
    );

  const distinctIps = new Set(recentUses.map((r) => r.ip));

  if (distinctIps.size > 3) {
    await db.update(users).set({ accessToken: null }).where(eq(users.id, user.id));
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

    console.warn(
      `[access-verify] IP abuse detected for user ${user.id} (${user.email}) — ${distinctIps.size} distinct IPs in 24h. Token revoked.`,
    );
    return "revoked";
  }

  const openId = await ensureUserOpenId(db, user);
  if (user.isPending) {
    await db
      .update(users)
      .set({ isPending: false, emailVerified: true })
      .where(eq(users.id, user.id));
  }

  await ensureUserRole(user.id);

  const sessionToken = await sdk.createSessionToken(openId, {
    name: user.name ?? user.email ?? "User",
    expiresInMs: ONE_YEAR_MS,
  });
  const accessHostname = resolveAuthHostname(req, hostParam);
  setAuthSessionCookies(req, res, sessionToken, accessHostname);

  const { getRequestClientInfo, recordUserLogin } = await import("./recordUserLogin");
  const { ipAddress: atIp, userAgent: atUa } = getRequestClientInfo(req);
  await recordUserLogin(db, {
    userId: user.id,
    ipAddress: atIp,
    userAgent: atUa,
    method: "access_token",
  });

  return "success";
}
