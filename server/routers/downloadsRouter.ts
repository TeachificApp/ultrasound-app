import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc, or, like, gte, lte, count } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb, getUserById, getOrCreateAccessToken } from "../db";
import {
  digitalProducts,
  digitalProductFiles,
  digitalPurchases,
  digitalDownloadEvents,
  digitalPurchaseActivity,
  digitalBundles,
  digitalBundleItems,
  digitalBundlePurchases,
  users,
  lmsArchive,
} from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { invokeLLM } from "../_core/llm";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
import { sendDownloadAccessEmail, sendBundleAccessEmail } from "../lib/enrollmentEmail";
import { addToAllContacts } from "../lib/emailListHelper";

function assertAdmin(ctx: any) {
  if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

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

      const conditions = [eq(digitalProducts.status, "published"), eq(digitalProducts.showInLibrary, true)];
      if (input?.search) {
        conditions.push(sql`${digitalProducts.title} LIKE ${"%%" + input.search + "%%"}`);
      }

      const [products, countResult] = await Promise.all([
        db.select().from(digitalProducts)
          .where(and(...conditions))
          .orderBy(asc(digitalProducts.libraryOrder), desc(digitalProducts.createdAt))
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
      // Admins can always see any product regardless of status
      const isAdmin = ctx.user?.role === "admin";
      if (!product || (!isAdmin && (product.status === "draft" || product.status === "archived" || product.status === "private"))) {
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
      let purchaseRow: Awaited<ReturnType<typeof import("../lib/downloadAccess").loadPurchaseForUser>> = null;

      if (!product.isFree && !isAdminPreview) {
        purchaseRow = await (await import("../lib/downloadAccess")).loadPurchaseForUser(db, ctx.user.id, input.productId);
        if (!purchaseRow) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You have not purchased this product" });
        }
        const { isPurchaseAccessActive } = await import("../lib/downloadAccess");
        if (!isPurchaseAccessActive(purchaseRow)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your download access for this order has expired or been revoked." });
        }
      }

      const files = await db.select().from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, input.productId))
        .orderBy(asc(digitalProductFiles.sortOrder));

      let fileStats: Awaited<ReturnType<typeof import("../lib/downloadAccess").getFileDownloadStatsForPurchase>> = [];
      if (purchaseRow) {
        const { getFileDownloadStatsForPurchase } = await import("../lib/downloadAccess");
        fileStats = await getFileDownloadStatsForPurchase(db, purchaseRow, purchaseRow.productMaxDownloads);
      } else if (isAdminPreview || product.isFree) {
        fileStats = files.map((f) => ({
          fileId: f.id,
          fileName: f.fileName,
          downloaded: 0,
          remaining: null,
          canDownload: true,
        }));
      }

      const filesWithStats = files.map((f) => {
        const stat = fileStats.find((s) => s.fileId === f.id);
        return { ...f, downloadStats: stat ?? { downloaded: 0, remaining: null, canDownload: true } };
      });

      return {
        product,
        files: filesWithStats,
        purchase: purchaseRow
          ? {
              id: purchaseRow.id,
              maxDownloadsPerFile: purchaseRow.maxDownloadsPerFile,
              accessExpiresAt: purchaseRow.accessExpiresAt,
              status: purchaseRow.status,
            }
          : null,
        memberPageBlocksAbove: product.memberPageBlocksAbove ?? null,
        memberPageBlocksBelow: product.memberPageBlocksBelow ?? null,
      };
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

  /** Validate a Stripe promotion code and return discount details */
  validatePromoCode: publicProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
      try {
        const promoCodes = await stripe.promotionCodes.list({ code: input.code.toUpperCase(), active: true, limit: 1 });
        const promoCode = promoCodes.data[0];
        if (!promoCode) return { valid: false as const, message: "Invalid or expired promo code" };
        const coupon = promoCode.coupon as any;
        if (!coupon.valid) return { valid: false as const, message: "This promo code is no longer active" };
        const discountText = coupon.percent_off
          ? `${coupon.percent_off}% off`
          : coupon.amount_off
          ? `$${(coupon.amount_off / 100).toFixed(2)} off`
          : "Discount applied";
        return {
          valid: true as const,
          promoCodeId: promoCode.id,
          discountText,
          percentOff: coupon.percent_off as number | null,
          amountOff: coupon.amount_off as number | null,
          currency: coupon.currency as string | null,
        };
      } catch {
        return { valid: false as const, message: "Invalid promo code" };
      }
    }),

  /** Create Stripe checkout session for a digital product */
  createCheckout: publicProcedure
    .input(z.object({ productId: z.number(), orderBumpId: z.number().optional(), promoCode: z.string().optional(), affiliateCode: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id ?? 0;
      const userEmail = ctx.user?.email ?? undefined;
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
          unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: 1,
      }];
      // Resolve promo code ID if provided
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) discounts = [{ promotion_code: promoCodes.data[0].id }];
        } catch { /* ignore invalid codes — checkout still works */ }
      }
      // ── 100% promo intercept for downloads ─────────────────────────────────
      if (discounts && discounts.length > 0) {
        try {
          const pc = await stripe.promotionCodes.retrieve(discounts[0].promotion_code);
          const coupon = (pc as any).coupon as any;
          const priceCents = Math.round(Number(product.price) * 100);
          const discountedCents = coupon.percent_off === 100 ? 0 : coupon.amount_off ? Math.max(0, priceCents - coupon.amount_off) : priceCents;
          if (discountedCents === 0) {
            await db.insert(digitalPurchases).values({ userId: ctx.user.id, productId: product.id });
            return { checkoutUrl: null, free: true };
          }
        } catch { /* ignore */ }
      }

      const isUpgradeBumpDl = orderBumpCheckout?.bumpMode === "upgrade";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: userEmail,
        client_reference_id: userId ? userId.toString() : undefined,
        ...(discounts ? { discounts } : { allow_promotion_codes: true }),
        line_items: isUpgradeBumpDl
          ? [orderBumpCheckout!.lineItem]
          : [...primaryLineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
        metadata: {
          type: "digital_download",
          product_id: product.id.toString(),
          user_id: userId ? userId.toString() : "",
          customer_email: userEmail ?? "",
          trigger_order_type: "download",
          affiliate_code: input.affiliateCode ?? "",
          ...(isUpgradeBumpDl ? { bump_mode: "upgrade" } : {}),
          ...orderBumpCheckout?.metadata,
        },
        payment_intent_data: { description: `${product.title} — Digital Download` },
        success_url: `${origin}/downloads/${product.slug}/files?success=1`,
        cancel_url: `${origin}/downloads/${product.slug}`,
        ...shippingOptions,
      }, { idempotencyKey: `download-checkout-${userId}-${product.id}-${new Date().toISOString().slice(0, 10)}` });

      return { checkoutUrl: session.url, free: false };
    }),

  /** Track a file download event (analytics + access enforcement) */
  trackDownload: protectedProcedure
    .input(z.object({ productId: z.number(), fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false, reason: "DB unavailable" };

      const {
        loadPurchaseForUser,
        validateDownloadAttempt,
        logPurchaseActivity,
      } = await import("../lib/downloadAccess");

      const purchase = await loadPurchaseForUser(db, ctx.user.id, input.productId);
      if (!purchase) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You have not purchased this product" });
      }

      const check = await validateDownloadAttempt(db, purchase, input.fileId, purchase.productMaxDownloads);
      if (!check.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: check.reason });
      }

      const fwd = ctx.req?.headers?.["x-forwarded-for"];
      const ip = typeof fwd === "string" ? fwd.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || "unknown";
      const userAgent = ctx.req?.headers?.["user-agent"]?.substring(0, 500) ?? null;

      const [file] = await db.select({ fileName: digitalProductFiles.fileName })
        .from(digitalProductFiles)
        .where(eq(digitalProductFiles.id, input.fileId))
        .limit(1);

      await db.insert(digitalDownloadEvents).values({
        userId: ctx.user.id,
        productId: input.productId,
        fileId: input.fileId,
        purchaseId: purchase.id,
        ipAddress: ip.substring(0, 64),
        userAgent,
      });

      await db.update(digitalProducts)
        .set({ downloadCount: sql`download_count + 1` })
        .where(eq(digitalProducts.id, input.productId));

      await logPurchaseActivity(db, {
        purchaseId: purchase.id,
        eventType: "file_downloaded",
        message: `'${file?.fileName ?? `File #${input.fileId}`}' downloaded by ${ip}`,
        ipAddress: ip,
        fileId: input.fileId,
      });

      const { logIpAccess } = await import("../jobs/sharingMonitor");
      logIpAccess({ userId: ctx.user.id, ipAddress: ip, userAgent: userAgent ?? undefined, contentType: "download", contentId: input.productId }).catch(() => {});

      try {
        const { userActivityLogs } = await import("../../drizzle/schema");
        await db.insert(userActivityLogs).values({
          userId: ctx.user.id,
          eventType: "download",
          description: `Downloaded ${file?.fileName ?? `file #${input.fileId}`} (${purchase.productTitle})`,
          ipAddress: ip.substring(0, 64),
          userAgent,
          metadata: { productId: input.productId, fileId: input.fileId, purchaseId: purchase.id },
        });
      } catch { /* non-blocking */ }

      return { success: true };
    }),

  /** Create Stripe checkout session for a bundle */
  createBundleCheckout: protectedProcedure
    .input(z.object({ bundleId: z.number(), purchaseType: z.enum(["one_time", "subscription"]).default("one_time") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [bundle] = await db.select().from(digitalBundles)
        .where(eq(digitalBundles.id, input.bundleId)).limit(1);
      if (!bundle || bundle.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });

      // Check if already purchased (active access)
      const [existing] = await db.select().from(digitalBundlePurchases)
        .where(and(
          eq(digitalBundlePurchases.userId, ctx.user.id),
          eq(digitalBundlePurchases.bundleId, input.bundleId),
        )).limit(1);
      // Allow re-subscribe if subscription was cancelled
      if (existing && (existing.purchaseType === "one_time" || existing.subscriptionStatus === "active" || existing.subscriptionStatus === "trialing")) {
        return { checkoutUrl: null, alreadyPurchased: true };
      }

      // Validate subscription mode
      if (input.purchaseType === "subscription" && !bundle.subscriptionEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription billing is not enabled for this bundle" });
      }

      const Stripe = (await import("stripe")).default;
      const validatePriceId = async (priceId: string | null | undefined): Promise<string | null> => { if (!priceId) return null; try { await stripe.prices.retrieve(priceId); return priceId; } catch (e: any) { if (e?.code === "resource_missing" || e?.statusCode === 404 || (e?.message && e.message.includes("No such price"))) return null; throw e; } };
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      const origin = ctx.req.headers.origin || `https://${ctx.req.headers.host}`;
      const commonMeta = {
        type: "digital_bundle",
        bundle_id: bundle.id.toString(),
        user_id: ctx.user.id.toString(),
        customer_email: ctx.user.email ?? "",
        purchase_type: input.purchaseType,
      };

      let session;
      if (input.purchaseType === "subscription") {
        // Subscription mode — use or create a Stripe Price
        let stripePriceId = await validatePriceId(bundle.subscriptionStripePriceId);
        if (!stripePriceId) {
          // Create a recurring price on the fly
          const stripeProduct = await stripe.products.create({
            name: bundle.title,
            description: bundle.subtitle ?? undefined,
            images: bundle.thumbnailUrl ? [bundle.thumbnailUrl] : [],
          });
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(Number(bundle.subscriptionPrice) * 100),
            currency: bundle.currency,
            recurring: {
              interval: (bundle.subscriptionInterval ?? "month") as "month" | "year",
              interval_count: bundle.subscriptionIntervalCount ?? 1,
            },
          });
          stripePriceId = stripePrice.id;
          // Save the price ID for future use
          await db.update(digitalBundles)
            .set({ subscriptionStripePriceId: stripePriceId })
            .where(eq(digitalBundles.id, bundle.id));
        }
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          allow_promotion_codes: true,
          line_items: [{ price: stripePriceId, quantity: 1 }],
          metadata: commonMeta,
          subscription_data: {
            description: `${bundle.title} — Digital Bundle — Subscription — Initial`,
            metadata: { user_id: ctx.user.id.toString(), bundle_id: bundle.id.toString(), type: "digital_bundle" },
          },
          success_url: `${origin}/my-downloads?success=1`,
          cancel_url: `${origin}/bundles/${bundle.slug}`,
        });
      } else {
        // One-time payment mode
        session = await stripe.checkout.sessions.create({
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
              unit_amount: Math.round(Number(bundle.discountPrice) * 100),
            },
            quantity: 1,
          }],
          metadata: commonMeta,
          payment_intent_data: { description: `${bundle.title} — Digital Bundle — One-Time Purchase` },
          success_url: `${origin}/my-downloads?success=1`,
          cancel_url: `${origin}/bundles/${bundle.slug}`,
        });
      }

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

  /** Check if user has purchased a bundle (active access only) */
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
      if (!purchase) return { purchased: false };
      // For subscription purchases, check that the subscription is still active
      if (purchase.purchaseType === "subscription") {
        const activeStatuses = ["active", "trialing"];
        return { purchased: activeStatuses.includes(purchase.subscriptionStatus ?? "") };
      }
            // One-time purchase = permanent access
      return { purchased: true };
    }),

  // ─── Embedded Checkout Session (for /checkout/{slug}?type=download) ────────
  // NOTE: publicProcedure — guest checkout is allowed, no sign-in required.
  createEmbeddedCheckoutSession: publicProcedure
    .input(z.object({ productSlug: z.string(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.slug, input.productSlug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      if ((product as any).bundleOnly) throw new TRPCError({ code: "FORBIDDEN", message: "This product is only available as part of a bundle." });
      const userId = ctx.user?.id ?? 0;
      if (product.isFree) {
        if (userId) {
          const [existing] = await db.select().from(digitalPurchases)
            .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, product.id))).limit(1);
          if (!existing) {
            await db.insert(digitalPurchases).values({ userId, productId: product.id });
          }
        }
        return { clientSecret: null, free: true, courseTitle: product.title, courseSubtitle: product.subtitle ?? null, courseDescription: product.description ?? null, courseThumbnail: product.thumbnailUrl ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: product.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: product.currency, minSeats: null, discountPercent: null, brand: "aaus" };
      }
      if (userId) {
        const [existing] = await db.select().from(digitalPurchases)
          .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, product.id))).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "You already own this product." });
      }
      const { platformSettings } = await import("../../drizzle/schema");
      const [settings] = await db.select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl }).from(platformSettings).limit(1);
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
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
        metadata: { type: "digital_download", product_id: product.id.toString(), user_id: userId.toString(), customer_email: ctx.user?.email ?? "" },
        payment_intent_data: { description: `${product.title} — Digital Download` },
        return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=download`,
      }, { idempotencyKey: `download-embedded-${userId}-${product.id}-${new Date().toISOString().slice(0, 10)}` });
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
        displayPrice: Math.round(Number(product.price)),
        pricingType: "one_time",
        isSubscription: false,
        billingLabel: null,
        currency: product.currency,
        minSeats: null,
        discountPercent: null,
        brand: "aaus",
      };
    }),
});
// ─── Admin Router ───────────────────────────────────────────────────────────
export const downloadsAdminRouter = router({
  /** List all digital products (admin) */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db.select().from(digitalProducts).orderBy(asc(digitalProducts.libraryOrder), desc(digitalProducts.createdAt));
  }),

  /** Reorder digital products in the Education Library */
  reorder: protectedProcedure
    .input(z.object({
      products: z.array(z.object({ id: z.number(), libraryOrder: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(
        input.products.map(({ id, libraryOrder }) =>
          db.update(digitalProducts).set({ libraryOrder }).where(eq(digitalProducts.id, id))
        )
      );
      return { success: true };
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
      showInLibrary: z.boolean().optional(),
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      maxDownloadsPerFile: z.number().int().min(0).nullable().optional(),
      defaultAccessDays: z.number().int().min(0).nullable().optional(),
      memberPageBlocksAbove: z.string().nullable().optional(),
      memberPageBlocksBelow: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(digitalProducts).set(data as any).where(eq(digitalProducts.id, id));
      return { success: true };
    }),

  /** Get member access page blocks (above + below download area) for a digital product */
  getMemberPageBlocks: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select({
        id: digitalProducts.id,
        title: digitalProducts.title,
        memberPageBlocksAbove: digitalProducts.memberPageBlocksAbove,
        memberPageBlocksBelow: digitalProducts.memberPageBlocksBelow,
      }).from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        productId: product.id,
        productTitle: product.title,
        blocksAbove: product.memberPageBlocksAbove ? JSON.parse(product.memberPageBlocksAbove) : [],
        blocksBelow: product.memberPageBlocksBelow ? JSON.parse(product.memberPageBlocksBelow) : [],
      };
    }),

  /** Save member access page blocks for a digital product */
  saveMemberPageBlocks: protectedProcedure
    .input(z.object({
      productId: z.number(),
      blocksAbove: z.string(), // JSON stringified array
      blocksBelow: z.string(), // JSON stringified array
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalProducts).set({
        memberPageBlocksAbove: input.blocksAbove,
        memberPageBlocksBelow: input.blocksBelow,
      }).where(eq(digitalProducts.id, input.productId));
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
        seoTitle: digitalProducts.seoTitle,
        seoDescription: digitalProducts.seoDescription,
        seoImage: digitalProducts.seoImage,
      }).from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
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

  /** Save SEO / link preview settings for a digital product landing page */
  saveLandingPageSeo: protectedProcedure
    .input(z.object({
      productId: z.number(),
      seoTitle: z.string().nullable().optional(),
      seoDescription: z.string().nullable().optional(),
      seoImage: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalProducts)
        .set({
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          seoImage: input.seoImage ?? null,
        })
        .where(eq(digitalProducts.id, input.productId));
      return { success: true };
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

  /** Archive a digital product to trash (soft delete, purged after 30 days) */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, input.id)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(lmsArchive).values({
        itemType: "download",
        originalId: product.id,
        title: product.title,
        snapshot: JSON.stringify(product),
        deletedByUserId: ctx.user.id,
        purgeAt,
      });
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

  /**
   * Register a file that was already uploaded via /api/upload-digital-file (multipart).
   * The multipart route handles the actual S3 upload; this procedure just inserts the DB record.
   */
  registerUploadedFile: protectedProcedure
    .input(z.object({
      productId: z.number(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileKey: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
        .from(digitalProductFiles)
        .where(eq(digitalProductFiles.productId, input.productId));

      const [result] = await db.insert(digitalProductFiles).values({
        productId: input.productId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        fileSize: input.fileSize ?? 0,
        mimeType: input.mimeType ?? null,
        sortOrder: (maxOrder?.max ?? 0) + 1,
      }).$returningId();

      return { id: result.id, url: input.fileUrl, fileKey: input.fileKey };
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
      purchaseId: digitalDownloadEvents.purchaseId,
      downloadedAt: digitalDownloadEvents.downloadedAt,
      ipAddress: digitalDownloadEvents.ipAddress,
      productTitle: digitalProducts.title,
      fileName: digitalProductFiles.fileName,
      userEmail: users.email,
      userName: users.name,
    }).from(digitalDownloadEvents)
      .leftJoin(digitalProducts, eq(digitalDownloadEvents.productId, digitalProducts.id))
      .leftJoin(digitalProductFiles, eq(digitalDownloadEvents.fileId, digitalProductFiles.id))
      .leftJoin(users, eq(digitalDownloadEvents.userId, users.id))
      .orderBy(desc(digitalDownloadEvents.downloadedAt))
      .limit(50);

    return { products, recentDownloads };
  }),

  /** Dashboard: orders + downloads time series (last 30 days) */
  getAccessDashboard: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { series: [], summary: { ordersToday: 0, orders7d: 0, orders30d: 0, downloads30d: 0 } };

      const days = input?.days ?? 30;
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);

      const orderRows = await db
        .select({
          day: sql<string>`DATE(${digitalPurchases.purchasedAt})`,
          c: sql<number>`count(*)`,
        })
        .from(digitalPurchases)
        .where(gte(digitalPurchases.purchasedAt, from))
        .groupBy(sql`DATE(${digitalPurchases.purchasedAt})`);

      const downloadRows = await db
        .select({
          day: sql<string>`DATE(${digitalDownloadEvents.downloadedAt})`,
          c: sql<number>`count(*)`,
        })
        .from(digitalDownloadEvents)
        .where(gte(digitalDownloadEvents.downloadedAt, from))
        .groupBy(sql`DATE(${digitalDownloadEvents.downloadedAt})`);

      const dayMap = new Map<string, { date: string; orders: number; downloads: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, { date: key, orders: 0, downloads: 0 });
      }
      for (const r of orderRows) {
        const entry = dayMap.get(String(r.day).slice(0, 10));
        if (entry) entry.orders = Number(r.c);
      }
      for (const r of downloadRows) {
        const entry = dayMap.get(String(r.day).slice(0, 10));
        if (entry) entry.downloads = Number(r.c);
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);

      const [[ordersToday], [orders7d], [orders30d], [downloads30d]] = await Promise.all([
        db.select({ c: count() }).from(digitalPurchases).where(gte(digitalPurchases.purchasedAt, todayStart)),
        db.select({ c: count() }).from(digitalPurchases).where(gte(digitalPurchases.purchasedAt, d7)),
        db.select({ c: count() }).from(digitalPurchases).where(gte(digitalPurchases.purchasedAt, d30)),
        db.select({ c: count() }).from(digitalDownloadEvents).where(gte(digitalDownloadEvents.downloadedAt, d30)),
      ]);

      return {
        series: Array.from(dayMap.values()),
        summary: {
          ordersToday: Number(ordersToday?.c ?? 0),
          orders7d: Number(orders7d?.c ?? 0),
          orders30d: Number(orders30d?.c ?? 0),
          downloads30d: Number(downloads30d?.c ?? 0),
        },
      };
    }),

  /** List all download orders (FetchApp-style orders table) */
  listOrders: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(25),
      status: z.enum(["all", "open", "expired", "revoked", "refunded", "downloaded"]).default("all"),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { orders: [], total: 0 };

      const offset = (input.page - 1) * input.pageSize;
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.status !== "all" && input.status !== "downloaded") {
        conditions.push(eq(digitalPurchases.status, input.status));
      }
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conditions.push(or(
          like(users.email, q),
          like(users.name, q),
          like(digitalProducts.title, q),
        )!);
      }

      const purchases = await db
        .select({
          id: digitalPurchases.id,
          userId: digitalPurchases.userId,
          productId: digitalPurchases.productId,
          amount: digitalPurchases.amount,
          currency: digitalPurchases.currency,
          status: digitalPurchases.status,
          purchasedAt: digitalPurchases.purchasedAt,
          accessExpiresAt: digitalPurchases.accessExpiresAt,
          maxDownloadsPerFile: digitalPurchases.maxDownloadsPerFile,
          stripeCheckoutSessionId: digitalPurchases.stripeCheckoutSessionId,
          userName: users.name,
          userEmail: users.email,
          productTitle: digitalProducts.title,
          productSlug: digitalProducts.slug,
        })
        .from(digitalPurchases)
        .innerJoin(users, eq(users.id, digitalPurchases.userId))
        .innerJoin(digitalProducts, eq(digitalProducts.id, digitalPurchases.productId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(digitalPurchases.purchasedAt))
        .limit(input.pageSize)
        .offset(offset);

      const [totalRow] = await db
        .select({ c: count() })
        .from(digitalPurchases)
        .innerJoin(users, eq(users.id, digitalPurchases.userId))
        .innerJoin(digitalProducts, eq(digitalProducts.id, digitalPurchases.productId))
        .where(conditions.length ? and(...conditions) : undefined);

      const { formatOrderRef } = await import("../lib/downloadAccess");

      const orders = await Promise.all(purchases.map(async (p) => {
        const [dlCount] = await db
          .select({ c: count() })
          .from(digitalDownloadEvents)
          .where(eq(digitalDownloadEvents.purchaseId, p.id));
        const [fileCount] = await db
          .select({ c: count() })
          .from(digitalProductFiles)
          .where(eq(digitalProductFiles.productId, p.productId));
        const hasDownloaded = Number(dlCount?.c ?? 0) > 0;
        if (input.status === "downloaded" && !hasDownloaded) return null;
        return {
          ...p,
          orderRef: formatOrderRef(p),
          fileCount: Number(fileCount?.c ?? 0),
          downloadEventCount: Number(dlCount?.c ?? 0),
          hasDownloaded,
          displayStatus: hasDownloaded && p.status === "open" ? "downloaded" as const : p.status,
        };
      }));

      return {
        orders: orders.filter(Boolean),
        total: Number(totalRow?.c ?? 0),
      };
    }),

  /** Order detail — files with downloaded/remaining + activity log */
  getOrderDetail: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND" });

      const [purchase] = await db
        .select({
          id: digitalPurchases.id,
          userId: digitalPurchases.userId,
          productId: digitalPurchases.productId,
          amount: digitalPurchases.amount,
          currency: digitalPurchases.currency,
          status: digitalPurchases.status,
          purchasedAt: digitalPurchases.purchasedAt,
          accessExpiresAt: digitalPurchases.accessExpiresAt,
          maxDownloadsPerFile: digitalPurchases.maxDownloadsPerFile,
          stripeCheckoutSessionId: digitalPurchases.stripeCheckoutSessionId,
          stripePaymentIntentId: digitalPurchases.stripePaymentIntentId,
          userName: users.name,
          userEmail: users.email,
          productTitle: digitalProducts.title,
          productSlug: digitalProducts.slug,
          productMaxDownloads: digitalProducts.maxDownloadsPerFile,
          productDefaultAccessDays: digitalProducts.defaultAccessDays,
        })
        .from(digitalPurchases)
        .innerJoin(users, eq(users.id, digitalPurchases.userId))
        .innerJoin(digitalProducts, eq(digitalProducts.id, digitalPurchases.productId))
        .where(eq(digitalPurchases.id, input.purchaseId))
        .limit(1);

      if (!purchase) throw new TRPCError({ code: "NOT_FOUND" });

      const { getFileDownloadStatsForPurchase, formatOrderRef } = await import("../lib/downloadAccess");
      const files = await getFileDownloadStatsForPurchase(db, purchase, purchase.productMaxDownloads);

      const activity = await db
        .select()
        .from(digitalPurchaseActivity)
        .where(eq(digitalPurchaseActivity.purchaseId, input.purchaseId))
        .orderBy(desc(digitalPurchaseActivity.createdAt));

      return {
        ...purchase,
        orderRef: formatOrderRef(purchase),
        files,
        activity,
      };
    }),

  /** Update order download restrictions */
  updateOrderAccess: protectedProcedure
    .input(z.object({
      purchaseId: z.number(),
      maxDownloadsPerFile: z.number().int().min(0).nullable().optional(),
      accessExpiresAt: z.string().datetime().nullable().optional(),
      status: z.enum(["open", "expired", "revoked"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updates: Record<string, unknown> = {};
      if (input.maxDownloadsPerFile !== undefined) updates.maxDownloadsPerFile = input.maxDownloadsPerFile;
      if (input.accessExpiresAt !== undefined) {
        updates.accessExpiresAt = input.accessExpiresAt ? new Date(input.accessExpiresAt) : null;
      }
      if (input.status) updates.status = input.status;

      await db.update(digitalPurchases).set(updates).where(eq(digitalPurchases.id, input.purchaseId));

      const { logPurchaseActivity } = await import("../lib/downloadAccess");
      await logPurchaseActivity(db, {
        purchaseId: input.purchaseId,
        eventType: "access_updated",
        message: `Order access updated by admin (${ctx.user.email ?? ctx.user.id})`,
        metadata: updates,
      });

      return { success: true };
    }),

  expireOrder: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalPurchases).set({ status: "expired" }).where(eq(digitalPurchases.id, input.purchaseId));
      const { logPurchaseActivity } = await import("../lib/downloadAccess");
      await logPurchaseActivity(db, {
        purchaseId: input.purchaseId,
        eventType: "expired",
        message: `Order expired by admin (${ctx.user.email ?? ctx.user.id})`,
      });
      return { success: true };
    }),

  reopenOrder: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalPurchases).set({ status: "open" }).where(eq(digitalPurchases.id, input.purchaseId));
      const { logPurchaseActivity } = await import("../lib/downloadAccess");
      await logPurchaseActivity(db, {
        purchaseId: input.purchaseId,
        eventType: "reopened",
        message: `Order reopened by admin (${ctx.user.email ?? ctx.user.id})`,
      });
      return { success: true };
    }),

  /** Resend purchase access email */
  resendOrderEmail: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [purchase] = await db.select().from(digitalPurchases).where(eq(digitalPurchases.id, input.purchaseId)).limit(1);
      if (!purchase) throw new TRPCError({ code: "NOT_FOUND" });
      await sendPurchaseConfirmationEmail(purchase.userId, purchase.productId);
      const { logPurchaseActivity } = await import("../lib/downloadAccess");
      await logPurchaseActivity(db, {
        purchaseId: input.purchaseId,
        eventType: "email_sent",
        message: `Download email resent by admin (${ctx.user.email ?? ctx.user.id})`,
      });
      return { success: true };
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
      subscriptionEnabled: z.boolean().optional(),
      subscriptionPrice: z.number().min(0).optional(),
      subscriptionInterval: z.enum(["month", "year"]).optional(),
      subscriptionIntervalCount: z.number().min(1).max(12).optional(),
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

  /** Archive a bundle to trash (soft delete, purged after 30 days) */
  deleteBundle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(digitalBundles).where(eq(digitalBundles.id, input.id)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(lmsArchive).values({
        itemType: "bundle",
        originalId: bundle.id,
        title: bundle.title,
        snapshot: JSON.stringify(bundle),
        deletedByUserId: ctx.user.id,
        purgeAt,
      });
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
      publishDomain: z.string().max(255).nullable().optional(),
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
        // Backfill openId for existing users created without one (Thinkific imports, bulk imports).
        // Without openId the magic-link session lookup fails and the user can never log in.
        const [existingFull] = await db.select({ openId: users.openId }).from(users)
          .where(eq(users.id, userId)).limit(1);
        if (!existingFull?.openId) {
          const generatedOpenId = `email:${input.email.toLowerCase().trim()}`;
          await db.update(users).set({ openId: generatedOpenId }).where(eq(users.id, userId));
        }
      } else {
        // New user: generate a stable email-based openId so magic link login works immediately
        const openId = `email:${input.email.toLowerCase().trim()}`;
        const [inserted] = await db.insert(users).values({
          openId,
          name: input.name,
          displayName: input.name,
          email: input.email,
          role: "user",
        }).$returningId();
        userId = inserted.id;
        isNewUser = true;
        addToAllContacts(input.email, input.name, { userId, source: "purchase" }).catch(() => {});
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
          const accessToken = await getOrCreateAccessToken(userId);
          await sendDownloadAccessEmail({
            to: { name: input.name, email: input.email },
            productTitle: product.title,
            productSlug: product.slug,
            accessToken,
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
        // Backfill openId for existing users created without one (Thinkific imports, bulk imports).
        // Without openId the magic-link session lookup fails and the user can never log in.
        const [existingFull] = await db.select({ openId: users.openId }).from(users)
          .where(eq(users.id, userId)).limit(1);
        if (!existingFull?.openId) {
          const generatedOpenId = `email:${input.email.toLowerCase().trim()}`;
          await db.update(users).set({ openId: generatedOpenId }).where(eq(users.id, userId));
        }
      } else {
        // New user: generate a stable email-based openId so magic link login works immediately
        const openId = `email:${input.email.toLowerCase().trim()}`;
        const [inserted] = await db.insert(users).values({
          openId,
          name: input.name,
          displayName: input.name,
          email: input.email,
          role: "user",
        }).$returningId();
        userId = inserted.id;
        isNewUser = true;
        addToAllContacts(input.email, input.name, { userId, source: "purchase" }).catch(() => {});
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
          const accessToken = await getOrCreateAccessToken(userId);
          await sendBundleAccessEmail({
            to: { name: input.name, email: input.email },
            bundleTitle: bundle.title,
            bundleSlug: bundle.slug,
            accessToken,
          });
        } catch (e) {
          console.error("[bundle-access-email] Failed:", e);
        }
      })();
      return { purchaseId: result.id, alreadyGranted: false, isNewUser };
    }),

  /** AI-generate landing page blocks for a digital product */
  aiGenerateLandingPage: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [product] = await db.select({
        id: digitalProducts.id,
        title: digitalProducts.title,
        subtitle: digitalProducts.subtitle,
        description: digitalProducts.description,
        price: digitalProducts.price,
        isFree: digitalProducts.isFree,
        thumbnailUrl: digitalProducts.thumbnailUrl,
        slug: digitalProducts.slug,
      }).from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const priceText = product.isFree ? "Free" : product.price ? `$${Number(product.price).toFixed(2)}` : "Free";

      const systemPrompt = `You are an expert landing page designer for digital products. Generate a complete, compelling landing page block structure as JSON. The blocks should be professional, conversion-focused, and specific to the content provided. Return ONLY valid JSON, no markdown.`;
      const userPrompt = `Generate a landing page for this digital download product:

Title: ${product.title}
Subtitle: ${product.subtitle ?? ""}
Description: ${product.description ?? ""}
Price: ${priceText}
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
   buttons: [{text: "Get Access", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled"}]

2. text block — data fields:
   html: string (HTML with h2, p, ul/li tags — write compelling content about what's included, benefits, who it's for)
   bgColor: "#ffffff"

3. reviews block — data fields:
   headline: "What People Are Saying"
   bgColor: "#ffffff"
   reviews: array of 3 objects each with: name (string), text (string — realistic review), rating (number 4 or 5)

4. faq block — data fields:
   headline: "Frequently Asked Questions"
   bgColor: "#f9fafb"
   items: array of 5 objects each with: q (string — question), a (string — answer)

5. cta_standalone block — data fields:
   headline: string (urgent call to action)
   subtext: string (reassurance text)
   ctaText: "Get Instant Access"
   ctaColor: "#179ca3"
   ctaTextColor: "#ffffff"
   bgColor: "#f0fafa"
   align: "center"

Create blocks in this order: hero, text (what you get + benefits), text (about/description), reviews, faq, cta_standalone.
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
        console.error("[aiGenerateLandingPage downloads] parse error:", err?.message, "raw:", (response.choices[0]?.message?.content as string)?.slice(0, 400));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI returned invalid JSON: ${err?.message ?? "unknown error"}. Please try again.` });
      }
      const blocksJson = JSON.stringify(blocks);
      await db.update(digitalProducts)
        .set({ landingBlocks: blocksJson })
        .where(eq(digitalProducts.id, input.productId));

      return { success: true, blockCount: blocks.length };
    }),

  /** List all buyers/access holders for a digital product */
  getSalesData: protectedProcedure
    .input(z.object({
      productId: z.number(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { purchases: [], total: 0, totalRevenue: 0 };

      const offset = (input.page - 1) * input.pageSize;

      const [purchases, countResult] = await Promise.all([
        db.select({
          id: digitalPurchases.id,
          userId: digitalPurchases.userId,
          productId: digitalPurchases.productId,
          amount: digitalPurchases.amount,
          currency: digitalPurchases.currency,
          status: digitalPurchases.status,
          stripePaymentIntentId: digitalPurchases.stripePaymentIntentId,
          purchasedAt: digitalPurchases.purchasedAt,
          userName: users.name,
          userEmail: users.email,
        })
          .from(digitalPurchases)
          .leftJoin(users, eq(users.id, digitalPurchases.userId))
          .where(eq(digitalPurchases.productId, input.productId))
          .orderBy(desc(digitalPurchases.purchasedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)`, revenue: sql<number>`COALESCE(SUM(CASE WHEN ${digitalPurchases.status}='open' OR ${digitalPurchases.status}='expired' THEN COALESCE(${digitalPurchases.amount}, 0) ELSE 0 END), 0)` })
          .from(digitalPurchases)
          .where(eq(digitalPurchases.productId, input.productId)),
      ]);

      return {
        purchases,
        total: Number(countResult[0]?.count ?? 0),
        totalRevenue: Number(countResult[0]?.revenue ?? 0),
      };
    }),

  /** Revoke a user's access to a digital product */
  revokeAccess: protectedProcedure
    .input(z.object({
      purchaseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.update(digitalPurchases)
        .set({ status: "revoked" })
        .where(eq(digitalPurchases.id, input.purchaseId));

      return { success: true };
    }),

  /** Refund a digital purchase via Stripe */
  refundPurchase: protectedProcedure
    .input(z.object({
      purchaseId: z.number(),
      reason: z.string().default("requested_by_customer"),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [purchase] = await db.select().from(digitalPurchases).where(eq(digitalPurchases.id, input.purchaseId)).limit(1);
      if (!purchase) throw new Error("Purchase not found");
      if (!purchase.stripePaymentIntentId) throw new Error("No Stripe payment intent on this purchase");

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });

      const refund = await stripe.refunds.create({
        payment_intent: purchase.stripePaymentIntentId,
        reason: input.reason as any,
      });

      await db.update(digitalPurchases)
        .set({ status: "refunded" })
        .where(eq(digitalPurchases.id, input.purchaseId));

      return { refundId: refund.id, status: refund.status };
    }),

  /** List all files across all digital products — for the file_download block picker */
  listAllFiles: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(24),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { files: [], total: 0, page: 1, pageSize: 24 };
      const offset = (input.page - 1) * input.pageSize;
      const conditions = [];
      if (input.search) {
        conditions.push(
          or(
            like(digitalProductFiles.fileName, `%${input.search}%`),
            like(digitalProducts.title, `%${input.search}%`)
          )!
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const files = await db
        .select({
          id: digitalProductFiles.id,
          productId: digitalProductFiles.productId,
          productTitle: digitalProducts.title,
          fileName: digitalProductFiles.fileName,
          fileUrl: digitalProductFiles.fileUrl,
          fileKey: digitalProductFiles.fileKey,
          fileSize: digitalProductFiles.fileSize,
          mimeType: digitalProductFiles.mimeType,
          sortOrder: digitalProductFiles.sortOrder,
        })
        .from(digitalProductFiles)
        .innerJoin(digitalProducts, eq(digitalProductFiles.productId, digitalProducts.id))
        .where(where)
        .orderBy(asc(digitalProducts.libraryOrder), asc(digitalProductFiles.sortOrder))
        .limit(input.pageSize)
        .offset(offset);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(digitalProductFiles)
        .innerJoin(digitalProducts, eq(digitalProductFiles.productId, digitalProducts.id))
        .where(where);
      return { files, total: count, page: input.page, pageSize: input.pageSize };
    }),

  // ─── After Purchase Workflow ──────────────────────────────────────────────
  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db
        .select({ id: digitalProducts.id, afterPurchaseWorkflow: digitalProducts.afterPurchaseWorkflow })
        .from(digitalProducts)
        .where(eq(digitalProducts.id, input.productId))
        .limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return { afterPurchaseWorkflow: product.afterPurchaseWorkflow ?? null };
    }),

  updateAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ productId: z.number(), workflow: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalProducts)
                .set({ afterPurchaseWorkflow: input.workflow })
        .where(eq(digitalProducts.id, input.productId));
      return { success: true };
    }),
  getHidePricingOptions: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db
        .select({ id: digitalProducts.id, hidePricingOptions: digitalProducts.hidePricingOptions })
        .from(digitalProducts)
        .where(eq(digitalProducts.id, input.productId))
        .limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return { hidePricingOptions: product.hidePricingOptions ?? false };
    }),
  updateHidePricingOptions: protectedProcedure
    .input(z.object({ productId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalProducts)
        .set({ hidePricingOptions: input.hidePricingOptions })
        .where(eq(digitalProducts.id, input.productId));
      return { success: true };
    }),
  // ─── Bundle After Purchase Workflow + Hide Pricing Options ─────────────────────────────────
  getBundleAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db
        .select({ id: digitalBundles.id, afterPurchaseWorkflow: digitalBundles.afterPurchaseWorkflow })
        .from(digitalBundles)
        .where(eq(digitalBundles.id, input.bundleId))
        .limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      return { afterPurchaseWorkflow: bundle.afterPurchaseWorkflow ?? null };
    }),
  updateBundleAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ bundleId: z.number(), workflow: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalBundles)
        .set({ afterPurchaseWorkflow: input.workflow })
        .where(eq(digitalBundles.id, input.bundleId));
      return { success: true };
    }),
  getBundleHidePricingOptions: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db
        .select({ id: digitalBundles.id, hidePricingOptions: digitalBundles.hidePricingOptions })
        .from(digitalBundles)
        .where(eq(digitalBundles.id, input.bundleId))
        .limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      return { hidePricingOptions: bundle.hidePricingOptions ?? false };
    }),
  updateBundleHidePricingOptions: protectedProcedure
    .input(z.object({ bundleId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(digitalBundles)
        .set({ hidePricingOptions: input.hidePricingOptions })
        .where(eq(digitalBundles.id, input.bundleId));
      return { success: true };
    }),
  // ─── Checkout Page Config ──────────────────────────────────────────────────
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select({ checkoutPageConfig: digitalProducts.checkoutPageConfig })
        .from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: product.checkoutPageConfig ?? null };
    }),

  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({ productId: z.number(), config: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.config); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" }); }
      await db.update(digitalProducts).set({ checkoutPageConfig: input.config }).where(eq(digitalProducts.id, input.productId));
      return { success: true };
    }),

  // ─── Embedded Checkout Session ────────────────────────────────────────────
  createEmbeddedCheckoutSession: protectedProcedure
    .input(z.object({ productSlug: z.string(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select().from(digitalProducts)
        .where(eq(digitalProducts.slug, input.productSlug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      if ((product as any).bundleOnly) throw new TRPCError({ code: "FORBIDDEN", message: "This product is only available as part of a bundle." });
      if (product.isFree) {
        // Auto-grant free product
        const [existing] = await db.select().from(digitalPurchases)
          .where(and(eq(digitalPurchases.userId, ctx.user.id), eq(digitalPurchases.productId, product.id))).limit(1);
        if (!existing) {
          await db.insert(digitalPurchases).values({ userId: ctx.user.id, productId: product.id });
        }
        return { clientSecret: null, free: true, courseTitle: product.title, courseSubtitle: product.subtitle ?? null, courseDescription: product.description ?? null, courseThumbnail: product.thumbnailUrl ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: product.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: product.currency, minSeats: null, discountPercent: null, brand: "aaus" };
      }
      const [existing] = await db.select().from(digitalPurchases)
        .where(and(eq(digitalPurchases.userId, ctx.user.id), eq(digitalPurchases.productId, product.id))).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You already own this product." });
      // Fetch platform settings for terms/privacy URLs
      const { platformSettings } = await import("../../drizzle/schema");
      const [settings] = await db.select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl }).from(platformSettings).limit(1);
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
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
        metadata: { type: "digital_download", product_id: product.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "" },
        payment_intent_data: { description: `${product.title} — Digital Download` },
        return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=download`,
      }, { idempotencyKey: `download-embedded-${ctx.user.id}-${product.id}-${new Date().toISOString().slice(0, 10)}` });
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
        displayPrice: Math.round(Number(product.price)),
        pricingType: "one_time",
        isSubscription: false,
        billingLabel: null,
        currency: product.currency,
        minSeats: null,
        discountPercent: null,
        brand: "aaus",
      };
    }),
});

// ─── Public: checkout page config for download products ───────────────────────
export const downloadsCheckoutPublicRouter = router({
  getPublicCheckoutPageConfig: publicProcedure
    .input(z.object({ productSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [product] = await db.select({
        checkoutPageConfig: digitalProducts.checkoutPageConfig,
        id: digitalProducts.id,
        title: digitalProducts.title,
        description: digitalProducts.description,
      }).from(digitalProducts).where(eq(digitalProducts.slug, input.productSlug)).limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        config: product.checkoutPageConfig ?? null,
        courseStats: { totalLessons: 0, totalSections: 0, hasCertificate: false },
      };
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

  const appUrl = 'https://app.allaboutultrasound.com';
  const filesPath = `/downloads/${product.slug}/files`;
  const filesUrl = `${appUrl}${filesPath}`;

  // Generate a persistent auto-login token so the button logs them in automatically
  let accessUrl = filesUrl;
  try {
    const { generateAutoLoginToken } = await import('../routes/autoLogin');
    const token = await generateAutoLoginToken(userId, filesUrl);
    accessUrl = `${appUrl}/api/auth/auto-login?token=${token}&host=${encodeURIComponent(new URL(appUrl).hostname)}`;
  } catch (tokenErr) {
    console.error(`[sendPurchaseConfirmationEmail] Failed to generate auto-login token for user ${userId}:`, tokenErr);
  }

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
            <a href="${accessUrl}" style="display:inline-block;background:linear-gradient(135deg,#189aa1,#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Access Your Files</a>
          </div>
          <p style="margin:4px 0 16px;font-size:12px;color:#94a3b8;text-align:center;">This link signs you in automatically — no password needed.</p>
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
    previewText: `Your download "${product.title}" is ready — click to access your files instantly.`,
  });
  console.log(`[sendPurchaseConfirmationEmail] Sent access email to ${user.email} for product ${productId} (auto-login: ${accessUrl !== filesUrl ? 'yes' : 'no'})`);
}
