/**
 * ssoRouter — Cross-domain SSO handshake
 *
 * Accreditation domain rules:
 *  - Users broadcasting FROM accreditation.iheartecho.com must have an active
 *    accreditation subscription (diy_admin or diy_user role with active/trialing org).
 *    If they don't, issueTokens returns { tokens: [], allowed: false }.
 *  - Users broadcasting FROM any other domain always get tokens issued (they will
 *    be signed into accreditation.iheartecho.com as free members and see the upgrade prompt).
 */
import { z } from "zod";
import crypto from "crypto";
import { eq, and, isNull, gt, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ssoTokens, users, userRoles, diyOrganizations, diySubscriptions } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { sdk } from "../_core/sdk";

const SSO_TOKEN_TTL_MS = 60_000; // 60 seconds

/** Active subscription statuses for DIY Accreditation */
const ACTIVE_STATUSES = ["active", "trialing"] as const;

/**
 * Returns true if the user has an active accreditation subscription.
 * Checks:
 *  1. User has a diy_admin or diy_user role
 *  2. The org linked to that role has an active/trialing diySubscription
 *  3. OR the user is the ownerUserId of an org with an active/trialing subscription
 */
async function hasActiveAccreditationSubscription(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check if user has diy_admin or diy_user role
  const roles = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        inArray(userRoles.role, ["diy_admin", "diy_user"])
      )
    )
    .limit(10);

  if (roles.length > 0) {
    // Get all org IDs linked via grantedByLabId
    const orgIds = roles
      .map(r => r.grantedByLabId)
      .filter((id): id is number => id != null);

    if (orgIds.length > 0) {
      const activeSubs = await db
        .select({ id: diySubscriptions.id })
        .from(diySubscriptions)
        .where(
          and(
            inArray(diySubscriptions.orgId, orgIds),
            inArray(diySubscriptions.status, [...ACTIVE_STATUSES])
          )
        )
        .limit(1);

      if (activeSubs.length > 0) return true;
    }
  }

  // Also check if user is the owner of any org with an active subscription
  const ownedOrgs = await db
    .select({ id: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, userId))
    .limit(10);

  if (ownedOrgs.length > 0) {
    const ownedOrgIds = ownedOrgs.map(o => o.id);
    const activeSubs = await db
      .select({ id: diySubscriptions.id })
      .from(diySubscriptions)
      .where(
        and(
          inArray(diySubscriptions.orgId, ownedOrgIds),
          inArray(diySubscriptions.status, [...ACTIVE_STATUSES])
        )
      )
      .limit(1);

    if (activeSubs.length > 0) return true;
  }

  return false;
}

export const ssoRouter = router({
  /**
   * Issue multiple tokens at once — one per target domain.
   * Used by useCrossDomainSso to broadcast to all other apps simultaneously.
   *
   * The `sourceIsAccreditation` flag tells the server that the request is coming
   * from accreditation.iheartecho.com. In that case, the user must have an active
   * accreditation subscription to broadcast. If they don't, returns { tokens: [], allowed: false }.
   *
   * When sourceIsAccreditation is false (default), tokens are always issued —
   * the user will be signed into accreditation as a free member and see the upgrade prompt.
   */
  issueTokens: protectedProcedure
    .input(z.object({
      count: z.number().int().min(1).max(10),
      sourceIsAccreditation: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Gate: accreditation domain only broadcasts if user has active subscription
      if (input.sourceIsAccreditation) {
        const hasAccredSub = await hasActiveAccreditationSubscription(ctx.user.id);
        if (!hasAccredSub) {
          return { tokens: [], allowed: false };
        }
      }

      const expiresAt = new Date(Date.now() + SSO_TOKEN_TTL_MS);
      const tokens: string[] = [];
      for (let i = 0; i < input.count; i++) {
        const token = crypto.randomBytes(48).toString("hex");
        tokens.push(token);
        await db.insert(ssoTokens).values({ token, userId: ctx.user.id, expiresAt });
      }
      return { tokens, allowed: true };
    }),

  issueToken: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + SSO_TOKEN_TTL_MS);
    await db.insert(ssoTokens).values({ token, userId: ctx.user.id, expiresAt });
    return { token };
  }),

  exchangeToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = new Date();
      const [row] = await db
        .select()
        .from(ssoTokens)
        .where(and(eq(ssoTokens.token, input.token), isNull(ssoTokens.usedAt), gt(ssoTokens.expiresAt, now)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired SSO token" });
      await db.update(ssoTokens).set({ usedAt: now }).where(eq(ssoTokens.id, row.id));
      const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
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
