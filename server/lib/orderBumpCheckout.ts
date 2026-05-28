import { and, eq, sql } from "drizzle-orm";
import {
  digitalBundleItems,
  digitalBundlePurchases,
  digitalBundles,
  digitalProducts,
  digitalPurchases,
  lmsCourses,
  lmsEnrollments,
  orderBumpConversions,
  orderBumps,
} from "../../drizzle/schema";

type TriggerType = "course" | "download" | "bundle";
type BumpType = "course" | "download" | "bundle" | "physical";

export type OrderBumpCheckoutLine = {
  lineItem: Record<string, unknown>;
  metadata: Record<string, string>;
  amount: number;
  requiresShipping: boolean;
};

export async function buildOrderBumpCheckoutLine(
  db: any,
  input: {
    orderBumpId?: number | null;
    triggerType: TriggerType;
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

  const bumpType = bump.bumpType as BumpType;
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
  } else if (bumpType === "course") {
    const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, bump.bumpProductId)).limit(1);
    if (course) {
      name = bump.headline || course.title;
      description = bump.subheadline || course.subtitle || undefined;
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
  }

  if (!amount || amount < 0) return null;

  return {
    amount,
    requiresShipping: bumpType === "physical",
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
    triggerOrderType: TriggerType;
    triggerOrderId?: number | null;
  },
) {
  const bumpId = meta.order_bump_id ? Number(meta.order_bump_id) : null;
  const bumpProductId = meta.order_bump_product_id ? Number(meta.order_bump_product_id) : null;
  const bumpType = meta.order_bump_type as BumpType | undefined;
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
  } else if (bumpType === "course" && bumpProductId) {
    const [existing] = await db
      .select()
      .from(lmsEnrollments)
      .where(and(eq(lmsEnrollments.userId, input.userId), eq(lmsEnrollments.courseId, bumpProductId)))
      .limit(1);
    if (!existing) {
      await db.insert(lmsEnrollments).values({
        userId: input.userId,
        courseId: bumpProductId,
        affiliateCode: null,
      });
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
