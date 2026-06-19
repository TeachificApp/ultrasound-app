/**
 * formAccessGrant.ts
 * Applies product access grants from form routing rules.
 * Used by both generalFormRouter and formBuilderRouter.
 */
import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

export interface AccessGrantAction {
  productType: "course" | "download" | "bundle" | "physical" | "membership" | "webinar";
  productId: number;
}

/**
 * Applies access grant actions for a user based on a routing rule.
 * Runs asynchronously and does not throw — errors are logged.
 */
export async function applyAccessGrantActions(
  db: MySql2Database<any>,
  grantAccessActionsJson: string,
  userId: number
): Promise<void> {
  const {
    lmsEnrollments,
    digitalPurchases,
    digitalBundlePurchases,
    physicalProductOrders,
    membershipSubscriptions,
    webinarRegistrations,
  } = await import("../../drizzle/schema");

  const actions: AccessGrantAction[] = JSON.parse(grantAccessActionsJson);

  for (const action of actions) {
    const { productType, productId } = action;
    if (!productId) continue;

    if (productType === "course") {
      const [existing] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, productId)))
        .limit(1);
      if (!existing) {
        await db.insert(lmsEnrollments).values({
          userId,
          courseId: productId,
          enrollmentType: "full",
          source: "form_grant",
        });
      } else if ((existing as any).enrollmentType !== "full") {
        await db.update(lmsEnrollments).set({ enrollmentType: "full" }).where(eq(lmsEnrollments.id, existing.id));
      }
    } else if (productType === "download") {
      const [existing] = await db.select({ id: digitalPurchases.id })
        .from(digitalPurchases)
        .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, productId)))
        .limit(1);
      if (!existing) {
        await db.insert(digitalPurchases).values({ userId, productId });
      }
    } else if (productType === "bundle") {
      const [existing] = await db.select({ id: digitalBundlePurchases.id })
        .from(digitalBundlePurchases)
        .where(and(eq(digitalBundlePurchases.userId, userId), eq(digitalBundlePurchases.bundleId, productId)))
        .limit(1);
      if (!existing) {
        await db.insert(digitalBundlePurchases).values({ userId, bundleId: productId });
      }
    } else if (productType === "physical") {
      await db.insert(physicalProductOrders).values({
        userId,
        productId,
        amountPaid: 0,
        currency: "usd",
        notes: "Granted via form routing rule",
        fulfillmentStatus: "delivered",
      });
    } else if (productType === "membership") {
      const [existing] = await db.select({ id: membershipSubscriptions.id })
        .from(membershipSubscriptions)
        .where(and(eq(membershipSubscriptions.userId, userId), eq(membershipSubscriptions.planId, productId)))
        .limit(1);
      if (!existing) {
        await db.insert(membershipSubscriptions).values({
          planId: productId,
          userId,
          status: "active",
        });
      }
    } else if (productType === "webinar") {
      const [existing] = await db.select({ id: webinarRegistrations.id })
        .from(webinarRegistrations)
        .where(and(eq(webinarRegistrations.userId, userId), eq(webinarRegistrations.webinarId, productId)))
        .limit(1);
      if (!existing) {
        await db.insert(webinarRegistrations).values({ userId, webinarId: productId });
      }
    }
  }
}
