import { and, eq, sql } from "drizzle-orm";
import {
  digitalBundleItems,
  digitalBundlePurchases,
  digitalBundles,
  digitalProducts,
  digitalPurchases,
  lmsCourses,
  lmsEnrollments,
  membershipPlans,
  membershipSubscriptions,
  orderBumpConversions,
  orderBumps,
  webinarRegistrations,
  webinars,
} from "../../drizzle/schema";

export type ProductType =
  | "course"
  | "quiz"
  | "download"
  | "bundle"
  | "physical"
  | "cohort"
  | "webinar"
  | "membership";

export type OrderBumpCheckoutLine = {
  lineItem: Record<string, unknown>;
  metadata: Record<string, string>;
  amount: number;
  requiresShipping: boolean;
  /** "addon" = charged in addition to original; "upgrade" = replaces original item */
  bumpMode: "addon" | "upgrade";
};

export async function buildOrderBumpCheckoutLine(
  db: any,
  input: {
    orderBumpId?: number | null;
    triggerType: ProductType;
    triggerProductId: number;
    currency: string;
  },
): Promise<OrderBumpCheckoutLine | null> {
  if (!input.orderBumpId) return null;

  const [bump] = await db
    .select()
    .from(orderBumps)
    .where(
      and(
        eq(orderBumps.id, input.orderBumpId),
        eq(orderBumps.triggerType, input.triggerType),
        eq(orderBumps.triggerProductId, input.triggerProductId),
        eq(orderBumps.timing, "before_checkout"),
        eq(orderBumps.isActive, true),
      ),
    )
    .limit(1);

  if (!bump) return null;

  const bumpType = bump.bumpType as ProductType;
  let name = bump.headline || "Order bump";
  let description = bump.subheadline || undefined;
  let imageUrl = bump.imageUrl || undefined;
  let amount = bump.bumpPrice;

  if (bumpType === "download") {
    const [product] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, bump.bumpProductId)).limit(1);
    if (product) {
      name = bump.headline || product.title;
      description = bump.subheadline || product.subtitle || undefined;
      imageUrl = bump.imageUrl || product.thumbnailUrl || undefined;
      if (!amount) amount = product.price;
    }
  } else if (bumpType === "course" || bumpType === "quiz" || bumpType === "cohort") {
    const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, bump.bumpProductId)).limit(1);
    if (course) {
      name = bump.headline || course.title;
      description = bump.subheadline || course.subtitle || undefined;
      imageUrl = bump.imageUrl || course.thumbnailUrl || undefined;
      if (!amount) amount = course.price;
    }
  } else if (bumpType === "bundle") {
    const [bundle] = await db.select().from(digitalBundles).where(eq(digitalBundles.id, bump.bumpProductId)).limit(1);
    if (bundle) {
      name = bump.headline || bundle.title;
      description = bump.subheadline || bundle.subtitle || undefined;
      imageUrl = bump.imageUrl || bundle.thumbnailUrl || undefined;
      if (!amount) amount = bundle.price;
    }
  } else if (bumpType === "webinar") {
    const [webinar] = await db.select().from(webinars).where(eq(webinars.id, bump.bumpProductId)).limit(1);
    if (webinar) {
      name = bump.headline || webinar.title;
      description = bump.subheadline || webinar.description || undefined;
      imageUrl = bump.imageUrl || webinar.thumbnailUrl || undefined;
      // Webinar pricing is in pricingOptions JSON; admin must set bumpPrice explicitly
    }
  } else if (bumpType === "membership") {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, bump.bumpProductId)).limit(1);
    if (plan) {
      name = bump.headline || plan.title;
      description = bump.subheadline || plan.description || undefined;
      imageUrl = bump.imageUrl || plan.coverImage || undefined;
      if (!amount) amount = plan.price;
    }
  }

  if (!amount || amount < 0) return null;

  return {
    amount,
    requiresShipping: bumpType === "physical",
    bumpMode: (bump.bumpMode as "addon" | "upgrade") ?? "addon",
    lineItem: {
      price_data: {
        currency: input.currency,
        product_data: {
          name,
          description,
          images: imageUrl ? [imageUrl] : undefined,
          metadata: {
            order_bump_id: String(bump.id),
            order_bump_type: bumpType,
          },
        },
        unit_amount: Math.round(Number(amount) * 100),
      },
      quantity: 1,
    },
    metadata: {
      order_bump_id: String(bump.id),
      order_bump_type: bumpType,
      order_bump_product_id: String(bump.bumpProductId),
      order_bump_price: String(amount),
    },
  };
}

export async function fulfillOrderBumpPurchase(
  db: any,
  meta: Record<string, string>,
  input: {
    userId: number;
    sessionId: string;
    triggerOrderType: ProductType;
    triggerOrderId?: number | null;
  },
) {
  const bumpId = meta.order_bump_id ? Number(meta.order_bump_id) : null;
  const bumpProductId = meta.order_bump_product_id ? Number(meta.order_bump_product_id) : null;
  const bumpType = meta.order_bump_type as ProductType | undefined;
  const bumpAmount = meta.order_bump_price ? Number(meta.order_bump_price) : 0;

  if (!bumpId || !bumpType) return;

  if (bumpType === "download" && bumpProductId) {
    const [existing] = await db
      .select()
      .from(digitalPurchases)
      .where(and(eq(digitalPurchases.userId, input.userId), eq(digitalPurchases.productId, bumpProductId)))
      .limit(1);
    if (!existing) {
      await db.insert(digitalPurchases).values({
        userId: input.userId,
        productId: bumpProductId,
        stripeCheckoutSessionId: input.sessionId,
      });
    }
  } else if ((bumpType === "course" || bumpType === "quiz" || bumpType === "cohort") && bumpProductId) {
    const [existing] = await db
      .select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
      .from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, bumpProductId)))
      .limit(1);
    if (!existing) {
      await db.insert(lmsEnrollments).values({
        userId: input.userId,
        courseId: bumpProductId,
        affiliateCode: null,
        enrollmentType: "full",
      });
    } else if (existing.enrollmentType === "free_preview") {
      // Upgrade free preview to full access on order bump purchase
      await db.update(lmsEnrollments)
        .set({ enrollmentType: "full" })
        .where(eq(lmsEnrollments.id, existing.id));
    }
  } else if (bumpType === "bundle" && bumpProductId) {
    const [existingBundle] = await db
      .select()
      .from(digitalBundlePurchases)
      .where(and(eq(digitalBundlePurchases.userId, input.userId), eq(digitalBundlePurchases.bundleId, bumpProductId)))
      .limit(1);
    if (!existingBundle) {
      await db.insert(digitalBundlePurchases).values({
        userId: input.userId,
        bundleId: bumpProductId,
        stripeCheckoutSessionId: input.sessionId,
      });
    }

    const items = await db.select().from(digitalBundleItems).where(eq(digitalBundleItems.bundleId, bumpProductId));
    for (const item of items) {
      const [existingProduct] = await db
        .select()
        .from(digitalPurchases)
        .where(and(eq(digitalPurchases.userId, input.userId), eq(digitalPurchases.productId, item.productId)))
        .limit(1);
      if (!existingProduct) {
        await db.insert(digitalPurchases).values({
          userId: input.userId,
          productId: item.productId,
          stripeCheckoutSessionId: input.sessionId,
        });
      }
    }
  } else if (bumpType === "webinar" && bumpProductId) {
    // Register user for the webinar
    const [existing] = await db
      .select()
      .from(webinarRegistrations)
      .where(and(eq(webinarRegistrations.userId, input.userId), eq(webinarRegistrations.webinarId, bumpProductId)))
      .limit(1);
    if (!existing) {
      const [webinar] = await db.select({ status: webinars.status }).from(webinars).where(eq(webinars.id, bumpProductId)).limit(1);
      await db.insert(webinarRegistrations).values({
        userId: input.userId,
        webinarId: bumpProductId,
        accessLevel: webinar?.status === "presale" ? "presale" : "full",
        // sessionId is a checkout session ID, not a payment intent, but we store it for reference
        stripePaymentIntentId: input.sessionId,
      });
    }
  } else if (bumpType === "membership" && bumpProductId) {
    // Create an active membership subscription (one-time/lifetime purchase via bump)
    const [existing] = await db
      .select()
      .from(membershipSubscriptions)
      .where(and(
        eq(membershipSubscriptions.userId, input.userId),
        eq(membershipSubscriptions.planId, bumpProductId),
        eq(membershipSubscriptions.status, "active"),
      ))
      .limit(1);
    if (!existing) {
      await db.insert(membershipSubscriptions).values({
        userId: input.userId,
        planId: bumpProductId,
        status: "active",
      });
    }
  }

  const [existingConversion] = await db
    .select()
    .from(orderBumpConversions)
    .where(and(eq(orderBumpConversions.bumpId, bumpId), eq(orderBumpConversions.stripeCheckoutSessionId, input.sessionId)))
    .limit(1);
  if (existingConversion) return;

  await db.insert(orderBumpConversions).values({
    bumpId,
    userId: input.userId,
    triggerOrderType: input.triggerOrderType,
    triggerOrderId: input.triggerOrderId ?? null,
    stripeCheckoutSessionId: input.sessionId,
    bumpAmount,
    status: "completed",
  });
  await db.execute(sql`UPDATE order_bumps SET conversions = conversions + 1 WHERE id = ${bumpId}`);
}
