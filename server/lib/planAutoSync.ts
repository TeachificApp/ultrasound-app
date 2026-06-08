/**
 * planAutoSync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-sync engine: ensures every published course / digital product / bundle
 * that has a stripe_price_id has a corresponding membership_plan row linked to
 * that price.
 *
 * Rules:
 *  1. One membership plan per Stripe price ID (unique constraint enforced here).
 *  2. If a plan already exists for the price ID → update its title/slug if needed.
 *  3. If no plan exists → create one with status "published" and the correct
 *     billing interval derived from the Stripe price metadata.
 *  4. For course plans: the course itself is auto-added as an access item when
 *     the plan is first created. Admins can add more items via the plan editor.
 *
 * Usage:
 *   import { syncPlanForCourse } from "./planAutoSync";
 *   await syncPlanForCourse(db, courseId);
 */

import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { membershipPlans, membershipPlanAccess, lmsCourses, digitalProducts } from "../../drizzle/schema";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type PlanSyncResult = {
  action: "created" | "updated" | "skipped" | "error";
  planId?: number;
  message: string;
  sourceTitle?: string;
  stripePriceId?: string;
};

/**
 * Ensure a membership plan exists for a given Stripe price ID.
 * Creates or updates the plan as needed.
 */
export async function ensurePlanForStripePrice(
  db: MySql2Database<typeof schema>,
  opts: {
    stripePriceId: string;
    title: string;
    billingInterval?: "monthly" | "annual" | "lifetime" | "one_time";
    price?: number;
    brand?: "all_about_ultrasound" | "iheartecho";
    stripeProductId?: string | null;
  }
): Promise<PlanSyncResult> {
  try {
    // Check if plan already exists for this price ID
    const [existing] = await db
      .select({ id: membershipPlans.id, title: membershipPlans.title })
      .from(membershipPlans)
      .where(eq(membershipPlans.stripePriceId, opts.stripePriceId))
      .limit(1);

    if (existing) {
      return {
        action: "skipped",
        planId: existing.id,
        message: `Plan already exists (id=${existing.id}, title="${existing.title}")`,
        sourceTitle: opts.title,
        stripePriceId: opts.stripePriceId,
      };
    }

    // Create new plan
    const slug = slugify(opts.title);
    const [slugConflict] = await db
      .select({ id: membershipPlans.id })
      .from(membershipPlans)
      .where(eq(membershipPlans.slug, slug))
      .limit(1);
    const finalSlug = slugConflict ? `${slug}-${Date.now()}` : slug;

    const [result] = await db.insert(membershipPlans).values({
      title: opts.title,
      slug: finalSlug,
      brand: opts.brand ?? "all_about_ultrasound",
      status: "published",
      billingInterval: opts.billingInterval ?? "monthly",
      price: opts.price ?? 0,
      stripePriceId: opts.stripePriceId,
      stripeProductId: opts.stripeProductId ?? null,
      trialDays: 0,
      accentColor: "#189aa1",
    });

    const planId = (result as any).insertId as number;
    return {
      action: "created",
      planId,
      message: `Created plan id=${planId} for price ${opts.stripePriceId}`,
      sourceTitle: opts.title,
      stripePriceId: opts.stripePriceId,
    };
  } catch (err: any) {
    return {
      action: "error",
      message: err?.message ?? "Unknown error",
      sourceTitle: opts.title,
      stripePriceId: opts.stripePriceId,
    };
  }
}

/**
 * Sync a membership plan for a specific LMS course.
 * No-op if the course has no stripe_price_id.
 * Auto-adds the course as an access item when a new plan is created.
 */
export async function syncPlanForCourse(
  db: MySql2Database<typeof schema>,
  courseId: number
): Promise<PlanSyncResult> {
  const [course] = await db
    .select({
      id: lmsCourses.id,
      title: lmsCourses.title,
      stripePriceId: lmsCourses.stripePriceId,
    })
    .from(lmsCourses)
    .where(eq(lmsCourses.id, courseId))
    .limit(1);

  if (!course) {
    return { action: "error", message: `Course ${courseId} not found` };
  }
  if (!course.stripePriceId) {
    return {
      action: "skipped",
      message: `Course "${course.title}" has no stripe_price_id`,
      sourceTitle: course.title ?? undefined,
    };
  }

  const result = await ensurePlanForStripePrice(db, {
    stripePriceId: course.stripePriceId,
    title: course.title ?? `Course ${courseId}`,
    billingInterval: "monthly",
  });

  // Auto-add the course as an access item when a new plan is created
  if (result.action === "created" && result.planId) {
    try {
      await db.insert(membershipPlanAccess).values({
        planId: result.planId,
        itemType: "course",
        itemId: course.id,
        label: course.title ?? undefined,
        sortOrder: 0,
      });
    } catch {
      // ignore duplicate key errors
    }
  }

  return result;
}

/**
 * Sync a membership plan for a specific digital product.
 * No-op if the product has no stripe_price_id.
 */
export async function syncPlanForDigitalProduct(
  db: MySql2Database<typeof schema>,
  productId: number
): Promise<PlanSyncResult> {
  const [product] = await db
    .select({
      id: digitalProducts.id,
      title: digitalProducts.title,
      stripePriceId: digitalProducts.stripePriceId,
      stripeProductId: digitalProducts.stripeProductId,
    })
    .from(digitalProducts)
    .where(eq(digitalProducts.id, productId))
    .limit(1);

  if (!product) {
    return { action: "error", message: `Digital product ${productId} not found` };
  }
  if (!product.stripePriceId) {
    return {
      action: "skipped",
      message: `Product "${product.title}" has no stripe_price_id`,
      sourceTitle: product.title ?? undefined,
    };
  }

  return ensurePlanForStripePrice(db, {
    stripePriceId: product.stripePriceId,
    title: product.title ?? `Product ${productId}`,
    stripeProductId: product.stripeProductId ?? null,
    billingInterval: "one_time",
  });
}

/**
 * Bulk backfill: sync plans for ALL courses and digital products that have
 * a stripe_price_id but no matching membership plan.
 */
export async function bulkSyncAllPlans(
  db: MySql2Database<typeof schema>
): Promise<PlanSyncResult[]> {
  const results: PlanSyncResult[] = [];

  // Sync all courses with stripe_price_id
  const allCourses = await db
    .select({ id: lmsCourses.id, title: lmsCourses.title, stripePriceId: lmsCourses.stripePriceId })
    .from(lmsCourses)
    .where(eq(lmsCourses.status, "public"));

  for (const course of allCourses) {
    if (!course.stripePriceId) continue;
    const r = await ensurePlanForStripePrice(db, {
      stripePriceId: course.stripePriceId,
      title: course.title ?? `Course ${course.id}`,
      billingInterval: "monthly",
    });
    results.push(r);
  }

  // Sync all published digital products with stripe_price_id
  const allProducts = await db
    .select({
      id: digitalProducts.id,
      title: digitalProducts.title,
      stripePriceId: digitalProducts.stripePriceId,
      stripeProductId: digitalProducts.stripeProductId,
    })
    .from(digitalProducts)
    .where(eq(digitalProducts.status, "published"));

  for (const product of allProducts) {
    if (!product.stripePriceId) continue;
    const r = await ensurePlanForStripePrice(db, {
      stripePriceId: product.stripePriceId,
      title: product.title ?? `Product ${product.id}`,
      stripeProductId: product.stripeProductId ?? null,
      billingInterval: "one_time",
    });
    results.push(r);
  }

  return results;
}
