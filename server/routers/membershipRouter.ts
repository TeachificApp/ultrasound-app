import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  membershipPlans,
  membershipPlanAccess,
  membershipSubscriptions,
  membershipDiscountCodes,
  courses,
  users,
  lmsCourses,
  digitalProducts,
  sonoQuizzes,
  webinars,
  communities,
  physicalProducts,
} from "../../drizzle/schema";
import { eq, and, desc, asc, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";
import { syncStripeProduct } from "../stripeSync";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function assertCanPurchaseMembership(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  plan: { id: number; stripePriceId: string | null; title: string },
  email: string | null | undefined,
) {
  const { userHasActivePlanAccess } = await import("../lib/enrollmentAccess");
  const access = await userHasActivePlanAccess(db as any, userId, plan.id);
  if (access.hasAccess) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You already have active access to this membership. Check your dashboard or contact support if you need help.",
    });
  }

  if (!plan.stripePriceId || !email || !process.env.STRIPE_SECRET_KEY) return;

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });
  const customers = await stripe.customers.list({ email: email.trim().toLowerCase(), limit: 1 });
  const customerId = customers.data[0]?.id;
  if (!customerId) return;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 10,
  });
  const duplicate = subs.data.find((s) =>
    s.items.data.some((item) => item.price.id === plan.stripePriceId),
  );
  if (duplicate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You already have an active Stripe subscription for this plan. Contact support if you were charged twice.",
    });
  }
}

// ─── Public Procedures ────────────────────────────────────────────────────────

const listPublicMemberships = publicProcedure
  .input(z.object({ brand: z.string().optional() }).optional())
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const plans = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.status, "published"))
      .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.id));
    return plans;
  });

const getMembershipBySlug = publicProcedure
  .input(z.object({ slug: z.string() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, input.slug));
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });
    const rawItems = await db
      .select()
      .from(membershipPlanAccess)
      .where(eq(membershipPlanAccess.planId, plan.id))
      .orderBy(asc(membershipPlanAccess.sortOrder));

    // Enrich each item with title, slug, and coverImage from the relevant table
    const items = await Promise.all(rawItems.map(async (item) => {
      let itemTitle: string | null = null;
      let itemSlug: string | null = null;
      let itemCoverImage: string | null = null;

      // Special non-ID types
      if (item.itemType === "all_courses") {
        return { ...item, itemTitle: item.label ?? "All Courses", itemSlug: null, itemCoverImage: null };
      }
      if (item.itemType === "all_downloads") {
        return { ...item, itemTitle: item.label ?? "All Downloads", itemSlug: null, itemCoverImage: null };
      }
      const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
      const IHE_LOGO  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/iheartecho_logo_ring_01cc7ccd.webp";
      if (item.itemType === "ultrasoundassist_free") {
        return { ...item, itemTitle: item.label ?? "UltrasoundAssist™ (Free Member)", itemSlug: null, itemCoverImage: AAUS_LOGO, appLabel: "UltrasoundAssist™" };
      }
      if (item.itemType === "ultrasoundassist_premium") {
        return { ...item, itemTitle: item.label ?? "UltrasoundAssist™ (Premium)", itemSlug: null, itemCoverImage: AAUS_LOGO, appLabel: "UltrasoundAssist™" };
      }
      if (item.itemType === "echoassist_free") {
        return { ...item, itemTitle: item.label ?? "EchoAssist™ (Free Member)", itemSlug: null, itemCoverImage: IHE_LOGO, appLabel: "EchoAssist™" };
      }
      if (item.itemType === "echoassist_premium") {
        return { ...item, itemTitle: item.label ?? "EchoAssist™ (Premium)", itemSlug: null, itemCoverImage: IHE_LOGO, appLabel: "EchoAssist™" };
      }

      if (!item.itemId) return { ...item, itemTitle: item.label, itemSlug: null, itemCoverImage: null };

      try {
        if (item.itemType === "course") {
          const [r] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, img: lmsCourses.coverImageUrl }).from(lmsCourses).where(eq(lmsCourses.id, item.itemId)).limit(1);
          if (r) { itemTitle = r.title; itemSlug = r.slug; itemCoverImage = r.img ?? null; }
        } else if (item.itemType === "download") {
          const [r] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug, img: digitalProducts.thumbnailUrl }).from(digitalProducts).where(eq(digitalProducts.id, item.itemId)).limit(1);
          if (r) { itemTitle = r.title; itemSlug = r.slug; itemCoverImage = r.img ?? null; }
        } else if (item.itemType === "quiz") {
          const [r] = await db.select({ title: sonoQuizzes.title, img: sonoQuizzes.coverImageUrl }).from(sonoQuizzes).where(eq(sonoQuizzes.id, item.itemId)).limit(1);
          if (r) { itemTitle = r.title; itemCoverImage = r.img ?? null; }
        } else if (item.itemType === "webinar") {
          const [r] = await db.select({ title: webinars.title, slug: webinars.slug, img: webinars.coverImage }).from(webinars).where(eq(webinars.id, item.itemId)).limit(1);
          if (r) { itemTitle = r.title; itemSlug = r.slug; itemCoverImage = r.img ?? null; }
        } else if (item.itemType === "community") {
          const [r] = await db.select({ title: communities.title, slug: communities.slug, img: communities.coverImage }).from(communities).where(eq(communities.id, item.itemId)).limit(1);
          if (r) { itemTitle = r.title; itemSlug = r.slug; itemCoverImage = r.img ?? null; }
        } else if (item.itemType === "product") {
          const [r] = await db.select({ title: physicalProducts.title, slug: physicalProducts.slug }).from(physicalProducts).where(eq(physicalProducts.id, item.itemId)).limit(1);
          if (r) { itemTitle = r.title; itemSlug = r.slug; }
        }
      } catch { /* non-fatal */ }

      return {
        ...item,
        itemTitle: item.label ?? itemTitle,
        itemSlug,
        itemCoverImage,
      };
    }));

    return { plan, items };
  });

const validateDiscountCode = publicProcedure
  .input(z.object({ code: z.string(), planId: z.number() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [code] = await db
      .select()
      .from(membershipDiscountCodes)
      .where(
        and(
          eq(membershipDiscountCodes.code, input.code.toUpperCase()),
          eq(membershipDiscountCodes.isActive, true),
          or(
            isNull(membershipDiscountCodes.planId),
            eq(membershipDiscountCodes.planId, input.planId)
          )
        )
      );
    if (!code) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired discount code" });
    if (code.maxUses !== null && code.usedCount >= code.maxUses) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This discount code has reached its usage limit" });
    }
    if (code.expiresAt && code.expiresAt < Date.now()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This discount code has expired" });
    }
    return {
      id: code.id,
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      stripePromotionCodeId: code.stripePromotionCodeId,
    };
  });

// ─── Protected Procedures (logged-in users) ───────────────────────────────────

const getMyMemberships = protectedProcedure.query(async ({ ctx }) => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const subs = await db
    .select({
      subscription: membershipSubscriptions,
      plan: membershipPlans,
    })
    .from(membershipSubscriptions)
    .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
    .where(eq(membershipSubscriptions.userId, ctx.user.id))
    .orderBy(desc(membershipSubscriptions.createdAt));

  const result = [];
  for (const row of subs) {
    const items = await db
      .select()
      .from(membershipPlanAccess)
      .where(eq(membershipPlanAccess.planId, row.plan.id))
      .orderBy(asc(membershipPlanAccess.sortOrder));
    result.push({ subscription: row.subscription, plan: row.plan, items });
  }
  return result;
});

const checkMembershipAccess = protectedProcedure
  .input(z.object({ planId: z.number() }))
  .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { hasAccess: false };
    const [sub] = await db
      .select()
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.userId, ctx.user.id),
          eq(membershipSubscriptions.planId, input.planId),
          or(
            eq(membershipSubscriptions.status, "active"),
            eq(membershipSubscriptions.status, "trialing")
          )
        )
      );
    return { hasAccess: !!sub, subscription: sub ?? null };
  });

// ─── Admin Procedures ─────────────────────────────────────────────────────────

const listAllMemberships = adminProcedure
  .input(z.object({ brand: z.string().optional() }).optional())
  .query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const plans = await db
      .select()
      .from(membershipPlans)
      .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.id));
    return plans;
  });

const getMembershipById = adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, input.id));
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });
    const items = await db
      .select()
      .from(membershipPlanAccess)
      .where(eq(membershipPlanAccess.planId, plan.id))
      .orderBy(asc(membershipPlanAccess.sortOrder));
    const discountCodes = await db
      .select()
      .from(membershipDiscountCodes)
      .where(eq(membershipDiscountCodes.planId, plan.id))
      .orderBy(desc(membershipDiscountCodes.createdAt));
    const subscribers = await db
      .select({ subscription: membershipSubscriptions, user: users })
      .from(membershipSubscriptions)
      .innerJoin(users, eq(membershipSubscriptions.userId, users.id))
      .where(eq(membershipSubscriptions.planId, plan.id))
      .orderBy(desc(membershipSubscriptions.createdAt))
      .limit(100);
    return { plan, items, discountCodes, subscribers };
  });

const createMembership = adminProcedure
  .input(
    z.object({
      title: z.string().min(1),
      brand: z.enum(["all_about_ultrasound", "iheartecho"]).optional(),
      description: z.string().optional(),
      billingInterval: z.enum(["monthly", "annual", "lifetime", "one_time"]).optional(),
      price: z.number().min(0).optional(),
      compareAtPrice: z.number().optional(),
      trialDays: z.number().min(0).optional(),
      accentColor: z.string().optional(),
      stripePriceId: z.string().optional().nullable(),
      stripeProductId: z.string().optional().nullable(),
      status: z.enum(["draft", "published"]).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const slug = slugify(input.title);
    const [existing] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, slug));
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
    // Auto-sync Stripe product/price
    const stripeSync = await syncStripeProduct({
      existingProductId: input.stripeProductId ?? null,
      existingPriceId: input.stripePriceId ?? null,
      name: input.title,
      price: input.price ?? 0,
      billingInterval: (input.billingInterval as any) ?? "monthly",
      metadata: { product_type: "membership" },
    });
    const [result] = await db.insert(membershipPlans).values({
      title: input.title,
      slug: finalSlug,
      brand: input.brand ?? "all_about_ultrasound",
      description: input.description ?? null,
      billingInterval: input.billingInterval ?? "monthly",
      price: input.price ?? 0,
      compareAtPrice: input.compareAtPrice ?? null,
      trialDays: input.trialDays ?? 0,
      accentColor: input.accentColor ?? "#189aa1",
      status: input.status ?? "draft",
      stripePriceId: stripeSync.stripePriceId ?? input.stripePriceId ?? null,
      stripeProductId: stripeSync.stripeProductId ?? input.stripeProductId ?? null,
    });
    return { id: (result as any).insertId as number };
  });

const updateMembership = adminProcedure
  .input(
    z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      coverImage: z.string().optional().nullable(),
      iconImage: z.string().optional().nullable(),
      accentColor: z.string().optional(),
      status: z.enum(["draft", "published"]).optional(),
      billingInterval: z.enum(["monthly", "annual", "lifetime", "one_time"]).optional(),
      price: z.number().min(0).optional(),
      compareAtPrice: z.number().optional().nullable(),
      currency: z.string().optional(),
      stripeProductId: z.string().optional().nullable(),
      stripePriceId: z.string().optional().nullable(),
      features: z.string().optional().nullable(),
      featureBullets: z.string().optional().nullable(),
      landingPageBlocks: z.string().optional().nullable(),
      memberPageBlocks: z.string().optional().nullable(),
      trialDays: z.number().min(0).optional(),
      sortOrder: z.number().optional(),
      publishDomain: z.string().optional().nullable(),
      settings: z.string().optional().nullable(),
      subtitle: z.string().optional().nullable(),
      slug: z.string().optional(),
      metaTitle: z.string().optional().nullable(),
      metaDescription: z.string().optional().nullable(),
      brand: z.enum(["all_about_ultrasound", "iheartecho"]).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { id, ...rest } = input;
    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updateData[k] = v;
    }
    // Auto-sync Stripe product/price when price/billing changes
    if (rest.price !== undefined || rest.billingInterval !== undefined || rest.title !== undefined) {
      const [existing] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id));
      if (existing) {
        const stripeSync = await syncStripeProduct({
          existingProductId: (rest.stripeProductId as string | null | undefined) ?? existing.stripeProductId,
          existingPriceId: (rest.stripePriceId as string | null | undefined) ?? existing.stripePriceId,
          name: (rest.title as string | undefined) ?? existing.title,
          description: (rest.description as string | undefined) ?? existing.description ?? undefined,
          price: (rest.price as number | undefined) ?? existing.price ?? 0,
          billingInterval: ((rest.billingInterval ?? existing.billingInterval) as any) ?? "monthly",
          metadata: { product_type: "membership", product_id: String(id) },
        });
        if (stripeSync.stripeProductId) updateData.stripeProductId = stripeSync.stripeProductId;
        if (stripeSync.stripePriceId) updateData.stripePriceId = stripeSync.stripePriceId;
      }
    }
    await db.update(membershipPlans).set(updateData).where(eq(membershipPlans.id, id));
    return { success: true };
  });

const deleteMembership = adminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipPlanAccess).where(eq(membershipPlanAccess.planId, input.id));
    await db.delete(membershipDiscountCodes).where(eq(membershipDiscountCodes.planId, input.id));
    await db.delete(membershipPlans).where(eq(membershipPlans.id, input.id));
    return { success: true };
  });

// ─── Item Bundling ────────────────────────────────────────────────────────────

// All valid membership item types (including app-level access grants)
const MEMBERSHIP_ITEM_TYPE = z.enum([
  "course", "quiz", "bundle", "community", "webinar", "download", "product",
  "all_courses", "all_downloads",
  "ultrasoundassist_free", "ultrasoundassist_premium",
  "echoassist_free", "echoassist_premium",
]);

const setMembershipItems = adminProcedure
  .input(
    z.object({
      planId: z.number(),
      items: z.array(
        z.object({
          itemType: MEMBERSHIP_ITEM_TYPE,
          itemId: z.number().optional().nullable(),
          label: z.string().optional().nullable(),
          sortOrder: z.number().optional(),
        })
      ),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipPlanAccess).where(eq(membershipPlanAccess.planId, input.planId));
    if (input.items.length > 0) {
      await db.insert(membershipPlanAccess).values(
        input.items.map((item, idx) => ({
          planId: input.planId,
          itemType: item.itemType,
          itemId: item.itemId ?? null,
          label: item.label ?? null,
          sortOrder: item.sortOrder ?? idx,
        }))
      );
    }
    return { success: true };
  });

const addMembershipItem = adminProcedure
  .input(
    z.object({
      planId: z.number(),
      itemType: MEMBERSHIP_ITEM_TYPE,
      itemId: z.number().optional().nullable(),
      label: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const existing = await db
      .select({ sortOrder: membershipPlanAccess.sortOrder })
      .from(membershipPlanAccess)
      .where(eq(membershipPlanAccess.planId, input.planId))
      .orderBy(desc(membershipPlanAccess.sortOrder))
      .limit(1);
    const nextOrder = existing.length > 0 ? (existing[0].sortOrder ?? 0) + 1 : 0;
    await db.insert(membershipPlanAccess).values({
      planId: input.planId,
      itemType: input.itemType,
      itemId: input.itemId ?? null,
      label: input.label ?? null,
      sortOrder: nextOrder,
    });
    return { success: true };
  });

const removeMembershipItem = adminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipPlanAccess).where(eq(membershipPlanAccess.id, input.id));
    return { success: true };
  });

const reorderMembershipItems = adminProcedure
  .input(
    z.object({
      /** Ordered array of access-item IDs — first element gets sortOrder 0 */
      orderedIds: z.array(z.number()),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Update each row's sort_order to match its position in the array
    await Promise.all(
      input.orderedIds.map((id, index) =>
        db
          .update(membershipPlanAccess)
          .set({ sortOrder: index })
          .where(eq(membershipPlanAccess.id, id))
      )
    );
    return { success: true };
  });

// ─── Discount Codes ───────────────────────────────────────────────────────────

const listDiscountCodes = adminProcedure
  .input(z.object({ planId: z.number().optional() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions = input.planId
      ? or(eq(membershipDiscountCodes.planId, input.planId), isNull(membershipDiscountCodes.planId))
      : undefined;
    return db
      .select()
      .from(membershipDiscountCodes)
      .where(conditions)
      .orderBy(desc(membershipDiscountCodes.createdAt));
  });

const createDiscountCode = adminProcedure
  .input(
    z.object({
      planId: z.number().optional().nullable(),
      code: z.string().min(1).max(64),
      discountType: z.enum(["percent", "fixed"]),
      discountValue: z.number().min(1),
      maxUses: z.number().optional().nullable(),
      expiresAt: z.number().optional().nullable(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const code = input.code.toUpperCase().trim();
    const [existing] = await db
      .select({ id: membershipDiscountCodes.id })
      .from(membershipDiscountCodes)
      .where(eq(membershipDiscountCodes.code, code));
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Discount code already exists" });
    await db.insert(membershipDiscountCodes).values({
      planId: input.planId ?? null,
      code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: true,
    });
    return { success: true };
  });

const updateDiscountCode = adminProcedure
  .input(
    z.object({
      id: z.number(),
      isActive: z.boolean().optional(),
      maxUses: z.number().optional().nullable(),
      expiresAt: z.number().optional().nullable(),
      discountValue: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { id, ...rest } = input;
    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updateData[k] = v;
    }
    await db.update(membershipDiscountCodes).set(updateData).where(eq(membershipDiscountCodes.id, id));
    return { success: true };
  });

const deleteDiscountCode = adminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipDiscountCodes).where(eq(membershipDiscountCodes.id, input.id));
    return { success: true };
  });

// ─── Page Content ─────────────────────────────────────────────────────────────

const updateLandingPageBlocks = adminProcedure
  .input(z.object({ id: z.number(), blocks: z.string() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db
      .update(membershipPlans)
      .set({ landingPageBlocks: input.blocks })
      .where(eq(membershipPlans.id, input.id));
    return { success: true };
  });

const updateMemberPageBlocks = adminProcedure
  .input(z.object({ id: z.number(), blocks: z.string() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db
      .update(membershipPlans)
      .set({ memberPageBlocks: input.blocks })
      .where(eq(membershipPlans.id, input.id));
    return { success: true };
  });

// ─── Enrollment (manual admin) ────────────────────────────────────────────────

const manualEnroll = adminProcedure
  .input(
    z.object({
      planId: z.number(),
      userId: z.number(),
      status: z.enum(["active", "trialing"]).optional(),
      currentPeriodEnd: z.number().optional().nullable(),
      stripeSubscriptionId: z.string().optional(),
      stripeCustomerId: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [existing] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(
        and(
          eq(membershipSubscriptions.planId, input.planId),
          eq(membershipSubscriptions.userId, input.userId)
        )
      );
    if (existing) {
      await db
        .update(membershipSubscriptions)
        .set({
          status: input.status ?? "active",
          stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
          stripeCustomerId: input.stripeCustomerId ?? undefined,
        })
        .where(eq(membershipSubscriptions.id, existing.id));
    } else {
      await db.insert(membershipSubscriptions).values({
        planId: input.planId,
        userId: input.userId,
        status: input.status ?? "active",
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        stripeCustomerId: input.stripeCustomerId ?? null,
      });
    }
    const { fulfillMembershipPlanAccess } = await import("../lib/membershipFulfillment");
    const notes = await fulfillMembershipPlanAccess(db as any, input.userId, input.planId, {
      sessionId: null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
    });
    return { success: true, notes };
  });

// ─── Student-Accessible Subscription Management ─────────────────────────────

const cancelMembershipSubscription = protectedProcedure
  .input(z.object({ subscriptionId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // Verify ownership
    const [sub] = await db
      .select()
      .from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.id, input.subscriptionId), eq(membershipSubscriptions.userId, ctx.user.id)))
      .limit(1);

    if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

    if (sub.stripeSubscriptionId) {
      // Cancel at period end via Stripe so student keeps access until billing period ends
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
      await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
      // Update local record
      await db.update(membershipSubscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(membershipSubscriptions.id, sub.id));
      return { success: true, message: "Your subscription will be cancelled at the end of the current billing period. You will retain access until then." };
    } else {
      // No Stripe sub — cancel immediately in DB
      await db.update(membershipSubscriptions)
        .set({ status: "cancelled" })
        .where(eq(membershipSubscriptions.id, sub.id));
      return { success: true, message: "Your subscription has been cancelled." };
    }
  });

const reactivateMembershipSubscription = protectedProcedure
  .input(z.object({ subscriptionId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [sub] = await db
      .select()
      .from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.id, input.subscriptionId), eq(membershipSubscriptions.userId, ctx.user.id)))
      .limit(1);

    if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
    if (!sub.stripeSubscriptionId) throw new TRPCError({ code: "BAD_REQUEST", message: "This subscription cannot be reactivated here." });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
    await db.update(membershipSubscriptions)
      .set({ cancelAtPeriodEnd: false })
      .where(eq(membershipSubscriptions.id, sub.id));

    return { success: true, message: "Your subscription has been reactivated." };
  });

// ─── Admin Enrollment Management ─────────────────────────────────────────────

const cancelEnrollment = adminProcedure
  .input(z.object({ subscriptionId: z.number() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db
      .update(membershipSubscriptions)
      .set({ status: "cancelled" })
      .where(eq(membershipSubscriptions.id, input.subscriptionId));
    return { success: true };
  });

// ─── Stripe Checkout ──────────────────────────────────────────────────────────

const createMembershipCheckout = protectedProcedure
  .input(
    z.object({
      planId: z.number(),
      discountCodeId: z.number().optional(),
      origin: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, input.planId));
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });

    await assertCanPurchaseMembership(db, ctx.user.id, plan, ctx.user.email);

    // Dynamic import to avoid issues if Stripe not configured
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" as any });
    const validatePriceId = async (priceId: string | null | undefined): Promise<string | null> => { if (!priceId) return null; try { await stripe.prices.retrieve(priceId); return priceId; } catch (e: any) { if (e?.code === "resource_missing" || e?.statusCode === 404 || (e?.message && e.message.includes("No such price"))) return null; throw e; } };

    const isRecurring = plan.billingInterval !== "one_time" && plan.billingInterval !== "lifetime";

    // Build line item
    let priceData: any;
    const validatedPriceId = await validatePriceId(plan.stripePriceId);
    if (validatedPriceId) {
      priceData = { price: validatedPriceId, quantity: 1 };
    } else {
      priceData = {
        price_data: {
          currency: plan.currency ?? "usd",
          unit_amount: plan.price,
          product_data: {
            name: plan.title,
            description: plan.description ?? undefined,
            images: plan.coverImage ? [plan.coverImage] : [],
          },
          ...(isRecurring
            ? {
                recurring: {
                  interval: plan.billingInterval === "annual" ? "year" : "month",
                },
              }
            : {}),
        },
        quantity: 1,
      };
    }

    // Discount code
    let discounts: any[] = [];
    if (input.discountCodeId) {
      const [dc] = await db
        .select()
        .from(membershipDiscountCodes)
        .where(eq(membershipDiscountCodes.id, input.discountCodeId));
      if (dc?.stripePromotionCodeId) {
        discounts = [{ promotion_code: dc.stripePromotionCodeId }];
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? "subscription" : "payment",
      line_items: [priceData],
      customer_email: ctx.user.email,
      allow_promotion_codes: discounts.length === 0,
      ...(discounts.length > 0 ? { discounts } : {}),
      client_reference_id: ctx.user.id.toString(),
      metadata: {
        user_id: ctx.user.id.toString(),
        plan_id: plan.id.toString(),
        customer_email: ctx.user.email,
        customer_name: ctx.user.name ?? "",
        type: "membership",
      },
      ...(isRecurring ? { subscription_data: { description: plan.title, metadata: { user_id: ctx.user.id.toString(), plan_id: plan.id.toString(), type: "membership" } } } : {}),
      success_url: `${input.origin}/memberships/${plan.slug}?success=1`,
      cancel_url: `${input.origin}/memberships/${plan.slug}`,
    }, { idempotencyKey: `membership-checkout-${ctx.user.id}-${plan.id}-${new Date().toISOString().slice(0, 10)}` });

    return { checkoutUrl: session.url };
  });

// ─── Checkout Page Config ───────────────────────────────────────────────────

const getMembershipCheckoutPageConfig = protectedProcedure
  .input(z.object({ planId: z.number() }))
  .query(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [plan] = await db.select({ checkoutPageConfig: membershipPlans.checkoutPageConfig }).from(membershipPlans).where(eq(membershipPlans.id, input.planId)).limit(1);
    if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
    return { config: plan.checkoutPageConfig ?? null };
  });

const saveMembershipCheckoutPageConfig = protectedProcedure
  .input(z.object({ planId: z.number(), config: z.string() }))
  .mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    try { JSON.parse(input.config); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON config" }); }
    await db.update(membershipPlans).set({ checkoutPageConfig: input.config }).where(eq(membershipPlans.id, input.planId));
    return { success: true };
  });

const getPublicMembershipCheckoutPageConfig = publicProcedure
  .input(z.object({ planSlug: z.string() }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [plan] = await db.select({ checkoutPageConfig: membershipPlans.checkoutPageConfig }).from(membershipPlans).where(eq(membershipPlans.slug, input.planSlug)).limit(1);
    if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
    return { config: plan.checkoutPageConfig ?? null, courseStats: { totalLessons: 0, totalSections: 0, hasCertificate: false } };
  });

const createMembershipEmbeddedCheckoutSession = protectedProcedure
  .input(z.object({ planSlug: z.string(), origin: z.string(), discountCodeId: z.number().optional() }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.slug, input.planSlug)).limit(1);
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership plan not found" });

    await assertCanPurchaseMembership(db, ctx.user.id, plan, ctx.user.email);

    const isFree = !plan.price || Number(plan.price) === 0;
    if (isFree) {
      // Enroll user in the free membership directly (idempotent)
      try {
        const { fulfillMembershipPurchase } = await import("../lib/membershipFulfillment");
        await fulfillMembershipPurchase(
          db as any,
          plan.id,
          { userId: ctx.user.id, isNew: false, resetToken: null },
          {
            sessionId: null,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            customerEmail: ctx.user.email ?? null,
            customerName: ctx.user.name ?? null,
            skipEmail: false,
            forceWelcomeEmail: true,
          },
        );
      } catch (err) {
        console.error("[createMembershipEmbeddedCheckoutSession] Free enrollment failed:", err);
      }
      return { clientSecret: null, free: true, courseTitle: plan.title, courseSubtitle: null, courseDescription: plan.description ?? null, courseThumbnail: plan.coverImage ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: plan.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: plan.currency ?? "usd", minSeats: null, discountPercent: null };
    }
    const { platformSettings } = await import("../../drizzle/schema");
    const [settings] = await db.select({ termsUrl: platformSettings.termsUrl, privacyUrl: platformSettings.privacyUrl }).from(platformSettings).limit(1);
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" as any });
    const validatePriceId2 = async (priceId: string | null | undefined): Promise<string | null> => { if (!priceId) return null; try { await stripe.prices.retrieve(priceId); return priceId; } catch (e: any) { if (e?.code === "resource_missing" || e?.statusCode === 404 || (e?.message && e.message.includes("No such price"))) return null; throw e; } };
    const isRecurring = plan.billingInterval !== "one_time" && plan.billingInterval !== "lifetime";
    let lineItem: any;
    const validatedPriceId2 = await validatePriceId2(plan.stripePriceId);
    if (validatedPriceId2) {
      lineItem = { price: validatedPriceId2, quantity: 1 };
    } else {
      lineItem = {
        price_data: {
          currency: plan.currency ?? "usd",
          unit_amount: plan.price,
          product_data: { name: plan.title, description: plan.description ?? undefined, images: plan.coverImage ? [plan.coverImage] : [] },
          ...(isRecurring ? { recurring: { interval: plan.billingInterval === "annual" ? "year" : "month" } } : {}),
        },
        quantity: 1,
      };
    }
    let discounts: any[] = [];
    if (input.discountCodeId) {
      const [dc] = await db.select().from(membershipDiscountCodes).where(eq(membershipDiscountCodes.id, input.discountCodeId));
      if (dc?.stripePromotionCodeId) discounts = [{ promotion_code: dc.stripePromotionCodeId }];
    }
    // ── 100% promo intercept for memberships ────────────────────────────────
    if (discounts.length > 0 && !isRecurring) {
      try {
        const promoId = discounts[0].promotion_code;
        const pc = await stripe.promotionCodes.retrieve(promoId);
        const coupon = (pc as any).coupon as any;
        const priceCents = plan.price ?? 0;
        const discountedCents = coupon.percent_off === 100 ? 0 : coupon.amount_off ? Math.max(0, priceCents - coupon.amount_off) : priceCents;
        if (discountedCents === 0) {
          // Grant free membership access directly
          const { membershipEnrollments } = await import("../../drizzle/schema");
          const db2 = await getDb();
          if (db2) {
            const [ex] = await db2.select({ id: membershipEnrollments.id }).from(membershipEnrollments)
              .where(and(eq(membershipEnrollments.userId, ctx.user.id), eq(membershipEnrollments.planId, plan.id))).limit(1);
            if (!ex) await db2.insert(membershipEnrollments).values({ userId: ctx.user.id, planId: plan.id, status: "active", source: "promo_free" });
          }
          return { clientSecret: null, free: true, courseTitle: plan.title, courseSubtitle: null, courseDescription: plan.description ?? null, courseThumbnail: plan.coverImage ?? null, primaryColor: "#189aa1", accentColor: "#4ad9e0", gradientFrom: "#189aa1", gradientTo: "#4ad9e0", gradientDirection: "135deg", playerTheme: "light", termsUrl: "", privacyUrl: "", productName: plan.title, displayPrice: 0, pricingType: "free", isSubscription: false, billingLabel: null, currency: plan.currency ?? "usd", minSeats: null, discountPercent: null };
        }
      } catch { /* ignore */ }
    }
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: isRecurring ? "subscription" : "payment",
      line_items: [lineItem],
      customer_email: ctx.user.email ?? undefined,
      allow_promotion_codes: discounts.length === 0,
      ...(discounts.length > 0 ? { discounts } : {}),
      client_reference_id: ctx.user.id.toString(),
      metadata: {
        type: "membership",
        plan_id: plan.id.toString(),
        user_id: ctx.user.id.toString(),
        customer_email: ctx.user.email ?? "",
        customer_name: ctx.user.name ?? "",
        ...(input.discountCodeId ? { discount_code_id: input.discountCodeId.toString() } : {}),
      },
      ...(isRecurring ? { subscription_data: { description: plan.title, metadata: { user_id: ctx.user.id.toString(), plan_id: plan.id.toString(), type: "membership" } } } : {}),
      return_url: `${input.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=membership`,
    }, { idempotencyKey: `membership-embedded-${ctx.user.id}-${plan.id}-${new Date().toISOString().slice(0, 10)}` });
    const billingLabel = isRecurring ? (plan.billingInterval === "annual" ? "per year" : "per month") : null;
    return {
      clientSecret: session.client_secret!,
      free: false,
      courseTitle: plan.title,
      courseSubtitle: null,
      courseDescription: plan.description ?? null,
      courseThumbnail: plan.coverImage ?? null,
      primaryColor: "#189aa1",
      accentColor: "#4ad9e0",
      gradientFrom: "#189aa1",
      gradientTo: "#4ad9e0",
      gradientDirection: "135deg",
      playerTheme: "light",
      termsUrl: settings?.termsUrl ?? "",
      privacyUrl: settings?.privacyUrl ?? "",
      productName: plan.title,
      displayPrice: Number(plan.price),
      pricingType: isRecurring ? "subscription" : "one_time",
      isSubscription: isRecurring,
      billingLabel,
      currency: plan.currency ?? "usd",
      minSeats: null,
      discountPercent: null,
    };
  });

const guestMembershipCheckoutRegister = publicProcedure
  .input(z.object({
    planSlug: z.string(),
    name: z.string().min(1).max(200),
    email: z.string().email(),
    origin: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.slug, input.planSlug)).limit(1);
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership plan not found" });

    const { getOrCreateUserByEmail } = await import("../db");
    const { user } = await getOrCreateUserByEmail({
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
    });

    const { sdk } = await import("../_core/sdk");
    const { COOKIE_NAME, ONE_YEAR_MS } = await import("@shared/const");
    const { getSessionCookieOptions } = await import("../_core/cookies");
    const openId = `email:${input.email.trim().toLowerCase()}`;
    await db.update(users).set({ openId }).where(and(eq(users.id, user.id), isNull(users.openId)));
    const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: ONE_YEAR_MS });
    const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    // For free plans, enroll directly and redirect to member page
    if (!plan.stripePriceId || !plan.price || Number(plan.price) === 0) {
      try {
        const { fulfillMembershipPurchase } = await import("../lib/membershipFulfillment");
        await fulfillMembershipPurchase(
          db as any,
          plan.id,
          { userId: user.id, isNew: false, resetToken: null },
          {
            sessionId: null,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            customerEmail: input.email.trim().toLowerCase(),
            customerName: input.name.trim(),
            skipEmail: false,
            forceWelcomeEmail: true,
          },
        );
      } catch (err) {
        console.error("[guestMembershipCheckoutRegister] Free enrollment failed:", err);
      }
      return {
        userId: user.id,
        checkoutPath: `/my-memberships/${input.planSlug}`,
      };
    }
    return {
      userId: user.id,
      checkoutPath: `/checkout/${input.planSlug}?type=membership`,
    };
  });
const getMembershipCheckoutSessionStatus = publicProcedure
  .input(z.object({ sessionId: z.string() }))
  .query(async ({ ctx, input }) => {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
    const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
      expand: ["line_items"],
    });

    if (session.status === "complete") {
      const db = await getDb();
      if (db) {
        try {
          const { reconcileMembershipFromStripeSession } = await import("../lib/membershipFulfillment");
          await reconcileMembershipFromStripeSession(db as any, session as unknown as Record<string, unknown>);
        } catch (err) {
          console.error("[MembershipCheckoutStatus] Fallback fulfillment error:", err);
        }
      }
    }

    const meta = (session.metadata ?? {}) as Record<string, string>;
    let planSlug: string | null = null;
    if (meta.plan_id) {
      const db = await getDb();
      if (db) {
        const [plan] = await db
          .select({ slug: membershipPlans.slug })
          .from(membershipPlans)
          .where(eq(membershipPlans.id, parseInt(meta.plan_id, 10)))
          .limit(1);
        planSlug = plan?.slug ?? null;
      }
    }

    let autoLoginUrl: string | null = null;
    if (ctx.user && session.status === "complete") {
      try {
        const { generateAutoLoginToken } = await import("../routes/autoLogin");
        const baseUrl = "https://app.allaboutultrasound.com";
        const next = planSlug ? `https://learn.allaboutultrasound.com/my-dashboard` : `${baseUrl}/my-dashboard`;
        const token = await generateAutoLoginToken(ctx.user.id, next);
        autoLoginUrl = `${baseUrl}/api/auth/auto-login?token=${token}`;
      } catch { /* non-fatal */ }
    }

    return {
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email ?? null,
      planSlug,
      autoLoginUrl,
    };
  });

const cancelDuplicateStripeSubscriptionsAdmin = adminProcedure
  .input(z.object({
    stripeCustomerId: z.string(),
    keepSubscriptionId: z.string(),
    stripePriceId: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const { cancelDuplicateStripeSubscriptions } = await import("../lib/membershipFulfillment");
    const cancelled = await cancelDuplicateStripeSubscriptions(input);
    return { cancelled };
  });

const reconcileStripeMembership = adminProcedure
  .input(z.object({
    stripeCheckoutSessionId: z.string().optional(),
    stripeSubscriptionId: z.string().optional(),
    email: z.string().email().optional(),
    /** Force-assign to a specific user ID (admin override — bypasses email lookup) */
    userId: z.number().int().optional(),
    /** Force-assign to a specific plan ID (admin override — bypasses price ID lookup) */
    planId: z.number().int().optional(),
  }))
  .mutation(async ({ input }) => {
    if (!input.stripeCheckoutSessionId && !input.stripeSubscriptionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Provide stripeCheckoutSessionId or stripeSubscriptionId" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

    let session: Record<string, unknown> | null = null;
    let stripeSubData: Record<string, unknown> | null = null;

    if (input.stripeCheckoutSessionId) {
      const s = await stripe.checkout.sessions.retrieve(input.stripeCheckoutSessionId, { expand: ["line_items"] });
      session = s as unknown as Record<string, unknown>;
      // Also fetch subscription to get billing period details
      if (s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        stripeSubData = sub as unknown as Record<string, unknown>;
      }
    } else if (input.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
      stripeSubData = sub as unknown as Record<string, unknown>;
      const sessions = await stripe.checkout.sessions.list({ subscription: input.stripeSubscriptionId, limit: 1, expand: ["data.line_items"] } as any);
      if (sessions.data[0]) {
        session = sessions.data[0] as unknown as Record<string, unknown>;
      } else {
        // Build a synthetic session from the subscription
        const priceId = sub.items?.data?.[0]?.price?.id ?? null;
        const meta: Record<string, string> = { ...(sub.metadata ?? {}), type: "membership" };
        if (priceId) meta.stripe_price_id = priceId;
        session = {
          id: `reconcile_sub_${input.stripeSubscriptionId}`,
          metadata: meta,
          subscription: sub.id,
          customer: sub.customer,
          customer_email: input.email ?? undefined,
          amount_total: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
          status: "complete",
          line_items: { data: [{ price: { id: priceId } }] },
        };
      }
    }

    // Always enrich session with live subscription billing data
    if (session && stripeSubData) {
      session.current_period_end = (stripeSubData as any).current_period_end ?? null;
      session.cancel_at_period_end = (stripeSubData as any).cancel_at_period_end ?? false;
      // Ensure line_items has price ID for plan resolution
      if (!(session as any).line_items?.data?.[0]?.price?.id) {
        const priceId = (stripeSubData as any).items?.data?.[0]?.price?.id ?? null;
        if (priceId) {
          session.line_items = { data: [{ price: { id: priceId } }] };
        }
      }
    }

    if (!session) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Could not load Stripe checkout session" });
    }

    // Admin overrides: always create a fresh metadata copy to avoid frozen/sealed object issues
    if (input.userId || input.planId) {
      const existingMeta = (session.metadata as Record<string, string>) ?? {};
      const newMeta: Record<string, string> = { ...existingMeta };
      if (input.userId) newMeta.user_id = String(input.userId);
      if (input.planId) newMeta.plan_id = String(input.planId);
      session = { ...session, metadata: newMeta };
    }

    // Log what we're working with for debugging
    const debugPriceId = (session as any).line_items?.data?.[0]?.price?.id ?? (session as any).metadata?.stripe_price_id ?? null;
    const debugPlanId = input.planId ?? ((session as any).metadata?.plan_id ? parseInt((session as any).metadata.plan_id, 10) : null);
    console.log(`[ReconcileMembership] sub=${input.stripeSubscriptionId ?? input.stripeCheckoutSessionId} priceId=${debugPriceId} planIdOverride=${debugPlanId} userId=${input.userId ?? 'auto'} email=${input.email ?? 'auto'}`);

    const { reconcileMembershipFromStripeSession, resolveMembershipUserId, fulfillMembershipPurchase } = await import("../lib/membershipFulfillment");

    // Fast path: if planId is explicitly provided, bypass plan resolution entirely
    if (input.planId) {
      const meta = (session.metadata as Record<string, string>) ?? {};
      const customerEmail = (session.customer_email as string) ?? meta.customer_email ?? input.email ?? null;
      const customerName = meta.customer_name ?? null;
      const resolved = await resolveMembershipUserId(db as any, {
        metaUserId: input.userId ?? (meta.user_id ? parseInt(meta.user_id, 10) : null),
        customerEmail,
        customerName,
      });
      if (!resolved) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Could not resolve user for email: ${customerEmail ?? 'unknown'}` });
      }
      const fastResult = await fulfillMembershipPurchase(db as any, input.planId, resolved, {
        sessionId: session.id as string,
        stripeSubscriptionId: (session.subscription as string) ?? input.stripeSubscriptionId ?? null,
        stripeCustomerId: (session.customer as string) ?? null,
        amountTotalCents: (session.amount_total as number) ?? 0,
        customerEmail,
        customerName,
        currentPeriodEnd: (session.current_period_end as number) ?? null,
        cancelAtPeriodEnd: (session.cancel_at_period_end as boolean) ?? false,
      });
      if (!fastResult.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fastResult.error ?? "Fulfillment failed" });
      }
      return fastResult;
    }

    const result = await reconcileMembershipFromStripeSession(db as any, session);
    if (!result.success) {
      const errDetail = result.error === "Could not resolve membership plan"
        ? `Could not resolve membership plan (priceId=${debugPriceId ?? 'none'}, planIdOverride=${debugPlanId ?? 'none'}). Select a plan manually from the dropdown.`
        : result.error ?? "Reconciliation failed";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errDetail });
    }
    return result;
  });

// ─── Bulk Reconcile All Stripe Subscriptions ────────────────────────────────
/**
 * Pages through ALL Stripe subscriptions (active + past_due + trialing),
 * matches each to a membership plan by price ID, and runs full fulfillment.
 * Returns a per-subscription result log for the admin UI.
 */
const bulkReconcileStripeSubscriptions = adminProcedure
  .input(z.object({
    /** Limit to a specific Stripe price ID (optional — leave empty to process all) */
    priceId: z.string().optional(),
    /** Max subscriptions to process in one call (default 200, max 500) */
    limit: z.number().int().min(1).max(500).default(200),
    /** Dry run: resolve plan/user but skip DB writes */
    dryRun: z.boolean().default(false),
  }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
    const { reconcileMembershipFromStripeSession } = await import("../lib/membershipFulfillment");

    // Fetch all known plan price IDs so we can skip non-membership subscriptions
    const allPlans = await db.select({ id: membershipPlans.id, stripePriceId: membershipPlans.stripePriceId }).from(membershipPlans);
    const knownPriceIds = new Set(allPlans.map(p => p.stripePriceId).filter(Boolean));

    const results: Array<{
      subscriptionId: string;
      customerEmail: string | null;
      priceId: string | null;
      status: "fulfilled" | "skipped" | "error" | "dry_run";
      notes: string[];
      error?: string;
      userId?: number | null;
    }> = [];

    let processed = 0;
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
        const customerEmail = typeof sub.customer === "object" && sub.customer !== null
          ? (sub.customer as any).email ?? null
          : null;

        // Skip non-membership subscriptions unless a specific priceId was requested
        if (!input.priceId && priceId && !knownPriceIds.has(priceId)) {
          results.push({ subscriptionId: sub.id, customerEmail, priceId, status: "skipped", notes: ["Not a membership price ID"] });
          continue;
        }

        // Skip cancelled subscriptions (they've already been handled by webhook)
        if (sub.status === "canceled") {
          results.push({ subscriptionId: sub.id, customerEmail, priceId, status: "skipped", notes: ["Subscription cancelled"] });
          continue;
        }

        if (input.dryRun) {
          results.push({ subscriptionId: sub.id, customerEmail, priceId, status: "dry_run", notes: [`Would reconcile — status: ${sub.status}`] });
          continue;
        }

        try {
          const meta: Record<string, string> = { ...(sub.metadata ?? {}), type: "membership" };
          if (priceId) meta.stripe_price_id = priceId;
          const session: Record<string, unknown> = {
            id: `bulk_reconcile_${sub.id}`,
            metadata: meta,
            subscription: sub.id,
            customer: typeof sub.customer === "object" ? (sub.customer as any).id : sub.customer,
            customer_email: customerEmail,
            amount_total: sub.items?.data?.[0]?.price?.unit_amount ?? 0,
            status: "complete",
            line_items: { data: [{ price: { id: priceId } }] },
            current_period_end: sub.current_period_end ?? null,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
          };

          const result = await reconcileMembershipFromStripeSession(db as any, session);
          results.push({
            subscriptionId: sub.id,
            customerEmail,
            priceId,
            status: result.success ? "fulfilled" : "error",
            notes: result.notes,
            error: result.error,
            userId: result.userId,
          });
        } catch (err: any) {
          results.push({
            subscriptionId: sub.id,
            customerEmail,
            priceId,
            status: "error",
            notes: [],
            error: err?.message ?? "Unknown error",
          });
        }
      }

      processed += batch.data.length;
      if (!batch.has_more) break;
      startingAfter = batch.data[batch.data.length - 1].id;
    }

    const fulfilled = results.filter(r => r.status === "fulfilled").length;
    const errors = results.filter(r => r.status === "error").length;
    const skipped = results.filter(r => r.status === "skipped").length;

    await notifyOwner({
      title: `🔄 Bulk Stripe Reconcile Complete`,
      content: `Processed ${processed} subscriptions. Fulfilled: ${fulfilled}, Errors: ${errors}, Skipped: ${skipped}.`,
    }).catch(() => {});

    return { processed, fulfilled, errors, skipped, results };
  });

// ─── Bulk Plan Sync ─────────────────────────────────────────────────────────

const bulkSyncPlans = adminProcedure
  .mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { bulkSyncAllPlans } = await import("../lib/planAutoSync");
    const results = await bulkSyncAllPlans(db as any);
    const created = results.filter(r => r.action === "created").length;
    const skipped = results.filter(r => r.action === "skipped").length;
    const errors = results.filter(r => r.action === "error").length;
    await notifyOwner({
      title: `🔄 Bulk Plan Sync Complete`,
      content: `Synced ${results.length} sources. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}.`,
    }).catch(() => {});
    return { total: results.length, created, skipped, errors, results };
  });

// ─── Router ───────────────────────────────────────────────────────────────────


// ─── After Purchase Workflow + Hide Pricing Options ───────────────────────────

const getMembershipAfterPurchaseWorkflow = adminProcedure
  .input(z.object({ planId: z.number() }))
  .query(async ({ input }) => {
    const db = await getDb();
    const [plan] = await db.select({ id: membershipPlans.id, afterPurchaseWorkflow: membershipPlans.afterPurchaseWorkflow })
      .from(membershipPlans).where(eq(membershipPlans.id, input.planId)).limit(1);
    return { afterPurchaseWorkflow: plan.afterPurchaseWorkflow ?? null };
  });

const updateMembershipAfterPurchaseWorkflow = adminProcedure
  .input(z.object({ planId: z.number(), workflow: z.string().nullable() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    await db.update(membershipPlans).set({ afterPurchaseWorkflow: input.workflow }).where(eq(membershipPlans.id, input.planId));
    return { success: true };
  });

const getMembershipHidePricingOptions = adminProcedure
  .input(z.object({ planId: z.number() }))
  .query(async ({ input }) => {
    const db = await getDb();
    const [plan] = await db.select({ id: membershipPlans.id, hidePricingOptions: membershipPlans.hidePricingOptions })
      .from(membershipPlans).where(eq(membershipPlans.id, input.planId)).limit(1);
    return { hidePricingOptions: plan.hidePricingOptions ?? false };
  });

const updateMembershipHidePricingOptions = adminProcedure
  .input(z.object({ planId: z.number(), hidePricingOptions: z.boolean() }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    await db.update(membershipPlans).set({ hidePricingOptions: input.hidePricingOptions }).where(eq(membershipPlans.id, input.planId));
    return { success: true };
  });

/**
 * selfEnrollFree — lets an authenticated user self-enroll in a free (no Stripe price) membership plan.
 * Sends a welcome email (unlike ensureFreeMembership which is always silent).
 */
const selfEnrollFree = protectedProcedure
  .input(z.object({ planId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Verify the plan exists and is free (no Stripe price ID)
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, input.planId))
      .limit(1);
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership plan not found" });
    if (plan.stripePriceId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This membership requires payment. Please use the checkout flow." });
    }
    // Idempotent — check if already enrolled
    const [existing] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.userId, ctx.user.id), eq(membershipSubscriptions.planId, input.planId)))
      .limit(1);
    if (existing) return { success: true, alreadyEnrolled: true };
    // Insert subscription row
    await db.insert(membershipSubscriptions).values({
      planId: input.planId,
      userId: ctx.user.id,
      status: "active",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      currentPeriodEnd: null,
    });
    // Look up user email + name for welcome email
    const [userRow] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    // Fulfill plan access items and send welcome email via the standard fulfillment path
    try {
      const { fulfillMembershipPurchase } = await import("../lib/membershipFulfillment");
      await fulfillMembershipPurchase(
        db as any,
        input.planId,
        { userId: ctx.user.id, isNew: false, resetToken: null },
        {
          sessionId: null,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          customerEmail: userRow?.email ?? null,
          customerName: userRow?.name ?? null,
          skipEmail: false,
          forceWelcomeEmail: true,
        },
      );
    } catch (fulfillErr) {
      console.error("[selfEnrollFree] fulfillMembershipPurchase failed:", fulfillErr);
    }
    return { success: true, alreadyEnrolled: false };
  });

export const membershipRouter = router({
  // Public
  listPublic: listPublicMemberships,
  getBySlug: getMembershipBySlug,
  validateCode: validateDiscountCode,

  // Protected
  myMemberships: getMyMemberships,
  checkAccess: checkMembershipAccess,
  createCheckout: createMembershipCheckout,
  selfEnrollFree: selfEnrollFree,

  // Admin
  listAll: listAllMemberships,
  getById: getMembershipById,
  create: createMembership,
  update: updateMembership,
  delete: deleteMembership,
  setItems: setMembershipItems,
  addItem: addMembershipItem,
  removeItem: removeMembershipItem,
  reorderItems: reorderMembershipItems,
  listDiscountCodes: listDiscountCodes,
  createDiscountCode: createDiscountCode,
  updateDiscountCode: updateDiscountCode,
  deleteDiscountCode: deleteDiscountCode,
  updateLandingPageBlocks: updateLandingPageBlocks,
  updateMemberPageBlocks: updateMemberPageBlocks,
  manualEnroll: manualEnroll,
  cancelEnrollment: cancelEnrollment,
  getCheckoutPageConfig: getMembershipCheckoutPageConfig,
  saveCheckoutPageConfig: saveMembershipCheckoutPageConfig,
  getPublicCheckoutPageConfig: getPublicMembershipCheckoutPageConfig,
  createEmbeddedCheckoutSession: createMembershipEmbeddedCheckoutSession,
  guestCheckoutRegister: guestMembershipCheckoutRegister,
  getCheckoutSessionStatus: getMembershipCheckoutSessionStatus,
  reconcileStripeMembership,
  cancelDuplicateStripeSubscriptions: cancelDuplicateStripeSubscriptionsAdmin,
  bulkReconcileStripeSubscriptions,
  cancelMembershipSubscription,
  reactivateMembershipSubscription,
  bulkSyncPlans,
  getAfterPurchaseWorkflow: getMembershipAfterPurchaseWorkflow,
  updateAfterPurchaseWorkflow: updateMembershipAfterPurchaseWorkflow,
  getHidePricingOptions: getMembershipHidePricingOptions,
  updateHidePricingOptions: updateMembershipHidePricingOptions,
});
