/**
 * Premium Access Router
 *
 * Handles premium membership status for UltrasoundAssist™ and EchoAssist™.
 * All premium purchases now route through Stripe via the brandMembershipRouter.
 * The Thinkific free membership sync is preserved separately.
 *
 * Procedures:
 *  - premium.getStatus        — returns the current user's premium status (checks brandMemberships)
 *  - premium.checkAndSync     — re-checks brandMemberships + legacy isPremium flag (protected)
 *  - premium.syncByEmail      — public: check premium by email (for post-checkout confirmation)
 *  - premium.adminGrant       — admin: manually grant premium to a user by email
 *  - premium.adminRevoke      — admin: manually revoke premium from a user by email
 *  - premium.adminListPremium — admin: list all premium users
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getUserByEmail, getUserById, setPremiumStatus } from "../db";
import { getDb } from "../db";
import { brandMemberships } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Check if a user has active premium via brandMemberships table (Stripe-based).
 * Returns true if the user has an active premium membership for the given brand.
 */
async function checkStripePremiumByUserId(userId: number, brand: string = "aaus"): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const [membership] = await db
      .select()
      .from(brandMemberships)
      .where(
        and(
          eq(brandMemberships.userId, userId),
          eq(brandMemberships.brand, brand),
          eq(brandMemberships.tier, "premium"),
          eq(brandMemberships.status, "active")
        )
      )
      .limit(1);
    if (!membership) return false;
    // Check expiry
    if (membership.expiresAt && new Date(membership.expiresAt) < new Date()) return false;
    return true;
  } catch (err) {
    console.error("[Premium] Error checking Stripe premium status:", err);
    return false;
  }
}

/**
 * Check premium by email — looks up user, then checks brandMemberships.
 */
async function checkPremiumByEmail(email: string): Promise<boolean> {
  try {
    const user = await getUserByEmail(email);
    if (!user) return false;
    // Check brandMemberships for both brands
    const hasAaus = await checkStripePremiumByUserId(user.id, "aaus");
    if (hasAaus) return true;
    const hasIhe = await checkStripePremiumByUserId(user.id, "iheartecho");
    return hasIhe;
  } catch (err) {
    console.error("[Premium] Error checking premium by email:", err);
    return false;
  }
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const premiumRouter = router({
  /**
   * Get the current user's premium status.
   * Now checks brandMemberships (Stripe) instead of Thinkific.
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    // Admin users always have full premium access
    if (ctx.user.role === "admin") {
      return {
        isPremium: true,
        premiumGrantedAt: user.premiumGrantedAt ?? null,
        premiumSource: "admin",
        checkoutUrl: "/premium",
        manageUrl: "/premium",
      };
    }
    // Check brandMemberships (Stripe-based)
    const hasBrandPremium = await checkStripePremiumByUserId(ctx.user.id, ctx.brand ?? "aaus");
    const isPremium = hasBrandPremium || user.isPremium;
    return {
      isPremium,
      premiumGrantedAt: user.premiumGrantedAt ?? null,
      premiumSource: user.premiumSource ?? null,
      checkoutUrl: "/premium",
      manageUrl: "/premium",
    };
  }),

  /**
   * Re-check premium status and sync the user's isPremium flag.
   * Called when a logged-in user returns from Stripe checkout.
   * Checks brandMemberships table (Stripe) for active premium.
   */
  checkAndSync: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    if (!user.email) {
      return { isPremium: false, changed: false, message: "No email on account" };
    }
    // If already premium in DB, confirm it
    if (user.isPremium) {
      return {
        isPremium: true,
        changed: false,
        message: "Premium access is active",
      };
    }
    // Check brandMemberships (Stripe-based)
    const hasPremium = await checkStripePremiumByUserId(ctx.user.id, ctx.brand ?? "aaus");
    const changed = hasPremium !== user.isPremium;
    if (changed && hasPremium) {
      await setPremiumStatus(user.id, true, "stripe");
    }
    return {
      isPremium: hasPremium,
      changed,
      message: changed
        ? hasPremium
          ? "Premium access granted — welcome!"
          : "Premium access has been removed"
        : hasPremium
        ? "Premium access is active"
        : "No active premium membership found. Visit /premium to subscribe.",
    };
  }),

  /**
   * Public: check premium by email and sync status if the user exists in DB.
   * Used on the /upgrade-success page for users who completed Stripe checkout.
   */
  syncByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase().trim();
      const user = await getUserByEmail(email);
      if (!user) {
        return {
          userExists: false,
          isPremium: false,
          premiumOnThinkific: false,
          message: "No account found for this email. Create your account first, then your premium access will be activated.",
        };
      }
      // Check if already premium in DB
      if (user.isPremium) {
        return {
          userExists: true,
          isPremium: true,
          premiumOnThinkific: true,
          message: "Premium access is already active on your account.",
        };
      }
      // Check brandMemberships (Stripe)
      const hasAaus = await checkStripePremiumByUserId(user.id, "aaus");
      const hasIhe = await checkStripePremiumByUserId(user.id, "iheartecho");
      const hasPremium = hasAaus || hasIhe;
      if (hasPremium && !user.isPremium) {
        await setPremiumStatus(user.id, true, "stripe");
      }
      return {
        userExists: true,
        isPremium: hasPremium,
        premiumOnThinkific: hasPremium, // Keep field name for backward compat
        message: hasPremium
          ? "Premium access granted! Sign in to access all premium features."
          : "No active premium membership found. Your Stripe payment may still be processing — try again in a moment.",
      };
    }),

  /**
   * Admin: manually grant premium access to a user by email.
   */
  adminGrant: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await setPremiumStatus(user.id, true, "admin");
      return { success: true, userId: user.id, email: user.email };
    }),

  /**
   * Admin: manually revoke premium access from a user by email.
   */
  adminRevoke: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await setPremiumStatus(user.id, false, "admin");
      return { success: true, userId: user.id, email: user.email };
    }),

  /**
   * Admin: list recent webhook events (kept for monitoring).
   */
  adminGetWebhookEvents: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { webhookEvents } = await import("../../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.createdAt))
        .limit(input?.limit ?? 50);
    }),

  /**
   * Admin: send a test webhook payload to verify the endpoint is working.
   */
  adminTestWebhook: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const payload = {
        resource: "order",
        action: "created",
        payload: {
          product_name: "UltrasoundAssist™ App - Premium Access",
          status: "Complete",
          user_email: input.email,
          user_name: "Test User (Admin)",
        },
      };
      const res = await fetch("http://localhost:3000/api/webhooks/thinkific", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json() as { ok: boolean; message: string };
      return { httpStatus: res.status, ...result };
    }),

  /**
   * Admin: list all users with active premium access.
   */
  adminListPremium: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        isPremium: users.isPremium,
        premiumGrantedAt: users.premiumGrantedAt,
        premiumSource: users.premiumSource,
      })
      .from(users)
      .where(eq(users.isPremium, true))
      .orderBy(desc(users.premiumGrantedAt));
  }),
});
