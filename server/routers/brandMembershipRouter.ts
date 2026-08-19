import { getStripeClient } from "../lib/stripeClient";
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
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { brandMemberships } from "../../drizzle/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import type { Brand } from "../../shared/brands";

/**
 * Brand-specific Stripe product configuration.
 * Annual plans are HIDDEN (showAnnual: false) — set to true to re-enable.
 */
/** July 31 2026 11:59 PM ET — after this, annual replaces lifetime */
const LIFETIME_OFFER_END = new Date("2026-08-01T03:59:00.000Z"); // 2026-07-31 23:59 ET = 2026-08-01 03:59 UTC
export function isLifetimeOfferActive(): boolean {
  return Date.now() < LIFETIME_OFFER_END.getTime();
}

export const BRAND_PRODUCTS: Record<Brand, {
  name: string;
  monthlyPrice: number;  // cents
  annualPrice: number;   // cents — HIDDEN, kept for future re-enable
  lifetimePrice: number; // cents — one-time Founding Member payment
  currency: string;
  monthlyPriceId?: string;
  annualPriceId?: string; // HIDDEN — kept for future re-enable
  lifetimePriceId?: string;
  showAnnual: boolean;   // false = annual option hidden from UI
}> = {
  aaus: {
    name: "UltrasoundAssist™ Premium Access",
    monthlyPrice: 997,   // $9.97/month
    annualPrice: 9997,   // $99.97/year — HIDDEN
    lifetimePrice: 9997, // $99.97 one-time Founding Member
    currency: "usd",
    // Canonical live Stripe monthly price — verified 2026-08-18.
    monthlyPriceId: "price_1U5xVtBj9HgnkZLK6pvUcG4P",
    lifetimePriceId: "price_1Tl7pbPvVOPkJOleDjA0D43O",
    showAnnual: !isLifetimeOfferActive() ? true : false,
  },
  iheartecho: {
    name: "EchoAssist™ Premium Access",
    monthlyPrice: 997,   // $9.97/month
    annualPrice: 9997,   // $99.97/year — HIDDEN
    lifetimePrice: 9997, // $99.97 one-time Founding Member
    currency: "usd",
    // Canonical live Stripe monthly price — verified 2026-08-18.
    monthlyPriceId: "price_1U5xVtBj9HgnkZLKzl3Qo0pE",
    lifetimePriceId: "price_1Tl7pbPvVOPkJOleQayUZjad",
    showAnnual: !isLifetimeOfferActive() ? true : false,
  },
};

/**
 * Dual Membership product — grants premium access to BOTH brands.
 * $12.99/month or $147 one-time Founding Member lifetime access.
 */
export const DUAL_MEMBERSHIP_PRODUCT = {
  name: "All Access Dual Membership — UltrasoundAssist™ + EchoAssist™",
  description: "Full premium access to both All About Ultrasound™ (UltrasoundAssist™) and iHeartEcho™ (EchoAssist™) platforms.",
  monthlyPrice: 1299,   // $12.99/month
  annualPrice: 14700,   // $147.00/year — same rate as former lifetime
  lifetimePrice: 14700, // $147.00 one-time Founding Member
  currency: "usd",
  // Canonical live Stripe monthly price — verified 2026-08-18.
  monthlyPriceId: "price_1U5xVuBj9HgnkZLKEL1A9qkU",
  lifetimePriceId: "price_1Tl7pcPvVOPkJOleJDKwSypQ",
} as const;

/** Admin check helper */
function assertAdmin(ctx: { user: { role?: string } | null }) {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

type StripeClient = import("stripe").default;

function assertStripeConfigured(): void {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Payment system is not configured. Please contact support.",
    });
  }
}

function isStripePriceMissingError(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number; message?: string };
  return (
    e?.code === "resource_missing"
    || e?.statusCode === 404
    || Boolean(e?.message?.includes("No such price"))
  );
}

/** Validate a stored price ID exists in the current Stripe account (test vs live). */
export async function validateStripePriceId(
  stripe: StripeClient,
  priceId: string | null | undefined,
): Promise<string | null> {
  if (!priceId) return null;
  try {
    await stripe.prices.retrieve(priceId);
    return priceId;
  } catch (err) {
    if (isStripePriceMissingError(err)) return null;
    throw err;
  }
}

function wrapStripeCheckoutError(err: unknown): never {
  console.error("[brandMembership] Stripe checkout error:", err);
  if (err instanceof TRPCError) throw err;
  const message = err instanceof Error ? err.message : "Payment setup failed";
  if (message.includes("No API key") || message.toLowerCase().includes("invalid api key")) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Payment system is not configured. Please contact support.",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: message.includes("No such price")
      ? "Checkout is temporarily unavailable — please try again or contact support."
      : `Checkout failed: ${message}`,
  });
}

function isPaidBrandTier(tier: string, status: string): boolean {
  return (tier === "premium" || tier === "lifetime") && status === "active";
}

async function buildBrandLifetimeLineItem(
  stripe: StripeClient,
  productConfig: (typeof BRAND_PRODUCTS)[Brand],
  brand: Brand,
) {
  const validatedPriceId = await validateStripePriceId(stripe, productConfig.lifetimePriceId);
  if (validatedPriceId) return { price: validatedPriceId, quantity: 1 };
  return {
    price_data: {
      currency: productConfig.currency,
      product_data: {
        name: `${productConfig.name} — Founding Member Lifetime Access`,
        description: "One-time payment. Lock in lifetime access before future pricing increases.",
        metadata: { brand },
      },
      unit_amount: productConfig.lifetimePrice,
    },
    quantity: 1,
  };
}

async function buildBrandRecurringLineItem(
  stripe: StripeClient,
  productConfig: (typeof BRAND_PRODUCTS)[Brand],
  brand: Brand,
  interval: "monthly" | "annual",
) {
  const priceAmount = interval === "annual" ? productConfig.annualPrice : productConfig.monthlyPrice;
  const intervalConfig = interval === "annual"
    ? { interval: "year" as const, interval_count: 1 }
    : { interval: "month" as const, interval_count: 1 };
  const candidatePriceId = interval === "monthly"
    ? productConfig.monthlyPriceId
    : productConfig.annualPriceId;
  const validatedPriceId = await validateStripePriceId(stripe, candidatePriceId);
  if (validatedPriceId) return { price: validatedPriceId, quantity: 1 };
  return {
    price_data: {
      currency: productConfig.currency,
      product_data: {
        name: productConfig.name,
        description: interval === "annual" ? "Annual subscription" : "Monthly subscription — cancel anytime",
        metadata: { brand },
      },
      unit_amount: priceAmount,
      recurring: intervalConfig,
    },
    quantity: 1,
  };
}

async function buildDualMonthlyLineItem(stripe: StripeClient) {
  const validatedPriceId = await validateStripePriceId(stripe, DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId);
  if (validatedPriceId) return { price: validatedPriceId, quantity: 1 };
  return {
    price_data: {
      currency: DUAL_MEMBERSHIP_PRODUCT.currency,
      product_data: {
        name: DUAL_MEMBERSHIP_PRODUCT.name,
        description: DUAL_MEMBERSHIP_PRODUCT.description,
        metadata: { type: "dual_membership" },
      },
      unit_amount: DUAL_MEMBERSHIP_PRODUCT.monthlyPrice,
      recurring: { interval: "month" as const, interval_count: 1 },
    },
    quantity: 1,
  };
}

async function buildDualAnnualLineItem(stripe: StripeClient) {
  return {
    price_data: {
      currency: DUAL_MEMBERSHIP_PRODUCT.currency,
      product_data: {
        name: DUAL_MEMBERSHIP_PRODUCT.name,
        description: "Annual subscription — UltrasoundAssist™ + EchoAssist™",
        metadata: { type: "dual_membership" },
      },
      unit_amount: DUAL_MEMBERSHIP_PRODUCT.annualPrice,
      recurring: { interval: "year" as const, interval_count: 1 },
    },
    quantity: 1,
  };
}

async function buildDualLifetimeLineItem(stripe: StripeClient) {
  const validatedPriceId = await validateStripePriceId(stripe, DUAL_MEMBERSHIP_PRODUCT.lifetimePriceId);
  if (validatedPriceId) return { price: validatedPriceId, quantity: 1 };
  return {
    price_data: {
      currency: DUAL_MEMBERSHIP_PRODUCT.currency,
      product_data: {
        name: `${DUAL_MEMBERSHIP_PRODUCT.name} — Founding Member Lifetime Access`,
        description: "One-time payment. Lifetime access to both UltrasoundAssist™ + EchoAssist™. Lock in before future pricing increases.",
        metadata: { type: "dual_membership_lifetime" },
      },
      unit_amount: DUAL_MEMBERSHIP_PRODUCT.lifetimePrice,
    },
    quantity: 1,
  };
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
    const isPremium = isPaidBrandTier(membership.tier, membership.status) && !isExpired;

    return {
      brand,
      tier: membership.tier as "free" | "premium" | "lifetime",
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
      interval: z.enum(["monthly", "annual", "lifetime"]).default("monthly"),
      origin: z.string().url(),
      promoCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = ctx.brand;
      const productConfig = BRAND_PRODUCTS[brand];
      if (!productConfig) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown brand" });
      }
      // Guard: annual is hidden — reject if someone tries to use it directly
      if (input.interval === "annual" && !productConfig.showAnnual) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Annual plan is not currently available" });
      }

      assertStripeConfigured();
      const stripe = getStripeClient();

      const isLifetime = input.interval === "lifetime";

      try {
        // Resolve promo code if provided
        let discounts: Array<{ promotion_code: string }> | undefined;
        if (input.promoCode) {
          try {
            const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
            if (promoCodes.data[0]) discounts = [{ promotion_code: promoCodes.data[0].id }];
          } catch { /* ignore */ }
        }
        const promoOpts = discounts ? { discounts } : { allow_promotion_codes: true };

        // ── 100% promo intercept for brand memberships ────────────────────────
        if (discounts && discounts.length > 0) {
          try {
            const pc = await stripe.promotionCodes.retrieve(discounts[0].promotion_code);
            const coupon = (pc as any).coupon as any;
            if (coupon.percent_off === 100) {
              const db = await getDb();
              if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
              const [existing] = await db.select({ id: brandMemberships.id })
                .from(brandMemberships)
                .where(and(eq(brandMemberships.userId, ctx.user.id), eq(brandMemberships.brand, brand)))
                .limit(1);
              if (existing) {
                await db.update(brandMemberships)
                  .set({ tier: isLifetime ? "lifetime" : "premium", status: "active", updatedAt: new Date() })
                  .where(eq(brandMemberships.id, existing.id));
              } else {
                await db.insert(brandMemberships).values({
                  userId: ctx.user.id,
                  brand,
                  tier: isLifetime ? "lifetime" : "premium",
                  status: "active",
                  source: "promo_free",
                });
              }
                            (await import("../_core/notification")).notifyOwner({
                title: `🎉 Free Brand Membership Activated (100% Promo)`,
                content: `User ${ctx.user.id} (${ctx.user.email}) activated ${brand} ${isLifetime ? "lifetime" : "premium"} membership via 100% promo code. Source: promo_free.`,
              }).catch(() => {});
              return { checkoutUrl: null, free: true };
            }
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            /* fall through to paid checkout */
          }
        }
        // ── Lifetime duplicate guard ─────────────────────────────────────────────
        if (isLifetime) {
          const db = await getDb();
          if (db) {
            const [existingMembership] = await db.select({ id: brandMemberships.id, tier: brandMemberships.tier, status: brandMemberships.status })
              .from(brandMemberships)
              .where(and(eq(brandMemberships.userId, ctx.user.id), eq(brandMemberships.brand, brand)))
              .limit(1);
            if (existingMembership && existingMembership.tier === "lifetime" && existingMembership.status === "active") {
              throw new TRPCError({ code: "BAD_REQUEST", message: "You already have lifetime access. Please contact support if you need assistance." });
            }
          }
        }

        if (isLifetime) {
          const lifetimeLineItem = await buildBrandLifetimeLineItem(stripe, productConfig, brand);
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            customer_email: ctx.user.email ?? undefined,
            ...promoOpts,
            line_items: [lifetimeLineItem],
            success_url: `${input.origin}/upgrade-success?brand=${brand}&lifetime=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${input.origin}/premium`,
            client_reference_id: ctx.user.id.toString(),
            metadata: {
              user_id: ctx.user.id.toString(),
              customer_email: ctx.user.email ?? "",
              customer_name: ctx.user.name ?? "",
              brand,
              type: "brand_membership_upgrade",
              interval: "lifetime",
            },
            payment_intent_data: { description: `${productConfig.name} — Lifetime Membership` },
          }, { idempotencyKey: `brand-lifetime-${ctx.user.id}-${brand}-${new Date().toISOString().slice(0, 10)}` });
          if (!session.url) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
          }
          return { checkoutUrl: session.url };
        }

        const recurringInterval = input.interval === "annual" ? "annual" : "monthly";
        const recurringLineItem = await buildBrandRecurringLineItem(stripe, productConfig, brand, recurringInterval);

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: [recurringLineItem],
          subscription_data: {
            description: `${productConfig.name} — ${input.interval === "annual" ? "Annual" : "Monthly"} Subscription — Initial`,
            metadata: { user_id: ctx.user.id.toString(), brand, type: "brand_membership_upgrade" },
          },
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
        }, { idempotencyKey: `brand-sub-${ctx.user.id}-${brand}-${input.interval}-${new Date().toISOString().slice(0, 10)}` });
        if (!session.url) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
        }
        return { checkoutUrl: session.url };
      } catch (err) {
        wrapStripeCheckoutError(err);
      }
    }),

  /**
   * Create a Stripe Checkout session for the Dual Membership (both brands, $12.99/mo).
   */
  createDualMembershipCheckout: protectedProcedure
    .input(z.object({
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertStripeConfigured();
      const stripe = getStripeClient();

      try {
        const dualMonthlyLineItem = await buildDualMonthlyLineItem(stripe);
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [dualMonthlyLineItem],
          subscription_data: {
            description: `${DUAL_MEMBERSHIP_PRODUCT.name} — Monthly Subscription — Initial`,
            metadata: { user_id: ctx.user.id.toString(), type: "dual_membership" },
          },
          success_url: `${input.origin}/upgrade-success?dual=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${input.origin}/premium`,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email ?? "",
            customer_name: ctx.user.name ?? "",
            type: "dual_membership",
          },
        }, { idempotencyKey: `dual-monthly-${ctx.user.id}-${new Date().toISOString().slice(0, 10)}` });
        if (!session.url) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
        }
        return { checkoutUrl: session.url };
      } catch (err) {
        wrapStripeCheckoutError(err);
      }
    }),

  /**
   * Create a Stripe Checkout session for Dual Lifetime Membership ($147 one-time).
   */
  createDualLifetimeCheckout: protectedProcedure
    .input(z.object({
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertStripeConfigured();
      const stripe = getStripeClient();

      try {
        const dualLifetimeLineItem = await buildDualLifetimeLineItem(stripe);
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [dualLifetimeLineItem],
          success_url: `${input.origin}/upgrade-success?dual=1&lifetime=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${input.origin}/premium`,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email ?? "",
            customer_name: ctx.user.name ?? "",
            type: "dual_membership_lifetime",
          },
          payment_intent_data: { description: `${DUAL_MEMBERSHIP_PRODUCT.name} — Lifetime Membership` },
        }, { idempotencyKey: `dual-lifetime-${ctx.user.id}-${new Date().toISOString().slice(0, 10)}` });
        if (!session.url) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
        }
        return { checkoutUrl: session.url };
      } catch (err) {
        wrapStripeCheckoutError(err);
      }
    }),

  /**
   * Create a Stripe Checkout session for Dual Annual Membership ($147/year — post-lifetime-offer).
   */
  createDualAnnualCheckout: protectedProcedure
    .input(z.object({
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertStripeConfigured();
      const stripe = getStripeClient();

      try {
        const dualAnnualLineItem = await buildDualAnnualLineItem(stripe);
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [dualAnnualLineItem],
          subscription_data: {
            description: `${DUAL_MEMBERSHIP_PRODUCT.name} — Annual Subscription — Initial`,
            metadata: { user_id: ctx.user.id.toString(), type: "dual_membership" },
          },
          success_url: `${input.origin}/upgrade-success?dual=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${input.origin}/premium`,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email ?? "",
            customer_name: ctx.user.name ?? "",
            type: "dual_membership",
          },
        }, { idempotencyKey: `dual-annual-${ctx.user.id}-${new Date().toISOString().slice(0, 10)}` });
        if (!session.url) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
        }
        return { checkoutUrl: session.url };
      } catch (err) {
        wrapStripeCheckoutError(err);
      }
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

      (await import("../_core/notification")).notifyOwner({
        title: `👑 Brand Membership Granted (Admin)`,
        content: `Admin granted ${input.brand} premium membership to user ${input.userId}.`,
      }).catch(() => {});
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
   * Admin: bulk-reconcile brand memberships from Stripe.
   *
   * Pages through all Stripe subscriptions (for recurring brand/dual plans)
   * and payment intents (for lifetime one-time purchases) that match known
   * brand price IDs, then calls the same fulfillment logic used by the
   * webhook to fill any gaps caused by missed or failed webhook deliveries.
   *
   * Accepts an optional dryRun flag to preview what would be reconciled
   * without making any DB writes.
   */
  bulkReconcileBrandMemberships: protectedProcedure
    .input(z.object({
      /** Limit to a specific Stripe price ID (optional — leave empty to process all brand price IDs) */
      priceId: z.string().optional(),
      /** Max Stripe objects to process in one call (default 200, max 500) */
      limit: z.number().int().min(1).max(500).default(200),
      /** Dry run: resolve user/brand but skip DB writes */
      dryRun: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const stripe = getStripeClient();

      // ── Known brand price IDs ────────────────────────────────────────────────
      // Collect all configured price IDs from BRAND_PRODUCTS + DUAL_MEMBERSHIP_PRODUCT.
      // Any subscription or payment whose price matches one of these is a brand membership.
      const brandPriceIds = new Set<string>();
      const lifetimePriceIds = new Set<string>(); // one-time prices (no recurring)
      const dualPriceIds = new Set<string>();     // dual membership prices

      for (const cfg of Object.values(BRAND_PRODUCTS)) {
        if (cfg.monthlyPriceId) brandPriceIds.add(cfg.monthlyPriceId);
        if (cfg.annualPriceId) brandPriceIds.add(cfg.annualPriceId);
        if (cfg.lifetimePriceId) {
          brandPriceIds.add(cfg.lifetimePriceId);
          lifetimePriceIds.add(cfg.lifetimePriceId);
        }
      }
      // Include DUAL_MEMBERSHIP_PRODUCT canonical price IDs
      if (DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId) {
        brandPriceIds.add(DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId);
        dualPriceIds.add(DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId);
      }
      if (DUAL_MEMBERSHIP_PRODUCT.lifetimePriceId) {
        brandPriceIds.add(DUAL_MEMBERSHIP_PRODUCT.lifetimePriceId);
        dualPriceIds.add(DUAL_MEMBERSHIP_PRODUCT.lifetimePriceId);
        lifetimePriceIds.add(DUAL_MEMBERSHIP_PRODUCT.lifetimePriceId);
      }

      type ReconcileResult = {
        stripeId: string;
        type: "subscription" | "payment_intent";
        customerEmail: string | null;
        priceId: string | null;
        brand: string | null;
        metaType: string | null;
        status: "fulfilled" | "skipped" | "error" | "dry_run";
        notes: string[];
        error?: string;
        userId?: number | null;
      };

      const results: ReconcileResult[] = [];
      let processed = 0;

      // ── 1. Reconcile subscriptions (monthly/annual recurring brand plans) ────
      {
        let startingAfter: string | undefined = undefined;
        while (processed < input.limit) {
          const batchSize = Math.min(100, input.limit - processed);
          const listParams: Record<string, unknown> = {
            limit: batchSize,
            status: "all",
            expand: ["data.customer"],
          };
          if (startingAfter) listParams.starting_after = startingAfter;
          if (input.priceId) listParams.price = input.priceId;

          const batch = await stripe.subscriptions.list(listParams as any);
          if (batch.data.length === 0) break;

          for (const sub of batch.data) {
            const priceId = sub.items?.data?.[0]?.price?.id ?? null;
            const metaType = (sub.metadata as Record<string, string>)?.type ?? null;
            const metaBrand = (sub.metadata as Record<string, string>)?.brand ?? null;
            const customerEmail = typeof sub.customer === "object" && sub.customer !== null
              ? (sub.customer as any).email ?? null
              : null;

            // Determine if this is a brand membership subscription
            // Match by metadata type OR by canonical price ID
            const isDualByPrice = priceId ? dualPriceIds.has(priceId) : false;
            const isBrandSub = metaType === "brand_membership_upgrade" ||
              metaType === "dual_membership" ||
              isDualByPrice ||
              (priceId && brandPriceIds.has(priceId));

            if (!isBrandSub && !input.priceId) {
              results.push({ stripeId: sub.id, type: "subscription", customerEmail, priceId, brand: metaBrand, metaType, status: "skipped", notes: ["Not a brand membership subscription"] });
              continue;
            }

            if (sub.status === "canceled") {
              results.push({ stripeId: sub.id, type: "subscription", customerEmail, priceId, brand: metaBrand, metaType, status: "skipped", notes: ["Subscription cancelled — skipped"] });
              continue;
            }

            if (input.dryRun) {
              results.push({ stripeId: sub.id, type: "subscription", customerEmail, priceId, brand: metaBrand, metaType, status: "dry_run", notes: [`Would reconcile — Stripe status: ${sub.status}`] });
              processed++;
              continue;
            }

            try {
              // Build a synthetic session and dispatch through the same webhook handlers
              const { handleBrandMembershipCheckoutCompleted, handleDualMembershipCheckoutCompleted } =
                await import("../webhooks/stripe") as any;

              // Determine effective type — prefer metadata, fall back to price ID match
              const effectiveType = metaType ??
                (isDualByPrice ? "dual_membership" : (metaBrand ? "brand_membership_upgrade" : "dual_membership"));

              const syntheticSession: Record<string, unknown> = {
                id: `bulk_reconcile_${sub.id}`,
                metadata: {
                  ...((sub.metadata as Record<string, string>) ?? {}),
                  type: effectiveType,
                  brand: metaBrand ?? undefined,
                },
                subscription: sub.id,
                customer: typeof sub.customer === "object" ? (sub.customer as any).id : sub.customer,
                customer_email: customerEmail,
                status: "complete",
              };

              if (metaType === "dual_membership") {
                await handleDualMembershipCheckoutCompleted(syntheticSession);
              } else {
                await handleBrandMembershipCheckoutCompleted(syntheticSession);
              }

              results.push({ stripeId: sub.id, type: "subscription", customerEmail, priceId, brand: metaBrand, metaType, status: "fulfilled", notes: ["Reconciled via webhook handler"] });
            } catch (err: any) {
              results.push({ stripeId: sub.id, type: "subscription", customerEmail, priceId, brand: metaBrand, metaType, status: "error", notes: [], error: err?.message ?? "Unknown error" });
            }
            processed++;
          }

          if (!batch.has_more) break;
          startingAfter = batch.data[batch.data.length - 1].id;
        }
      }

      // ── 2. Reconcile one-time payments (lifetime brand/dual memberships) ─────
      // Search payment intents with metadata.type = brand_membership_upgrade or dual_membership_lifetime
      // Stripe doesn't support filtering payment intents by metadata, so we use checkout sessions instead.
      if (processed < input.limit) {
        const remainingLimit = input.limit - processed;
        let startingAfter: string | undefined = undefined;
        let piProcessed = 0;

        while (piProcessed < remainingLimit) {
          const batchSize = Math.min(100, remainingLimit - piProcessed);
          const listParams: Record<string, unknown> = {
            limit: batchSize,
            // Expand both customer (for email) and line_items (for canonical price ID matching)
            expand: ["data.customer", "data.line_items"],
          };
          if (startingAfter) listParams.starting_after = startingAfter;

          const batch = await stripe.checkout.sessions.list(listParams as any);
          if (batch.data.length === 0) break;

          for (const session of batch.data) {
            const meta = (session.metadata ?? {}) as Record<string, string>;
            const metaType = meta.type ?? null;
            const metaBrand = meta.brand ?? null;
            const customerEmail = session.customer_email ??
              (typeof session.customer === "object" ? (session.customer as any)?.email : null) ?? null;

            // Resolve price ID from session line items if available
            const sessionPriceId = (session as any).line_items?.data?.[0]?.price?.id ?? null;

            // Match by metadata type OR by canonical lifetime price ID
            const isLifetimeBrand = (metaType === "brand_membership_upgrade" && meta.interval === "lifetime") ||
              (sessionPriceId && lifetimePriceIds.has(sessionPriceId) && !dualPriceIds.has(sessionPriceId));
            const isLifetimeDual = metaType === "dual_membership_lifetime" ||
              (sessionPriceId && dualPriceIds.has(sessionPriceId) && lifetimePriceIds.has(sessionPriceId));

            if (!isLifetimeBrand && !isLifetimeDual) {
              // Not a lifetime brand membership session — skip
              continue;
            }

            if (session.payment_status !== "paid") {
              results.push({ stripeId: session.id, type: "payment_intent", customerEmail, priceId: null, brand: metaBrand, metaType, status: "skipped", notes: [`Payment status: ${session.payment_status}`] });
              piProcessed++;
              continue;
            }

            if (input.dryRun) {
              results.push({ stripeId: session.id, type: "payment_intent", customerEmail, priceId: null, brand: metaBrand, metaType, status: "dry_run", notes: [`Would reconcile lifetime ${metaType}`] });
              piProcessed++;
              processed++;
              continue;
            }

            try {
              const { handleBrandMembershipCheckoutCompleted, handleDualMembershipCheckoutCompleted } =
                await import("../webhooks/stripe") as any;

              const syntheticSession: Record<string, unknown> = {
                id: session.id,
                metadata: meta,
                subscription: null,
                customer: typeof session.customer === "object" ? (session.customer as any)?.id : session.customer,
                customer_email: customerEmail,
                status: "complete",
                payment_status: "paid",
              };

              if (isLifetimeDual) {
                await handleDualMembershipCheckoutCompleted(syntheticSession);
              } else {
                await handleBrandMembershipCheckoutCompleted(syntheticSession);
              }

              results.push({ stripeId: session.id, type: "payment_intent", customerEmail, priceId: null, brand: metaBrand, metaType, status: "fulfilled", notes: ["Reconciled lifetime via webhook handler"] });
            } catch (err: any) {
              results.push({ stripeId: session.id, type: "payment_intent", customerEmail, priceId: null, brand: metaBrand, metaType, status: "error", notes: [], error: err?.message ?? "Unknown error" });
            }
            piProcessed++;
            processed++;
          }

          if (!batch.has_more) break;
          startingAfter = batch.data[batch.data.length - 1].id;
        }
      }

      const fulfilled = results.filter(r => r.status === "fulfilled").length;
      const errors = results.filter(r => r.status === "error").length;
      const skipped = results.filter(r => r.status === "skipped").length;
      const dryRunCount = results.filter(r => r.status === "dry_run").length;

      await (await import("../_core/notification")).notifyOwner({
        title: `\ud83d\udd04 Bulk Brand Membership Reconcile Complete`,
        content: `Processed ${processed} Stripe objects. Fulfilled: ${fulfilled}, Errors: ${errors}, Skipped: ${skipped}${input.dryRun ? `, Dry-run: ${dryRunCount}` : ""}.`,
      }).catch(() => {});

      return { processed, fulfilled, errors, skipped, dryRun: input.dryRun, results };
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
          inArray(brandMemberships.tier, ["premium", "lifetime"]),
        ))
        .orderBy(desc(brandMemberships.grantedAt));

      return memberships;
    }),

  /**
   * Public lead-capture: Team / Institution pricing inquiry.
   * Sends an owner notification — no auth required.
   */
  submitTeamInquiry: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(320),
      organization: z.string().min(1).max(300),
      teamSize: z.string().min(1).max(100),
      productInterest: z.string().max(200).optional(),
      message: z.string().max(2000).optional(),
      brand: z.enum(["aaus", "iheartecho"]),
    }))
    .mutation(async ({ input }) => {
      const appLabel = input.brand === "iheartecho" ? "iHeartEcho" : "All About Ultrasound";
      const lines = [
        `App: ${appLabel}`,
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        `Organization: ${input.organization}`,
        `Team Size: ${input.teamSize}`,
        ...(input.productInterest ? [`Product Interest: ${input.productInterest}`] : []),
        ...(input.message ? [`Message: ${input.message}`] : []),
      ];
      try {
        await (await import("../_core/notification")).notifyOwner({
          title: `[${appLabel}] Team/Institution Pricing Inquiry`,
          content: lines.join("\n"),
        });
      } catch { /* non-fatal */ }
      return { success: true };
    }),
});
