import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  digitalBundles,
  digitalProducts,
  bundles as canonicalBundles,
  lmsCourses,
  membershipPlans,
  physicalProducts,
  purchaseEmailOverrides,
  userRoles,
  webinars,
  workshops,
  workshopInstances,
} from "../../drizzle/schema";
import { PURCHASE_EMAIL_CONTENT_TYPES } from "../lib/purchaseEmailOverride";
import { PURCHASE_EMAIL_PREVIEW_SOURCES, renderCurrentPurchaseEmailPreview } from "../lib/purchaseEmailPreview";

const contentTypeSchema = z.enum(PURCHASE_EMAIL_CONTENT_TYPES);
const previewSourceSchema = z.enum(PURCHASE_EMAIL_PREVIEW_SOURCES);

async function assertPlatformAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role === "admin") return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const assigned = await db.select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, ctx.user.id));
  if (!assigned.some(({ role }) => role === "platform_admin" || role === "platform_owner")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform Admin access is required." });
  }
}

const copySchema = z.object({
  contentType: contentTypeSchema,
  contentId: z.number().int().positive(),
  enabled: z.boolean().default(true),
  subject: z.string().trim().max(500).nullable().optional(),
  heading: z.string().trim().max(500).nullable().optional(),
  intro: z.string().trim().max(5000).nullable().optional(),
  detailsHtml: z.string().max(50000).nullable().optional(),
});

export const purchaseEmailOverridesRouter = router({
  /** Lists every eligible item alongside saved per-item override rows. */
  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPlatformAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [overrides, courses, downloads, bundles, canonicalBundleRows, webinarRows, workshopRows, instanceRows, products, memberships] = await Promise.all([
      db.select().from(purchaseEmailOverrides).orderBy(desc(purchaseEmailOverrides.updatedAt)),
      db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type, brand: lmsCourses.brand, status: lmsCourses.status }).from(lmsCourses).orderBy(asc(lmsCourses.title)),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, brand: digitalProducts.brand, status: digitalProducts.status }).from(digitalProducts).orderBy(asc(digitalProducts.title)),
      db.select({ id: digitalBundles.id, title: digitalBundles.title, brand: digitalBundles.brand, status: digitalBundles.status }).from(digitalBundles).orderBy(asc(digitalBundles.title)),
      db.select({ id: canonicalBundles.id, title: canonicalBundles.title, brand: canonicalBundles.brand, status: canonicalBundles.status }).from(canonicalBundles).orderBy(asc(canonicalBundles.title)),
      db.select({ id: webinars.id, title: webinars.title, brand: webinars.brand, status: webinars.status }).from(webinars).orderBy(asc(webinars.title)),
      db.select({ id: workshops.id, title: workshops.title, brand: workshops.brand, status: workshops.status }).from(workshops).orderBy(asc(workshops.title)),
      db.select({ id: workshopInstances.id, workshopId: workshopInstances.workshopId, title: workshopInstances.title, status: workshopInstances.status, workshopTitle: workshops.title, brand: workshops.brand })
        .from(workshopInstances).leftJoin(workshops, eq(workshopInstances.workshopId, workshops.id)).orderBy(asc(workshops.title), asc(workshopInstances.startDate)),
      db.select({ id: physicalProducts.id, title: physicalProducts.title, brand: physicalProducts.brand, status: physicalProducts.status }).from(physicalProducts).orderBy(asc(physicalProducts.title)),
      db.select({ id: membershipPlans.id, title: membershipPlans.title, brand: membershipPlans.brand, status: membershipPlans.status }).from(membershipPlans).orderBy(asc(membershipPlans.title)),
    ]);

    const content = [
      ...courses.map((item) => ({ id: item.id, source: "course", contentType: item.type === "quiz" ? "quiz" : item.type === "cohort" ? "cohort" : "course", title: item.title, brand: item.brand, status: item.status, subtitle: null })),
      ...downloads.map((item) => ({ ...item, source: "download", contentType: "download", subtitle: null })),
      ...bundles.map((item) => ({ ...item, source: "digital_bundle", contentType: "bundle", subtitle: "Digital bundle" })),
      ...canonicalBundleRows.map((item) => ({ ...item, source: "canonical_bundle", contentType: "bundle", subtitle: "Bundle" })),
      ...webinarRows.map((item) => ({ ...item, source: "webinar", contentType: "webinar", subtitle: null })),
      ...workshopRows.map((item) => ({ ...item, source: "workshop", contentType: "workshop", subtitle: "Select an instance below to preview its dated confirmation" })),
      ...instanceRows.map((item) => ({ id: item.id, source: "workshop_instance", contentType: "workshop_instance", title: item.title, brand: item.brand, status: item.status, subtitle: item.workshopTitle ?? `Workshop #${item.workshopId}` })),
      ...products.map((item) => ({ ...item, source: "physical_product", contentType: "physical_product", subtitle: null })),
      ...memberships.map((item) => ({ ...item, source: "membership", contentType: "membership", subtitle: null })),
    ];

    const systemPreviewContent = [
      { id: 1, source: "funnel_fallback", contentType: "membership", title: "Generic funnel / embedded checkout fallback", brand: "all_about_ultrasound", status: "system", subtitle: "Used only when a purchase does not have a product-specific template", previewOnly: true },
      { id: 1, source: "brand_membership", contentType: "membership", title: "UltrasoundAssist™ Premium — new learner", brand: "all_about_ultrasound", status: "system", subtitle: "New-account access and password setup", previewOnly: true },
      { id: 2, source: "brand_membership", contentType: "membership", title: "UltrasoundAssist™ Premium — existing learner", brand: "all_about_ultrasound", status: "system", subtitle: "Existing-account access", previewOnly: true },
      { id: 3, source: "brand_membership", contentType: "membership", title: "EchoAssist™ Premium — new learner", brand: "iheartecho", status: "system", subtitle: "New-account access and password setup", previewOnly: true },
      { id: 4, source: "brand_membership", contentType: "membership", title: "EchoAssist™ Premium — existing learner", brand: "iheartecho", status: "system", subtitle: "Existing-account access", previewOnly: true },
      { id: 1, source: "dual_membership", contentType: "membership", title: "All Access Dual Membership — new learner", brand: "all_about_ultrasound", status: "system", subtitle: "New-account access and password setup", previewOnly: true },
      { id: 2, source: "dual_membership", contentType: "membership", title: "All Access Dual Membership — existing learner", brand: "all_about_ultrasound", status: "system", subtitle: "Existing-account access", previewOnly: true },
    ];

    return { content: [...content, ...systemPreviewContent], overrides };
  }),

  /** Renders the current saved purchase email without creating tokens, users, or sends. */
  preview: protectedProcedure
    .input(z.object({
      source: previewSourceSchema,
      contentId: z.number().int().positive(),
      contentType: contentTypeSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try {
        return await renderCurrentPurchaseEmailPreview(db, input);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Unable to render the current purchase email.",
        });
      }
    }),

  /** Creates or updates a copy record. Saving never sends or resends mail. */
  save: protectedProcedure.input(copySchema).mutation(async ({ ctx, input }) => {
    await assertPlatformAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const clean = {
      enabled: input.enabled,
      subject: input.subject?.trim() || null,
      heading: input.heading?.trim() || null,
      intro: input.intro?.trim() || null,
      detailsHtml: input.detailsHtml?.trim() || null,
      updatedByUserId: ctx.user.id,
      updatedAt: new Date(),
    };
    const [existing] = await db.select({ id: purchaseEmailOverrides.id })
      .from(purchaseEmailOverrides)
      .where(and(
        eq(purchaseEmailOverrides.contentType, input.contentType),
        eq(purchaseEmailOverrides.contentId, input.contentId),
      ))
      .limit(1);

    if (existing) {
      await db.update(purchaseEmailOverrides).set(clean).where(eq(purchaseEmailOverrides.id, existing.id));
      return { id: existing.id, saved: true };
    }

    const [created] = await db.insert(purchaseEmailOverrides).values({
      contentType: input.contentType,
      contentId: input.contentId,
      ...clean,
      createdByUserId: ctx.user.id,
      createdAt: new Date(),
    }).$returningId();
    return { id: created.id, saved: true };
  }),

  /** Reverts an item to its generated purchase email. This never sends mail. */
  revertToDefault: protectedProcedure
    .input(z.object({ contentType: contentTypeSchema, contentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(purchaseEmailOverrides).where(
        and(
          eq(purchaseEmailOverrides.contentType, input.contentType),
          eq(purchaseEmailOverrides.contentId, input.contentId),
        ),
      );
      return { reverted: true };
    }),
});
