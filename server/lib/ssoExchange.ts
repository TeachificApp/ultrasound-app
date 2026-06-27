/**
 * Shared SSO token redemption — used by tRPC exchangeToken and GET /api/sso/exchange.
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { ssoTokens, users } from "../../drizzle/schema";
import { getSessionCookieOptions, getLaxSessionCookieOptions, resolveAuthHostname } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, LAX_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ensureUserOpenId } from "./ensureUserOpenId";

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export async function redeemSsoToken(
  db: Db,
  token: string,
): Promise<{ userId: number; openId: string } | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(ssoTokens)
    .where(
      and(
        eq(ssoTokens.token, token),
        isNull(ssoTokens.usedAt),
        gt(ssoTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;

  await db.update(ssoTokens).set({ usedAt: now }).where(eq(ssoTokens.id, row.id));

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) return null;

  const openId = await ensureUserOpenId(db, user);
  return { userId: user.id, openId };
}

export async function setSessionCookiesForUser(
  req: Request,
  res: Response,
  openId: string,
  displayName: string,
  hostnameOverride?: string,
): Promise<void> {
  const sessionToken = await sdk.signSession({
    openId,
    appId: process.env.VITE_APP_ID ?? "",
    name: displayName || "User",
  });
  const hostname = resolveAuthHostname(req, hostnameOverride);
  const cookieOptions = getSessionCookieOptions(req, hostname);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  const laxCookieOptions = getLaxSessionCookieOptions(req, hostname);
  res.cookie(LAX_COOKIE_NAME, sessionToken, { ...laxCookieOptions, maxAge: ONE_YEAR_MS });
}

export async function redeemSsoTokenAndSetCookies(
  db: Db,
  req: Request,
  res: Response,
  token: string,
  hostnameOverride?: string,
): Promise<{ userId: number } | null> {
  const redeemed = await redeemSsoToken(db, token);
  if (!redeemed) return null;

  const [user] = await db.select().from(users).where(eq(users.id, redeemed.userId)).limit(1);
  const displayName = user?.name ?? user?.email ?? "User";

  await setSessionCookiesForUser(req, res, redeemed.openId, displayName, hostnameOverride);
  return { userId: redeemed.userId };
}
