import { getStripeClient } from "../lib/stripeClient";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
import {
  getTitleByIsbn,
  isBookvaultConfigured,
  listTitles,
  normalizeIsbn,
  testConnection,
} from "../bookvault";
import { fulfillBookvaultOrder } from "../lib/fulfillBookvaultOrder";
import { fulfillPrintfulOrder } from "../lib/fulfillPrintfulOrder";
import {
  getSyncProduct,
  isPrintfulConfigured,
  testConnection as printfulTestConnection,
} from "../printful";
import {
  getProduct as getPrintifyProduct,
  isPrintifyConfigured,
  testConnection as printifyTestConnection,
} from "../printify";

import {
  physicalProducts,
  physicalProductPricingOptions,
  physicalProductOrders,
  users,
} from "../../drizzle/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(db: Awaited<ReturnType<typeof getDb>>, base: string): Promise<string> {
  if (!db) return base;
  let slug = base;
  let i = 0;
  while (true) {
    const [existing] = await db!.select({ id: physicalProducts.id })
      .from(physicalProducts).where(eq(physicalProducts.slug, slug)).limit(1);
    if (!existing) return slug;
    i++;
    slug = `${base}-${i}`;
  }
}

// ─── Public Router ────────────────────────────────────────────────────────────
export const productsPublicRouter = router({
  /** List published physical products */
  list: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(12),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { products: [], total: 0 };
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 12;
      const offset = (page - 1) * limit;
      const conditions = [eq(physicalProducts.status, "published")];
      if (input?.search) {
        conditions.push(sql`${physicalProducts.title} LIKE ${"%" + input.search + "%"}`);
      }
      const [products, countResult] = await Promise.all([
        db.select().from(physicalProducts)
          .where(and(...conditions))
          .orderBy(desc(physicalProducts.createdAt))
          .limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(physicalProducts)
          .where(and(...conditions)),
      ]);
      return { products, total: countResult[0]?.count ?? 0 };
    }),

  /** Get single product by slug (public sales page) */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(physicalProducts)
        .where(eq(physicalProducts.slug, input.slug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      // Allow preview for admins
      const isAdmin = (ctx.user as any)?.role === "admin" || (ctx.user as any)?.role === "platform_admin";
      if (product.status !== "published" && !input.preview && !isAdmin) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      // Fetch active pricing options
      const pricingOptions = await db.select().from(physicalProductPricingOptions)
        .where(and(
          eq(physicalProductPricingOptions.productId, product.id),
          eq(physicalProductPricingOptions.isActive, true),
        ))
        .orderBy(asc(physicalProductPricingOptions.sortOrder));
      return { product, pricingOptions };
    }),

  /** Get slug by product ID (for building links) */
  getSlugById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select({ slug: physicalProducts.slug })
        .from(physicalProducts).where(eq(physicalProducts.id, input.id)).limit(1);
      return row?.slug ?? null;
    }),
});

// ─── Learner / Buyer Router ───────────────────────────────────────────────────
export const productsLearnerRouter = router({
  /** Check if the current user has purchased a product */
  hasPurchased: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return false;
      const [row] = await db.select({ id: physicalProductOrders.id })
        .from(physicalProductOrders)
        .where(and(
          eq(physicalProductOrders.userId, ctx.user.id),
          eq(physicalProductOrders.productId, input.productId),
          eq(physicalProductOrders.fulfillmentStatus, "pending"),
        )).limit(1);
      // Also check non-pending statuses (processing, shipped, delivered)
      const [row2] = await db.select({ id: physicalProductOrders.id })
        .from(physicalProductOrders)
        .where(and(
          eq(physicalProductOrders.userId, ctx.user.id),
          eq(physicalProductOrders.productId, input.productId),
        )).limit(1);
      return !!row2;
    }),

  /** Create an embedded Stripe Checkout session for a physical product (learner-facing). */
  // NOTE: publicProcedure — guest checkout is allowed, no sign-in required.
  createEmbeddedCheckoutSession: publicProcedure
    .input(z.object({ productSlug: z.string(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(physicalProducts)
        .where(eq(physicalProducts.slug, input.productSlug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      if (product.status !== "published" && !product.isFree) throw new TRPCError({ code: "FORBIDDEN", message: "This product is not available." });
      if (product.checkoutMode !== "native") throw new TRPCError({ code: "BAD_REQUEST", message: "This product uses an external checkout." });
      const userId = ctx.user?.id ?? 0;
      if (product.isFree || Number(product.price) === 0) {
        // Auto-grant free product (only if user is logged in)
        if (userId) {
          await db.insert(physicalProductOrders).values({
            userId,
            productId: product.id,
            pricingOptionId: null,
            amountPaid: 0,
            currency: product.currency,
          }).onDuplicateKeyUpdate({ set: { userId } }).catch(() => {});
        }
        const { platformSettings } = await import("../../drizzle/schema");
        const [settings] = await db.select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl }).from(platformSettings).limit(1);
        return { clientSecret: null, free: true, courseTitle: product.title, courseSubtitle: product.subtitle ?? null, courseDescription: product.description ?? null, courseThumbnail: product.thumbnailUrl ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: settings?.termsUrl ?? "", privacyUrl: settings?.privacyUrl ?? "", productName: product.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: product.currency, minSeats: null, discountPercent: null };
      }
      const { platformSettings } = await import("../../drizzle/schema");
      const [settings] = await db.select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl }).from(platformSettings).limit(1);
      const stripe = getStripeClient();
      const shippingOpts = product.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA", "AU", "GB"] as any } }
        : {};
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "payment",
        customer_email: ctx.user?.email ?? undefined,
        client_reference_id: userId ? userId.toString() : undefined,
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: product.currency,
            product_data: {
              name: product.title,
              description: product.subtitle ?? undefined,
              images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
            },
            unit_amount: Math.round(Number(product.price) * 100),
          },
          quantity: 1,
        }],
        metadata: { type: "physical_product", product_id: product.id.toString(), user_id: userId.toString(), customer_email: ctx.user?.email ?? "" },
        payment_intent_data: { description: `${product.title} — Physical Product` },
        return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=physical`,
        ...shippingOpts,
      });
      return {
        clientSecret: session.client_secret!,
        free: false,
        courseTitle: product.title,
        courseSubtitle: product.subtitle ?? null,
        courseDescription: product.description ?? null,
        courseThumbnail: product.thumbnailUrl ?? null,
        primaryColor: "#189aa1",
        accentColor: "#4ad9e0",
        gradientFrom: "#189aa1",
        gradientTo: "#4ad9e0",
        gradientDirection: "135deg",
        playerTheme: "light",
        termsUrl: settings?.termsUrl ?? "",
        privacyUrl: settings?.privacyUrl ?? "",
        productName: product.title,
        displayPrice: Number(product.price),
        pricingType: "one_time",
        isSubscription: false,
        billingLabel: null,
        currency: product.currency,
        minSeats: null,
        discountPercent: null,
      };
    }),

  /** List the current user's orders */
  myOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const orders = await db.select({
      order: physicalProductOrders,
      product: {
        id: physicalProducts.id,
        title: physicalProducts.title,
        slug: physicalProducts.slug,
        thumbnailUrl: physicalProducts.thumbnailUrl,
      },
    })
      .from(physicalProductOrders)
      .leftJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
      .where(eq(physicalProductOrders.userId, ctx.user.id))
      .orderBy(desc(physicalProductOrders.orderedAt));
    return orders;
  }),

  /** Create a Stripe Checkout session for a physical product (native mode).
   *  Shipping address collection is always enabled for native physical products. */
  createCheckout: publicProcedure
    .input(z.object({
      productId: z.number(),
      pricingOptionId: z.number().optional(),
      promoCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id ?? 0;
      const userEmail = ctx.user?.email ?? undefined;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(physicalProducts)
        .where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      if (product.status !== "published") throw new TRPCError({ code: "FORBIDDEN", message: "This product is not available." });
      if (product.checkoutMode !== "native") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This product uses an external checkout. Use the Shopify or external URL instead." });
      }

      // Resolve pricing
      let unitAmount = product.price;
      let pricingLabel = product.title;
      if (input.pricingOptionId) {
        const [opt] = await db.select().from(physicalProductPricingOptions)
          .where(and(
            eq(physicalProductPricingOptions.id, input.pricingOptionId),
            eq(physicalProductPricingOptions.productId, product.id),
            eq(physicalProductPricingOptions.isActive, true),
          )).limit(1);
        if (opt) {
          unitAmount = opt.price;
          pricingLabel = opt.label;
        }
      }

      // Free product — auto-grant
      if (product.isFree || unitAmount === 0) {
        if (userId) {
          await db.insert(physicalProductOrders).values({
            userId,
            productId: product.id,
            pricingOptionId: input.pricingOptionId ?? null,
            amountPaid: 0,
            currency: product.currency,
          });
        }
        return { checkoutUrl: null, free: true };
      }

      const stripe = getStripeClient();
      const origin = ctx.req.headers.origin || `https://${ctx.req.headers.host}`;

      // Allowed shipping countries (default to US + CA if not specified)
      const allowedCountries = product.shippingCountries
        ? (JSON.parse(product.shippingCountries) as string[])
        : ["US", "CA", "GB", "AU", "NZ"];

      // Resolve promo code if provided
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) {
            discounts = [{ promotion_code: promoCodes.data[0].id }];
            // ── 100% promo intercept for physical products ────────────────────
            const coupon = promoCodes.data[0].coupon as any;
            const priceCents = unitAmount;
            const discountedCents = coupon.percent_off === 100 ? 0 : coupon.amount_off ? Math.max(0, priceCents - coupon.amount_off) : priceCents;
            if (discountedCents === 0) {
              if (userId) await db.insert(physicalProductOrders).values({ userId, productId: product.id, pricingOptionId: input.pricingOptionId ?? null, amountPaid: 0, currency: product.currency });
              return { checkoutUrl: null, free: true };
            }
          }
        } catch { /* ignore */ }
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userId ? userId.toString() : undefined,
        ...(discounts ? { discounts } : { allow_promotion_codes: true }),
        // Always collect shipping address for native physical products
        shipping_address_collection: {
          allowed_countries: allowedCountries as any,
        },
        line_items: [{
          price_data: {
            currency: product.currency,
            product_data: {
              name: pricingLabel,
              description: product.subtitle ?? undefined,
              images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
            },
            unit_amount: Math.round(Number(unitAmount) * 100),
          },
          quantity: 1,
        }],
        metadata: {
          type: "physical_product",
          product_id: product.id.toString(),
          pricing_option_id: input.pricingOptionId?.toString() ?? "",
          user_id: userId ? userId.toString() : "",
          customer_email: userEmail ?? "",
        },
        payment_intent_data: { description: `${pricingLabel} — Physical Product` },
        success_url: `${origin}/product/${product.slug}?success=1`,
        cancel_url: `${origin}/product/${product.slug}`,
      });
      return { checkoutUrl: session.url, free: false };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
export const productsAdminRouter = router({
  /** List all products (admin) */
  list: protectedProcedure.query(async ({ ctx }) => {
    if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    return db.select().from(physicalProducts).orderBy(desc(physicalProducts.createdAt));
  }),

  /** Get a single product with its pricing options */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(physicalProducts)
        .where(eq(physicalProducts.id, input.id)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const pricingOptions = await db.select().from(physicalProductPricingOptions)
        .where(eq(physicalProductPricingOptions.productId, product.id))
        .orderBy(asc(physicalProductPricingOptions.sortOrder));
      return { product, pricingOptions };
    }),

  /** Create a new product */
  create: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = await uniqueSlug(db, slugify(input.title));
      const [result] = await db.insert(physicalProducts).values({
        title: input.title,
        slug,
        status: "draft",
      });
      const insertId = (result as any).insertId;
      return { id: insertId, slug };
    }),

  /** Update product fields */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      subtitle: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      details: z.string().optional().nullable(),
      thumbnailUrl: z.string().optional().nullable(),
      price: z.number().optional(),
      compareAtPrice: z.number().optional().nullable(),
      isFree: z.boolean().optional(),
      currency: z.string().optional(),
      checkoutMode: z.enum(["native", "shopify", "external"]).optional(),
      shopifyProductUrl: z.string().optional().nullable(),
      shopifyEmbedCode: z.string().optional().nullable(),
      shopifyProductId: z.string().optional().nullable(),
      externalCheckoutUrl: z.string().optional().nullable(),
      requiresShipping: z.boolean().optional(),
      shippingCountries: z.string().optional().nullable(),
      status: z.enum(["draft", "published", "hidden", "private", "archived"]).optional(),
      landingHeadline: z.string().optional().nullable(),
      landingBody: z.string().optional().nullable(),
      landingFeatures: z.string().optional().nullable(),
      metaTitle: z.string().optional().nullable(),
      metaDescription: z.string().optional().nullable(),
      slug: z.string().optional(),
      publishDomain: z.string().max(255).nullable().optional(),
      brand: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      // Validate slug uniqueness if being changed
      if (fields.slug) {
        const [existing] = await db.select({ id: physicalProducts.id })
          .from(physicalProducts).where(eq(physicalProducts.slug, fields.slug)).limit(1);
        if (existing && existing.id !== id) {
          throw new TRPCError({ code: "CONFLICT", message: "Slug already in use." });
        }
      }
      await db.update(physicalProducts).set(fields as any).where(eq(physicalProducts.id, id));
      return { success: true };
    }),

  /** Delete a product */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(physicalProductPricingOptions)
        .where(eq(physicalProductPricingOptions.productId, input.id));
      await db.delete(physicalProducts).where(eq(physicalProducts.id, input.id));
      return { success: true };
    }),

  /** Duplicate a product */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(physicalProducts)
        .where(eq(physicalProducts.id, input.id)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const newSlug = await uniqueSlug(db, slugify(`${product.title} copy`));
      const { id: _id, createdAt: _c, updatedAt: _u, orderCount: _oc, ...rest } = product;
      const [result] = await db.insert(physicalProducts).values({
        ...rest,
        title: `${product.title} (Copy)`,
        slug: newSlug,
        status: "draft",
        orderCount: 0,
      });
      const newId = (result as any).insertId;
      // Duplicate pricing options
      const opts = await db.select().from(physicalProductPricingOptions)
        .where(eq(physicalProductPricingOptions.productId, product.id));
      for (const opt of opts) {
        const { id: _oid, createdAt: _oc2, productId: _pid, ...optRest } = opt;
        await db.insert(physicalProductPricingOptions).values({ ...optRest, productId: newId });
      }
      return { id: newId, slug: newSlug };
    }),

  // ── Landing Page Builder ──────────────────────────────────────────────────

  /** Get landing page blocks for the page builder */
  getLandingBlocks: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select({
        id: physicalProducts.id,
        title: physicalProducts.title,
        slug: physicalProducts.slug,
        subtitle: physicalProducts.subtitle,
        thumbnailUrl: physicalProducts.thumbnailUrl,
        landingBlocks: physicalProducts.landingBlocks,
        landingHeadline: physicalProducts.landingHeadline,
        seoTitle: physicalProducts.seoTitle,
        seoDescription: physicalProducts.seoDescription,
        seoImage: physicalProducts.seoImage,
      }).from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        blocks: product.landingBlocks ? JSON.parse(product.landingBlocks) : null,
        productTitle: product.title,
        productSlug: product.slug,
        heroTitle: product.landingHeadline ?? product.title,
        heroSubtitle: product.subtitle ?? "",
        heroImageUrl: product.thumbnailUrl ?? "",
        seoTitle: product.seoTitle ?? null,
        seoDescription: product.seoDescription ?? null,
        seoImage: product.seoImage ?? null,
      };
    }),

  /** Save SEO / link preview settings for a physical product landing page */
  saveLandingPageSeo: protectedProcedure
    .input(z.object({
      productId: z.number(),
      seoTitle: z.string().nullable().optional(),
      seoDescription: z.string().nullable().optional(),
      seoImage: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(physicalProducts)
        .set({
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          seoImage: input.seoImage ?? null,
        })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  /** Save landing page blocks */
  saveLandingBlocks: protectedProcedure
    .input(z.object({ productId: z.number(), blocks: z.array(z.any()) }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const blocksJson = JSON.stringify(input.blocks);
      await db.update(physicalProducts)
        .set({ landingBlocks: blocksJson })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  // ── Thumbnail Upload ──────────────────────────────────────────────────────

  /** Upload a product thumbnail image */
  uploadThumbnail: protectedProcedure
    .input(z.object({
      productId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "jpg";
      const key = `physical-products/${input.productId}/thumbnail-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.update(physicalProducts)
        .set({ thumbnailUrl: url })
        .where(eq(physicalProducts.id, input.productId));
      return { url };
    }),

  // ── Pricing Options ───────────────────────────────────────────────────────

  /** Add a pricing option */
  addPricingOption: protectedProcedure
    .input(z.object({
      productId: z.number(),
      label: z.string().min(1),
      sublabel: z.string().optional().nullable(),
      pricingType: z.enum(["one_time", "free"]).default("one_time"),
      price: z.number().default(0),
      compareAtPrice: z.number().optional().nullable(),
      ctaLabel: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get current max sortOrder
      const [maxRow] = await db.select({ max: sql<number>`MAX(sort_order)` })
        .from(physicalProductPricingOptions)
        .where(eq(physicalProductPricingOptions.productId, input.productId));
      const sortOrder = (maxRow?.max ?? -1) + 1;
      const [result] = await db.insert(physicalProductPricingOptions).values({
        productId: input.productId,
        label: input.label,
        sublabel: input.sublabel ?? null,
        pricingType: input.pricingType,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        ctaLabel: input.ctaLabel ?? null,
        sortOrder,
      });
      return { id: (result as any).insertId };
    }),

  /** Update a pricing option */
  updatePricingOption: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      sublabel: z.string().optional().nullable(),
      pricingType: z.enum(["one_time", "free"]).optional(),
      price: z.number().optional(),
      compareAtPrice: z.number().optional().nullable(),
      ctaLabel: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(physicalProductPricingOptions).set(fields as any)
        .where(eq(physicalProductPricingOptions.id, id));
      return { success: true };
    }),

  /** Delete a pricing option */
  deletePricingOption: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(physicalProductPricingOptions)
        .where(eq(physicalProductPricingOptions.id, input.id));
      return { success: true };
    }),

  // ── Orders Management ─────────────────────────────────────────────────────

  /** List all orders (admin) */
  listOrders: protectedProcedure
    .input(z.object({
      productId: z.number().optional(),
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(25),
    }).optional())
    .query(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) return { orders: [], total: 0 };
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 25;
      const offset = (page - 1) * limit;
      const conditions: any[] = [];
      if (input?.productId) conditions.push(eq(physicalProductOrders.productId, input.productId));
      if (input?.status) conditions.push(eq(physicalProductOrders.fulfillmentStatus, input.status as any));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [orders, countResult] = await Promise.all([
        db.select({
          order: physicalProductOrders,
          product: { id: physicalProducts.id, title: physicalProducts.title, slug: physicalProducts.slug },
          user: { id: users.id, name: users.name, email: users.email },
        })
          .from(physicalProductOrders)
          .leftJoin(physicalProducts, eq(physicalProductOrders.productId, physicalProducts.id))
          .leftJoin(users, eq(physicalProductOrders.userId, users.id))
          .where(whereClause)
          .orderBy(desc(physicalProductOrders.orderedAt))
          .limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(physicalProductOrders).where(whereClause),
      ]);
      return { orders, total: countResult[0]?.count ?? 0 };
    }),

  /** Update order fulfillment status / tracking */
  updateOrder: protectedProcedure
    .input(z.object({
      id: z.number(),
      fulfillmentStatus: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
      trackingNumber: z.string().optional().nullable(),
      trackingCarrier: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(physicalProductOrders).set(fields as any)
        .where(eq(physicalProductOrders.id, id));
      return { success: true };
    }),

  /** Manually grant a user access to a product (create an order record) */
  grantAccess: protectedProcedure
    .input(z.object({
      productId: z.number(),
      userId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(physicalProductOrders).values({
        userId: input.userId,
        productId: input.productId,
        amountPaid: 0,
        currency: "usd",
        notes: input.notes ?? "Manually granted by admin",
        fulfillmentStatus: "delivered",
      });
      return { success: true };
    }),

  /** Get analytics for a product */
  getAnalytics: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) return { totalOrders: 0, totalRevenue: 0, byStatus: [] };
      const [totals] = await db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`COALESCE(SUM(amount_paid), 0)`,
      }).from(physicalProductOrders)
        .where(eq(physicalProductOrders.productId, input.productId));
      const byStatus = await db.select({
        status: physicalProductOrders.fulfillmentStatus,
        count: sql<number>`count(*)`,
      }).from(physicalProductOrders)
        .where(eq(physicalProductOrders.productId, input.productId))
        .groupBy(physicalProductOrders.fulfillmentStatus);
      return {
        totalOrders: totals?.totalOrders ?? 0,
        totalRevenue: totals?.totalRevenue ?? 0,
        byStatus,
      };
    }),

  /** AI-generate landing page blocks for a physical product */
  aiGenerateLandingPage: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if ((ctx.user as any).role !== "admin" && (ctx.user as any).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [product] = await db.select({
        id: physicalProducts.id,
        title: physicalProducts.title,
        subtitle: physicalProducts.subtitle,
        description: physicalProducts.description,
        thumbnailUrl: physicalProducts.thumbnailUrl,
        slug: physicalProducts.slug,
      }).from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // Get pricing options
      const pricingOptions = await db.select({
        label: physicalProductPricingOptions.label,
        price: physicalProductPricingOptions.price,
      }).from(physicalProductPricingOptions)
        .where(eq(physicalProductPricingOptions.productId, input.productId))
        .limit(5);
      const priceText = pricingOptions.length > 0
        ? pricingOptions.map(p => `${p.label}: $${Number(p.price).toFixed(2)}`).join(", ")
        : "Contact for pricing";

      const systemPrompt = `You are an expert landing page designer for physical products. Generate a complete, compelling landing page block structure as JSON. The blocks should be professional, conversion-focused, and specific to the content provided. Return ONLY valid JSON, no markdown.`;
      const userPrompt = `Generate a landing page for this physical product:

Title: ${product.title}
Subtitle: ${product.subtitle ?? ""}
Description: ${product.description ?? ""}
Pricing: ${priceText}
Cover Image: ${product.thumbnailUrl ?? ""}

Generate a JSON array of 5-7 content blocks. Each block MUST have:
- id: unique string like "block_1", "block_2", etc.
- type: MUST be one of these exact strings: hero, text, reviews, faq, cta_standalone
- data: object with the fields described below

Block data schemas:

1. hero block — data fields:
   headline: string (main title)
   subheadline: string (subtitle/hook)
   bgType: "gradient"
   gradientFrom: "#179ca3"
   gradientTo: "#0e4a50"
   textColor: "#ffffff"
   align: "center"
   inlineMediaUrl: "${product.thumbnailUrl ?? ""}"
   inlineMediaType: "image"
   inlineMediaPlacement: "right"
   buttons: [{text: "Order Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled"}]

2. text block — data fields:
   html: string (HTML with h2, p, ul/li tags — write compelling content about features, benefits, who it's for)
   bgColor: "#ffffff"

3. reviews block — data fields:
   headline: "What Customers Are Saying"
   bgColor: "#ffffff"
   reviews: array of 3 objects each with: name (string), text (string — realistic review), rating (number 4 or 5)

4. faq block — data fields:
   headline: "Frequently Asked Questions"
   bgColor: "#f9fafb"
   items: array of 5 objects each with: q (string — question), a (string — answer)

5. cta_standalone block — data fields:
   headline: string (urgent call to action)
   subtext: string (reassurance text)
   ctaText: "Order Now"
   ctaColor: "#179ca3"
   ctaTextColor: "#ffffff"
   bgColor: "#f0fafa"
   align: "center"

Create blocks in this order: hero, text (features/what you get), text (about/description), reviews, faq, cta_standalone.
Make ALL content specific and compelling based on the product title and description above. Do NOT use generic placeholder text.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      let blocks: any[];
      try {
        const raw = response.choices[0].message.content as string;
        blocks = parseLandingBlocks(raw);
      } catch (err: any) {
        console.error("[aiGenerateLandingPage products] parse error:", err?.message, "raw:", (response.choices[0]?.message?.content as string)?.slice(0, 400));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI returned invalid JSON: ${err?.message ?? "unknown error"}. Please try again.` });
      }
      const blocksJson = JSON.stringify(blocks);
      await db.update(physicalProducts)
        .set({ landingBlocks: blocksJson })
        .where(eq(physicalProducts.id, input.productId));

      return { success: true, blockCount: blocks.length };
    }),

  // ─── After Purchase Workflow ──────────────────────────────────────────────
  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db
        .select({ id: physicalProducts.id, afterPurchaseWorkflow: physicalProducts.afterPurchaseWorkflow })
        .from(physicalProducts)
        .where(eq(physicalProducts.id, input.productId))
        .limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return { afterPurchaseWorkflow: product.afterPurchaseWorkflow ?? null };
    }),

  updateAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ productId: z.number(), workflow: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(physicalProducts)
        .set({ afterPurchaseWorkflow: input.workflow })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  getHidePricingOptions: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [p] = await db.select({ id: physicalProducts.id, hidePricingOptions: physicalProducts.hidePricingOptions })
        .from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      return { hidePricingOptions: p.hidePricingOptions ?? false };
    }),

  updateHidePricingOptions: protectedProcedure
    .input(z.object({ productId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(physicalProducts)
        .set({ hidePricingOptions: input.hidePricingOptions })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  getBookvaultSettings: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [p] = await db.select({ id: physicalProducts.id, bookvaultEnabled: physicalProducts.bookvaultEnabled, bookvaultIsbn: physicalProducts.bookvaultIsbn })
        .from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });

      let connection: { connected: boolean; accountName?: string | null; error?: string | null } = {
        connected: false,
        accountName: null,
        error: null,
      };
      if (isBookvaultConfigured()) {
        try {
          const result = await testConnection();
          connection = {
            connected: true,
            accountName:
              (typeof result.account.Name === "string" && result.account.Name) ||
              (typeof result.account.CompanyName === "string" && result.account.CompanyName) ||
              null,
            error: null,
          };
        } catch (err) {
          connection = {
            connected: false,
            accountName: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      } else {
        connection.error = "BOOKVAULT_API_KEY is not configured";
      }

      let titleMatch: { isbn: string; title: string | null } | null = null;
      const isbn = normalizeIsbn(p.bookvaultIsbn);
      if (isbn && connection.connected) {
        try {
          const title = await getTitleByIsbn(isbn);
          titleMatch = {
            isbn,
            title:
              (typeof title?.Title === "string" && title.Title) ||
              (typeof title?.title === "string" && title.title) ||
              null,
          };
        } catch {
          titleMatch = { isbn, title: null };
        }
      }

      return {
        bookvaultEnabled: p.bookvaultEnabled ?? false,
        bookvaultIsbn: p.bookvaultIsbn ?? null,
        connection,
        titleMatch,
      };
    }),

  testBookvaultConnection: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (!isBookvaultConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BOOKVAULT_API_KEY is not configured" });
      }
      const result = await testConnection();
      return {
        accountName:
          (typeof result.account.Name === "string" && result.account.Name) ||
          (typeof result.account.CompanyName === "string" && result.account.CompanyName) ||
          "BookVault account",
        email: typeof result.account.Email === "string" ? result.account.Email : null,
      };
    }),

  listBookvaultTitles: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (!isBookvaultConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BOOKVAULT_API_KEY is not configured" });
      }
      const titles = await listTitles();
      return titles.map((t) => ({
        isbn:
          (typeof t.ISBN === "string" && t.ISBN) ||
          (typeof t.isbn === "string" && t.isbn) ||
          "",
        title:
          (typeof t.Title === "string" && t.Title) ||
          (typeof t.title === "string" && t.title) ||
          "Untitled",
        author:
          (typeof t.Author === "string" && t.Author) ||
          (typeof t.author === "string" && t.author) ||
          null,
      })).filter((t) => t.isbn);
    }),

  retryBookvaultFulfillment: protectedProcedure
    .input(z.object({ orderId: z.number(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && (ctx.user as { role?: string }).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await fulfillBookvaultOrder(db, input.orderId, { force: input.force ?? false });
      if (result.error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      if (result.skipped && result.reason === "bookvault_disabled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "BookVault is not enabled for this product" });
      }
      if (result.skipped && result.reason === "missing_isbn") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Product is missing a BookVault ISBN" });
      }
      if (result.skipped && result.reason === "api_key_not_configured") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BOOKVAULT_API_KEY is not configured" });
      }
      return result;
    }),

  updateBookvaultSettings: protectedProcedure
    .input(z.object({ productId: z.number(), bookvaultEnabled: z.boolean(), bookvaultIsbn: z.string().max(32).nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(physicalProducts)
        .set({ bookvaultEnabled: input.bookvaultEnabled, bookvaultIsbn: input.bookvaultIsbn })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  getPrintfulSettings: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [p] = await db.select({
        id: physicalProducts.id,
        printfulEnabled: physicalProducts.printfulEnabled,
        printfulStoreId: physicalProducts.printfulStoreId,
        printfulSyncProductId: physicalProducts.printfulSyncProductId,
        printfulSyncVariantId: physicalProducts.printfulSyncVariantId,
      })
        .from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });

      let connection: {
        configured: boolean;
        connected: boolean;
        stores: Array<{ id: number; name: string; type: string }>;
        defaultStoreId: number | null;
        error?: string | null;
      } = {
        configured: false,
        connected: false,
        stores: [],
        defaultStoreId: null,
        error: null,
      };
      if (isPrintfulConfigured()) {
        connection.configured = true;
        try {
          const { stores } = await printfulTestConnection();
          const { getDefaultPrintfulStoreId } = await import("../printful");
          connection = {
            configured: true,
            connected: true,
            stores,
            defaultStoreId: getDefaultPrintfulStoreId(),
            error: null,
          };
        } catch (err) {
          connection = {
            configured: true,
            connected: false,
            stores: [],
            defaultStoreId: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      } else {
        connection.error = "PRINTFUL_API_KEY is not configured";
      }

      let productMatch: { title: string | null; variantName: string | null } | null = null;
      if (p.printfulStoreId && p.printfulSyncProductId && connection.connected) {
        try {
          const detail = await getSyncProduct(p.printfulStoreId, p.printfulSyncProductId);
          const variant = detail.sync_variants?.find((v) => v.id === p.printfulSyncVariantId) ?? detail.sync_variants?.[0];
          productMatch = {
            title: detail.sync_product?.name ?? null,
            variantName: variant?.name ?? null,
          };
        } catch {
          productMatch = { title: null, variantName: null };
        }
      }

      return {
        printfulEnabled: p.printfulEnabled ?? false,
        printfulStoreId: p.printfulStoreId ?? null,
        printfulSyncProductId: p.printfulSyncProductId ?? null,
        printfulSyncVariantId: p.printfulSyncVariantId ?? null,
        connection,
        productMatch,
      };
    }),

  testPrintfulConnection: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (!isPrintfulConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTFUL_API_KEY is not configured" });
      }
      const { stores } = await printfulTestConnection();
      const { getDefaultPrintfulStoreId } = await import("../printful");
      return { stores, defaultStoreId: getDefaultPrintfulStoreId() };
    }),

  retryPrintfulFulfillment: protectedProcedure
    .input(z.object({ orderId: z.number(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && (ctx.user as { role?: string }).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await fulfillPrintfulOrder(db, input.orderId, { force: input.force ?? false });
      if (result.error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      if (result.skipped && result.reason === "printful_disabled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Printful is not enabled for this product" });
      }
      if (result.skipped && result.reason === "missing_printful_product_link") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Product is missing Printful store/sync variant link" });
      }
      if (result.skipped && result.reason === "api_key_not_configured") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTFUL_API_KEY is not configured" });
      }
      return result;
    }),

  updatePrintfulSettings: protectedProcedure
    .input(z.object({
      productId: z.number(),
      printfulEnabled: z.boolean(),
      printfulStoreId: z.number().nullable(),
      printfulSyncProductId: z.number().nullable(),
      printfulSyncVariantId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(physicalProducts)
        .set({
          printfulEnabled: input.printfulEnabled,
          printfulStoreId: input.printfulStoreId,
          printfulSyncProductId: input.printfulSyncProductId,
          printfulSyncVariantId: input.printfulSyncVariantId,
        })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  // ─── Checkout Page Config ──────────────────────────────────────────────────
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [p] = await db.select({ checkoutPageConfig: physicalProducts.checkoutPageConfig })
        .from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: p.checkoutPageConfig ?? null };
    }),

  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({ productId: z.number(), config: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.config); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" }); }
      await db.update(physicalProducts).set({ checkoutPageConfig: input.config }).where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

  // ─── Embedded Checkout Session ────────────────────────────────────────────
  createEmbeddedCheckoutSession: protectedProcedure
    .input(z.object({ productSlug: z.string(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(physicalProducts)
        .where(eq(physicalProducts.slug, input.productSlug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      if (product.checkoutMode !== "native") throw new TRPCError({ code: "BAD_REQUEST", message: "This product uses an external checkout." });
      if (product.isFree) {
        return { clientSecret: null, free: true, courseTitle: product.title, courseSubtitle: product.subtitle ?? null, courseDescription: product.description ?? null, courseThumbnail: product.thumbnailUrl ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: product.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: product.currency, minSeats: null, discountPercent: null };
      }
      const { platformSettings } = await import("../../drizzle/schema");
      const [settings] = await db.select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl }).from(platformSettings).limit(1);
      const stripe = getStripeClient();
      const shippingOpts = product.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA", "AU", "GB"] as any } }
        : {};
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: product.currency,
            product_data: {
              name: product.title,
              description: product.subtitle ?? undefined,
              images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
            },
            unit_amount: Math.round(Number(product.price) * 100),
          },
          quantity: 1,
        }],
        metadata: { type: "physical_product", product_id: product.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "" },
        payment_intent_data: { description: `${product.title} — Physical Product` },
        return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=physical`,
        ...shippingOpts,
      });
      return {
        clientSecret: session.client_secret!,
        free: false,
        courseTitle: product.title,
        courseSubtitle: product.subtitle ?? null,
        courseDescription: product.description ?? null,
        courseThumbnail: product.thumbnailUrl ?? null,
        primaryColor: "#189aa1",
        accentColor: "#4ad9e0",
        gradientFrom: "#189aa1",
        gradientTo: "#4ad9e0",
        gradientDirection: "135deg",
        playerTheme: "light",
        termsUrl: settings?.termsUrl ?? "",
        privacyUrl: settings?.privacyUrl ?? "",
        productName: product.title,
        displayPrice: Number(product.price),
        pricingType: "one_time",
        isSubscription: false,
        billingLabel: null,
        currency: product.currency,
        minSeats: null,
        discountPercent: null,
      };
    }),

  // ─── Printify Settings ──────────────────────────────────────────────────────
  getPrintifySettings: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [p] = await db.select().from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      let connection: { configured: boolean; connected: boolean; shops: Array<{ id: number; title: string; sales_channel: string }>; defaultShopId: number | null; error?: string | null } = {
        configured: false,
        connected: false,
        shops: [],
        defaultShopId: null,
        error: null,
      };
      if (isPrintifyConfigured()) {
        connection.configured = true;
        try {
          const { shops } = await printifyTestConnection();
          const { getDefaultPrintifyShopId } = await import("../printify");
          connection = {
            configured: true,
            connected: true,
            shops,
            defaultShopId: getDefaultPrintifyShopId(),
            error: null,
          };
        } catch (err) {
          connection = {
            configured: true,
            connected: false,
            shops: [],
            defaultShopId: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      } else {
        connection.error = "PRINTIFY_API_TOKEN is not configured";
      }
      let productMatch: { title: string | null; variantTitle: string | null } | null = null;
      if (p.printifyShopId && p.printifyProductId && connection.connected) {
        try {
          const detail = await getPrintifyProduct(p.printifyShopId, p.printifyProductId);
          if (detail) {
            const variant = detail.variants.find((v) => v.id === p.printifyVariantId) ?? detail.variants[0];
            productMatch = {
              title: detail.title,
              variantTitle: variant?.title ?? null,
            };
          }
        } catch {
          productMatch = { title: null, variantTitle: null };
        }
      }
      return {
        printifyEnabled: p.printifyEnabled ?? false,
        printifyShopId: p.printifyShopId ?? null,
        printifyProductId: p.printifyProductId ?? null,
        printifyVariantId: p.printifyVariantId ?? null,
        connection,
        productMatch,
      };
    }),
  testPrintifyConnection: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (!isPrintifyConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      const { shops } = await printifyTestConnection();
      const { getDefaultPrintifyShopId } = await import("../printify");
      return { shops, defaultShopId: getDefaultPrintifyShopId() };
    }),
  retryPrintifyFulfillment: protectedProcedure
    .input(z.object({ orderId: z.number(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && (ctx.user as { role?: string }).role !== "platform_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { fulfillPrintifyOrder } = await import("../lib/fulfillPrintifyOrder");
      const result = await fulfillPrintifyOrder(db, input.orderId, { force: input.force ?? false });
      if (result.error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      if (result.skipped && result.reason === "printify_disabled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Printify is not enabled for this product" });
      }
      if (result.skipped && result.reason === "missing_printify_product_link") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Product is missing Printify shop/product/variant link" });
      }
      if (result.skipped && result.reason === "api_token_not_configured") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PRINTIFY_API_TOKEN is not configured" });
      }
      return result;
    }),
  updatePrintifySettings: protectedProcedure
    .input(z.object({
      productId: z.number(),
      printifyEnabled: z.boolean(),
      printifyShopId: z.number().nullable(),
      printifyProductId: z.string().max(64).nullable(),
      printifyVariantId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(physicalProducts)
        .set({
          printifyEnabled: input.printifyEnabled,
          printifyShopId: input.printifyShopId,
          printifyProductId: input.printifyProductId,
          printifyVariantId: input.printifyVariantId,
        })
        .where(eq(physicalProducts.id, input.productId));
      return { success: true };
    }),

});
// ─── Public: checkout page config for physical products ──────────────────────
export const productsCheckoutPublicRouter = router({
  getPublicCheckoutPageConfig: publicProcedure
    .input(z.object({ productSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select({
        checkoutPageConfig: physicalProducts.checkoutPageConfig,
      }).from(physicalProducts).where(eq(physicalProducts.slug, input.productSlug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        config: product.checkoutPageConfig ?? null,
        courseStats: { totalLessons: 0, totalSections: 0, hasCertificate: false },
      };
    }),
});
