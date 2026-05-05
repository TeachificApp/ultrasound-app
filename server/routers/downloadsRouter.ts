import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import {
  digitalProducts,
  digitalProductFiles,
  digitalPurchases,
} from "../../drizzle/schema";

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
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.slug, input.slug)).limit(1);
      if (!product || product.status !== "published") {
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
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if product is free or user has purchased
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      if (!product.isFree) {
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
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      if (product.isFree) {
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
      if (existing) {
        return { checkoutUrl: null, free: false, alreadyPurchased: true };
      }

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
            currency: product.currency,
            product_data: {
              name: product.title,
              description: product.subtitle ?? undefined,
              images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined,
            },
            unit_amount: product.price,
          },
          quantity: 1,
        }],
        metadata: {
          type: "digital_download",
          product_id: product.id.toString(),
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
        },
        success_url: `${origin}/downloads/${product.slug}/files?success=1`,
        cancel_url: `${origin}/downloads/${product.slug}`,
      });

      return { checkoutUrl: session.url, free: false };
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
      thumbnailUrl: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).default("draft"),
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
      thumbnailUrl: z.string().nullable().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      landingHeadline: z.string().nullable().optional(),
      landingBody: z.string().nullable().optional(),
      landingFeatures: z.string().nullable().optional(),
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
});
