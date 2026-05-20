/**
 * ssoRouter — Cross-domain SSO handshake
 */
import { z } from "zod";
import crypto from "crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ssoTokens, users } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { sdk } from "../_core/sdk";

const SSO_TOKEN_TTL_MS = 60_000; // 60 seconds

export const ssoRouter = router({
  issueToken: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + SSO_TOKEN_TTL_MS);
    await db.insert(ssoTokens).values({ token, userId: ctx.user.id, expiresAt });
    return { token };
  }),

  exchangeToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const now = new Date();
      const [row] = await db
        .select()
        .from(ssoTokens)
        .where(and(eq(ssoTokens.token, input.token), isNull(ssoTokens.usedAt), gt(ssoTokens.expiresAt, now)))
        .limit(1);
      if (!row) throw new Error("Invalid or expired SSO token");
      await db.update(ssoTokens).set({ usedAt: now }).where(eq(ssoTokens.id, row.id));
      const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      if (!user) throw new Error("User not found");
      const sessionToken = await sdk.signSession({
        openId: user.openId ?? String(user.id),
        appId: process.env.VITE_APP_ID ?? "",
        name: user.name ?? user.email ?? "User",
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, userId: user.id };
    }),
});
