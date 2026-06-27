/**
 * Shared SSO token redemption — used by tRPC exchangeToken and GET /api/sso/exchange.
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { ssoTokens, users } from "../../drizzle/schema";
import { ensureUserOpenId } from "./ensureUserOpenId";
import { setAuthSessionCookies } from "./setAuthSessionCookies";

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
    appId: ENV.appId,
    name: displayName || "User",
  });
  setAuthSessionCookies(req, res, sessionToken, hostnameOverride);
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
