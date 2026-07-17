import { getStripeClient } from "../lib/stripeClient";
/**
 * bundleRouter.ts — Bundles: sell multiple items as one package
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import {
  bundles, bundleItems, bundleEnrollments, users,
  lmsCourses, lmsEnrollments, lmsQuizzes, digitalBundlePurchases,
  digitalProducts, physicalProducts, webinars, sonoQuizzes, communities,
  bundlePricingOptions,
} from "../../drizzle/schema";

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
async function assertAdmin(ctx: any) { if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); }
async function uniqueSlug(db: any, base: string) {
  let slug = base, i = 0;
  while (true) {
    const [ex] = await db.select({ id: bundles.id }).from(bundles).where(eq(bundles.slug, slug)).limit(1);
    if (!ex) return slug;
    slug = `${base}-${++i}`;
  }
}

export const bundlePublicRouter = router({
  list: publicProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().max(50).default(12), search: z.string().optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) return { bundles: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.limit ?? 12, offset = (page-1)*limit;
      const conds: any[] = [eq(bundles.status, "published")];
      if (input?.search) conds.push(sql`${bundles.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.brand) conds.push(eq(bundles.brand, input.brand));
      const [rows, cnt] = await Promise.all([
        db.select().from(bundles).where(and(...conds)).orderBy(desc(bundles.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bundles).where(and(...conds)),
      ]);
      return { bundles: rows, total: cnt[0]?.count ?? 0 };
    }),

  getIncludedItems: publicProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select({ id: bundles.id, title: bundles.title, slug: bundles.slug }).from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id)).orderBy(asc(bundleItems.sortOrder));
      const enrichedItems = await Promise.all(items.map(async (item) => {
        let itemTitle: string | null = null, itemSlug: string | null = null, itemCoverImage: string | null = null, itemDescription: string | null = null;
        try {
          if (item.itemType === "course" || item.itemType === "quiz" || item.itemType === "cohort" || item.itemType === "workshop") {
            const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, coverImageUrl: lmsCourses.coverImageUrl, description: lmsCourses.description }).from(lmsCourses).where(eq(lmsCourses.id, item.itemId)).limit(1);
            itemTitle = c?.title ?? null; itemSlug = c?.slug ?? null; itemCoverImage = c?.coverImageUrl ?? null; itemDescription = c?.description ?? null;
          } else if (item.itemType === "download") {
            const [d] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug, thumbnailUrl: digitalProducts.thumbnailUrl, description: digitalProducts.description }).from(digitalProducts).where(eq(digitalProducts.id, item.itemId)).limit(1);
            itemTitle = d?.title ?? null; itemSlug = d?.slug ?? null; itemCoverImage = d?.thumbnailUrl ?? null; itemDescription = d?.description ?? null;
          } else if (item.itemType === "webinar") {
            const [w] = await db.select({ title: webinars.title, slug: webinars.slug, coverImage: webinars.coverImage }).from(webinars).where(eq(webinars.id, item.itemId)).limit(1);
            itemTitle = w?.title ?? null; itemSlug = w?.slug ?? null; itemCoverImage = w?.coverImage ?? null;
          } else if (item.itemType === "community") {
            const [cm] = await db.select({ title: communities.title, slug: communities.slug, coverImage: communities.coverImage }).from(communities).where(eq(communities.id, item.itemId)).limit(1);
            itemTitle = cm?.title ?? null; itemSlug = cm?.slug ?? null; itemCoverImage = cm?.coverImage ?? null;
          }
        } catch {}
        return { ...item, itemTitle, itemSlug, itemCoverImage, itemDescription };
      }));
      return { bundle, items: enrichedItems };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(bundles).where(eq(bundles.slug, input.slug)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const isAdmin = (ctx.user as any)?.role === "admin";
      if (bundle.status !== "published" && !input.preview && !isAdmin) throw new TRPCError({ code: "NOT_FOUND" });
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id)).orderBy(asc(bundleItems.sortOrder));
      // Enrich items with titles from their respective tables
      const enrichedItems = await Promise.all(items.map(async (item) => {
        let itemTitle = "";
        let itemSlug = "";
        try {
          if (item.itemType === "course") {
            const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, item.itemId)).limit(1);
            itemTitle = c?.title || "";
            itemSlug = c?.slug || "";
          } else if (item.itemType === "download") {
            const [d] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug }).from(digitalProducts).where(eq(digitalProducts.id, item.itemId)).limit(1);
            itemTitle = d?.title || "";
            itemSlug = d?.slug || "";
          } else if (item.itemType === "product") {
            const [p] = await db.select({ title: physicalProducts.title, slug: physicalProducts.slug }).from(physicalProducts).where(eq(physicalProducts.id, item.itemId)).limit(1);
            itemTitle = p?.title || "";
            itemSlug = p?.slug || "";
          } else if (item.itemType === "webinar") {
            const [w] = await db.select({ title: webinars.title, slug: webinars.slug }).from(webinars).where(eq(webinars.id, item.itemId)).limit(1);
            itemTitle = w?.title || "";
            itemSlug = w?.slug || "";
          } else if (item.itemType === "quiz") {
            const [q] = await db.select({ title: sonoQuizzes.title }).from(sonoQuizzes).where(eq(sonoQuizzes.id, item.itemId)).limit(1);
            itemTitle = q?.title || "";
          }
        } catch {}
        return { ...item, itemTitle, itemSlug };
      }));
      let isEnrolled = false;
      if ((ctx.user as any)?.id) {
        const [enr] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
          .where(and(eq(bundleEnrollments.bundleId, bundle.id), eq(bundleEnrollments.userId, (ctx.user as any).id))).limit(1);
        isEnrolled = !!enr;
      }
      return { bundle, items: enrichedItems, isEnrolled };
    }),
});

export const bundleLearnerRouter = router({
  enroll: protectedProcedure
    .input(z.object({ bundleId: z.number(), pricingOptionId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const [ex] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
        .where(and(eq(bundleEnrollments.bundleId, input.bundleId), eq(bundleEnrollments.userId, ctx.user.id))).limit(1);
      if (!ex) {
        await db.insert(bundleEnrollments).values({ bundleId: input.bundleId, userId: ctx.user.id, pricingOptionId: input.pricingOptionId });
        // Auto-enroll in all contained courses
        const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
        for (const item of items) {
          if (item.itemType === "course") {
            const [courseEnr] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.courseId, item.itemId), eq(lmsEnrollments.userId, ctx.user.id))).limit(1);
            if (!courseEnr) {
              await db.insert(lmsEnrollments).values({ courseId: item.itemId, userId: ctx.user.id, source: "bundle" });
            }
          }
        }
      }
      return { success: true };
    }),

  createCheckout: publicProcedure
    .input(z.object({ bundleId: z.number(), pricingOptionId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ?? 0;
      const userEmail = ctx.user?.email ?? undefined;
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [bundle] = await db.select().from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      // If free bundle, just enroll directly (requires login)
      if (bundle.accessType === "free") {
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to enroll in this free bundle." });
        const [ex] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
          .where(and(eq(bundleEnrollments.bundleId, input.bundleId), eq(bundleEnrollments.userId, userId))).limit(1);
        if (ex) return { alreadyEnrolled: true, checkoutUrl: null };
        await db.insert(bundleEnrollments).values({ bundleId: input.bundleId, userId, pricingOptionId: input.pricingOptionId });
        // Auto-enroll in courses
        const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
        for (const item of items) {
          if (item.itemType === "course") {
            const [courseEnr] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.courseId, item.itemId), eq(lmsEnrollments.userId, userId))).limit(1);
            if (!courseEnr) await db.insert(lmsEnrollments).values({ courseId: item.itemId, userId, source: "bundle" });
          }
        }
        (await import("../_core/notification")).notifyOwner({
          title: `🎁 Free Bundle Enrollment`,
          content: `User ${userId} (${userEmail}) enrolled in free bundle: ${bundle.title} (ID: ${input.bundleId}).`,
        }).catch(() => {});
        return { alreadyEnrolled: false, checkoutUrl: null, enrolled: true };
      }
      // Paid bundle — create Stripe Checkout (guest checkout allowed)
      if (userId) {
        const [ex] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
          .where(and(eq(bundleEnrollments.bundleId, input.bundleId), eq(bundleEnrollments.userId, userId))).limit(1);
        if (ex) return { alreadyEnrolled: true, checkoutUrl: null };
      }
      // Parse pricing options — prefer structured table, fall back to legacy JSON column
      const structuredOpts = await db.select().from(bundlePricingOptions)
        .where(and(eq(bundlePricingOptions.bundleId, input.bundleId), eq(bundlePricingOptions.isActive, true)))
        .orderBy(asc(bundlePricingOptions.sortOrder), asc(bundlePricingOptions.id));

      let selectedOption: any;
      let isStructured = false;

      if (structuredOpts.length > 0) {
        isStructured = true;
        const optId = input.pricingOptionId ? parseInt(input.pricingOptionId) : null;
        selectedOption = optId
          ? structuredOpts.find(o => o.id === optId)
          : structuredOpts[0];
      } else {
        // Legacy JSON fallback
        let pricingOptions: any[] = [];
        try { pricingOptions = JSON.parse(bundle.pricingOptions || "[]"); } catch {}
        selectedOption = input.pricingOptionId
          ? pricingOptions.find((p: any) => p.id === input.pricingOptionId)
          : pricingOptions[0];
        if (!selectedOption && pricingOptions.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No pricing options configured for this bundle" });
        }
      }

      if (!selectedOption) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pricing option not found" });
      }

      // Normalize price: structured table stores cents, legacy JSON stores dollars
      const price = isStructured ? (selectedOption.price / 100) : (selectedOption.price ?? 0);

      if (price <= 0 || selectedOption.pricingType === "free") {
        // Free pricing option — enroll directly
        await db.insert(bundleEnrollments).values({ bundleId: input.bundleId, userId: ctx.user.id, pricingOptionId: input.pricingOptionId });
        const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
        for (const item of items) {
          if (item.itemType === "course") {
            const [courseEnr] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.courseId, item.itemId), eq(lmsEnrollments.userId, ctx.user.id))).limit(1);
            if (!courseEnr) await db.insert(lmsEnrollments).values({ courseId: item.itemId, userId: ctx.user.id, source: "bundle" });
          }
        }
        (await import("../_core/notification")).notifyOwner({
          title: `🎁 Free Bundle Enrollment (Free Pricing Option)`,
          content: `User ${ctx.user.id} (${ctx.user.email}) enrolled in bundle: ${bundle.title} (ID: ${input.bundleId}) via free pricing option.`,
        }).catch(() => {});
        return { alreadyEnrolled: false, checkoutUrl: null, enrolled: true };
      }
      const stripe = getStripeClient();
      const origin = ctx.req.headers.origin || "https://app.allaboutultrasound.com";
      const isSubscription = isStructured
        ? selectedOption.pricingType === "subscription"
        : selectedOption?.type === "subscription";

      // ── 100% promo intercept for bundles ──────────────────────────────────
      if (input.promoCode && !isSubscription) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) {
            const coupon = promoCodes.data[0].coupon as any;
            const priceCents = Math.round(price * 100);
            const discountedCents = coupon.percent_off === 100 ? 0 : coupon.amount_off ? Math.max(0, priceCents - coupon.amount_off) : priceCents;
            if (discountedCents === 0) {
              if (userId) {
                await db.insert(bundleEnrollments).values({ bundleId: input.bundleId, userId, pricingOptionId: input.pricingOptionId });
                const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
                for (const item of items) {
                  if (item.itemType === "course") {
                    const [courseEnr] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
                      .where(and(eq(lmsEnrollments.courseId, item.itemId), eq(lmsEnrollments.userId, userId))).limit(1);
                    if (!courseEnr) await db.insert(lmsEnrollments).values({ courseId: item.itemId, userId, source: "bundle" });
                  }
                }
              }
              (await import("../_core/notification")).notifyOwner({
                title: `🎉 Bundle Enrolled via 100% Promo`,
                content: `User ${userId} (${userEmail}) enrolled in bundle: ${bundle.title} (ID: ${input.bundleId}) using 100% promo code.`,
              }).catch(() => {});
              return { alreadyEnrolled: false, checkoutUrl: null, enrolled: true };
            }
          }
        } catch { /* ignore — checkout still works without promo */ }
      }

      // Resolve subscription interval for structured options
      const subIntervalMap: Record<string, string> = { monthly: "month", quarterly: "month", annual: "year" };
      const subInterval = isStructured
        ? (subIntervalMap[selectedOption.subscriptionInterval ?? "monthly"] ?? "month")
        : (selectedOption?.interval || "month");
      const subIntervalCount = isStructured && selectedOption.subscriptionInterval === "quarterly" ? 3 : 1;

      // Use explicit Stripe Price ID if provided
      const explicitStripePriceId = isStructured ? (selectedOption.stripePriceId ?? null) : null;

      const lineItem = explicitStripePriceId
        ? { price: explicitStripePriceId, quantity: 1 }
        : {
            price_data: {
              currency: "usd",
              product_data: { name: bundle.title, description: `Bundle: ${bundle.title}` },
              unit_amount: Math.round(price * 100),
              ...(isSubscription ? { recurring: { interval: subInterval, ...(subIntervalCount > 1 ? { interval_count: subIntervalCount } : {}) } } : {}),
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: isSubscription ? "subscription" : "payment",
        customer_email: userEmail,
        client_reference_id: userId ? userId.toString() : undefined,
        allow_promotion_codes: true,
        ...(bundle.collectShippingAddress ? { shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "AU", "NZ", "IE"] } } : {}),
        metadata: {
          user_id: userId ? userId.toString() : "",
          bundle_id: input.bundleId.toString(),
          pricing_option_id: input.pricingOptionId || "",
          purchase_type: "bundle_purchase",
        },
        ...(isSubscription
          ? { subscription_data: { description: `${bundle.title} — Bundle — Subscription — Initial`, metadata: { user_id: userId ? userId.toString() : "", bundle_id: input.bundleId.toString() } } }
          : { payment_intent_data: { description: `${bundle.title} — Bundle — One-Time Purchase` } }),
        line_items: [lineItem],
        success_url: `${origin}/bundles/${bundle.slug}?success=1`,
        cancel_url: `${origin}/bundles/${bundle.slug}?cancelled=1`,
        ...(isSubscription ? {} : { payment_intent_data: { metadata: { user_id: userId ? userId.toString() : "", bundle_id: input.bundleId.toString(), purchase_type: "bundle_purchase" } } }),
      }, { idempotencyKey: `bundle-checkout-${userId}-${input.bundleId}-${input.pricingOptionId ?? 0}-${new Date().toISOString().slice(0, 10)}` });
      return { alreadyEnrolled: false, checkoutUrl: session.url, enrolled: false };
    }),

  myBundles: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); if (!db) return [];
    const enrollments = await db.select({ bundleId: bundleEnrollments.bundleId, enrolledAt: bundleEnrollments.enrolledAt })
      .from(bundleEnrollments).where(eq(bundleEnrollments.userId, ctx.user.id));
    if (!enrollments.length) return [];
    const bundleIds = enrollments.map(e => e.bundleId);
    const bundleRows = await db.select().from(bundles).where(sql`${bundles.id} IN (${bundleIds.join(",")})`);
    return bundleRows;
  }),
});

export const bundleAdminRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().max(200).default(20), search: z.string().optional(), status: z.enum(["draft","published"]).optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { bundles: [], total: 0 };
      const page = input?.page ?? 1, limit = input?.pageSize ?? 20, offset = (page-1)*limit;
      const conds: any[] = [];
      if (input?.search) conds.push(sql`${bundles.title} LIKE ${"%" + input.search + "%"}`);
      if (input?.status) conds.push(eq(bundles.status, input.status));
      if (input?.brand) conds.push(eq(bundles.brand, input.brand));
      const where = conds.length ? and(...conds) : undefined;
      const [rows, cnt] = await Promise.all([
        db.select().from(bundles).where(where).orderBy(desc(bundles.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bundles).where(where),
      ]);
      return { bundles: rows, total: cnt[0]?.count ?? 0 };
    }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [bundle] = await db.select().from(bundles).where(eq(bundles.id, input.id)).limit(1);
    if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
    const rawItems = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.id)).orderBy(asc(bundleItems.sortOrder));
    const items = await Promise.all(rawItems.map(async (item) => {
      let itemTitle: string | null = null, itemSlug: string | null = null, itemCoverImage: string | null = null;
      try {
        if (item.itemType === "course" || item.itemType === "cohort") {
          const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, img: lmsCourses.coverImageUrl }).from(lmsCourses).where(eq(lmsCourses.id, item.itemId)).limit(1);
          if (c) { itemTitle = c.title; itemSlug = c.slug; itemCoverImage = c.img ?? null; }
        } else if (item.itemType === "quiz") {
          const [q] = await db.select({ title: sonoQuizzes.title }).from(sonoQuizzes).where(eq(sonoQuizzes.id, item.itemId)).limit(1);
          if (q) { itemTitle = q.title; }
        } else if (item.itemType === "download") {
          const [d] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug, img: digitalProducts.thumbnailUrl }).from(digitalProducts).where(eq(digitalProducts.id, item.itemId)).limit(1);
          if (d) { itemTitle = d.title; itemSlug = d.slug; itemCoverImage = d.img ?? null; }
        } else if (item.itemType === "product") {
          const [p] = await db.select({ title: physicalProducts.title, slug: physicalProducts.slug }).from(physicalProducts).where(eq(physicalProducts.id, item.itemId)).limit(1);
          if (p) { itemTitle = p.title; itemSlug = p.slug; }
        } else if (item.itemType === "webinar") {
          const [w] = await db.select({ title: webinars.title, slug: webinars.slug, img: webinars.coverImage }).from(webinars).where(eq(webinars.id, item.itemId)).limit(1);
          if (w) { itemTitle = w.title; itemSlug = w.slug; itemCoverImage = w.img ?? null; }
        } else if (item.itemType === "community") {
          const [cm] = await db.select({ title: communities.title, slug: communities.slug, img: communities.coverImage }).from(communities).where(eq(communities.id, item.itemId)).limit(1);
          if (cm) { itemTitle = cm.title; itemSlug = cm.slug; itemCoverImage = cm.img ?? null; }
        }
      } catch {}
      return { ...item, itemTitle, itemSlug, itemCoverImage };
    }));
    return { bundle, items };
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(255), brand: z.enum(["all_about_ultrasound","iheartecho"]).default("all_about_ultrasound"), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = await uniqueSlug(db, slugify(input.title));
      const [ins] = await db.insert(bundles).values({ title: input.title, slug, brand: input.brand, description: input.description }).$returningId();
      return { id: ins.id, slug };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(), title: z.string().optional(), brand: z.enum(["all_about_ultrasound","iheartecho"]).optional(),
      status: z.enum(["draft","published"]).optional(), description: z.string().optional(),
      coverImage: z.string().optional(), accessType: z.enum(["free","paid"]).optional(),
      pricingOptions: z.string().optional(), landingPageBlocks: z.string().optional(),
      // Structured pricing fields
      pricingType: z.enum(["free","one_time","subscription","payment_plan","trial_then_subscription"]).optional(),
      price: z.number().optional(),
      isFree: z.boolean().optional(),
      subscriptionInterval: z.enum(["monthly","quarterly","annual"]).nullable().optional(),
      trialDays: z.number().nullable().optional(),
      downPayment: z.number().nullable().optional(),
      installmentCount: z.number().nullable().optional(),
      installmentAmount: z.number().nullable().optional(),
      installmentIntervalDays: z.number().nullable().optional(),
      subtitle: z.string().optional(),
      slug: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      publishDomain: z.string().optional(),
      collectShippingAddress: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const upd: any = {};
      Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) upd[k] = v; });
      if (Object.keys(upd).length) await db.update(bundles).set(upd).where(eq(bundles.id, id));
      return { success: true };
    }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(bundleItems).where(eq(bundleItems.bundleId, input.id));
    await db.delete(bundleEnrollments).where(eq(bundleEnrollments.bundleId, input.id));
    await db.delete(bundles).where(eq(bundles.id, input.id));
    return { success: true };
  }),

  addItem: protectedProcedure
    .input(z.object({ bundleId: z.number(), itemType: z.enum(["course","quiz","download","product","webinar"]), itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ex] = await db.select({ id: bundleItems.id }).from(bundleItems)
        .where(and(eq(bundleItems.bundleId, input.bundleId), eq(bundleItems.itemType, input.itemType), eq(bundleItems.itemId, input.itemId))).limit(1);
      if (!ex) {
        const [maxOrder] = await db.select({ max: sql<number>`MAX(sort_order)` }).from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
        await db.insert(bundleItems).values({ bundleId: input.bundleId, itemType: input.itemType, itemId: input.itemId, sortOrder: (maxOrder?.max ?? 0) + 1 });
      }
      return { success: true };
    }),

  removeItem: protectedProcedure.input(z.object({ itemId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(bundleItems).where(eq(bundleItems.id, input.itemId));
    return { success: true };
  }),

  reorderItems: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (const item of input.items) await db.update(bundleItems).set({ sortOrder: item.sortOrder }).where(eq(bundleItems.id, item.id));
      return { success: true };
    }),

  getEnrollments: protectedProcedure
    .input(z.object({ bundleId: z.number(), page: z.number().default(1), pageSize: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return { enrollments: [], total: 0 };
      const offset = (input.page-1)*input.pageSize;
      const [rows, cnt] = await Promise.all([
        db.select({ id: bundleEnrollments.id, userId: bundleEnrollments.userId, enrolledAt: bundleEnrollments.enrolledAt, userName: users.name, userEmail: users.email })
          .from(bundleEnrollments).leftJoin(users, eq(bundleEnrollments.userId, users.id))
          .where(eq(bundleEnrollments.bundleId, input.bundleId)).orderBy(desc(bundleEnrollments.enrolledAt)).limit(input.pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(bundleEnrollments).where(eq(bundleEnrollments.bundleId, input.bundleId)),
      ]);
      return { enrollments: rows, total: cnt[0]?.count ?? 0 };
    }),

  getSalesData: protectedProcedure
    .input(z.object({ bundleId: z.number(), page: z.number().min(1).default(1), pageSize: z.number().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { purchases: [], total: 0, totalRevenue: 0 };
      const offset = (input.page - 1) * input.pageSize;
      const [purchases, countResult] = await Promise.all([
        db.select({
          id: digitalBundlePurchases.id,
          userId: digitalBundlePurchases.userId,
          bundleId: digitalBundlePurchases.bundleId,
          amount: digitalBundlePurchases.amount,
          currency: digitalBundlePurchases.currency,
          status: digitalBundlePurchases.status,
          stripePaymentIntentId: digitalBundlePurchases.stripePaymentIntentId,
          createdAt: digitalBundlePurchases.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
          .from(digitalBundlePurchases)
          .leftJoin(users, eq(users.id, digitalBundlePurchases.userId))
          .where(eq(digitalBundlePurchases.bundleId, input.bundleId))
          .orderBy(desc(digitalBundlePurchases.createdAt))
          .limit(input.pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)`, revenue: sql<number>`COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0)` })
          .from(digitalBundlePurchases).where(eq(digitalBundlePurchases.bundleId, input.bundleId)),
      ]);
      return { purchases, total: Number(countResult[0]?.count ?? 0), totalRevenue: Number(countResult[0]?.revenue ?? 0) };
    }),

  refundPurchase: protectedProcedure
    .input(z.object({ purchaseId: z.number(), reason: z.string().default("requested_by_customer") }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [purchase] = await db.select().from(digitalBundlePurchases).where(eq(digitalBundlePurchases.id, input.purchaseId)).limit(1);
      if (!purchase) throw new TRPCError({ code: "NOT_FOUND" });
      if (!purchase.stripePaymentIntentId) throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe payment intent" });
      const stripe = getStripeClient();
      const refund = await stripe.refunds.create({ payment_intent: purchase.stripePaymentIntentId, reason: input.reason as any });
      await db.update(digitalBundlePurchases).set({ status: "refunded" }).where(eq(digitalBundlePurchases.id, input.purchaseId));
      return { refundId: refund.id, status: refund.status };
    }),

  revokeAccess: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(bundleEnrollments).where(eq(bundleEnrollments.id, input.enrollmentId));
      return { success: true };
    }),

  getAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ afterPurchaseWorkflow: bundles.afterPurchaseWorkflow }).from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return { afterPurchaseWorkflow: row.afterPurchaseWorkflow };
    }),
  updateAfterPurchaseWorkflow: protectedProcedure
    .input(z.object({ bundleId: z.number(), workflow: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(bundles).set({ afterPurchaseWorkflow: input.workflow }).where(eq(bundles.id, input.bundleId));
      return { success: true };
    }),
  getHidePricingOptions: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ hidePricingOptions: bundles.hidePricingOptions }).from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return { hidePricingOptions: !!row.hidePricingOptions };
    }),
  updateHidePricingOptions: protectedProcedure
    .input(z.object({ bundleId: z.number(), hidePricingOptions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(bundles).set({ hidePricingOptions: input.hidePricingOptions ? 1 : 0 }).where(eq(bundles.id, input.bundleId));
      return { success: true };
    }),
  getCheckoutPageConfig: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ landingPageBlocks: bundles.landingPageBlocks }).from(bundles).where(eq(bundles.id, input.bundleId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return { config: row.landingPageBlocks ?? null };
    }),
  saveCheckoutPageConfig: protectedProcedure
    .input(z.object({ bundleId: z.number(), config: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.config); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON" }); }
      await db.update(bundles).set({ landingPageBlocks: input.config }).where(eq(bundles.id, input.bundleId));
      return { success: true };
    }),
  // ─── Bundle Pricing Options CRUD ───────────────────────────────────────────────────────────────────────
  listPricingOptions: protectedProcedure
    .input(z.object({ bundleId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) return [];
      return db.select().from(bundlePricingOptions)
        .where(eq(bundlePricingOptions.bundleId, input.bundleId))
        .orderBy(asc(bundlePricingOptions.sortOrder), asc(bundlePricingOptions.id));
    }),

  createPricingOption: protectedProcedure
    .input(z.object({
      bundleId: z.number(),
      label: z.string().min(1),
      sublabel: z.string().optional(),
      pricingType: z.enum(["one_time", "subscription", "payment_plan", "free"]),
      price: z.number().default(0),
      stripePriceId: z.string().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      downPayment: z.number().optional(),
      installmentCount: z.number().optional(),
      installmentAmount: z.number().optional(),
      installmentIntervalDays: z.number().optional(),
      ctaLabel: z.string().optional(),
      ctaUrl: z.string().optional(),
      isActive: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const priceCents = Math.round((input.price ?? 0) * 100);
      const [res] = await db.insert(bundlePricingOptions).values({
        bundleId: input.bundleId,
        label: input.label,
        sublabel: input.sublabel ?? null,
        pricingType: input.pricingType,
        price: priceCents,
        stripePriceId: input.stripePriceId ?? null,
        subscriptionInterval: input.subscriptionInterval ?? null,
        downPayment: input.downPayment != null ? Math.round(input.downPayment * 100) : 0,
        installmentCount: input.installmentCount ?? 0,
        installmentAmount: input.installmentAmount != null ? Math.round(input.installmentAmount * 100) : 0,
        installmentIntervalDays: input.installmentIntervalDays ?? 30,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      });
      return { id: (res as any).insertId };
    }),

  updatePricingOption: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().min(1).optional(),
      sublabel: z.string().nullable().optional(),
      pricingType: z.enum(["one_time", "subscription", "payment_plan", "free"]).optional(),
      price: z.number().optional(),
      stripePriceId: z.string().nullable().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      downPayment: z.number().nullable().optional(),
      installmentCount: z.number().nullable().optional(),
      installmentAmount: z.number().nullable().optional(),
      installmentIntervalDays: z.number().nullable().optional(),
      ctaLabel: z.string().nullable().optional(),
      ctaUrl: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, price, downPayment, installmentAmount, ...rest } = input;
      const patch: any = { ...rest };
      if (price != null) patch.price = Math.round(price * 100);
      if (downPayment != null) patch.downPayment = Math.round(downPayment * 100);
      if (installmentAmount != null) patch.installmentAmount = Math.round(installmentAmount * 100);
      await db.update(bundlePricingOptions).set(patch).where(eq(bundlePricingOptions.id, id));
      return { success: true };
    }),

  deletePricingOption: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(bundlePricingOptions).where(eq(bundlePricingOptions.id, input.id));
      return { success: true };
    }),

  reorderPricingOptions: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.orderedIds.map((id, idx) =>
        db.update(bundlePricingOptions).set({ sortOrder: idx }).where(eq(bundlePricingOptions.id, id))
      ));
      return { success: true };
    }),

  listAvailableItems: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return { courses: [], downloads: [], products: [], webinars: [], quizzes: [] };
    const [courses, downloads, products, webinarRows, quizzes] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, type: lmsCourses.type, status: lmsCourses.status }).from(lmsCourses).where(eq(lmsCourses.status, "public")).orderBy(desc(lmsCourses.createdAt)),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, status: digitalProducts.status }).from(digitalProducts).orderBy(desc(digitalProducts.createdAt)),
      db.select({ id: physicalProducts.id, title: physicalProducts.title, status: physicalProducts.status }).from(physicalProducts).orderBy(desc(physicalProducts.createdAt)),
      db.select({ id: webinars.id, title: webinars.title, status: webinars.status }).from(webinars).orderBy(desc(webinars.createdAt)),
      db.select({ id: sonoQuizzes.id, title: sonoQuizzes.title, status: sonoQuizzes.status }).from(sonoQuizzes).orderBy(desc(sonoQuizzes.createdAt)),
    ]);
    return { courses, downloads, products, webinars: webinarRows, quizzes };
  }),
});
