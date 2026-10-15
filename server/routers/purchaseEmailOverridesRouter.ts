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
  lmsCohortGroups,
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

    // This administration screen must remain useful even while an optional
    // catalog table is being migrated. A missing/older table must not turn an
    // otherwise healthy 99-item catalog into the misleading "No matching
    // content" screen. Each source fails independently and is identified to
    // the administrator for a focused repair.
    const unavailableSources: string[] = [];
    const readCatalog = async <T,>(source: string, query: Promise<T>): Promise<T> => {
      try {
        return await query;
      } catch (error) {
        unavailableSources.push(source);
        console.error(`[purchase-email-overrides] Unable to load ${source}:`, error);
        return [] as unknown as T;
      }
    };

    const [overrides, courses, cohortGroups, downloads, bundles, canonicalBundleRows, webinarRows, workshopRows, instanceRows, products, memberships] = await Promise.all([
      readCatalog("saved email overrides", db.select().from(purchaseEmailOverrides).orderBy(desc(purchaseEmailOverrides.updatedAt))),
      readCatalog("courses and quizzes", db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type, brand: lmsCourses.brand, status: lmsCourses.status }).from(lmsCourses).orderBy(asc(lmsCourses.title))),
      readCatalog("cohort groups", db.select({ id: lmsCohortGroups.id, courseId: lmsCohortGroups.courseId, name: lmsCohortGroups.name, startDate: lmsCohortGroups.startDate, endDate: lmsCohortGroups.endDate, status: lmsCohortGroups.status }).from(lmsCohortGroups).orderBy(asc(lmsCohortGroups.startDate))),
      readCatalog("downloads", db.select({ id: digitalProducts.id, title: digitalProducts.title, brand: digitalProducts.brand, status: digitalProducts.status }).from(digitalProducts).orderBy(asc(digitalProducts.title))),
      readCatalog("digital bundles", db.select({ id: digitalBundles.id, title: digitalBundles.title, brand: digitalBundles.brand, status: digitalBundles.status }).from(digitalBundles).orderBy(asc(digitalBundles.title))),
      readCatalog("bundles", db.select({ id: canonicalBundles.id, title: canonicalBundles.title, brand: canonicalBundles.brand, status: canonicalBundles.status }).from(canonicalBundles).orderBy(asc(canonicalBundles.title))),
      readCatalog("webinars", db.select({ id: webinars.id, title: webinars.title, brand: webinars.brand, status: webinars.status, scheduledAt: webinars.scheduledAt, durationMinutes: webinars.durationMinutes, timezone: webinars.timezone, type: webinars.type }).from(webinars).orderBy(asc(webinars.title))),
      readCatalog("workshops", db.select({ id: workshops.id, title: workshops.title, brand: workshops.brand, status: workshops.status }).from(workshops).orderBy(asc(workshops.title))),
      readCatalog("workshop instances", db.select({ id: workshopInstances.id, workshopId: workshopInstances.workshopId, title: workshopInstances.title, status: workshopInstances.status, workshopTitle: workshops.title, brand: workshops.brand })
        .from(workshopInstances).leftJoin(workshops, eq(workshopInstances.workshopId, workshops.id)).orderBy(asc(workshops.title), asc(workshopInstances.startDate))),
      readCatalog("physical products", db.select({ id: physicalProducts.id, title: physicalProducts.title, brand: physicalProducts.brand, status: physicalProducts.status }).from(physicalProducts).orderBy(asc(physicalProducts.title))),
      readCatalog("membership plans", db.select({ id: membershipPlans.id, title: membershipPlans.title, brand: membershipPlans.brand, status: membershipPlans.status }).from(membershipPlans).orderBy(asc(membershipPlans.title))),
    ]);

    const content = [
      ...courses.map((item) => ({ id: item.id, source: "course", contentType: item.type === "quiz" ? "quiz" : item.type === "cohort" ? "cohort" : "course", title: item.title, brand: item.brand, status: item.status, subtitle: item.type === "cohort" ? "Select a cohort group below to preview its dated confirmation" : null })),
      ...cohortGroups.map((item) => ({ id: item.id, source: "cohort_group", contentType: "cohort", title: item.name, brand: null, status: item.status, subtitle: "Cohort group preview", courseId: item.courseId, previewOnly: true })),
      ...downloads.map((item) => ({ ...item, source: "download", contentType: "download", subtitle: null })),
      ...bundles.map((item) => ({ ...item, source: "digital_bundle", contentType: "bundle", subtitle: "Digital bundle" })),
      ...canonicalBundleRows.map((item) => ({ ...item, source: "canonical_bundle", contentType: "bundle", subtitle: "Bundle" })),
      ...webinarRows.map((item) => ({ ...item, source: "webinar", contentType: "webinar", subtitle: item.scheduledAt ? "Scheduled webinar" : "Date and time to be announced" })),
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
      { id: 1, source: "free_purchase_account_setup", contentType: "account_setup", title: "Free purchase — account setup (All About Ultrasound™)", brand: "all_about_ultrasound", status: "system", subtitle: "New learner password setup", previewOnly: true },
      { id: 2, source: "free_purchase_account_setup", contentType: "account_setup", title: "Free purchase — account setup (iHeartEcho™)", brand: "iheartecho", status: "system", subtitle: "New learner password setup", previewOnly: true },
      { id: 1, source: "team_subscription", contentType: "team_subscription", title: "UltrasoundAssist™ Team/University — monthly", brand: "all_about_ultrasound", status: "system", subtitle: "Organizer subscription confirmation", previewOnly: true },
      { id: 2, source: "team_subscription", contentType: "team_subscription", title: "EchoAssist™ Team/University — monthly", brand: "iheartecho", status: "system", subtitle: "Organizer subscription confirmation", previewOnly: true },
      { id: 3, source: "team_subscription", contentType: "team_subscription", title: "Both Apps Team/University — monthly", brand: "all_about_ultrasound", status: "system", subtitle: "Organizer subscription confirmation", previewOnly: true },
      { id: 4, source: "team_subscription", contentType: "team_subscription", title: "UltrasoundAssist™ Team/University — lifetime", brand: "all_about_ultrasound", status: "system", subtitle: "Organizer subscription confirmation", previewOnly: true },
      { id: 5, source: "team_subscription", contentType: "team_subscription", title: "EchoAssist™ Team/University — lifetime", brand: "iheartecho", status: "system", subtitle: "Organizer subscription confirmation", previewOnly: true },
      { id: 6, source: "team_subscription", contentType: "team_subscription", title: "Both Apps Team/University — lifetime", brand: "all_about_ultrasound", status: "system", subtitle: "Organizer subscription confirmation", previewOnly: true },
    ];

    return { content: [...content, ...systemPreviewContent], overrides, unavailableSources };
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
