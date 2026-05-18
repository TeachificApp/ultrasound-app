/**
 * Brand Membership Router — Multi-tenant premium subscription management.
 *
 * Handles brand-scoped premium memberships (separate from the legacy AAUS isPremium flag).
 * Each brand (aaus, iheartecho) has its own subscription tier managed via Stripe.
 *
 * Procedures:
 *  - brandMembership.getStatus       — returns current user's membership for the detected brand
 *  - brandMembership.createCheckout  — creates a Stripe checkout session for brand premium upgrade
 *  - brandMembership.adminGrant      — admin: manually grant premium to a user for a brand
 *  - brandMembership.adminRevoke     — admin: manually revoke premium from a user for a brand
 *  - brandMembership.adminList       — admin: list all premium members for a brand
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { brandMemberships } from "../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { Brand } from "../../shared/brands";

/**
 * Brand-specific Stripe product configuration.
 * These will be created dynamically on first checkout if not pre-configured.
 * In production, set these to actual Stripe Price IDs from your Stripe dashboard.
 */
export const BRAND_PRODUCTS: Record<Brand, {
  name: string;
  monthlyPrice: number; // cents
  annualPrice: number; // cents
  currency: string;
  monthlyPriceId?: string; // set after first Stripe product creation
  annualPriceId?: string;
}> = {
  aaus: {
    name: "UltrasoundAssist™ Premium Access",
    monthlyPrice: 997, // $9.97/month
    annualPrice: 9997, // $99.97/year
    currency: "usd",
  },
  iheartecho: {
    name: "EchoAssist™ Premium Access",
    monthlyPrice: 997, // $9.97/month
    annualPrice: 9997, // $99.97/year
    currency: "usd",
  },
};

/**
 * Dual Membership product — grants premium access to BOTH brands.
 * $12.99/month, billed monthly only.
 */
export const DUAL_MEMBERSHIP_PRODUCT = {
  name: "All Access Dual Membership — UltrasoundAssist™ + EchoAssist™",
  description: "Full premium access to both All About Ultrasound™ (UltrasoundAssist™) and iHeartEcho™ (EchoAssist™) platforms.",
  monthlyPrice: 1299, // $12.99/month
  currency: "usd",
} as const;

/** Admin check helper */
function assertAdmin(ctx: { user: { role?: string } | null }) {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const brandMembershipRouter = router({
  /**
   * Get the current user's brand membership status for the detected brand.
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const brand = ctx.brand;
    const [membership] = await db
      .select()
      .from(brandMemberships)
      .where(and(eq(brandMemberships.userId, ctx.user.id), eq(brandMemberships.brand, brand)))
      .limit(1);

    if (!membership) {
      return {
        brand,
        tier: "free" as const,
        status: "none" as const,
        isPremium: false,
        stripeSubscriptionId: null,
      };
    }

    // Check if expired
    const isExpired = membership.expiresAt && new Date(membership.expiresAt) < new Date();
    const isPremium = membership.tier === "premium" && membership.status === "active" && !isExpired;

    return {
      brand,
      tier: membership.tier as "free" | "premium",
      status: membership.status as "active" | "cancelled" | "expired",
      isPremium,
      stripeSubscriptionId: membership.stripeSubscriptionId,
      grantedAt: membership.grantedAt,
      expiresAt: membership.expiresAt,
      source: membership.source,
    };
  }),

  /**
   * Create a Stripe Checkout session for brand premium upgrade.
   * Supports monthly and annual billing intervals.
   */
  createCheckout: protectedProcedure
    .input(z.object({
      interval: z.enum(["monthly", "annual"]).default("monthly"),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = ctx.brand;
      const productConfig = BRAND_PRODUCTS[brand];
      if (!productConfig) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown brand" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const priceAmount = input.interval === "annual" ? productConfig.annualPrice : productConfig.monthlyPrice;
      const intervalConfig = input.interval === "annual"
        ? { interval: "year" as const, interval_count: 1 }
        : { interval: "month" as const, interval_count: 1 };

      // Create or reuse a Stripe product + price
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: productConfig.currency,
            product_data: {
              name: productConfig.name,
              description: `${input.interval === "annual" ? "Annual" : "Monthly"} subscription`,
              metadata: { brand },
            },
            unit_amount: priceAmount,
            recurring: intervalConfig,
          },
          quantity: 1,
        }],
        success_url: `${input.origin}/upgrade-success?brand=${brand}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/premium`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          brand,
          type: "brand_membership_upgrade",
          interval: input.interval,
        },
      });

      return { checkoutUrl: session.url };
    }),

  /**
   * Create a Stripe Checkout session for the Dual Membership (both brands, $12.99/mo).
   */
  createDualMembershipCheckout: protectedProcedure
    .input(z.object({
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: DUAL_MEMBERSHIP_PRODUCT.currency,
            product_data: {
              name: DUAL_MEMBERSHIP_PRODUCT.name,
              description: DUAL_MEMBERSHIP_PRODUCT.description,
              metadata: { type: "dual_membership" },
            },
            unit_amount: DUAL_MEMBERSHIP_PRODUCT.monthlyPrice,
            recurring: { interval: "month", interval_count: 1 },
          },
          quantity: 1,
        }],
        success_url: `${input.origin}/upgrade-success?dual=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/premium`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          type: "dual_membership",
        },
      });

      return { checkoutUrl: session.url };
    }),

  /**
   * Admin: manually grant premium access to a user for a specific brand.
   */
  adminGrant: protectedProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      brand: z.enum(["aaus", "iheartecho"]),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if membership already exists
      const [existing] = await db
        .select()
        .from(brandMemberships)
        .where(and(eq(brandMemberships.userId, input.userId), eq(brandMemberships.brand, input.brand)))
        .limit(1);

      if (existing) {
        // Update existing membership
        await db.update(brandMemberships)
          .set({ tier: "premium", status: "active", source: "admin", grantedAt: new Date() })
          .where(eq(brandMemberships.id, existing.id));
      } else {
        // Create new membership
        await db.insert(brandMemberships).values({
          userId: input.userId,
          brand: input.brand,
          tier: "premium",
          status: "active",
          source: "admin",
        });
      }

      return { success: true };
    }),

  /**
   * Admin: revoke premium access from a user for a specific brand.
   */
  adminRevoke: protectedProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      brand: z.enum(["aaus", "iheartecho"]),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select()
        .from(brandMemberships)
        .where(and(eq(brandMemberships.userId, input.userId), eq(brandMemberships.brand, input.brand)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No membership found" });
      }

      await db.update(brandMemberships)
        .set({ tier: "free", status: "cancelled", source: "admin" })
        .where(eq(brandMemberships.id, existing.id));

      return { success: true };
    }),

  /**
   * Admin: list all premium members for a specific brand.
   */
  adminList: protectedProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho"]),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) return [];

      const { users } = await import("../../drizzle/schema");

      const memberships = await db
        .select({
          id: brandMemberships.id,
          userId: brandMemberships.userId,
          brand: brandMemberships.brand,
          tier: brandMemberships.tier,
          status: brandMemberships.status,
          source: brandMemberships.source,
          grantedAt: brandMemberships.grantedAt,
          expiresAt: brandMemberships.expiresAt,
          stripeSubscriptionId: brandMemberships.stripeSubscriptionId,
          userName: users.name,
          userEmail: users.email,
        })
        .from(brandMemberships)
        .leftJoin(users, eq(users.id, brandMemberships.userId))
        .where(and(
          eq(brandMemberships.brand, input.brand),
          eq(brandMemberships.tier, "premium"),
        ))
        .orderBy(desc(brandMemberships.grantedAt));

      return memberships;
    }),
});
