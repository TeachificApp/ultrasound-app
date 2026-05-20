/**
 * ssoRouter — Cross-domain SSO handshake
 *
 * Flow:
 *  1. Authenticated user on app.allaboutultrasound.com calls sso.issueToken
 *  2. Server generates a short-lived (60s) one-time token stored in sso_tokens
 *  3. Frontend appends ?sso=TOKEN to the learn.allaboutultrasound.com URL
 *  4. learn. calls sso.exchangeToken with the token
 *  5. Server validates, marks token as used, signs a new session cookie, returns it
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
  /**
   * Issue a short-lived SSO token for the currently authenticated user.
   * Called from app. before redirecting to learn.
   */
  issueToken: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + SSO_TOKEN_TTL_MS);
    await db.insert(ssoTokens).values({
      token,
      userId: ctx.user.id,
      expiresAt,
    });
    return { token };
  }),

  /**
   * Exchange a one-time SSO token for a full session cookie.
   * Called from learn. when ?sso=TOKEN is present in the URL.
   */
  exchangeToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();

      // Find a valid, unused, non-expired token
      const [row] = await db
        .select()
        .from(ssoTokens)
        .where(
          and(
            eq(ssoTokens.token, input.token),
            isNull(ssoTokens.usedAt),
            gt(ssoTokens.expiresAt, now)
          )
        )
        .limit(1);

      if (!row) {
        throw new Error("Invalid or expired SSO token");
      }

      // Mark token as used immediately (one-time use)
      await db
        .update(ssoTokens)
        .set({ usedAt: now })
        .where(eq(ssoTokens.id, row.id));

      // Load the user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, row.userId))
        .limit(1);

      if (!user) {
        throw new Error("User not found");
      }

      // Sign a new session JWT
      const sessionToken = await sdk.signSession({
        openId: user.openId ?? String(user.id),
        appId: process.env.VITE_APP_ID ?? "",
        name: user.name ?? user.email ?? "User",
      });

      // Set the session cookie on the learn. domain response
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { success: true, userId: user.id };
    }),
});
