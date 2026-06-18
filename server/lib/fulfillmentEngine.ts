/**
 * Fulfillment Engine — UltrasoundAssist™
 *
 * This is the single source of truth for granting access after a paid order.
 * It is called by:
 *   1. The Stripe webhook (payment_intent.succeeded) for paid orders
 *   2. The free-order handler (processFreeOrder) for $0 orders
 *   3. The admin retry UI to re-run failed fulfillments
 *   4. The background retry cron job
 *
 * Every paid order creates a pending_fulfillments record BEFORE fulfillment
 * runs. On success the status is set to "completed". On failure the record
 * stays "pending" / "failed" so it can be retried without data loss.
 *
 * Fulfillment is IDEMPOTENT — running it twice for the same user+product is
 * safe and will not create duplicate enrollments or memberships.
 */

import { and, eq, sql } from "drizzle-orm";
import {
  pendingFulfillments,
  lmsEnrollments,
  digitalPurchases,
  digitalBundlePurchases,
  digitalBundleItems,
  brandMemberships,
  lmsCourses,
} from "../../drizzle/schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";

export type FulfillmentInput = {
  /** Stripe payment intent ID (used for idempotency) */
  stripePaymentIntentId?: string | null;
  /** Resolved user ID — may be null if auto-account creation failed */
  userId: number | null;
  /** Buyer email — always required */
  email: string;
  customerName?: string | null;
  /** Product display name */
  productName: string;
  /** Product type */
  productType: "course" | "download" | "physical" | "membership" | "bundle" | "other";
  /** LMS course ID to enroll the user in */
  courseId?: number | null;
  /** Digital download / physical / bundle product ID */
  productId?: number | null;
  /** Brand membership to grant */
  fulfillmentBrand?: "aaus" | "iheartecho" | "both" | null;
  /** Additional bonus access items */
  additionalAccess?: Array<{
    type: string;
    productId?: number;
    brand?: string;
    label: string;
  }> | null;
  /** Amount paid in DOLLARS (not cents) */
  amountPaid: number;
};

export type FulfillmentResult = {
  success: boolean;
  notes: string[];
  error?: string;
};

/**
 * Create or update a pending_fulfillments record before running fulfillment.
 * Returns the record ID so we can update it after fulfillment completes.
 */
export async function createPendingFulfillmentRecord(
  db: MySql2Database<typeof schema>,
  input: FulfillmentInput
): Promise<number> {
  // Check if a record already exists for this payment intent
  if (input.stripePaymentIntentId) {
    const [existing] = await db
      .select({ id: pendingFulfillments.id, status: pendingFulfillments.status })
      .from(pendingFulfillments)
      .where(eq(pendingFulfillments.stripePaymentIntentId, input.stripePaymentIntentId))
      .limit(1);
    if (existing) {
      // Update with latest user ID if it was resolved after initial creation
      if (input.userId && !existing.status) {
        await db.update(pendingFulfillments)
          .set({ userId: input.userId, updatedAt: new Date() })
          .where(eq(pendingFulfillments.id, existing.id));
      }
      return existing.id;
    }
  }

  const [result] = await db.insert(pendingFulfillments).values({
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    userId: input.userId,
    email: input.email,
    customerName: input.customerName ?? null,
    productName: input.productName,
    productType: input.productType,
    productId: input.productId ?? null,
    courseId: input.courseId ?? null,
    fulfillmentBrand: input.fulfillmentBrand ?? null,
    additionalAccessJson: input.additionalAccess ? JSON.stringify(input.additionalAccess) : null,
    amountPaid: String(Number(input.amountPaid).toFixed(2)),
    status: "pending",
    attempts: 0,
  });
  return (result as any).insertId as number;
}

/**
 * Execute fulfillment for a paid order.
 * This is IDEMPOTENT — safe to call multiple times for the same order.
 *
 * @param db - Drizzle database instance
 * @param input - Fulfillment parameters
 * @param pendingFulfillmentId - ID of the pending_fulfillments record to update
 */
export async function executeFulfillment(
  db: MySql2Database<typeof schema>,
  input: FulfillmentInput,
  pendingFulfillmentId?: number
): Promise<FulfillmentResult> {
  const notes: string[] = [];
  const errors: string[] = [];

  // Update attempt count
  if (pendingFulfillmentId) {
    await db.update(pendingFulfillments)
      .set({
        attempts: sql`${pendingFulfillments.attempts} + 1`,
        lastAttemptAt: new Date(),
        userId: input.userId ?? undefined,
      })
      .where(eq(pendingFulfillments.id, pendingFulfillmentId));
  }

  const userId = input.userId;

  if (!userId) {
    const errMsg = `Cannot fulfill order: no user ID resolved for email ${input.email}`;
    console.error(`[FulfillmentEngine] ${errMsg}`);
    if (pendingFulfillmentId) {
      await db.update(pendingFulfillments)
        .set({ status: "failed", errorMessage: errMsg })
        .where(eq(pendingFulfillments.id, pendingFulfillmentId));
    }
    return { success: false, notes, error: errMsg };
  }

  // ── 1. LMS Course Enrollment ──────────────────────────────────────────────
  const courseId = input.courseId ?? (input.productType === "course" ? input.productId : null);
  if (courseId) {
    try {
      const [existing] = await db
        .select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId)))
        .limit(1);
      if (!existing) {
        await db.insert(lmsEnrollments).values({
          userId,
          courseId,
          orderId: null,
          affiliateCode: null,
          enrollmentType: "full",
        });
        notes.push(`Enrolled in course #${courseId}`);
        console.log(`[FulfillmentEngine] Enrolled user ${userId} in course ${courseId}`);
        const { onCourseEnrollment } = await import("./communityAutoJoin");
        onCourseEnrollment(userId, courseId);
      } else if (existing.enrollmentType === "free_preview") {
        // Upgrade free preview enrollment to full access
        await db.update(lmsEnrollments)
          .set({ enrollmentType: "full" })
          .where(eq(lmsEnrollments.id, existing.id));
        notes.push(`Upgraded free preview enrollment to full access for course #${courseId}`);
        console.log(`[FulfillmentEngine] Upgraded user ${userId} from free_preview to full enrollment in course ${courseId}`);
        const { onCourseEnrollment } = await import("./communityAutoJoin");
        onCourseEnrollment(userId, courseId);
      } else {
        notes.push(`Already enrolled in course #${courseId} (idempotent)`);
        console.log(`[FulfillmentEngine] User ${userId} already enrolled in course ${courseId} — skipping`);
      }
    } catch (err: any) {
      const msg = `Failed to enroll user ${userId} in course ${courseId}: ${err?.message ?? err}`;
      console.error(`[FulfillmentEngine] ${msg}`);
      errors.push(msg);
    }
  }

  // ── 2. Digital Download Access ────────────────────────────────────────────
  const downloadProductId = input.productType === "download" ? input.productId : null;
  if (downloadProductId) {
    try {
      const [existing] = await db
        .select({ id: digitalPurchases.id })
        .from(digitalPurchases)
        .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, downloadProductId)))
        .limit(1);
      if (!existing) {
        await db.insert(digitalPurchases).values({
          userId,
          productId: downloadProductId,
          stripeCheckoutSessionId: input.stripePaymentIntentId ?? null,
        });
        notes.push(`Granted download access #${downloadProductId}`);
        console.log(`[FulfillmentEngine] Granted download ${downloadProductId} to user ${userId}`);
      } else {
        notes.push(`Download #${downloadProductId} already granted (idempotent)`);
      }
    } catch (err: any) {
      const msg = `Failed to grant download ${downloadProductId} to user ${userId}: ${err?.message ?? err}`;
      console.error(`[FulfillmentEngine] ${msg}`);
      errors.push(msg);
    }
  }

  // ── 3. Digital Bundle Access ──────────────────────────────────────────────
  const bundleProductId = input.productType === "bundle" ? input.productId : null;
  if (bundleProductId) {
    try {
      const [existingBundle] = await db
        .select({ id: digitalBundlePurchases.id })
        .from(digitalBundlePurchases)
        .where(and(eq(digitalBundlePurchases.userId, userId), eq(digitalBundlePurchases.bundleId, bundleProductId)))
        .limit(1);
      if (!existingBundle) {
        await db.insert(digitalBundlePurchases).values({
          userId,
          bundleId: bundleProductId,
          stripeCheckoutSessionId: input.stripePaymentIntentId ?? null,
        });
        // Also grant access to each item in the bundle
        const bundleItems = await db
          .select()
          .from(digitalBundleItems)
          .where(eq(digitalBundleItems.bundleId, bundleProductId));
        for (const item of bundleItems) {
          const [existingItem] = await db
            .select({ id: digitalPurchases.id })
            .from(digitalPurchases)
            .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, item.productId)))
            .limit(1);
          if (!existingItem) {
            await db.insert(digitalPurchases).values({
              userId,
              productId: item.productId,
              stripeCheckoutSessionId: input.stripePaymentIntentId ?? null,
            });
          }
        }
        notes.push(`Granted bundle access #${bundleProductId} (${bundleItems.length} items)`);
        console.log(`[FulfillmentEngine] Granted bundle ${bundleProductId} to user ${userId}`);
      } else {
        notes.push(`Bundle #${bundleProductId} already granted (idempotent)`);
      }
    } catch (err: any) {
      const msg = `Failed to grant bundle ${bundleProductId} to user ${userId}: ${err?.message ?? err}`;
      console.error(`[FulfillmentEngine] ${msg}`);
      errors.push(msg);
    }
  }

  // ── 4. Brand Membership ───────────────────────────────────────────────────
  // SECURITY GUARD: Brand membership can ONLY be granted when productType is
  // "membership". Courses, downloads, bundles, and all other product types
  // must never trigger brand access — even if fulfillmentBrand is accidentally
  // set on the checkout block.
  if (input.fulfillmentBrand && input.productType === "membership") {
    const brandsToGrant: ("aaus" | "iheartecho")[] =
      input.fulfillmentBrand === "both" ? ["aaus", "iheartecho"] : [input.fulfillmentBrand];
    for (const brand of brandsToGrant) {
      try {
        const [existing] = await db
          .select({ id: brandMemberships.id })
          .from(brandMemberships)
          .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brand)))
          .limit(1);
        if (existing) {
          await db.update(brandMemberships)
            .set({ tier: "premium", status: "active", source: "stripe", grantedAt: new Date() })
            .where(eq(brandMemberships.id, existing.id));
          notes.push(`Upgraded ${brand} membership to premium`);
        } else {
          await db.insert(brandMemberships).values({
            userId,
            brand,
            tier: "premium",
            status: "active",
            source: "stripe",
            stripeSubscriptionId: null,
            stripeCustomerId: null,
          });
          notes.push(`Granted ${brand} premium membership`);
        }
        console.log(`[FulfillmentEngine] Granted ${brand} premium to user ${userId}`);
      } catch (err: any) {
        const msg = `Failed to grant ${brand} membership to user ${userId}: ${err?.message ?? err}`;
        console.error(`[FulfillmentEngine] ${msg}`);
        errors.push(msg);
      }
    }
  }

  // ── 5. Additional Access Items (bonus) ────────────────────────────────────
  const additionalItems = input.additionalAccess ?? [];
  for (const item of additionalItems) {
    try {
      if (item.type === "course" && item.productId) {
        const [existing] = await db
          .select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, item.productId)))
          .limit(1);
        if (!existing) {
          await db.insert(lmsEnrollments).values({
            userId,
            courseId: item.productId,
            orderId: null,
            affiliateCode: null,
            enrollmentType: "full",
          });
          notes.push(`Bonus course: ${item.label}`);
        } else if (existing.enrollmentType === "free_preview") {
          await db.update(lmsEnrollments)
            .set({ enrollmentType: "full" })
            .where(eq(lmsEnrollments.id, existing.id));
          notes.push(`Upgraded free preview to full for bonus course: ${item.label}`);
        }
      } else if (item.type === "download" && item.productId) {
        const [existing] = await db
          .select({ id: digitalPurchases.id })
          .from(digitalPurchases)
          .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, item.productId)))
          .limit(1);
        if (!existing) {
          await db.insert(digitalPurchases).values({
            userId,
            productId: item.productId,
            stripeCheckoutSessionId: input.stripePaymentIntentId ?? null,
          });
          notes.push(`Bonus download: ${item.label}`);
        }
      } else if (item.type === "membership" && item.brand) {
        const brandsToGrant: ("aaus" | "iheartecho")[] =
          item.brand === "both" ? ["aaus", "iheartecho"] : [item.brand as "aaus" | "iheartecho"];
        for (const brand of brandsToGrant) {
          const [existing] = await db
            .select({ id: brandMemberships.id })
            .from(brandMemberships)
            .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, brand)))
            .limit(1);
          if (existing) {
            await db.update(brandMemberships)
              .set({ tier: "premium", status: "active", source: "stripe", grantedAt: new Date() })
              .where(eq(brandMemberships.id, existing.id));
          } else {
            await db.insert(brandMemberships).values({
              userId,
              brand,
              tier: "premium",
              status: "active",
              source: "stripe",
              stripeSubscriptionId: null,
              stripeCustomerId: null,
            });
          }
          notes.push(`Bonus membership: ${item.label} (${brand})`);
        }
      }
    } catch (itemErr: any) {
      const msg = `Failed to grant bonus "${item.label}": ${itemErr?.message ?? itemErr}`;
      console.error(`[FulfillmentEngine] ${msg}`);
      errors.push(msg);
    }
  }

  // ── Update pending_fulfillments record ────────────────────────────────────
  const hasErrors = errors.length > 0;
  const hasCriticalFailure = errors.length > 0 && notes.length === 0;
  const finalStatus = hasCriticalFailure ? "failed" : "completed";

  if (pendingFulfillmentId) {
    await db.update(pendingFulfillments)
      .set({
        status: finalStatus,
        completedAt: finalStatus === "completed" ? new Date() : undefined,
        errorMessage: hasErrors ? errors.join("; ") : null,
        fulfillmentNotes: notes.join(", "),
      })
      .where(eq(pendingFulfillments.id, pendingFulfillmentId));
  }

  if (hasCriticalFailure) {
    return { success: false, notes, error: errors.join("; ") };
  }

  return { success: true, notes, error: hasErrors ? errors.join("; ") : undefined };
}

/**
 * Get the course slug for building access URLs.
 */
export async function getCourseSlug(
  db: MySql2Database<typeof schema>,
  courseId: number
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ slug: lmsCourses.slug })
      .from(lmsCourses)
      .where(eq(lmsCourses.id, courseId))
      .limit(1);
    return row?.slug ?? null;
  } catch {
    return null;
  }
}
