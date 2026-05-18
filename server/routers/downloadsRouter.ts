import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb, getUserById } from "../db";
import {
  digitalProducts,
  digitalProductFiles,
  digitalPurchases,
  digitalDownloadEvents,
  digitalBundles,
  digitalBundleItems,
  digitalBundlePurchases,
  users,
} from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { sendDownloadAccessEmail, sendBundleAccessEmail } from "../lib/enrollmentEmail";

// ─── Public Router ──────────────────────────────────────────────────────────
export const downloadsPublicRouter = router({
  /** List published digital products */
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

      const conditions = [eq(digitalProducts.status, "published")];
      if (input?.search) {
        conditions.push(sql`${digitalProducts.title} LIKE ${"%" + input.search + "%"}`);
      }

      const [products, countResult] = await Promise.all([
        db.select().from(digitalProducts)
          .where(and(...conditions))
          .orderBy(desc(digitalProducts.createdAt))
          .limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(digitalProducts)
          .where(and(...conditions)),
      ]);

      return { products, total: countResult[0]?.count ?? 0 };
    }),

  /** Get single product by slug (public landing page) */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.slug, input.slug)).limit(1);
      // 'published' and 'hidden' are accessible by direct URL; draft/archived/private are not
      // Allow preview for admin users
      const isAdmin = ctx.user?.role === "admin";
      if (!product || ((!input.preview || !isAdmin) && (product.status === "draft" || product.status === "archived" || product.status === "private"))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      // Get file count (not full URLs — those are only for purchasers)
      const files = await db.select({
        id: digitalProductFiles.id,
        fileName: digitalProductFiles.fileName,
        fileSize: digitalProductFiles.fileSize,
        mimeType: digitalProductFiles.mimeType,
      }).from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, product.id))
        .orderBy(asc(digitalProductFiles.sortOrder));

      return { ...product, files };
    }),

  /** Resolve a download product ID to its slug (used for opt-out link redirect) */
  getSlugById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [p] = await db.select({ slug: digitalProducts.slug }).from(digitalProducts)
        .where(eq(digitalProducts.id, input.id)).limit(1);
      return p?.slug ?? null;
    }),
});

// ─── Learner Router (authenticated) ─────────────────────────────────────────
export const downloadsLearnerRouter = router({
  /** Check if user has purchased a product */
  hasPurchased: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { purchased: false };
      const [purchase] = await db.select().from(digitalPurchases)
        .where(and(
          eq(digitalPurchases.userId, ctx.user.id),
          eq(digitalPurchases.productId, input.productId),
        )).limit(1);
      return { purchased: !!purchase };
    }),

  /** Get download links for a purchased product */
  getDownloadFiles: protectedProcedure
    .input(z.object({ productId: z.number(), preview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if product is free or user has purchased
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      // Admin preview mode bypasses purchase check
      const isAdminPreview = input.preview && ctx.user.role === "admin";
      if (!product.isFree && !isAdminPreview) {
        const [purchase] = await db.select().from(digitalPurchases)
          .where(and(
            eq(digitalPurchases.userId, ctx.user.id),
            eq(digitalPurchases.productId, input.productId),
          )).limit(1);
        if (!purchase) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You have not purchased this product" });
        }
      }

      const files = await db.select().from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, input.productId))
        .orderBy(asc(digitalProductFiles.sortOrder));

      return { product, files };
    }),

  /** List user's purchased digital products */
  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const purchases = await db.select({
      purchaseId: digitalPurchases.id,
      purchasedAt: digitalPurchases.purchasedAt,
      productId: digitalProducts.id,
      title: digitalProducts.title,
      thumbnailUrl: digitalProducts.thumbnailUrl,
      slug: digitalProducts.slug,
    }).from(digitalPurchases)
      .innerJoin(digitalProducts, eq(digitalPurchases.productId, digitalProducts.id))
      .where(eq(digitalPurchases.userId, ctx.user.id))
      .orderBy(desc(digitalPurchases.purchasedAt));
    return purchases;
  }),

  /** Create Stripe checkout session for a digital product */
  createCheckout: protectedProcedure
    .input(z.object({ productId: z.number(), orderBumpId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      if ((product as any).bundleOnly) throw new TRPCError({ code: "FORBIDDEN", message: "This product is only available as part of a bundle." });
      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "download",
        triggerProductId: product.id,
        currency: product.currency,
      });

      if (product.isFree && !orderBumpCheckout) {
        // Auto-grant free product
        await db.insert(digitalPurchases).values({
          userId: ctx.user.id,
          productId: product.id,
        });
        return { checkoutUrl: null, free: true };
      }

      // Check if already purchased
      const [existing] = await db.select().from(digitalPurchases)
        .where(and(
          eq(digitalPurchases.userId, ctx.user.id),
          eq(digitalPurchases.productId, input.productId),
        )).limit(1);
      if (existing && !orderBumpCheckout) {
        return { checkoutUrl: null, free: false, alreadyPurchased: true };
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const origin = ctx.req.headers.origin || `https://${ctx.req.headers.host}`;
      const shippingOptions = orderBumpCheckout?.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA"] as any } }
        : {};
      const primaryLineItem = product.isFree ? [] : [{
        price_data: {
          currency: product.currency,
          product_data: {
            name: product.title,
            description: product.subtitle ?? undefined,
            images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
          },
          unit_amount: product.price,
        },
        quantity: 1,
      }];
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        allow_promotion_codes: true,
        line_items: [...primaryLineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
        metadata: {
          type: "digital_download",
          product_id: product.id.toString(),
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
          trigger_order_type: "download",
          ...orderBumpCheckout?.metadata,
        },
        success_url: `${origin}/downloads/${product.slug}/files?success=1`,
        cancel_url: `${origin}/downloads/${product.slug}`,
        ...shippingOptions,
      });

      return { checkoutUrl: session.url, free: false };
    }),

  /** Track a file download event (analytics) */
  trackDownload: protectedProcedure
    .input(z.object({ productId: z.number(), fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.insert(digitalDownloadEvents).values({
        userId: ctx.user.id,
        productId: input.productId,
        fileId: input.fileId,
      });
      // Increment product download count
      await db.update(digitalProducts)
        .set({ downloadCount: sql`download_count + 1` })
        .where(eq(digitalProducts.id, input.productId));

      // Track IP access for sharing monitoring (non-blocking)
      const { logIpAccess } = await import("../jobs/sharingMonitor");
      const fwd = ctx.req?.headers?.["x-forwarded-for"];
      const ip = typeof fwd === "string" ? fwd.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || "unknown";
      logIpAccess({ userId: ctx.user.id, ipAddress: ip, userAgent: ctx.req?.headers?.["user-agent"] || undefined, contentType: "download", contentId: input.productId }).catch(() => {});

      return { success: true };
    }),

  /** Create Stripe checkout session for a bundle */
  createBundleCheckout: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [bundle] = await db.select().from(digitalBundles)
        .where(eq(digitalBundles.id, input.bundleId)).limit(1);
      if (!bundle || bundle.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });

      // Check if already purchased
      const [existing] = await db.select().from(digitalBundlePurchases)
        .where(and(
          eq(digitalBundlePurchases.userId, ctx.user.id),
          eq(digitalBundlePurchases.bundleId, input.bundleId),
        )).limit(1);
      if (existing) return { checkoutUrl: null, alreadyPurchased: true };

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const origin = ctx.req.headers.origin || `https://${ctx.req.headers.host}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency: bundle.currency,
            product_data: {
              name: bundle.title,
              description: bundle.subtitle ?? undefined,
              images: bundle.thumbnailUrl ? [bundle.thumbnailUrl] : undefined,
            },
            unit_amount: bundle.discountPrice,
          },
          quantity: 1,
        }],
        metadata: {
          type: "digital_bundle",
          bundle_id: bundle.id.toString(),
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
        },
        success_url: `${origin}/my-downloads?success=1`,
        cancel_url: `${origin}/bundles/${bundle.slug}`,
      });

      return { checkoutUrl: session.url, alreadyPurchased: false };
    }),

  /** List published bundles */
  listBundles: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const bundles = await db.select().from(digitalBundles)
      .where(eq(digitalBundles.status, "published"))
      .orderBy(desc(digitalBundles.createdAt));
    // Get items for each bundle
    const result = await Promise.all(bundles.map(async (bundle) => {
      const items = await db.select({
        productId: digitalBundleItems.productId,
        title: digitalProducts.title,
        thumbnailUrl: digitalProducts.thumbnailUrl,
        slug: digitalProducts.slug,
      }).from(digitalBundleItems)
        .innerJoin(digitalProducts, eq(digitalBundleItems.productId, digitalProducts.id))
        .where(eq(digitalBundleItems.bundleId, bundle.id))
        .orderBy(asc(digitalBundleItems.sortOrder));
      return { ...bundle, items };
    }));
    return result;
  }),

  /** Get bundle by slug */
  getBundleBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(digitalBundles)
        .where(eq(digitalBundles.slug, input.slug)).limit(1);
      if (!bundle || bundle.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });
      const items = await db.select({
        productId: digitalBundleItems.productId,
        title: digitalProducts.title,
        thumbnailUrl: digitalProducts.thumbnailUrl,
        slug: digitalProducts.slug,
        price: digitalProducts.price,
        isFree: digitalProducts.isFree,
      }).from(digitalBundleItems)
        .innerJoin(digitalProducts, eq(digitalBundleItems.productId, digitalProducts.id))
        .where(eq(digitalBundleItems.bundleId, bundle.id))
        .orderBy(asc(digitalBundleItems.sortOrder));
      return { ...bundle, items };
    }),

  /** Check if user has purchased a bundle */
  hasPurchasedBundle: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { purchased: false };
      const [purchase] = await db.select().from(digitalBundlePurchases)
        .where(and(
          eq(digitalBundlePurchases.userId, ctx.user.id),
          eq(digitalBundlePurchases.bundleId, input.bundleId),
        )).limit(1);
      return { purchased: !!purchase };
    }),
});

// ─── Admin Router ───────────────────────────────────────────────────────────
export const downloadsAdminRouter = router({
  /** List all digital products (admin) */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(digitalProducts).orderBy(desc(digitalProducts.createdAt));
  }),

  /** Get single product with files (admin) */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.id, input.id)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const files = await db.select().from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, product.id))
        .orderBy(asc(digitalProductFiles.sortOrder));
      return { ...product, files };
    }),

  /** Create a new digital product */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      price: z.number().min(0).default(0),
      isFree: z.boolean().default(false),
      bundleOnly: z.boolean().default(false),
      thumbnailUrl: z.string().optional(),
      status: z.enum(["draft", "published", "hidden", "private", "archived"]).default("draft"),
      landingHeadline: z.string().optional(),
      landingBody: z.string().optional(),
      landingFeatures: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Generate slug
      let slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [existing] = await db.select({ id: digitalProducts.id }).from(digitalProducts)
        .where(eq(digitalProducts.slug, slug)).limit(1);
      if (existing) slug += `-${Date.now().toString(36)}`;

      const [result] = await db.insert(digitalProducts).values({
        ...input,
        slug,
      }).$returningId();
      return { id: result.id, slug };
    }),

  /** Update a digital product */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      subtitle: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      price: z.number().min(0).optional(),
      isFree: z.boolean().optional(),
      bundleOnly: z.boolean().optional(),
      thumbnailUrl: z.string().nullable().optional(),
      status: z.enum(["draft", "published", "hidden", "private", "archived"]).optional(),
      landingHeadline: z.string().nullable().optional(),
      landingBody: z.string().nullable().optional(),
      landingFeatures: z.string().nullable().optional(),
      landingBlocks: z.string().nullable().optional(),
      metaTitle: z.string().nullable().optional(),
      metaDescription: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(digitalProducts).set(data).where(eq(digitalProducts.id, id));
      return { success: true };
    }),

  /** Get landing page blocks for a digital product */
  getLandingBlocks: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select({
        id: digitalProducts.id,
        title: digitalProducts.title,
        slug: digitalProducts.slug,
        subtitle: digitalProducts.subtitle,
        thumbnailUrl: digitalProducts.thumbnailUrl,
        landingBlocks: digitalProducts.landingBlocks,
        landingHeadline: digitalProducts.landingHeadline,
      }).from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        blocks: product.landingBlocks ? JSON.parse(product.landingBlocks) : null,
        productTitle: product.title,
        productSlug: product.slug,
        heroTitle: product.landingHeadline ?? product.title,
        heroSubtitle: product.subtitle ?? "",
        heroImageUrl: product.thumbnailUrl ?? "",
      };
    }),

  /** Save landing page blocks for a digital product */
  saveLandingBlocks: protectedProcedure
    .input(z.object({
      productId: z.number(),
      blocks: z.array(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const blocksJson = JSON.stringify(input.blocks);
      await db.update(digitalProducts)
        .set({ landingBlocks: blocksJson })
        .where(eq(digitalProducts.id, input.productId));
      return { success: true };
    }),

  /** Delete a digital product and its files */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(digitalProductFiles).where(eq(digitalProductFiles.productId, input.id));
      await db.delete(digitalProducts).where(eq(digitalProducts.id, input.id));
      return { success: true };
    }),

  /** Upload a file to a digital product */
  uploadFile: protectedProcedure
    .input(z.object({
      productId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const buffer = Buffer.from(input.fileBase64, "base64");
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `digital-downloads/${input.productId}/${suffix}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/octet-stream");

      // Get next sort order
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
        .from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, input.productId));

      const [result] = await db.insert(digitalProductFiles).values({
        productId: input.productId,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        fileSize: input.fileSize ?? buffer.length,
        mimeType: input.mimeType ?? null,
        sortOrder: (maxOrder?.max ?? 0) + 1,
      }).$returningId();

      return { id: result.id, url, fileKey };
    }),

  /** Remove a file from a digital product */
  removeFile: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(digitalProductFiles).where(eq(digitalProductFiles.id, input.fileId));
      return { success: true };
    }),

  /** Reorder files */
  reorderFiles: protectedProcedure
    .input(z.object({
      productId: z.number(),
      fileIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (let i = 0; i < input.fileIds.length; i++) {
        await db.update(digitalProductFiles)
          .set({ sortOrder: i })
          .where(eq(digitalProductFiles.id, input.fileIds[i]));
      }
      return { success: true };
    }),

  /** Get download analytics for all products (admin) */
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return { products: [], recentDownloads: [] };

    // Per-product stats
    const products = await db.select({
      id: digitalProducts.id,
      title: digitalProducts.title,
      downloadCount: digitalProducts.downloadCount,
      slug: digitalProducts.slug,
    }).from(digitalProducts).orderBy(desc(digitalProducts.downloadCount));

    // Recent 50 download events
    const recentDownloads = await db.select({
      id: digitalDownloadEvents.id,
      userId: digitalDownloadEvents.userId,
      productId: digitalDownloadEvents.productId,
      fileId: digitalDownloadEvents.fileId,
      downloadedAt: digitalDownloadEvents.downloadedAt,
      productTitle: digitalProducts.title,
      fileName: digitalProductFiles.fileName,
    }).from(digitalDownloadEvents)
      .leftJoin(digitalProducts, eq(digitalDownloadEvents.productId, digitalProducts.id))
      .leftJoin(digitalProductFiles, eq(digitalDownloadEvents.fileId, digitalProductFiles.id))
      .orderBy(desc(digitalDownloadEvents.downloadedAt))
      .limit(50);

    return { products, recentDownloads };
  }),

  // ─── Bundle Admin CRUD ─────────────────────────────────────────────────────
  /** List all bundles (admin) */
  listBundles: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    const bundles = await db.select().from(digitalBundles).orderBy(desc(digitalBundles.createdAt));
    const result = await Promise.all(bundles.map(async (bundle) => {
      const items = await db.select({
        productId: digitalBundleItems.productId,
        title: digitalProducts.title,
      }).from(digitalBundleItems)
        .innerJoin(digitalProducts, eq(digitalBundleItems.productId, digitalProducts.id))
        .where(eq(digitalBundleItems.bundleId, bundle.id))
        .orderBy(asc(digitalBundleItems.sortOrder));
      return { ...bundle, items };
    }));
    return result;
  }),

  /** Create a bundle */
  createBundle: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      originalPrice: z.number().min(0).default(0),
      discountPrice: z.number().min(0).default(0),
      status: z.enum(["draft", "published", "hidden", "private", "archived"]).default("draft"),
      productIds: z.array(z.number()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [existing] = await db.select({ id: digitalBundles.id }).from(digitalBundles)
        .where(eq(digitalBundles.slug, slug)).limit(1);
      if (existing) slug += `-${Date.now().toString(36)}`;

      const { productIds, ...bundleData } = input;
      const [result] = await db.insert(digitalBundles).values({ ...bundleData, slug }).$returningId();

      if (productIds.length > 0) {
        await db.insert(digitalBundleItems).values(
          productIds.map((pid, i) => ({ bundleId: result.id, productId: pid, sortOrder: i }))
        );
      }
      return { id: result.id, slug };
    }),

  /** Update a bundle */
  updateBundle: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      subtitle: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      thumbnailUrl: z.string().nullable().optional(),
      originalPrice: z.number().min(0).optional(),
      discountPrice: z.number().min(0).optional(),
      status: z.enum(["draft", "published", "hidden", "private", "archived"]).optional(),
      productIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, productIds, ...data } = input;
      await db.update(digitalBundles).set(data).where(eq(digitalBundles.id, id));

      if (productIds !== undefined) {
        await db.delete(digitalBundleItems).where(eq(digitalBundleItems.bundleId, id));
        if (productIds.length > 0) {
          await db.insert(digitalBundleItems).values(
            productIds.map((pid, i) => ({ bundleId: id, productId: pid, sortOrder: i }))
          );
        }
      }
      return { success: true };
    }),

  /** Delete a bundle */
  deleteBundle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(digitalBundleItems).where(eq(digitalBundleItems.bundleId, input.id));
      await db.delete(digitalBundles).where(eq(digitalBundles.id, input.id));
      return { success: true };
    }),

  /** Duplicate a digital product (copies metadata + file list, status = draft) */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [src] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, input.id)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });

      const newTitle = `${src.title} [Copy]`;
      let newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [existing] = await db.select({ id: digitalProducts.id }).from(digitalProducts)
        .where(eq(digitalProducts.slug, newSlug)).limit(1);
      if (existing) newSlug += `-${Date.now().toString(36)}`;

      const { id: _srcId, slug: _srcSlug, downloadCount: _dc, createdAt: _ca, updatedAt: _ua, ...srcRest } = src;
      const [result] = await db.insert(digitalProducts).values({
        ...srcRest,
        title: newTitle,
        slug: newSlug,
        status: "draft",
        downloadCount: 0,
      }).$returningId();

      // Copy file references (same S3 URLs — no re-upload needed)
      const files = await db.select().from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, input.id))
        .orderBy(asc(digitalProductFiles.sortOrder));
      for (const f of files) {
        const { id: _fid, productId: _fpid, ...fRest } = f;
        await db.insert(digitalProductFiles).values({ ...fRest, productId: result.id });
      }

      return { id: result.id, slug: newSlug, title: newTitle };
    }),

  /** Duplicate a bundle (copies metadata + item list, status = draft) */
  duplicateBundle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [src] = await db.select().from(digitalBundles).where(eq(digitalBundles.id, input.id)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND" });

      const newTitle = `${src.title} [Copy]`;
      let newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [existing] = await db.select({ id: digitalBundles.id }).from(digitalBundles)
        .where(eq(digitalBundles.slug, newSlug)).limit(1);
      if (existing) newSlug += `-${Date.now().toString(36)}`;

      const { id: _bid, slug: _bslug, createdAt: _bca, updatedAt: _bua, ...srcRest } = src;
      const [result] = await db.insert(digitalBundles).values({
        ...srcRest,
        title: newTitle,
        slug: newSlug,
        status: "draft",
      }).$returningId();

      const items = await db.select().from(digitalBundleItems)
        .where(eq(digitalBundleItems.bundleId, input.id))
        .orderBy(asc(digitalBundleItems.sortOrder));
      if (items.length > 0) {
        await db.insert(digitalBundleItems).values(
          items.map(item => ({ bundleId: result.id, productId: item.productId, sortOrder: item.sortOrder }))
        );
      }

      return { id: result.id, slug: newSlug, title: newTitle };
    }),

  /** Update download product settings (slug, SEO, visibility) */
  updateDownloadSettings: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
      metaTitle: z.string().max(255).optional(),
      metaDescription: z.string().max(500).optional(),
      status: z.enum(["draft", "published", "hidden", "private", "archived"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: digitalProducts.id }).from(digitalProducts)
        .where(and(eq(digitalProducts.slug, input.slug), sql`${digitalProducts.id} != ${input.productId}`)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A product with this slug already exists" });
      const { productId, ...fields } = input;
      await db.update(digitalProducts).set(fields).where(eq(digitalProducts.id, productId));
      return { success: true };
    }),

  /** Update bundle slug */
  updateBundleSlug: protectedProcedure
    .input(z.object({
      bundleId: z.number().int().positive(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: digitalBundles.id }).from(digitalBundles)
        .where(and(eq(digitalBundles.slug, input.slug), sql`${digitalBundles.id} != ${input.bundleId}`)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A bundle with this slug already exists" });
      await db.update(digitalBundles).set({ slug: input.slug }).where(eq(digitalBundles.id, input.bundleId));
      return { success: true };
    }),

  /** Admin: create a new user account (if needed) and grant them access to a digital product */
  createAndGrantDownloadAccess: protectedProcedure
    .input(z.object({
      productId: z.number(),
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Find or create user
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${input.email})`).limit(1);
      let userId: number;
      let isNewUser = false;
      if (existing) {
        userId = existing.id;
      } else {
        const openId = `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const [inserted] = await db.insert(users).values({
          openId,
          name: input.name,
          displayName: input.name,
          email: input.email,
          role: "user",
        }).$returningId();
        userId = inserted.id;
        isNewUser = true;
      }
      // Check if already has access
      const [existingPurchase] = await db.select({ id: digitalPurchases.id }).from(digitalPurchases)
        .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, input.productId))).limit(1);
      if (existingPurchase) return { purchaseId: existingPurchase.id, alreadyGranted: true, isNewUser };
      // Grant access
      const [result] = await db.insert(digitalPurchases).values({ userId, productId: input.productId }).$returningId();
      // Send email asynchronously
      void (async () => {
        try {
          const [product] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug })
            .from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
          if (!product) return;
          await sendDownloadAccessEmail({
            to: { name: input.name, email: input.email },
            productTitle: product.title,
            productSlug: product.slug,
          });
        } catch (e) {
          console.error("[download-access-email] Failed:", e);
        }
      })();
      return { purchaseId: result.id, alreadyGranted: false, isNewUser };
    }),

  /** Admin: create a new user account (if needed) and grant them access to a bundle */
  createAndGrantBundleAccess: protectedProcedure
    .input(z.object({
      bundleId: z.number(),
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Find or create user
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${input.email})`).limit(1);
      let userId: number;
      let isNewUser = false;
      if (existing) {
        userId = existing.id;
      } else {
        const openId = `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const [inserted] = await db.insert(users).values({
          openId,
          name: input.name,
          displayName: input.name,
          email: input.email,
          role: "user",
        }).$returningId();
        userId = inserted.id;
        isNewUser = true;
      }
      // Check if already has access
      const [existingPurchase] = await db.select({ id: digitalBundlePurchases.id }).from(digitalBundlePurchases)
        .where(and(eq(digitalBundlePurchases.userId, userId), eq(digitalBundlePurchases.bundleId, input.bundleId))).limit(1);
      if (existingPurchase) return { purchaseId: existingPurchase.id, alreadyGranted: true, isNewUser };
      // Grant access
      const [result] = await db.insert(digitalBundlePurchases).values({ userId, bundleId: input.bundleId }).$returningId();
      // Send email asynchronously
      void (async () => {
        try {
          const [bundle] = await db.select({ title: digitalBundles.title, slug: digitalBundles.slug })
            .from(digitalBundles).where(eq(digitalBundles.id, input.bundleId)).limit(1);
          if (!bundle) return;
          await sendBundleAccessEmail({
            to: { name: input.name, email: input.email },
            bundleTitle: bundle.title,
            bundleSlug: bundle.slug,
          });
        } catch (e) {
          console.error("[bundle-access-email] Failed:", e);
        }
      })();
      return { purchaseId: result.id, alreadyGranted: false, isNewUser };
    }),
});

// ─── Email Helper ───────────────────────────────────────────────────────────
export async function sendPurchaseConfirmationEmail(userId: number, productId: number) {
  const db = await getDb();
  if (!db) return;
  const user = await getUserById(userId);
  if (!user || !user.email) return;

  const [product] = await db.select().from(digitalProducts)
    .where(eq(digitalProducts.id, productId)).limit(1);
  if (!product) return;

  const files = await db.select().from(digitalProductFiles)
    .where(eq(digitalProductFiles.productId, productId))
    .orderBy(asc(digitalProductFiles.sortOrder));

  const appUrl = process.env.VITE_APP_URL || 'https://app.allaboutultrasound.com';
  const filesUrl = `${appUrl}/downloads/${product.slug}/files`;

  const fileListHtml = files.map(f => 
    `<li style="margin:4px 0;"><a href="${f.fileUrl}" style="color:#189aa1;">${f.fileName}</a> (${(f.fileSize / 1024 / 1024).toFixed(1)} MB)</li>`
  ).join("");

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f0fbfc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fbfc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%);padding:28px 32px;text-align:center;">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp" alt="All About Ultrasound" width="60" height="60" style="border-radius:50%;display:block;margin:0 auto 12px;" />
          <div style="font-size:18px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">Purchase Confirmed</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0e1e2e;font-family:Georgia,serif;">Thank you for your purchase!</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">Hi ${user.name || "there"}, your download is ready.</p>
          <div style="background:#f0fbfc;border-left:3px solid #189aa1;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#189aa1;">Product: ${product.title}</p>
            <ul style="margin:0;padding-left:20px;font-size:14px;color:#475569;">${fileListHtml}</ul>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="${filesUrl}" style="display:inline-block;background:linear-gradient(135deg,#189aa1,#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Access Your Files</a>
          </div>
          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Questions? Contact us at <a href="mailto:support@allaboutultrasound.com" style="color:#189aa1;">support@allaboutultrasound.com</a>.</p>
        </td></tr>
        <tr><td style="background:#f8fffe;border-top:1px solid #e5f7f8;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">© All About Ultrasound™ · <a href="https://www.allaboutultrasound.com" style="color:#189aa1;text-decoration:none;">www.allaboutultrasound.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await sendEmail({
    to: { name: user.name || "Customer", email: user.email },
    subject: `Your download is ready: ${product.title}`,
    htmlBody,
    previewText: `Your download "${product.title}" is ready — access your files now.`,
  });
}
