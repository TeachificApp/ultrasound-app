/**
 * Premium Access Router
 *
 * Handles premium membership status for the iHeartEcho™ App Premium Access
 * membership ($9.99/month) sold via Thinkific at:
 * https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832
 *
 * Procedures:
 *  - premium.getStatus        — returns the current user's premium status
 *  - premium.checkAndSync     — re-checks Thinkific and syncs isPremium in DB (protected)
 *  - premium.syncByEmail      — public: check Thinkific by email and sync if user exists in DB
 *  - premium.adminGrant       — admin: manually grant premium to a user by email
 *  - premium.adminRevoke      — admin: manually revoke premium from a user by email
 *  - premium.adminListPremium — admin: list all premium users
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getUserByEmail, getUserById, setPremiumStatus } from "../db";
import {
  getOrdersByEmail,
  IHEARTECHO_PREMIUM_PRODUCT_ID,
} from "../thinkific";

/** The Thinkific membership product slug for UltrasoundAssist™ Premium Access */
export const PREMIUM_MEMBERSHIP_SLUG = "ultrasoundassist-app-premium-membership";

/**
 * Check if a user has a completed order for the iHeartEcho™ Premium Access product on Thinkific.
 *
 * The premium product is sold as a subscription (product_id=3703267, "iHeartEcho™ App - Premium Access").
 * It does NOT appear in the enrollments endpoint — we query the orders endpoint directly by email.
 *
 * We query by email directly (not by user lookup) because the /users?query= endpoint
 * returns Internal Server Error for some emails on the Thinkific API.
 *
 * Note: We do not check for subscription cancellation here because the webhook handles revocation.
 * This function is used as a fallback sync for users who return from checkout.
 */
export async function checkThinkificPremiumByEmail(email: string): Promise<boolean> {
  try {
    const orders = await getOrdersByEmail(email);
    // A user has premium if they have a Complete order for the premium product
    return orders.some(
      (o) =>
        o.product_id === IHEARTECHO_PREMIUM_PRODUCT_ID &&
        o.status.toLowerCase() === "complete"
    );
  } catch (err) {
    console.error("[Premium] Error checking Thinkific premium status:", err);
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
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    // Admin users always have full premium access — never show upgrade prompts to admins
    const isPremium = ctx.user.role === "admin" ? true : user.isPremium;
    return {
      isPremium,
      premiumGrantedAt: user.premiumGrantedAt ?? null,
      premiumSource: user.premiumSource ?? null,
      checkoutUrl: "https://member.allaboutultrasound.com/enroll/3714929?price_id=4664974",
      manageUrl: `https://member.allaboutultrasound.com/account/billing`,
    };
  }),

  /**
   * Re-check Thinkific and sync the user's isPremium flag.
   * Called when a logged-in user returns from the Thinkific checkout page.
   */
  checkAndSync: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    if (!user.email) {
      return { isPremium: false, changed: false, message: "No email on account" };
    }
    // First check if the DB already has premium set (e.g. via webhook pending account)
    if (user.isPremium) {
      return {
        isPremium: true,
        changed: false,
        message: "Premium access is active",
      };
    }
    const hasPremium = await checkThinkificPremiumByEmail(user.email);
    const changed = hasPremium !== user.isPremium;
    if (changed) {
      await setPremiumStatus(user.id, hasPremium, "thinkific");
    }
    return {
      isPremium: hasPremium,
      changed,
      message: changed
        ? hasPremium
          ? "UltrasoundAssist™ Premium access granted — welcome!"
          : "Premium access has been removed"
        : hasPremium
        ? "Premium access is active"
        : "No active premium membership found",
    };
  }),

  /**
   * Public: check Thinkific by email and sync premium status if the user exists in DB.
   * Used on the /upgrade-success page for users who aren't logged in yet.
   * Returns whether premium was found on Thinkific (does NOT expose user data).
   */
  syncByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase().trim();
      // Check if user exists in our DB
      const user = await getUserByEmail(email);
      if (!user) {
        // Check Thinkific anyway — if they have premium there, we'll note it
        // but can't grant it until they create an account
        const hasPremiumOnThinkific = await checkThinkificPremiumByEmail(email);
        return {
          userExists: false,
          isPremium: false,
          premiumOnThinkific: hasPremiumOnThinkific,
          message: hasPremiumOnThinkific
            ? "Purchase confirmed on Thinkific. Create your UltrasoundAssist™ account with this email to activate premium."
            : "No premium membership found for this email on Thinkific.",
        };
      }
      // User exists — check if they already have premium in DB
      if (user.isPremium) {
        return {
          userExists: true,
          isPremium: true,
          premiumOnThinkific: true,
          message: "Premium access is already active on your account.",
        };
      }
      // Check Thinkific and sync
      const hasPremium = await checkThinkificPremiumByEmail(email);
      if (hasPremium) {
        await setPremiumStatus(user.id, true, "thinkific");
      }
      return {
        userExists: true,
        isPremium: hasPremium,
        premiumOnThinkific: hasPremium,
        message: hasPremium
          ? "Premium access granted! Sign in to access all premium features."
          : "No active premium membership found for this email on Thinkific.",
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
   * Admin: list recent Thinkific webhook events.
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
