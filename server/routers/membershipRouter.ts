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
} from "../../drizzle/schema";
import { eq, and, desc, asc, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Public Procedures ────────────────────────────────────────────────────────

const listPublicMemberships = publicProcedure
  .input(z.object({ brand: z.string().optional() }).optional())
  .query(async ({ input }) => {
    const db = getDb();
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
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, input.slug));
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });
    const items = await db
      .select()
      .from(membershipPlanAccess)
      .where(eq(membershipPlanAccess.planId, plan.id))
      .orderBy(asc(membershipPlanAccess.sortOrder));
    return { plan, items };
  });

const validateDiscountCode = publicProcedure
  .input(z.object({ code: z.string(), planId: z.number() }))
  .query(async ({ input }) => {
    const db = getDb();
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
  const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    })
  )
  .mutation(async ({ input }) => {
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const slug = slugify(input.title);
    const [existing] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, slug));
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
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
      status: "draft",
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
    })
  )
  .mutation(async ({ input }) => {
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { id, ...rest } = input;
    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updateData[k] = v;
    }
    await db.update(membershipPlans).set(updateData).where(eq(membershipPlans.id, id));
    return { success: true };
  });

const deleteMembership = adminProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipPlanAccess).where(eq(membershipPlanAccess.planId, input.id));
    await db.delete(membershipDiscountCodes).where(eq(membershipDiscountCodes.planId, input.id));
    await db.delete(membershipPlans).where(eq(membershipPlans.id, input.id));
    return { success: true };
  });

// ─── Item Bundling ────────────────────────────────────────────────────────────

const setMembershipItems = adminProcedure
  .input(
    z.object({
      planId: z.number(),
      items: z.array(
        z.object({
          itemType: z.enum(["course", "quiz", "bundle", "community", "webinar", "download", "product", "all_courses", "all_downloads"]),
          itemId: z.number().optional().nullable(),
          label: z.string().optional().nullable(),
          sortOrder: z.number().optional(),
        })
      ),
    })
  )
  .mutation(async ({ input }) => {
    const db = getDb();
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
      itemType: z.enum(["course", "quiz", "bundle", "community", "webinar", "download", "product", "all_courses", "all_downloads"]),
      itemId: z.number().optional().nullable(),
      label: z.string().optional().nullable(),
    })
  )
  .mutation(async ({ input }) => {
    const db = getDb();
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
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipPlanAccess).where(eq(membershipPlanAccess.id, input.id));
    return { success: true };
  });

// ─── Discount Codes ───────────────────────────────────────────────────────────

const listDiscountCodes = adminProcedure
  .input(z.object({ planId: z.number().optional() }))
  .query(async ({ input }) => {
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(membershipDiscountCodes).where(eq(membershipDiscountCodes.id, input.id));
    return { success: true };
  });

// ─── Page Content ─────────────────────────────────────────────────────────────

const updateLandingPageBlocks = adminProcedure
  .input(z.object({ id: z.number(), blocks: z.string() }))
  .mutation(async ({ input }) => {
    const db = getDb();
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
    const db = getDb();
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
    })
  )
  .mutation(async ({ input }) => {
    const db = getDb();
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
        .set({ status: input.status ?? "active" })
        .where(eq(membershipSubscriptions.id, existing.id));
    } else {
      await db.insert(membershipSubscriptions).values({
        planId: input.planId,
        userId: input.userId,
        status: input.status ?? "active",
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      });
    }
    return { success: true };
  });

const cancelEnrollment = adminProcedure
  .input(z.object({ subscriptionId: z.number() }))
  .mutation(async ({ input }) => {
    const db = getDb();
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
    const db = getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, input.planId));
    if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });

    // Dynamic import to avoid issues if Stripe not configured
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" as any });

    const isRecurring = plan.billingInterval !== "one_time" && plan.billingInterval !== "lifetime";

    // Build line item
    let priceData: any;
    if (plan.stripePriceId) {
      priceData = { price: plan.stripePriceId, quantity: 1 };
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
      success_url: `${input.origin}/memberships/${plan.slug}?success=1`,
      cancel_url: `${input.origin}/memberships/${plan.slug}`,
    });

    return { checkoutUrl: session.url };
  });

// ─── Router ───────────────────────────────────────────────────────────────────

export const membershipRouter = router({
  // Public
  listPublic: listPublicMemberships,
  getBySlug: getMembershipBySlug,
  validateCode: validateDiscountCode,

  // Protected
  myMemberships: getMyMemberships,
  checkAccess: checkMembershipAccess,
  createCheckout: createMembershipCheckout,

  // Admin
  listAll: listAllMemberships,
  getById: getMembershipById,
  create: createMembership,
  update: updateMembership,
  delete: deleteMembership,
  setItems: setMembershipItems,
  addItem: addMembershipItem,
  removeItem: removeMembershipItem,
  listDiscountCodes: listDiscountCodes,
  createDiscountCode: createDiscountCode,
  updateDiscountCode: updateDiscountCode,
  deleteDiscountCode: deleteDiscountCode,
  updateLandingPageBlocks: updateLandingPageBlocks,
  updateMemberPageBlocks: updateMemberPageBlocks,
  manualEnroll: manualEnroll,
  cancelEnrollment: cancelEnrollment,
});
