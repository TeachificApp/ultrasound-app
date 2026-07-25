/**
 * funnelRouter.ts — Standalone Funnel Builder (ClickFunnels-style)
 * Supports creating multi-step sales funnels independent of courses/downloads,
 * with optional product attachment and order bump integration.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getOrCreateUserByEmail } from "../db";
import { funnels, funnelPages, funnelLeads, funnelTemplates, lmsCourses, lmsLandingPages, digitalProducts, digitalBundles, funnelBranchRules, funnelBranchConditions, emailCampaigns, funnelPurchases, lmsEnrollments, digitalPurchases, digitalBundlePurchases, digitalBundleItems, brandMemberships, physicalProducts, lmsOrders, users, webinarRegistrations, bundleEnrollments, webinars, communities, workshops, workshopInstances, lmsCohortGroups } from "../../drizzle/schema";
import { eq, and, asc, desc, sql, inArray, or, like, isNotNull, gte } from "drizzle-orm";
import { evaluateBranchRules, type VisitorContext } from "../lib/funnelBranchEngine";
import { computeFunnelCheckoutTotalCents } from "../lib/checkoutPricing";
import { getStripeClient } from "../lib/stripeClient";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

/**
 * Returns a slug that is unique within the given funnel's pages.
 * If `baseSlug` already exists in the funnel, appends -2, -3, -4, ... until unique.
 * This prevents duplicate URL slugs like two pages both at /landing-page.
 */
async function uniquePageSlug(
  db: Awaited<ReturnType<typeof getDb>>,
  funnelId: number,
  baseSlug: string
): Promise<string> {
  const existingPages = await db
    .select({ slug: funnelPages.slug })
    .from(funnelPages)
    .where(eq(funnelPages.funnelId, funnelId));
  const existingSlugs = new Set(existingPages.map(p => p.slug));
  if (!existingSlugs.has(baseSlug)) return baseSlug;
  let attempt = 2;
  while (existingSlugs.has(`${baseSlug}-${attempt}`)) attempt++;
  return `${baseSlug}-${attempt}`;
}

// ─── Admin Router ────────────────────────────────────────────────────────────

export const funnelRouter = router({
  /** List all products (courses, downloads, bundles) for order bump picker */
  listAllProducts: publicProcedure.query(async () => {
    const db = await getDb();
    const [courses, downloads, bundles, physical, webinarList, communityList, workshopList] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, price: lmsCourses.price, thumbnailUrl: lmsCourses.thumbnailUrl, courseType: lmsCourses.type }).from(lmsCourses).orderBy(asc(lmsCourses.title)),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, price: digitalProducts.price, thumbnailUrl: digitalProducts.thumbnailUrl }).from(digitalProducts).orderBy(asc(digitalProducts.title)),
      db.select({ id: digitalBundles.id, title: digitalBundles.title, price: digitalBundles.discountPrice, thumbnailUrl: digitalBundles.thumbnailUrl }).from(digitalBundles).orderBy(asc(digitalBundles.title)),
      db.select({ id: physicalProducts.id, title: physicalProducts.title, price: physicalProducts.price, thumbnailUrl: physicalProducts.thumbnailUrl }).from(physicalProducts).orderBy(asc(physicalProducts.title)),
      db.select({ id: webinars.id, title: webinars.title, slug: webinars.slug, price: webinars.price, coverImage: webinars.coverImage, accessType: webinars.accessType }).from(webinars).where(eq(webinars.status, "published")).orderBy(asc(webinars.title)),
      db.select({ id: communities.id, title: communities.title, slug: communities.slug, coverImage: communities.coverImage, accessType: communities.accessType }).from(communities).where(eq(communities.status, "published")).orderBy(asc(communities.title)),
      db.select({ id: workshops.id, title: workshops.title, slug: workshops.slug, price: workshops.price, thumbnailUrl: workshops.thumbnailUrl, isFree: workshops.isFree, status: workshops.status }).from(workshops).orderBy(asc(workshops.title)),
    ]);
    // Hardcoded app products (UltrasoundAssist + EchoAssist, Free + Premium)
    // Use hero banner images (teal probe / teal heart) for product cards
    const AAUS_HERO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/ultrasound-hero-probe-3bWMAQMJw9YFHoPXwbt8bZ.webp";
    const IHE_HERO  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp";
    const APP_PRODUCTS = [
      { id: 1001, type: "app" as const, name: "UltrasoundAssist™ — Free", price: 0, imageUrl: AAUS_HERO, href: "https://app.allaboutultrasound.com", isFree: true, appLabel: "UltrasoundAssist™" },
      { id: 1002, type: "app" as const, name: "UltrasoundAssist™ — Premium", price: 9.97, imageUrl: AAUS_HERO, href: "https://app.allaboutultrasound.com", isFree: false, appLabel: "UltrasoundAssist™", priceLabel: "$9.97/mo" },
      { id: 1003, type: "app" as const, name: "EchoAssist™ — Free", price: 0, imageUrl: IHE_HERO, href: "https://app.iheartecho.com", isFree: true, appLabel: "EchoAssist™" },
      { id: 1004, type: "app" as const, name: "EchoAssist™ — Premium", price: 9.97, imageUrl: IHE_HERO, href: "https://app.iheartecho.com", isFree: false, appLabel: "EchoAssist™", priceLabel: "$9.97/mo" },
      { id: 1005, type: "app" as const, name: "UltrasoundAssist™ + EchoAssist™ — Bundle", price: 12.99, imageUrl: AAUS_HERO, href: "https://app.allaboutultrasound.com", isFree: false, appLabel: "UltrasoundAssist™ + EchoAssist™", priceLabel: "$12.99/mo" },
    ];
    return [
      // All prices returned in DOLLARS (DB stores cents for courses/downloads/bundles/physical/webinars)
      ...courses.map(c => ({ id: c.id, type: (c.courseType === "cohort" ? "cohort" : c.courseType === "quiz" ? "quiz" : "course") as string, name: c.title, price: Number(c.price ?? 0) / 100, imageUrl: c.thumbnailUrl ?? "" })),
      ...downloads.map(d => ({ id: d.id, type: "download" as const, name: d.title, price: Number(d.price ?? 0) / 100, imageUrl: d.thumbnailUrl ?? "" })),
      ...bundles.map(b => ({ id: b.id, type: "bundle" as const, name: b.title, price: Number(b.price ?? 0) / 100, imageUrl: b.thumbnailUrl ?? "" })),
      ...physical.map(p => ({ id: p.id, type: "physical" as const, name: p.title, price: Number(p.price ?? 0) / 100, imageUrl: p.thumbnailUrl ?? "" })),
      ...webinarList.map(w => ({ id: w.id, type: "webinar" as const, name: w.title, price: Number(w.price ?? 0) / 100, imageUrl: w.coverImage ?? "", isFree: w.accessType === "free" })),
      ...communityList.map(c => ({ id: c.id, type: "community" as const, name: c.title, price: 0, imageUrl: c.coverImage ?? "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp", isFree: c.accessType === "free" })),
      ...workshopList.map(w => ({ id: w.id, type: "workshop" as const, name: w.title, price: Number(w.price ?? 0) / 100, imageUrl: w.thumbnailUrl ?? "", isFree: w.isFree })),
      ...APP_PRODUCTS, // App products already in dollars (9.97, 12.99, etc.)
    ];
  }),

  /**
   * Fetch full product details for a list of {type, id} pairs.
   * Used by RelatedProductsBlock in manual selection mode.
   */
  getProductsByIds: publicProcedure
    .input(z.object({
      items: z.array(z.object({ type: z.string(), id: z.number() })),
    }))
    .query(async ({ input }) => {
      if (input.items.length === 0) return [];
      const db = await getDb();

      const courseIds = input.items.filter(i => i.type === "course" || i.type === "quiz").map(i => i.id);
      const cohortIds = input.items.filter(i => i.type === "cohort").map(i => i.id);
      const downloadIds = input.items.filter(i => i.type === "download").map(i => i.id);
      const bundleIds = input.items.filter(i => i.type === "bundle").map(i => i.id);
      const physicalIds = input.items.filter(i => i.type === "physical").map(i => i.id);
      const webinarIds = input.items.filter(i => i.type === "webinar").map(i => i.id);
      const communityIds = input.items.filter(i => i.type === "community").map(i => i.id);
      const workshopIds = input.items.filter(i => i.type === "workshop").map(i => i.id);
      const appIds = input.items.filter(i => i.type === "app").map(i => i.id);
      const allLmsCourseIds = [...new Set([...courseIds, ...cohortIds])];

      // Hardcoded app products registry — use hero banner images for product cards
      const AAUS_HERO_R = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/ultrasound-hero-probe-3bWMAQMJw9YFHoPXwbt8bZ.webp";
      const IHE_HERO_R  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp";
      const APP_REGISTRY: Record<number, { id: number; type: string; title: string; slug: string; description: string; price: number; isFree: boolean; imageUrl: string; href: string; appLabel?: string }> = {
        1001: { id: 1001, type: "app", title: "UltrasoundAssist™ — Free", slug: "ultrasound-assist-free", description: "AI-powered ultrasound clinical intelligence, free tier.", price: 0, isFree: true, imageUrl: AAUS_HERO_R, href: "https://app.allaboutultrasound.com", appLabel: "UltrasoundAssist™" },
        1002: { id: 1002, type: "app", title: "UltrasoundAssist™ — Premium", slug: "ultrasound-assist-premium", description: "Full access to AI-powered ultrasound clinical intelligence.", price: 9.97, isFree: false, imageUrl: AAUS_HERO_R, href: "https://app.allaboutultrasound.com", appLabel: "UltrasoundAssist™", priceLabel: "$9.97/mo" },
        1003: { id: 1003, type: "app", title: "EchoAssist™ — Free", slug: "echo-assist-free", description: "AI-powered echocardiography clinical intelligence, free tier.", price: 0, isFree: true, imageUrl: IHE_HERO_R, href: "https://app.iheartecho.com", appLabel: "EchoAssist™" },
        1004: { id: 1004, type: "app", title: "EchoAssist™ — Premium", slug: "echo-assist-premium", description: "Full access to AI-powered echocardiography clinical intelligence.", price: 9.97, isFree: false, imageUrl: IHE_HERO_R, href: "https://app.iheartecho.com", appLabel: "EchoAssist™", priceLabel: "$9.97/mo" },
        1005: { id: 1005, type: "app", title: "UltrasoundAssist™ + EchoAssist™ — Bundle", slug: "ultrasound-echo-bundle", description: "Full access to both UltrasoundAssist™ and EchoAssist™ premium apps.", price: 12.99, isFree: false, imageUrl: AAUS_HERO_R, href: "https://app.allaboutultrasound.com", appLabel: "UltrasoundAssist™ + EchoAssist™", priceLabel: "$12.99/mo" },
      };

      const [courses, downloads, bundles, physicals, webinarRows, communityRows, workshopRows] = await Promise.all([
        allLmsCourseIds.length > 0
          ? db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, price: lmsCourses.price, isFree: lmsCourses.isFree, description: lmsCourses.subtitle, imageUrl: lmsCourses.coverImageUrl, courseType: lmsCourses.type, pricingType: lmsCourses.pricingType, subscriptionInterval: lmsCourses.subscriptionInterval }).from(lmsCourses).where(inArray(lmsCourses.id, allLmsCourseIds))
          : [],
        downloadIds.length > 0
          ? db.select({ id: digitalProducts.id, title: digitalProducts.title, slug: digitalProducts.slug, price: digitalProducts.price, isFree: digitalProducts.isFree, description: digitalProducts.subtitle, imageUrl: digitalProducts.thumbnailUrl }).from(digitalProducts).where(inArray(digitalProducts.id, downloadIds))
          : [],
        bundleIds.length > 0
          ? db.select({ id: digitalBundles.id, title: digitalBundles.title, slug: digitalBundles.slug, price: digitalBundles.discountPrice, description: digitalBundles.description, imageUrl: digitalBundles.thumbnailUrl }).from(digitalBundles).where(inArray(digitalBundles.id, bundleIds))
          : [],
        physicalIds.length > 0
          ? db.select({ id: physicalProducts.id, title: physicalProducts.title, slug: physicalProducts.slug, price: physicalProducts.price, description: physicalProducts.description, imageUrl: physicalProducts.thumbnailUrl }).from(physicalProducts).where(inArray(physicalProducts.id, physicalIds))
          : [],
        webinarIds.length > 0
          ? db.select({ id: webinars.id, title: webinars.title, slug: webinars.slug, price: webinars.price, description: webinars.subtitle, imageUrl: webinars.coverImage, accessType: webinars.accessType }).from(webinars).where(inArray(webinars.id, webinarIds))
          : [],
        communityIds.length > 0
          ? db.select({ id: communities.id, title: communities.title, slug: communities.slug, description: communities.description, imageUrl: communities.coverImage, accessType: communities.accessType }).from(communities).where(inArray(communities.id, communityIds))
          : [],
        workshopIds.length > 0
          ? db.select({ id: workshops.id, title: workshops.title, slug: workshops.slug, price: workshops.price, description: workshops.subtitle, imageUrl: workshops.thumbnailUrl, isFree: workshops.isFree }).from(workshops).where(inArray(workshops.id, workshopIds))
          : [],
      ]);

      // Fallback: if a courseId was requested but not found in lms_courses,
      // check digital_products. This handles legacy block data where a download
      // was accidentally saved as type="course" in manualItems.
      const foundCourseIds = new Set((courses as any[]).map((c: any) => c.id));
      const missingCourseIds = courseIds.filter(id => !foundCourseIds.has(id));
      let fallbackDownloads: any[] = [];
      if (missingCourseIds.length > 0) {
        fallbackDownloads = await db
          .select({ id: digitalProducts.id, title: digitalProducts.title, slug: digitalProducts.slug, price: digitalProducts.price, isFree: digitalProducts.isFree, description: digitalProducts.subtitle, imageUrl: digitalProducts.thumbnailUrl })
          .from(digitalProducts)
          .where(inArray(digitalProducts.id, missingCourseIds));
      }

      // Pre-fetch cohort group data before map population
      const now = new Date();
      const cohortCourseRows = (courses as any[]).filter((c: any) => c.courseType === "cohort");
      const cohortGroupMap = new Map<number, { name: string; startDate: Date | null; endDate: Date | null } | null>();
      if (cohortCourseRows.length > 0) {
        const cohortCourseIdsArr = cohortCourseRows.map((c: any) => c.id);
        const allGroups = await db.select({ courseId: lmsCohortGroups.courseId, name: lmsCohortGroups.name, startDate: lmsCohortGroups.startDate, endDate: lmsCohortGroups.endDate, sortOrder: lmsCohortGroups.sortOrder })
          .from(lmsCohortGroups)
          .where(and(inArray(lmsCohortGroups.courseId, cohortCourseIdsArr), sql`${lmsCohortGroups.status} IN ('open','active')`))
          .orderBy(asc(lmsCohortGroups.sortOrder), asc(lmsCohortGroups.startDate));
        for (const grp of allGroups) {
          if (!cohortGroupMap.has(grp.courseId)) cohortGroupMap.set(grp.courseId, { name: grp.name, startDate: grp.startDate, endDate: grp.endDate });
        }
      }
      // Pre-fetch workshop instance data before map population
      const workshopIdsArr = (workshopRows as any[]).map((w: any) => w.id);
      const workshopInstanceMap = new Map<number, { startDate: Date | null; endDate: Date | null; locationType: string | null; venueName: string | null; venueCity: string | null; venueState: string | null } | null>();
      if (workshopIdsArr.length > 0) {
        const allInstances = await db.select({
          workshopId: workshopInstances.workshopId,
          startDate: workshopInstances.startDate,
          endDate: workshopInstances.endDate,
          locationType: workshopInstances.locationType,
          venueName: workshopInstances.venueName,
          venueCity: workshopInstances.venueCity,
          venueState: workshopInstances.venueState,
        }).from(workshopInstances)
          .where(and(inArray(workshopInstances.workshopId, workshopIdsArr), eq(workshopInstances.status, "published"), gte(workshopInstances.startDate, now)))
          .orderBy(asc(workshopInstances.startDate));
        for (const inst of allInstances) {
          if (!workshopInstanceMap.has(inst.workshopId)) workshopInstanceMap.set(inst.workshopId, inst);
        }
      }

      // Preserve the order specified by input.items
      const map = new Map<string, object>();
      for (const c of courses as any[]) {
        const resolvedType = c.courseType === "cohort" ? "cohort" : c.courseType === "quiz" ? "quiz" : "course";
        const primaryCohortGroup = resolvedType === "cohort" ? (cohortGroupMap.get(c.id) ?? null) : null;
        const entry = { ...c, type: resolvedType, isFree: c.isFree ?? false, href: `/courses/${c.slug}`, primaryCohortGroup };
        map.set(`course-${c.id}`, entry);
        map.set(`${resolvedType}-${c.id}`, entry);
      }
      // Register fallback downloads under BOTH keys so the original course-{id} lookup resolves
      for (const d of fallbackDownloads as any[]) {
        const entry = { ...d, type: "download", isFree: d.isFree ?? false, href: `/downloads/${d.slug}` };
        map.set(`course-${d.id}`, entry); // original (wrong) key from block data
        map.set(`download-${d.id}`, entry); // correct key
      }
      for (const d of downloads as any[]) map.set(`download-${d.id}`, { ...d, type: "download", isFree: d.isFree ?? false, href: `/downloads/${d.slug}` });
      for (const b of bundles as any[]) map.set(`bundle-${b.id}`, { ...b, type: "bundle", isFree: false, price: b.price ?? 0, href: `/bundles/${b.slug}` });
      for (const p of physicals as any[]) map.set(`physical-${p.id}`, { ...p, type: "physical", isFree: false, href: `/shop/${p.slug}` });
      for (const w of webinarRows as any[]) map.set(`webinar-${w.id}`, { ...w, type: "webinar", isFree: w.accessType === "free", price: w.price ?? 0, href: `/webinars/${w.slug}` });
      const COMMUNITY_FALLBACK_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
      for (const c of communityRows as any[]) map.set(`community-${c.id}`, { ...c, type: "community", isFree: c.accessType === "free", price: 0, href: `/community/${c.slug}`, imageUrl: c.imageUrl ?? COMMUNITY_FALLBACK_IMG });
      for (const w of workshopRows as any[]) {
        const nextInstance = workshopInstanceMap.get(w.id) ?? null;
        map.set(`workshop-${w.id}`, { ...w, type: "workshop", isFree: w.isFree ?? false, price: (w.price ?? 0) / 100, href: `/workshops/${w.slug}`, nextInstance });
      }
      for (const appId of appIds) {
        const app = APP_REGISTRY[appId];
        if (app) map.set(`app-${appId}`, app);
      }

      // Deduplicate: if the same lmsCourse id was saved under both "course" and "quiz" types
      // (e.g., type changed in DB), only return it once.
      const seenLmsCourseIds = new Set<number>();
      return input.items
        .map(i => map.get(`${i.type}-${i.id}`))
        .filter((item): item is NonNullable<typeof item> => {
          if (!item) return false;
          const it = item as any;
          if (it.type === "course" || it.type === "quiz" || it.type === "cohort") {
            if (seenLmsCourseIds.has(it.id)) return false;
            seenLmsCourseIds.add(it.id);
          }
          return true;
        }) as Array<{
          id: number; type: string; slug: string; title: string;
          description: string | null; price: number; isFree: boolean;
          imageUrl: string | null; href: string;
          pricingType?: string | null; subscriptionInterval?: string | null;
          appLabel?: string;
        }>;
    }),

  /** List all funnels */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    const rows = await db
      .select()
      .from(funnels)
      .orderBy(asc(funnels.sortOrder), desc(funnels.updatedAt));
    if (rows.length === 0) return [];
    // Batch-fetch all pages in a single query instead of N+1 loop
    const allPages = await db
      .select()
      .from(funnelPages)
      .where(inArray(funnelPages.funnelId, rows.map(f => f.id)))
      .orderBy(asc(funnelPages.sortOrder));
    const pagesByFunnelId = new Map<number, typeof allPages>();
    for (const page of allPages) {
      if (!pagesByFunnelId.has(page.funnelId)) pagesByFunnelId.set(page.funnelId, []);
      pagesByFunnelId.get(page.funnelId)!.push(page);
    }
    return rows.map(funnel => ({ ...funnel, pages: pagesByFunnelId.get(funnel.id) ?? [] }));
  }),

  /** Reorder funnels by updating sortOrder */
  reorderFunnels: protectedProcedure
    .input(z.object({ funnelIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      for (let i = 0; i < input.funnelIds.length; i++) {
        await db
          .update(funnels)
          .set({ sortOrder: i })
          .where(eq(funnels.id, input.funnelIds[i]));
      }
      return { success: true };
    }),

  /** Get a single funnel with all its pages */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, input.id));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND" });
      const pages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      return { ...funnel, pages };
    }),

  /** Create a new funnel */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        templateName: z.string().optional(),
        accentColor: z.string().optional(),
        bgColor: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const baseSlug = slugify(input.name);
      // Ensure unique slug
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const [existing] = await db.select().from(funnels).where(eq(funnels.slug, slug));
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }
      const result = await db.insert(funnels).values({
        name: input.name,
        slug,
        description: input.description,
        templateName: input.templateName,
        accentColor: input.accentColor || "#179ca3",
        bgColor: input.bgColor || "#ffffff",
      });
      const funnelId = result[0].insertId;
      return { id: funnelId, slug };
    }),

  /** Update funnel settings */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        accentColor: z.string().optional(),
        bgColor: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
        customDomain: z.string().max(255).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(funnels).set(data).where(eq(funnels.id, id));
      return { success: true };
    }),

  /** Delete a funnel and all its pages */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      await db.delete(funnelPages).where(eq(funnelPages.funnelId, input.id));
      await db.delete(funnels).where(eq(funnels.id, input.id));
      return { success: true };
    }),

  /** Duplicate a funnel */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [original] = await db.select().from(funnels).where(eq(funnels.id, input.id));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      const baseSlug = slugify(original.name + " copy");
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const [existing] = await db.select().from(funnels).where(eq(funnels.slug, slug));
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }
      const result = await db.insert(funnels).values({
        name: original.name + " (Copy)",
        slug,
        description: original.description,
        templateName: original.templateName,
        accentColor: original.accentColor,
        bgColor: original.bgColor,
        logoUrl: original.logoUrl,
        status: "draft",
      });
      const newFunnelId = result[0].insertId;
      // Copy all pages
      const pages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, input.id))
        .orderBy(asc(funnelPages.sortOrder));
      const pageIdMap: Record<number, number> = {};
      for (const page of pages) {
        const pageResult = await db.insert(funnelPages).values({
          funnelId: newFunnelId,
          pageType: page.pageType,
          title: page.title,
          slug: page.slug,
          blocks: page.blocks,
          productType: page.productType,
          productId: page.productId,
          customPrice: page.customPrice,
          customPriceLabel: page.customPriceLabel,
          orderBumpId: page.orderBumpId,
          sortOrder: page.sortOrder,
          isActive: page.isActive,
        });
        pageIdMap[page.id] = pageResult[0].insertId;
      }
      // Update nextPageId references
      for (const page of pages) {
        if (page.nextPageId && pageIdMap[page.nextPageId]) {
          await db
            .update(funnelPages)
            .set({ nextPageId: pageIdMap[page.nextPageId] })
            .where(eq(funnelPages.id, pageIdMap[page.id]));
        }
      }
      return { id: newFunnelId, slug };
    }),
  /** Save a funnel as a reusable template */
  saveAsTemplate: protectedProcedure
    .input(z.object({ id: z.number(), templateName: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, input.id));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND" });
      const pages = await db.select().from(funnelPages).where(eq(funnelPages.funnelId, input.id)).orderBy(asc(funnelPages.sortOrder));
      const pagesData = pages.map(p => ({ pageType: p.pageType, title: p.title, slug: p.slug, blocks: p.blocks, productType: p.productType, productId: p.productId, customPrice: p.customPrice, customPriceLabel: p.customPriceLabel, orderBumpId: p.orderBumpId, isActive: p.isActive }));
      await db.insert(funnelTemplates).values({
        name: input.templateName,
        description: funnel.description,
        pagesJson: JSON.stringify(pagesData),
        accentColor: funnel.accentColor,
        bgColor: funnel.bgColor,
        logoUrl: funnel.logoUrl,
      });
      return { success: true };
    }),
  /** List user-saved templates */
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    return db.select().from(funnelTemplates).orderBy(desc(funnelTemplates.createdAt));
  }),
  /** Delete a saved template */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      await db.delete(funnelTemplates).where(eq(funnelTemplates.id, input.id));
      return { success: true };
    }),

  // ─── Page Management ─────────────────────────────────────────────────────

  /** Add a page to a funnel */
  addPage: protectedProcedure
    .input(
      z.object({
        funnelId: z.number(),
        pageType: z.enum(["landing", "checkout", "upsell", "downsell", "thank_you", "custom"]),
        title: z.string().min(1).max(255),
        slug: z.string().optional(),
        blocks: z.string().optional(), // JSON string
        productType: z.enum(["course", "download", "bundle", "physical", "custom"]).optional(),
        productId: z.number().optional(),
        customPrice: z.number().optional(),
        customPriceLabel: z.string().optional(),
        orderBumpId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      // Auto-generate slug from title if not provided, then ensure it is unique within this funnel
      const basePageSlug = input.slug || slugify(input.title);
      const pageSlug = await uniquePageSlug(db, input.funnelId, basePageSlug);
      // Get max sort order
      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, input.funnelId));
      const sortOrder = (maxOrder?.max ?? -1) + 1;
      const result = await db.insert(funnelPages).values({
        funnelId: input.funnelId,
        pageType: input.pageType,
        title: input.title,
        slug: pageSlug,
        blocks: input.blocks || "[]",
        productType: input.productType,
        productId: input.productId,
        customPrice: input.customPrice,
        customPriceLabel: input.customPriceLabel,
        orderBumpId: input.orderBumpId,
        sortOrder,
      });
      return { id: result[0].insertId };
    }),

  /** Update a funnel page */
  updatePage: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        slug: z.string().optional(),
        blocks: z.string().optional(),
        pageType: z.enum(["landing", "checkout", "upsell", "downsell", "thank_you", "custom"]).optional(),
        nextPageId: z.number().nullable().optional(),
        productType: z.enum(["course", "download", "bundle", "physical", "custom"]).nullable().optional(),
        productId: z.number().nullable().optional(),
        customPrice: z.number().nullable().optional(),
        customPriceLabel: z.string().nullable().optional(),
        orderBumpId: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        isHidden: z.boolean().optional(),
        isStandaloneLanding: z.boolean().optional(),
        showNavigationButton: z.boolean().optional(),
        seoTitle: z.string().nullable().optional(),
        seoDescription: z.string().nullable().optional(),
        seoImage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db.update(funnelPages).set(data).where(eq(funnelPages.id, id));
      return { success: true };
    }),
  /** Duplicate a funnel page */
  duplicatePage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [original] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.id));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      // Use uniquePageSlug to avoid collisions — starts from original.slug-2, -3, etc.
      const pageSlug = await uniquePageSlug(db, original.funnelId, original.slug + "-copy");
      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, original.funnelId));
      const sortOrder = (maxOrder?.max ?? -1) + 1;
      const result = await db.insert(funnelPages).values({
        funnelId: original.funnelId,
        pageType: original.pageType,
        title: original.title + " (Copy)",
        slug: pageSlug,
        blocks: original.blocks,
        productType: original.productType,
        productId: original.productId,
        customPrice: original.customPrice,
        customPriceLabel: original.customPriceLabel,
        orderBumpId: original.orderBumpId,
        sortOrder,
        isActive: original.isActive,
      });
      return { id: result[0].insertId };
    }),

  /** Copy a funnel page to a different funnel */
  copyPageToFunnel: protectedProcedure
    .input(z.object({ pageId: z.number(), targetFunnelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [original] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.pageId));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      const [targetFunnel] = await db.select({ id: funnels.id }).from(funnels).where(eq(funnels.id, input.targetFunnelId));
      if (!targetFunnel) throw new TRPCError({ code: "NOT_FOUND", message: "Target funnel not found" });
      // Ensure slug is unique in the target funnel
      const pageSlug = await uniquePageSlug(db, input.targetFunnelId, original.slug);
      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, input.targetFunnelId));
      const sortOrder = (maxOrder?.max ?? -1) + 1;
      const result = await db.insert(funnelPages).values({
        funnelId: input.targetFunnelId,
        pageType: original.pageType,
        title: original.title + " (Copy)",
        slug: pageSlug,
        blocks: original.blocks,
        productType: original.productType,
        productId: original.productId,
        customPrice: original.customPrice,
        customPriceLabel: original.customPriceLabel,
        orderBumpId: original.orderBumpId,
        sortOrder,
        isActive: original.isActive,
      });
      return { id: result[0].insertId };
    }),

  /** Copy a funnel page as a standalone landing page (isStandaloneLanding = true) */
  copyPageAsStandalone: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [original] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.pageId));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      const pageSlug = original.slug + "-standalone-" + Date.now().toString(36).slice(-4);
      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, original.funnelId));
      const sortOrder = (maxOrder?.max ?? -1) + 1;
      const result = await db.insert(funnelPages).values({
        funnelId: original.funnelId,
        pageType: original.pageType,
        title: original.title + " (Standalone)",
        slug: pageSlug,
        blocks: original.blocks,
        productType: original.productType,
        productId: original.productId,
        customPrice: original.customPrice,
        customPriceLabel: original.customPriceLabel,
        orderBumpId: original.orderBumpId,
        sortOrder,
        isActive: original.isActive,
        isStandaloneLanding: true,
      });
      return { id: result[0].insertId, slug: pageSlug };
    }),

  /** Delete a funnel page */
  deletePage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      // Clear any nextPageId references to this page
      await db
        .update(funnelPages)
        .set({ nextPageId: null })
        .where(eq(funnelPages.nextPageId, input.id));
      await db.delete(funnelPages).where(eq(funnelPages.id, input.id));
      return { success: true };
    }),

  /** Reorder pages within a funnel */
  reorderPages: protectedProcedure
    .input(
      z.object({
        funnelId: z.number(),
        pageIds: z.array(z.number()), // ordered list of page IDs
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      for (let i = 0; i < input.pageIds.length; i++) {
        await db
          .update(funnelPages)
          .set({ sortOrder: i })
          .where(
            and(
              eq(funnelPages.id, input.pageIds[i]),
              eq(funnelPages.funnelId, input.funnelId)
            )
          );
      }
      return { success: true };
    }),

  /** Connect two pages (set nextPageId) */
  connectPages: protectedProcedure
    .input(
      z.object({
        fromPageId: z.number(),
        toPageId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      await db
        .update(funnelPages)
        .set({ nextPageId: input.toPageId })
        .where(eq(funnelPages.id, input.fromPageId));
      return { success: true };
    }),

  /** Create Stripe checkout session for a funnel product */
  createCheckout: protectedProcedure
    .input(
      z.object({
        funnelId: z.number(),
        pageId: z.number(),
        origin: z.string(),
        // Optional order bump
        includeOrderBump: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [page] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.pageId));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel page not found" });
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, input.funnelId));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });

      // Build line items from page product config
      const lineItems: any[] = [];
      if (page.customPrice && page.customPrice > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: page.customPriceLabel || page.title || "Funnel Product",
            },
            unit_amount: Math.round(Number(page.customPrice) * 100),
          },
          quantity: 1,
        });
      }

      if (lineItems.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No product configured for this page" });
      }

      const stripe = getStripeClient();

      // Find thank you page for success redirect
      const allPages = await db.select().from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      const thankYouPage = allPages.find(p => p.pageType === "thank_you");
      const successUrl = thankYouPage
        ? `${input.origin}/${funnel.slug}/${thankYouPage.slug}?success=1`
        : `${input.origin}/${funnel.slug}/${page.slug}?success=1`;
      const cancelUrl = `${input.origin}/${funnel.slug}/${page.slug}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        allow_promotion_codes: true,
        line_items: lineItems,
        metadata: {
          type: "funnel_purchase",
          funnel_id: funnel.id.toString(),
          funnel_page_id: page.id.toString(),
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
        },
        payment_intent_data: { description: `${funnel.title} — Funnel Purchase` },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return { checkoutUrl: session.url };
    }),

  /** Get a single funnel page by ID (admin) */
  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [page] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.id));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel page not found" });
      // Also get the funnel info
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, page.funnelId));
      // Get all pages in this funnel for sidebar navigation
      const allPages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, page.funnelId))
        .orderBy(asc(funnelPages.sortOrder));
      return { page, funnel, allPages };
    }),

  // ─── Leads / Contacts Management ────────────────────────────────────────────

  /** List all leads with pagination and filtering */
  listLeads: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      search: z.string().optional(),
      source: z.string().optional(),
      funnelId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const offset = (input.page - 1) * input.limit;

      let conditions: any[] = [];
      if (input.funnelId) conditions.push(eq(funnelLeads.funnelId, input.funnelId));
      if (input.source) conditions.push(eq(funnelLeads.source, input.source));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(funnelLeads).where(whereClause);
      const total = Number(countResult?.count ?? 0);

      // Get leads with search
      let query = db.select().from(funnelLeads).where(whereClause).orderBy(desc(funnelLeads.createdAt)).limit(input.limit).offset(offset);

      let leads = await query;

      // Client-side search filter (for simplicity)
      if (input.search) {
        const s = input.search.toLowerCase();
        leads = leads.filter(l =>
          l.email.toLowerCase().includes(s) ||
          (l.name && l.name.toLowerCase().includes(s)) ||
          (l.phone && l.phone.includes(s))
        );
      }

      return { leads, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  /** Get a single lead by ID with full details */
  getLeadById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [lead] = await db.select().from(funnelLeads).where(eq(funnelLeads.id, input.id));
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

      // Get funnel info
      const [funnel] = await db.select({ name: funnels.name, slug: funnels.slug }).from(funnels).where(eq(funnels.id, lead.funnelId));
      // Get page info
      const [page] = await db.select({ title: funnelPages.title, slug: funnelPages.slug, pageType: funnelPages.pageType }).from(funnelPages).where(eq(funnelPages.id, lead.funnelPageId));

      return { lead, funnel: funnel || null, page: page || null };
    }),

  /** Update a lead (tags, name, phone) */
  updateLead: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.phone !== undefined) updates.phone = input.phone;
      if (input.tags !== undefined) updates.tags = input.tags;
      await db.update(funnelLeads).set(updates).where(eq(funnelLeads.id, input.id));
      return { success: true };
    }),

  /** Delete leads by IDs */
  deleteLeads: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      for (const id of input.ids) {
        await db.delete(funnelLeads).where(eq(funnelLeads.id, id));
      }
      return { success: true, deleted: input.ids.length };
    }),

    // ─── Flow Diagram ─────────────────────────────────────────────────────────────────

  /** Return all pages + branch rules for a funnel, ready for the flow diagram */
  getFlowDiagram: protectedProcedure
    .input(z.object({ funnelId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const pages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, input.funnelId))
        .orderBy(asc(funnelPages.sortOrder));
      if (pages.length === 0) return [];
      // Batch-fetch all branch rules for all pages in 2 queries instead of N*M
      const pageIds = pages.map(p => p.id);
      const allRules = await db
        .select()
        .from(funnelBranchRules)
        .where(inArray(funnelBranchRules.funnelPageId, pageIds))
        .orderBy(asc(funnelBranchRules.priority));
      const ruleIds = allRules.map(r => r.id);
      const allConditions = ruleIds.length > 0
        ? await db
            .select()
            .from(funnelBranchConditions)
            .where(inArray(funnelBranchConditions.ruleId, ruleIds))
            .orderBy(asc(funnelBranchConditions.id))
        : [];
      // Group conditions by ruleId
      const conditionsByRuleId = new Map<number, typeof allConditions>();
      for (const cond of allConditions) {
        if (!conditionsByRuleId.has(cond.ruleId)) conditionsByRuleId.set(cond.ruleId, []);
        conditionsByRuleId.get(cond.ruleId)!.push(cond);
      }
      // Group rules (with conditions) by pageId
      const rulesByPageId = new Map<number, Array<(typeof allRules)[0] & { conditions: typeof allConditions }>>();
      for (const rule of allRules) {
        if (!rulesByPageId.has(rule.funnelPageId)) rulesByPageId.set(rule.funnelPageId, []);
        rulesByPageId.get(rule.funnelPageId)!.push({ ...rule, conditions: conditionsByRuleId.get(rule.id) ?? [] });
      }
      return pages.map(page => ({ ...page, branchRules: rulesByPageId.get(page.id) ?? [] }));
    }),

  // ─── Branch Rules CRUD ────────────────────────────────────────────────

  /** List all branch rules for a funnel page (with conditions) */
  listBranchRules: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const rules = await db
        .select()
        .from(funnelBranchRules)
        .where(eq(funnelBranchRules.funnelPageId, input.pageId))
        .orderBy(asc(funnelBranchRules.priority));
      if (rules.length === 0) return [];
      // Batch-fetch all conditions in one query instead of N+1
      const allConditions = await db
        .select()
        .from(funnelBranchConditions)
        .where(inArray(funnelBranchConditions.ruleId, rules.map(r => r.id)))
        .orderBy(asc(funnelBranchConditions.id));
      const conditionsByRuleId = new Map<number, typeof allConditions>();
      for (const cond of allConditions) {
        if (!conditionsByRuleId.has(cond.ruleId)) conditionsByRuleId.set(cond.ruleId, []);
        conditionsByRuleId.get(cond.ruleId)!.push(cond);
      }
      return rules.map(rule => ({ ...rule, conditions: conditionsByRuleId.get(rule.id) ?? [] }));
    }),

  /** Create or update a branch rule (upsert by id) */
  upsertBranchRule: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      funnelPageId: z.number(),
      name: z.string().min(1).max(255).default("Untitled Rule"),
      priority: z.number().int().default(0),
      matchMode: z.enum(["all", "any"]).default("all"),
      targetPageId: z.number().nullable().optional(),
      targetUrl: z.string().max(2048).nullable().optional(),
      isActive: z.boolean().default(true),
      conditions: z.array(z.object({
        variable: z.enum([
          "product_purchased", "order_bump_selected", "email_contains", "email_domain",
          "purchase_price", "source_url", "utm_source", "utm_medium", "utm_campaign",
          "date_range", "day_of_week", "hour_of_day", "country", "device_type", "custom_field",
        ]),
        operator: z.enum([
          "equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with",
          "greater_than", "less_than", "between", "in_list", "not_in_list", "is_set", "is_not_set",
        ]),
        value: z.string().max(1024).default(""),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      let ruleId: number;
      if (input.id) {
        await db.update(funnelBranchRules).set({
          name: input.name,
          priority: input.priority,
          matchMode: input.matchMode,
          targetPageId: input.targetPageId ?? null,
          targetUrl: input.targetUrl ?? null,
          isActive: input.isActive,
        }).where(eq(funnelBranchRules.id, input.id));
        ruleId = input.id;
        await db.delete(funnelBranchConditions).where(eq(funnelBranchConditions.ruleId, ruleId));
      } else {
        const res = await db.insert(funnelBranchRules).values({
          funnelPageId: input.funnelPageId,
          name: input.name,
          priority: input.priority,
          matchMode: input.matchMode,
          targetPageId: input.targetPageId ?? null,
          targetUrl: input.targetUrl ?? null,
          isActive: input.isActive,
        });
        ruleId = res[0].insertId;
      }
      if (input.conditions.length > 0) {
        await db.insert(funnelBranchConditions).values(
          input.conditions.map(c => ({ ruleId, variable: c.variable, operator: c.operator, value: c.value }))
        );
      }
      return { id: ruleId, success: true };
    }),

  /** Delete a branch rule and its conditions */
  deleteBranchRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      await db.delete(funnelBranchConditions).where(eq(funnelBranchConditions.ruleId, input.id));
      await db.delete(funnelBranchRules).where(eq(funnelBranchRules.id, input.id));
      return { success: true };
    }),

  /** Reorder branch rules by updating priorities */
  reorderBranchRules: protectedProcedure
    .input(z.object({ ruleIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      for (let i = 0; i < input.ruleIds.length; i++) {
        await db.update(funnelBranchRules).set({ priority: i }).where(eq(funnelBranchRules.id, input.ruleIds[i]));
      }
      return { success: true };
    }),

  /** Update funnel settings (slug, SEO, status, custom redirect) */
  updateFunnelSettings: protectedProcedure
    .input(z.object({
      funnelId: z.number().int().positive(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
      name: z.string().min(1).max(255).optional(),
      metaTitle: z.string().max(255).optional(),
      metaDescription: z.string().max(500).optional(),
      status: z.enum(["draft", "active", "archived", "paused"]).optional(),
      thankYouUrl: z.string().max(500).optional(),
      // Per-funnel publish domain override (null = use global funnelPublishDomain from platform_settings)
      customDomain: z.string().max(255).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: funnels.id }).from(funnels)
        .where(and(eq(funnels.slug, input.slug), sql`${funnels.id} != ${input.funnelId}`)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A funnel with this slug already exists" });
      const { funnelId, ...fields } = input;
      await db.update(funnels).set(fields).where(eq(funnels.id, funnelId));
      return { success: true };
    }),
});
// ─── Public Router (for rendering funnel pages) ──────────────────────────────────────────────────
export const funnelPublicRouter = router({
  /** Get a funnel by slug (public) */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [funnel] = await db
        .select()
        .from(funnels)
        .where(eq(funnels.slug, input.slug));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });
      // Track view
      await db.execute(sql`UPDATE funnels SET total_views = total_views + 1 WHERE id = ${funnel.id}`);
      const pages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      // Filter out hidden pages from the public sequence
      const visiblePages = pages.filter(p => !p.isHidden);
      return { ...funnel, pages: visiblePages };
    }),

  /** Get a standalone landing page by its slug (public — served at /p/{slug}) */
  getStandalonePage: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [page] = await db
        .select()
        .from(funnelPages)
        .where(
          and(
            eq(funnelPages.slug, input.slug),
            eq(funnelPages.isStandaloneLanding, true),
            eq(funnelPages.isActive, true)
          )
        );
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      // Get the parent funnel for branding
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, page.funnelId));
      // Track page view
      await db.execute(sql`UPDATE funnel_pages SET views = views + 1 WHERE id = ${page.id}`);
       return { funnel: funnel || null, page };
    }),

  /** Get the first page of a funnel by slug — used to redirect /:slug → /:slug/:firstPageSlug */
  getFirstPage: publicProcedure
    .input(z.object({ funnelSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [funnel] = await db
        .select()
        .from(funnels)
        .where(eq(funnels.slug, input.funnelSlug));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });
      const [firstPage] = await db
        .select({ slug: funnelPages.slug, title: funnelPages.title })
        .from(funnelPages)
        .where(and(eq(funnelPages.funnelId, funnel.id), eq(funnelPages.isActive, true)))
        .orderBy(asc(funnelPages.sortOrder))
        .limit(1);
      if (!firstPage) throw new TRPCError({ code: "NOT_FOUND", message: "No active pages in funnel" });
      return { funnelSlug: funnel.slug, firstPageSlug: firstPage.slug };
    }),

  /** Get a specific funnel page (public) */
  getPage: publicProcedure
    .input(z.object({ funnelSlug: z.string(), pageSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [funnel] = await db
        .select()
        .from(funnels)
        .where(eq(funnels.slug, input.funnelSlug));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });
      const [page] = await db
        .select()
        .from(funnelPages)
        .where(
          and(
            eq(funnelPages.funnelId, funnel.id),
            eq(funnelPages.slug, input.pageSlug)
          )
        );
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      // Track page view
      await db.execute(sql`UPDATE funnel_pages SET views = views + 1 WHERE id = ${page.id}`);
      // Get next page info — prefer explicit nextPageId, fall back to next sort_order
      let nextPage = null;
      if (page.nextPageId) {
        const [np] = await db
          .select({ slug: funnelPages.slug, title: funnelPages.title, pageType: funnelPages.pageType })
          .from(funnelPages)
          .where(eq(funnelPages.id, page.nextPageId));
        nextPage = np || null;
      }
      if (!nextPage) {
        // Fall back to the next page by sort_order in the same funnel
        const [np] = await db
          .select({ slug: funnelPages.slug, title: funnelPages.title, pageType: funnelPages.pageType })
          .from(funnelPages)
          .where(
            and(
              eq(funnelPages.funnelId, funnel.id),
              sql`${funnelPages.sortOrder} > ${page.sortOrder}`,
              eq(funnelPages.isActive, true)
            )
          )
          .orderBy(asc(funnelPages.sortOrder))
          .limit(1);
        nextPage = np || null;
      }
      return { funnel, page, nextPage };
    }),

  /** Create a checkout session from the checkout form block (public — no login required) */
  createFunnelFormCheckout: publicProcedure
    .input(
      z.object({
        funnelId: z.number(),
        pageId: z.number(),
        origin: z.string(),
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        selectedProductIndex: z.number().default(0),
        addedBumpIndexes: z.array(z.number()).default([]),
        billingAddress: z.object({
          address: z.string(),
          address2: z.string().optional(),
          country: z.string(),
          state: z.string(),
          city: z.string(),
          postalCode: z.string(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [page] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.pageId));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel page not found" });
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, input.funnelId));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });

      // Parse blocks to find checkout_form block
      let checkoutBlock: any = null;
      try {
        const blocks = JSON.parse(page.blocks || "[]");
        checkoutBlock = blocks.find((b: any) => b.type === "checkout_form");
      } catch {}

      if (!checkoutBlock) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No checkout form found on this page" });
      }

      const products = checkoutBlock.data?.products ?? [];
      const orderBumps = checkoutBlock.data?.orderBumps ?? [];
      const selectedProduct = products[input.selectedProductIndex];

      if (!selectedProduct) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product selection" });
      }

      // Build line items
      const lineItems: any[] = [
        {
          price_data: {
            currency: "usd",
            product_data: { name: selectedProduct.name, description: selectedProduct.description || undefined },
            unit_amount: Math.round(Number(selectedProduct.price) * 100),
          },
          quantity: 1,
        },
      ];

      // Add order bumps
      for (const bumpIdx of input.addedBumpIndexes) {
        const bump = orderBumps[bumpIdx];
        if (bump && bump.price > 0) {
          lineItems.push({
            price_data: {
              currency: "usd",
              product_data: { name: bump.title, description: bump.headline || undefined },
              unit_amount: Math.round(Number(bump.price) * 100),
            },
            quantity: 1,
          });
        }
      }

      const stripe = getStripeClient();

      // Find thank you page for success redirect
      const allPages = await db.select().from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      const thankYouPage = allPages.find(p => p.pageType === "thank_you");
      const successRedirect = checkoutBlock.data?.successRedirect;
      const resolveSuccessUrl = (redirect: string | undefined) => {
        if (!redirect) return thankYouPage ? `${input.origin}/${funnel.slug}/${thankYouPage.slug}?success=1` : `${input.origin}/${funnel.slug}/${page.slug}?success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/my-dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/${redirect.slice(11)}?success=1`;
        if (redirect.startsWith("http")) return redirect;
        return `${input.origin}${redirect}`;
      };
      const successUrl = resolveSuccessUrl(successRedirect);
      const cancelUrl = `${input.origin}/${funnel.slug}/${page.slug}`;

      const funnelCheckoutMetadata = {
          type: "funnel_form_purchase",
          funnel_id: funnel.id.toString(),
          funnel_page_id: page.id.toString(),
          customer_email: input.email,
          customer_name: `${input.firstName || ""} ${input.lastName || ""}`.trim(),
          customer_phone: input.phone || "",
          bumps_added: input.addedBumpIndexes.length > 0 ? "1" : "",
          bump_titles: input.addedBumpIndexes.map(i => orderBumps[i]?.title ?? "").join("|").slice(0, 490),
          bump_prices: input.addedBumpIndexes.map(i => orderBumps[i]?.price ?? 0).join("|").slice(0, 490),
          user_id: ctx.user?.id?.toString() || "",
          product_name: selectedProduct.name?.slice(0, 490) ?? "",
          product_type: selectedProduct.productType ?? selectedProduct.type ?? "other",
          product_id: selectedProduct.productId ? selectedProduct.productId.toString() : "",
          success_url: successUrl.slice(0, 490),
          brand_mode: checkoutBlock.data?.brandMode ?? "aaus",
        };

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.email,
        allow_promotion_codes: true,
        line_items: lineItems,
        metadata: funnelCheckoutMetadata,
        payment_intent_data: { metadata: funnelCheckoutMetadata, description: `${funnelCheckoutMetadata.product_name || "Funnel Product"} — Funnel Purchase` },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      // Extract IP and user agent from request
      const fwd = ctx.req?.headers?.["x-forwarded-for"];
      const ip = typeof fwd === "string" ? fwd.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || null;
      const ua = ctx.req?.headers?.["user-agent"] || null;

      // Also store as a lead
      await db.insert(funnelLeads).values({
        funnelId: input.funnelId,
        funnelPageId: input.pageId,
        email: input.email,
        name: `${input.firstName || ""} ${input.lastName || ""}`.trim() || null,
        phone: input.phone || null,
        customFields: JSON.stringify({
          selectedProduct: selectedProduct.name,
          bumps: input.addedBumpIndexes.map(i => orderBumps[i]?.title).filter(Boolean),
          billingAddress: input.billingAddress,
        }),
        userId: ctx.user?.id || null,
        source: "checkout_form",
        ipAddress: ip || null,
        userAgent: ua || null,
        sourcePage: input.origin ? `${input.origin}/${funnel.slug}/${page.slug}` : null,
      });
      return { checkoutUrl: session.url };
    }),

  /** Create a PaymentIntent for inline Stripe Elements checkout (no redirect) */
  createFunnelPaymentIntent: publicProcedure
    .input(
      z.object({
        funnelId: z.number(),
        pageId: z.number(),
        origin: z.string(),
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        selectedProductIndex: z.number().default(0),
        addedBumpIndexes: z.array(z.number()).default([]),
        billingAddress: z.object({
          address: z.string(),
          address2: z.string().optional(),
          country: z.string(),
          state: z.string(),
          city: z.string(),
          postalCode: z.string(),
        }).optional(),
        promoCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [page] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.pageId));
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel page not found" });
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, input.funnelId));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });

      // Parse blocks to find checkout_form block
      let checkoutBlock: any = null;
      try {
        const blocks = JSON.parse(page.blocks || "[]");
        checkoutBlock = blocks.find((b: any) => b.type === "checkout_form");
      } catch {}
      if (!checkoutBlock) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No checkout form found on this page" });
      }

      const products = checkoutBlock.data?.products ?? [];
      const orderBumps = checkoutBlock.data?.orderBumps ?? [];
      const selectedProduct = products[input.selectedProductIndex];
      if (!selectedProduct) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product selection" });
      }

      const { totalCents: serverTotalCents } = computeFunnelCheckoutTotalCents(checkoutBlock, {
        selectedProductIndex: input.selectedProductIndex,
        addedBumpIndexes: input.addedBumpIndexes,
      });
      let totalAmountCents = serverTotalCents;
      const bumpDetails: string[] = [];
      for (const bumpIdx of input.addedBumpIndexes) {
        const bump = orderBumps[bumpIdx];
        if (bump && bump.price > 0) bumpDetails.push(bump.title);
      }

      // ── FREE PRODUCT PATH ($0 total) ────────────────────────────────────────
      // Find thank you page for success redirect (needed for both free and paid paths)
      const allPagesForRedirect = await db.select().from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      const thankYouPageForRedirect = allPagesForRedirect.find(p => p.pageType === "thank_you");
      const successRedirectRaw = checkoutBlock.data?.successRedirect;
      const resolveSuccessUrl2 = (redirect: string | undefined) => {
        if (!redirect) return thankYouPageForRedirect ? `${input.origin}/${funnel.slug}/${thankYouPageForRedirect.slug}?success=1` : `${input.origin}/${funnel.slug}/${page.slug}?success=1`;
        if (redirect === "__dashboard__") return `${input.origin}/my-dashboard?purchase=success`;
        if (redirect.startsWith("__funnel__:")) return `${input.origin}/${redirect.slice(11)}?success=1`;
        if (redirect.startsWith("http")) return redirect;
        return `${input.origin}${redirect}`;
      };
      const successUrl = resolveSuccessUrl2(successRedirectRaw);

      if (totalAmountCents === 0) {
        // Free product — bypass Stripe entirely
        const customerName = `${input.firstName || ""} ${input.lastName || ""}`.trim();
        const brandMode = (checkoutBlock.data?.brandMode as string) || "aaus";
        const baseUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://app.allaboutultrasound.com";

        // 1. Create or find user account
        let resolvedUserId: number | null = ctx.user?.id ?? null;
        let isNewUser = false;
        let resetToken: string | null = null;
        if (!resolvedUserId) {
          try {
            const nameParts = customerName.split(" ");
            const result = await getOrCreateUserByEmail({
              email: input.email,
              firstName: nameParts[0] || undefined,
              lastName: nameParts.slice(1).join(" ") || undefined,
              name: customerName || undefined,
            });
            resolvedUserId = result.user.id;
            isNewUser = result.isNew;
            resetToken = result.resetToken;
          } catch (err) {
            console.error("[FreeCheckout] Failed to create/find user:", err);
          }
        }

        // 2. Send welcome + set-password email for new accounts
        if (isNewUser && resetToken && resolvedUserId) {
          try {
            const { buildPasswordResetEmail, sendEmail: _sendEmail } = await import("../_core/email");
            const setPasswordUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
            const firstName = input.firstName || customerName.split(" ")[0] || "there";
            const emailContent = buildPasswordResetEmail({
              firstName,
              resetUrl: setPasswordUrl,
              brandMode: brandMode as any,
            });
            await _sendEmail({
              to: { name: customerName || firstName, email: input.email },
              subject: `Your account is ready — set your password to access ${selectedProduct.name || "your purchase"}`,
              htmlBody: emailContent.htmlBody,
              previewText: `Set your password to access your ${selectedProduct.name || "purchase"} on ${brandMode === "iheartecho" ? "iHeartEcho" : "All About Ultrasound"}`,
            });
            console.log(`[FreeCheckout] Sent set-password email to ${input.email} (new user ${resolvedUserId})`);
          } catch (emailErr) {
            console.error(`[FreeCheckout] Failed to send set-password email:`, emailErr);
          }
        }

        // 3. Record the purchase
        const freeOrderRef = `free_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await db.insert(funnelPurchases).values({
          userId: resolvedUserId || null,
          email: input.email,
          name: customerName || null,
          phone: input.phone || null,
          productName: selectedProduct.name ?? "Free Product",
          productType: selectedProduct.productType ?? selectedProduct.type ?? "other",
          orderBumps: null,
          amountPaid: 0,
          currency: "usd",
          stripePaymentIntentId: freeOrderRef,
          sourceType: "funnel",
          sourceFunnelId: funnel.id,
          sourceFunnelPageId: page.id,
          status: "paid",
        });

        // 4. Grant access based on product type
        const productType = selectedProduct.productType ?? selectedProduct.type ?? "";
        const productId = selectedProduct.productId ? parseInt(String(selectedProduct.productId)) : null;
        if (resolvedUserId && productId) {
          if (productType === "course") {
            const [existingEnrollment] = await db.select({ id: lmsEnrollments.id })
              .from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.userId, resolvedUserId), eq(lmsEnrollments.courseId, productId)))
              .limit(1);
            if (!existingEnrollment) {
              await db.insert(lmsEnrollments).values({ userId: resolvedUserId, courseId: productId, orderId: null, affiliateCode: null });
              console.log(`[FreeCheckout] Enrolled user ${resolvedUserId} in course ${productId}`);
            }
          } else if (productType === "download") {
            const [existingDl] = await db.select({ id: digitalPurchases.id })
              .from(digitalPurchases)
              .where(and(eq(digitalPurchases.userId, resolvedUserId), eq(digitalPurchases.productId, productId)))
              .limit(1);
            if (!existingDl) {
              await db.insert(digitalPurchases).values({ userId: resolvedUserId, productId, stripeCheckoutSessionId: freeOrderRef });
              console.log(`[FreeCheckout] Granted download access: user ${resolvedUserId}, product ${productId}`);
            }
          } else if (productType === "bundle") {
            const [existingBundle] = await db.select({ id: digitalBundlePurchases.id })
              .from(digitalBundlePurchases)
              .where(and(eq(digitalBundlePurchases.userId, resolvedUserId), eq(digitalBundlePurchases.bundleId, productId)))
              .limit(1);
            if (!existingBundle) {
              await db.insert(digitalBundlePurchases).values({ userId: resolvedUserId, bundleId: productId, stripeCheckoutSessionId: freeOrderRef });
              const bundleItems = await db.select().from(digitalBundleItems).where(eq(digitalBundleItems.bundleId, productId));
              for (const item of bundleItems) {
                const [existingDl] = await db.select({ id: digitalPurchases.id }).from(digitalPurchases)
                  .where(and(eq(digitalPurchases.userId, resolvedUserId!), eq(digitalPurchases.productId, item.productId))).limit(1);
                if (!existingDl) {
                  await db.insert(digitalPurchases).values({ userId: resolvedUserId!, productId: item.productId, stripeCheckoutSessionId: freeOrderRef });
                }
              }
              console.log(`[FreeCheckout] Granted bundle access: user ${resolvedUserId}, bundle ${productId}`);
            }
          }
        }

        // 6. Send purchase confirmation email
        try {
          const { sendEmail, buildFunnelPurchaseConfirmationEmail } = await import("../_core/email");
          const firstName = input.firstName || customerName.split(" ")[0] || "there";
          let loginUrl = `${baseUrl}/my-courses`;
          if (productType === "course" && productId) {
            try {
              const [courseRow] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, productId)).limit(1);
              if (courseRow?.slug) loginUrl = `${baseUrl}/courses/${courseRow.slug}`;
            } catch { /* keep default */ }
          } else if (productType === "download") {
            loginUrl = `${baseUrl}/my-downloads`;
          } else if (productType === "bundle") {
            loginUrl = `${baseUrl}/my-courses`;
          }
          const { subject, htmlBody, previewText } = buildFunnelPurchaseConfirmationEmail({
            firstName,
            productName: selectedProduct.name ?? "Free Product",
            amountPaid: 0,
            loginUrl,
            brandMode: brandMode as any,
          });
          await sendEmail({ to: { name: customerName || firstName, email: input.email }, subject, htmlBody, previewText });
          console.log(`[FreeCheckout] Confirmation email sent to ${input.email}`);
        } catch (emailErr) {
          console.error(`[FreeCheckout] Failed to send confirmation email:`, emailErr);
        }

        return { freeSuccess: true, successUrl };
      }
      // ── END FREE PRODUCT PATH ────────────────────────────────────────────────

      const stripe = getStripeClient();

      // Apply promo code discount if provided
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode, active: true, limit: 1 });
          if (promoCodes.data.length > 0) {
            const coupon = promoCodes.data[0].coupon;
            if (coupon.percent_off) {
              totalAmountCents -= Math.round(totalAmountCents * (coupon.percent_off / 100));
            } else if (coupon.amount_off) {
              totalAmountCents -= Math.min(coupon.amount_off, totalAmountCents);
            }
            totalAmountCents = Math.max(0, totalAmountCents);
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired promo code" });
          }
        } catch (e: any) {
          if (e instanceof TRPCError) throw e;
        }
      }

      // ── 100% promo intercept for funnels ──────────────────────────────────
      if (totalAmountCents === 0) {
        // Promo made total free — grant access directly without Stripe
        const freeOrderRef = `free_promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const resolvedUserId = ctx.user?.id ?? null;
        if (resolvedUserId) {
          const productType = selectedProduct.type;
          const productId = selectedProduct.id;
          if (productType === "course" || productType === "quiz" || productType === "cohort") {
            const [ex] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.userId, resolvedUserId), eq(lmsEnrollments.courseId, productId))).limit(1);
            if (!ex) await db.insert(lmsEnrollments).values({ userId: resolvedUserId, courseId: productId, orderId: null, affiliateCode: null });
          } else if (productType === "download") {
            const [ex] = await db.select({ id: digitalPurchases.id }).from(digitalPurchases)
              .where(and(eq(digitalPurchases.userId, resolvedUserId), eq(digitalPurchases.productId, productId))).limit(1);
            if (!ex) await db.insert(digitalPurchases).values({ userId: resolvedUserId, productId, stripeCheckoutSessionId: freeOrderRef });
          } else if (productType === "bundle") {
            const [ex] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
              .where(and(eq(bundleEnrollments.userId, resolvedUserId), eq(bundleEnrollments.bundleId, productId))).limit(1);
            if (!ex) await db.insert(bundleEnrollments).values({ userId: resolvedUserId, bundleId: productId, stripeCheckoutSessionId: freeOrderRef });
          }
        }
        const successUrl = funnel.thankYouPageUrl || `${input.origin}/`;
        return { freeSuccess: true, successUrl, clientSecret: null, orderId: null, totalAmountCents: 0 };
      }

      if (totalAmountCents < 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum charge amount is $0.50" });
      }

      const totalAmount = totalAmountCents / 100;
      // Build description for the payment
      let description = selectedProduct.name;
      if (bumpDetails.length > 0) {
        description += " + " + bumpDetails.join(", ");
      }

      // Create PaymentIntent (Stripe requires amount in cents)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: "usd",
        description,
        receipt_email: input.email,
        metadata: {
          type: "funnel_form_purchase",
          funnel_id: funnel.id.toString(),
          funnel_page_id: page.id.toString(),
          customer_email: input.email,
          customer_name: `${input.firstName || ""} ${input.lastName || ""}`.trim(),
          customer_phone: input.phone || "",
          bumps_added: input.addedBumpIndexes.length > 0 ? "1" : "",
          bump_titles: input.addedBumpIndexes.map(i => orderBumps[i]?.title ?? "").join("|").slice(0, 490),
          bump_prices: input.addedBumpIndexes.map(i => orderBumps[i]?.price ?? 0).join("|").slice(0, 490),
          user_id: ctx.user?.id?.toString() || "",
          product_name: selectedProduct.name?.slice(0, 490) ?? "",
          product_type: selectedProduct.productType ?? selectedProduct.type ?? "other",
          product_id: selectedProduct.productId ? selectedProduct.productId.toString() : "",
          success_url: successUrl.slice(0, 490),
          brand_mode: checkoutBlock.data?.brandMode ?? "aaus",
        },
        automatic_payment_methods: { enabled: true },
      });

      // Extract IP and user agent from request
      const fwd = ctx.req?.headers?.["x-forwarded-for"];
      const ip = typeof fwd === "string" ? fwd.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || null;
      const ua = ctx.req?.headers?.["user-agent"] || null;

      // Store as a lead
      await db.insert(funnelLeads).values({
        funnelId: input.funnelId,
        funnelPageId: input.pageId,
        email: input.email,
        name: `${input.firstName || ""} ${input.lastName || ""}`.trim() || null,
        phone: input.phone || null,
        customFields: JSON.stringify({
          selectedProduct: selectedProduct.name,
          bumps: input.addedBumpIndexes.map(i => orderBumps[i]?.title).filter(Boolean),
          billingAddress: input.billingAddress,
          paymentIntentId: paymentIntent.id,
        }),
        userId: ctx.user?.id || null,
        source: "checkout_form",
        ipAddress: ip || null,
        userAgent: ua || null,
        sourcePage: input.origin ? `${input.origin}/${funnel.slug}/${page.slug}` : null,
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
        successUrl,
      };
    }),

  /** Submit a lead capture form (public) */
  submitLead: publicProcedure
    .input(
      z.object({
        funnelId: z.number(),
        funnelPageId: z.number(),
        email: z.string().email(),
        name: z.string().optional(),
        phone: z.string().optional(),
        customFields: z.record(z.string(), z.string()).optional(),
        // Rich contact data collected from the browser
        timezone: z.string().optional(),
        referrer: z.string().optional(),
        sourcePage: z.string().optional(),
        // Tags to apply to the lead (comma-separated or array)
        tags: z.string().optional(),
        // Optional email campaign to link this lead to
        campaignId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Extract IP from request headers (X-Forwarded-For or direct)
      const forwarded = ctx.req?.headers?.["x-forwarded-for"];
      const ipAddress = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || null;
      const userAgent = ctx.req?.headers?.["user-agent"] || null;

      await db.insert(funnelLeads).values({
        funnelId: input.funnelId,
        funnelPageId: input.funnelPageId,
        email: input.email,
        name: input.name || null,
        phone: input.phone || null,
        customFields: input.customFields ? JSON.stringify(input.customFields) : null,
        userId: ctx.user?.id || null,
        source: "funnel",
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        referrer: input.referrer || null,
        timezone: input.timezone || null,
        sourcePage: input.sourcePage || null,
        tags: input.tags || null,
        campaignId: input.campaignId || null,
      });
      // Track conversion
      await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${input.funnelPageId}`);
      return { success: true };
    }),

  /** List email campaigns for lead capture campaign linking (public — returns id + subject only) */
  listCampaignsPublic: publicProcedure
    .query(async () => {
      const db = await getDb();
      const campaigns = await db
        .select({ id: emailCampaigns.id, subject: emailCampaigns.subject, status: emailCampaigns.status })
        .from(emailCampaigns)
        .orderBy(desc(emailCampaigns.createdAt))
        .limit(100);
      return campaigns;
    }),

  /** Evaluate branch rules for a funnel page given visitor context (public) */
  evaluateBranch: publicProcedure
    .input(z.object({
      pageId: z.number(),
      context: z.object({
        productsPurchased: z.array(z.string()).optional(),
        orderBumpsSelected: z.array(z.string()).optional(),
        email: z.string().optional(),
        purchasePrice: z.number().optional(),
        sourceUrl: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        country: z.string().optional(),
        deviceType: z.string().optional(),
        customFields: z.record(z.string(), z.string()).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rules = await db
        .select()
        .from(funnelBranchRules)
        .where(and(eq(funnelBranchRules.funnelPageId, input.pageId), eq(funnelBranchRules.isActive, true)))
        .orderBy(asc(funnelBranchRules.priority));
      const rulesWithConditions = [];
      for (const rule of rules) {
        const conditions = await db
          .select()
          .from(funnelBranchConditions)
          .where(eq(funnelBranchConditions.ruleId, rule.id))
          .orderBy(asc(funnelBranchConditions.id));
        rulesWithConditions.push({ ...rule, conditions });
      }
      const result = evaluateBranchRules(rulesWithConditions, input.context);
      if (!result) return { matched: false, targetPageId: null, targetUrl: null };
      // Resolve target page slug if targetPageId is set
      let targetPageSlug: string | null = null;
      let targetFunnelSlug: string | null = null;
      if (result.targetPageId) {
        const [targetPage] = await db
          .select({ slug: funnelPages.slug, funnelId: funnelPages.funnelId })
          .from(funnelPages)
          .where(eq(funnelPages.id, result.targetPageId));
        if (targetPage) {
          targetPageSlug = targetPage.slug;
          const [targetFunnel] = await db
            .select({ slug: funnels.slug })
            .from(funnels)
            .where(eq(funnels.id, targetPage.funnelId));
          targetFunnelSlug = targetFunnel?.slug ?? null;
        }
      }
      return {
        matched: true,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        targetPageId: result.targetPageId,
        targetPageSlug,
        targetFunnelSlug,
                targetUrl: result.targetUrl,
      };
    }),

  /**
   * Create a Stripe Checkout Session from a direct-checkout CTA button on any landing page.
   * No authentication required — works for anonymous visitors.
   * Fulfillment is handled by the existing Stripe webhook (handleFunnelPaymentIntentSucceeded).
   */
  createDirectCheckout: publicProcedure
    .input(
      z.object({
        productType: z.enum(["course", "quiz", "cohort", "download", "product", "bundle"]),
        productId: z.number().int().positive(),
        origin: z.string(),
        email: z.string().email().optional(),
        promoCode: z.string().optional(),
        funnelId: z.number().optional(),
        pageId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const stripe = getStripeClient();
      // ── Resolve product details ──────────────────────────────────────────────
      let productName = "";
      let unitAmount = 0; // in dollars — will be converted to cents for Stripe
      let currency = "usd";
      if (input.productType === "course" || input.productType === "quiz" || input.productType === "cohort") {
        const [course] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, price: lmsCourses.price, currency: lmsCourses.currency, isFree: lmsCourses.isFree, pricingType: lmsCourses.pricingType })
          .from(lmsCourses).where(eq(lmsCourses.id, input.productId)).limit(1);
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
        if (course.isFree || course.pricingType === "free" || !course.price) throw new TRPCError({ code: "BAD_REQUEST", message: "Course is free — use free enrollment" });
        // Guard: block checkout if user is already actively enrolled
        if (ctx.user) {
          const [existingCourseEnr] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType, accessExpiresAt: lmsEnrollments.accessExpiresAt })
            .from(lmsEnrollments)
            .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id)))
            .limit(1);
          if (existingCourseEnr && existingCourseEnr.enrollmentType !== "free_preview" && (!existingCourseEnr.accessExpiresAt || new Date(existingCourseEnr.accessExpiresAt) > new Date())) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "You are already enrolled in this course." });
          }
        }
        productName = course.title;
        unitAmount = course.price;
        currency = course.currency ?? "usd";
      } else if (input.productType === "download") {
        const [prod] = await db.select({ id: digitalProducts.id, title: digitalProducts.title, price: digitalProducts.price })
          .from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
        if (!prod) throw new TRPCError({ code: "NOT_FOUND", message: "Download not found" });
        if (!prod.price) throw new TRPCError({ code: "BAD_REQUEST", message: "Product has no price" });
        productName = prod.title;
        unitAmount = prod.price;
      } else if (input.productType === "bundle") {
        const [bundle] = await db.select({ id: digitalBundles.id, title: digitalBundles.title, discountPrice: digitalBundles.discountPrice, originalPrice: digitalBundles.originalPrice })
          .from(digitalBundles).where(eq(digitalBundles.id, input.productId)).limit(1);
        if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        const bundlePrice = bundle.discountPrice || bundle.originalPrice;
        if (!bundlePrice) throw new TRPCError({ code: "BAD_REQUEST", message: "Bundle has no price" });
        productName = bundle.title;
        unitAmount = bundlePrice;
      } else {
        // physical product
        const { physicalProducts } = await import("../../drizzle/schema");
        const [prod] = await db.select({ id: physicalProducts.id, title: physicalProducts.title, price: physicalProducts.price })
          .from(physicalProducts).where(eq(physicalProducts.id, input.productId)).limit(1);
        if (!prod) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        if (!prod.price) throw new TRPCError({ code: "BAD_REQUEST", message: "Product has no price" });
        productName = prod.title;
        unitAmount = prod.price;
      }
      // ── Build Stripe session ─────────────────────────────────────────────────
      const successUrl = `${input.origin}/my-dashboard?purchase=success&product=${encodeURIComponent(productName)}`;
      const cancelUrl = `${input.origin}`;
      const sessionParams: any = {
        mode: "payment",
        allow_promotion_codes: true,
        line_items: [{
          price_data: {
            currency,
            product_data: { name: productName },
            unit_amount: Math.round(Number(unitAmount) * 100),
          },
          quantity: 1,
        }],
        metadata: {
          type: "funnel_form_purchase",
          product_type: input.productType,
          product_id: input.productId.toString(),
          product_name: productName.slice(0, 490),
          customer_email: input.email ?? "",
          funnel_id: input.funnelId?.toString() ?? "",
          funnel_page_id: input.pageId?.toString() ?? "",
          user_id: ctx.user?.id?.toString() ?? "",
          success_url: successUrl.slice(0, 490),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      };
      if (input.email) sessionParams.customer_email = input.email;
      // Apply promo code if provided
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode, active: true, limit: 1 });
          if (promoCodes.data.length > 0) {
            const coupon = promoCodes.data[0].coupon as any;
            let discountedAmount = Math.round(Number(unitAmount));
            if (coupon.percent_off) discountedAmount -= Math.round(discountedAmount * (coupon.percent_off / 100));
            else if (coupon.amount_off) discountedAmount -= Math.min(coupon.amount_off, discountedAmount);
            if (discountedAmount <= 0) {
              // 100% off — grant access directly
              const userId = ctx.user?.id ?? null;
              if (userId) {
                const freeRef = `free_promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                if (input.productType === "course" || input.productType === "quiz" || input.productType === "cohort") {
                  const [ex] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
                    .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.productId))).limit(1);
                  if (!ex) await db.insert(lmsEnrollments).values({ userId, courseId: input.productId, orderId: null, affiliateCode: null });
                } else if (input.productType === "download") {
                  const [ex] = await db.select({ id: digitalPurchases.id }).from(digitalPurchases)
                    .where(and(eq(digitalPurchases.userId, userId), eq(digitalPurchases.productId, input.productId))).limit(1);
                  if (!ex) await db.insert(digitalPurchases).values({ userId, productId: input.productId, stripeCheckoutSessionId: freeRef });
                } else if (input.productType === "bundle") {
                  const [ex] = await db.select({ id: bundleEnrollments.id }).from(bundleEnrollments)
                    .where(and(eq(bundleEnrollments.userId, userId), eq(bundleEnrollments.bundleId, input.productId))).limit(1);
                  if (!ex) await db.insert(bundleEnrollments).values({ userId, bundleId: input.productId, stripeCheckoutSessionId: freeRef });
                }
              }
              return { checkoutUrl: null, freeSuccess: true, successUrl };
            }
            sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
            delete sessionParams.allow_promotion_codes;
          }
        } catch (e: any) { if (e instanceof TRPCError) throw e; /* ignore other promo code errors */ }
      }
      const session = await stripe.checkout.sessions.create(sessionParams);
      return { checkoutUrl: session.url, freeSuccess: false, successUrl: null };
    }),
});

// ─── Funnel Admin Extended Router ─────────────────────────────────────────────
export const funnelAdminRouter = router({

  /** List pages that can be imported into a funnel (standalone landing pages + pages from other funnels) */
  listImportablePages: protectedProcedure
    .input(z.object({ excludeFunnelId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // ── Funnels (other than current) with their pages ──
      const allFunnelsList = await db
        .select({ id: funnels.id, name: funnels.name, status: funnels.status })
        .from(funnels)
        .orderBy(asc(funnels.name));

      const otherFunnels = allFunnelsList.filter(f =>
        input.excludeFunnelId ? f.id !== input.excludeFunnelId : true
      );

      const otherFunnelIds = otherFunnels.map(f => f.id);
      let funnelPagesRows: { id: number; title: string; slug: string; pageType: string; funnelId: number; views: number | null }[] = [];
      if (otherFunnelIds.length > 0) {
        funnelPagesRows = await db
          .select({ id: funnelPages.id, title: funnelPages.title, slug: funnelPages.slug, pageType: funnelPages.pageType, funnelId: funnelPages.funnelId, views: funnelPages.views })
          .from(funnelPages)
          .where(sql`${funnelPages.funnelId} IN (${sql.join(otherFunnelIds.map(id => sql`${id}`), sql`, `)})`)
          .orderBy(asc(funnelPages.sortOrder));
      }

      const funnelPagesByFunnelId = new Map<number, typeof funnelPagesRows>();
      for (const p of funnelPagesRows) {
        if (!funnelPagesByFunnelId.has(p.funnelId)) funnelPagesByFunnelId.set(p.funnelId, []);
        funnelPagesByFunnelId.get(p.funnelId)!.push(p);
      }

      const funnelSources = otherFunnels
        .map(f => ({
          sourceType: "funnel" as const,
          sourceId: f.id,
          sourceName: f.name,
          sourceStatus: f.status ?? "draft",
          pages: (funnelPagesByFunnelId.get(f.id) ?? []).map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            pageType: p.pageType,
            views: p.views ?? 0,
            sourceType: "funnel" as const,
          })),
        }))
        .filter(f => f.pages.length > 0);

      // ── Standalone funnel landing pages ──
      const standalonePages = await db
        .select({ id: funnelPages.id, title: funnelPages.title, slug: funnelPages.slug, pageType: funnelPages.pageType, funnelId: funnelPages.funnelId, views: funnelPages.views })
        .from(funnelPages)
        .where(eq(funnelPages.isStandaloneLanding, true))
        .orderBy(desc(funnelPages.views));

      const standaloneSources = standalonePages.length > 0 ? [{
        sourceType: "standalone" as const,
        sourceId: 0,
        sourceName: "Standalone Landing Pages",
        sourceStatus: "published",
        pages: standalonePages.map(p => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          pageType: p.pageType,
          views: p.views ?? 0,
          sourceType: "standalone" as const,
        })),
      }] : [];

      // ── Courses (all statuses) ──
      const courseRows = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, status: lmsCourses.status, type: lmsCourses.type })
        .from(lmsCourses)
        .orderBy(asc(lmsCourses.title));

      const courseSources = courseRows.map(c => ({
        sourceType: "course" as const,
        sourceId: c.id,
        sourceName: c.title,
        sourceStatus: c.status,
        pages: [{
          id: c.id,
          title: `${c.title} — Landing Page`,
          slug: c.slug,
          pageType: "landing" as string,
          views: 0,
          sourceType: "course" as const,
        }],
      }));

      // ── Downloads / Digital Products (all statuses) ──
      const downloadRows = await db
        .select({ id: digitalProducts.id, title: digitalProducts.title, slug: digitalProducts.slug, status: digitalProducts.status })
        .from(digitalProducts)
        .orderBy(asc(digitalProducts.title));

      const downloadSources = downloadRows.map(d => ({
        sourceType: "download" as const,
        sourceId: d.id,
        sourceName: d.title,
        sourceStatus: d.status,
        pages: [{
          id: d.id,
          title: `${d.title} — Landing Page`,
          slug: d.slug,
          pageType: "landing" as string,
          views: 0,
          sourceType: "download" as const,
        }],
      }));

      return [
        ...standaloneSources,
        ...funnelSources,
        ...courseSources,
        ...downloadSources,
      ];
    }),

  /** Import (copy) an existing page into a funnel */
  importPageToFunnel: protectedProcedure
    .input(z.object({
      sourcePageId: z.number(),
      targetFunnelId: z.number(),
      sourceType: z.enum(["funnel", "standalone", "course", "download"]).default("funnel"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get max sort order for target funnel
      const existing = await db.select({ sortOrder: funnelPages.sortOrder }).from(funnelPages).where(eq(funnelPages.funnelId, input.targetFunnelId)).orderBy(desc(funnelPages.sortOrder)).limit(1);
      const nextOrder = (existing[0]?.sortOrder ?? 0) + 1;
      const suffix = Date.now().toString(36).slice(-4);

      if (input.sourceType === "course") {
        const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.sourcePageId));
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        // Fetch the landing page blocks from lmsLandingPages
        const [landingPage] = await db.select({ blocks: lmsLandingPages.blocks }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1);
        const blocks = landingPage?.blocks ?? null;
        const newSlug = `${course.slug}-funnel-${suffix}`;
        const [inserted] = await db.insert(funnelPages).values({
          funnelId: input.targetFunnelId,
          pageType: "landing",
          title: course.title + " (Imported)",
          slug: newSlug,
          blocks,
          productType: "course",
          productId: course.id,
          sortOrder: nextOrder,
          isActive: true,
          isHidden: false,
          isStandaloneLanding: false,
        });
        return { id: (inserted as any).insertId, slug: newSlug };
      }

      if (input.sourceType === "download") {
        const [product] = await db.select().from(digitalProducts).where(eq(digitalProducts.id, input.sourcePageId));
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const newSlug = `${product.slug}-funnel-${suffix}`;
        // Copy landing blocks from the download product if available
        const blocks = product.landingBlocks ?? null;
        const [inserted] = await db.insert(funnelPages).values({
          funnelId: input.targetFunnelId,
          pageType: "landing",
          title: product.title + " (Imported)",
          slug: newSlug,
          blocks,
          productType: "download",
          productId: product.id,
          sortOrder: nextOrder,
          isActive: true,
          isHidden: false,
          isStandaloneLanding: false,
        });
        return { id: (inserted as any).insertId, slug: newSlug };
      }

      // funnel or standalone page
      const [original] = await db.select().from(funnelPages).where(eq(funnelPages.id, input.sourcePageId));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      const baseSlug = original.slug.replace(/-copy.*$/, "").replace(/-standalone.*$/, "").replace(/-imported.*$/, "");
      const newSlug = `${baseSlug}-imported-${suffix}`;

      const [inserted] = await db.insert(funnelPages).values({
        funnelId: input.targetFunnelId,
        pageType: original.pageType,
        title: original.title + " (Imported)",
        slug: newSlug,
        blocks: original.blocks,
        productType: original.productType,
        productId: original.productId,
        customPrice: original.customPrice,
        customPriceLabel: original.customPriceLabel,
        sortOrder: nextOrder,
        isActive: true,
        isHidden: false,
        isStandaloneLanding: false,
        showNavigationButton: original.showNavigationButton,
      });

      return { id: (inserted as any).insertId, slug: newSlug };
    }),

  /** Get per-page analytics with drop-off rates and sales issue detection */
  getFunnelAnalytics: protectedProcedure
    .input(z.object({ funnelId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get funnel
      const [funnel] = await db.select().from(funnels).where(eq(funnels.id, input.funnelId));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND" });

      // Get pages in order
      const pages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, input.funnelId))
        .orderBy(asc(funnelPages.sortOrder));

      // Get total leads for this funnel
      const [leadCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(funnelLeads)
        .where(eq(funnelLeads.funnelId, input.funnelId));
      const totalLeads = Number(leadCount?.count ?? 0);

      // Build per-page analytics with drop-off
      const pageStats = pages.map((page, idx) => {
        const prevPage = idx > 0 ? pages[idx - 1] : null;
        const entryViews = idx === 0 ? page.views : (prevPage?.views ?? 0);
        const dropOffRate = entryViews > 0 ? Math.round(((entryViews - page.views) / entryViews) * 100) : 0;
        const conversionRate = page.views > 0 ? Math.round((page.conversions / page.views) * 100) : 0;
        const isBuyPoint = page.pageType === "checkout" || page.pageType === "upsell" || page.pageType === "downsell";
        return {
          id: page.id,
          title: page.title,
          slug: page.slug,
          pageType: page.pageType,
          views: page.views,
          conversions: page.conversions,
          dropOffRate: idx === 0 ? 0 : dropOffRate,
          conversionRate,
          isBuyPoint,
          hasProduct: !!page.productId || !!page.productType,
          hasNextStep: !!page.nextPageId,
          isHidden: page.isHidden,
        };
      });

      // Detect critical sales workflow issues
      const issues: Array<{ severity: "error" | "warning"; pageId: number; pageTitle: string; issue: string }> = [];

      for (const page of pages) {
        // Checkout/upsell pages without a product
        if ((page.pageType === "checkout" || page.pageType === "upsell") && !page.productId && !page.productType) {
          issues.push({ severity: "error", pageId: page.id, pageTitle: page.title, issue: "Checkout/upsell page has no product attached" });
        }
        // Pages without a next step (except last page and thank_you)
        const isLast = pages[pages.length - 1].id === page.id;
        if (!isLast && page.pageType !== "thank_you" && !page.nextPageId) {
          issues.push({ severity: "warning", pageId: page.id, pageTitle: page.title, issue: "No next step configured — visitors will be stuck" });
        }
        // High drop-off on buy points
        const stat = pageStats.find(s => s.id === page.id);
        if (stat && stat.isBuyPoint && stat.dropOffRate > 70) {
          issues.push({ severity: "warning", pageId: page.id, pageTitle: page.title, issue: `High drop-off rate (${stat.dropOffRate}%) on buy point` });
        }
        // Landing pages with 0 views
        if (page.pageType === "landing" && page.views === 0) {
          issues.push({ severity: "warning", pageId: page.id, pageTitle: page.title, issue: "Landing page has no views yet — check your traffic source" });
        }
      }

      // Overall funnel stats
      const entryViews = pages[0]?.views ?? 0;
      const exitConversions = pages[pages.length - 1]?.conversions ?? 0;
      const overallConversionRate = entryViews > 0 ? Math.round((exitConversions / entryViews) * 100) : 0;

      return {
        funnelName: funnel.name,
        totalViews: funnel.totalViews,
        totalLeads,
        overallConversionRate,
        pageStats,
        issues,
      };
    }),

  /** Export funnel leads as CSV data */
  exportFunnelLeadsCSV: protectedProcedure
    .input(z.object({ funnelId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const leads = await db
        .select()
        .from(funnelLeads)
        .where(eq(funnelLeads.funnelId, input.funnelId))
        .orderBy(desc(funnelLeads.createdAt));

      // Get page titles for reference
      const pages = await db.select({ id: funnelPages.id, title: funnelPages.title }).from(funnelPages).where(eq(funnelPages.funnelId, input.funnelId));
      const pageMap = new Map(pages.map(p => [p.id, p.title]));

      // Build CSV rows
      const headers = ["ID", "Email", "Name", "Phone", "Page", "Source", "Tags", "Referrer", "Timezone", "Created At"];
      const rows = leads.map(l => [
        l.id,
        l.email,
        l.name ?? "",
        l.phone ?? "",
        pageMap.get(l.funnelPageId) ?? l.funnelPageId,
        l.source ?? "",
        l.tags ?? "",
        l.referrer ?? "",
        l.timezone ?? "",
        l.createdAt ? new Date(l.createdAt).toISOString() : "",
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return { csvContent, total: leads.length };
    }),

  /** Global contacts list — all leads across all funnels with conversion status */
  globalContacts: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(50),
      search: z.string().optional(),
      funnelId: z.number().optional(),
      conversionStatus: z.enum(["all", "lead", "registered", "purchaser"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.pageSize;

      // Build base query with funnel name join
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.funnelId) conditions.push(eq(funnelLeads.funnelId, input.funnelId));

      let baseQuery = db
        .select({
          id: funnelLeads.id,
          email: funnelLeads.email,
          name: funnelLeads.name,
          phone: funnelLeads.phone,
          funnelId: funnelLeads.funnelId,
          funnelName: funnels.name,
          source: funnelLeads.source,
          tags: funnelLeads.tags,
          ipAddress: funnelLeads.ipAddress,
          referrer: funnelLeads.referrer,
          userId: funnelLeads.userId,
          createdAt: funnelLeads.createdAt,
          lastActiveAt: funnelLeads.lastActiveAt,
        })
        .from(funnelLeads)
        .leftJoin(funnels, eq(funnelLeads.funnelId, funnels.id));

      if (conditions.length > 0) {
        baseQuery = baseQuery.where(and(...conditions)) as typeof baseQuery;
      }

      // Get all matching leads
      const allLeads = await baseQuery.orderBy(desc(funnelLeads.createdAt));

      // Apply search filter in JS (for email/name)
      let filtered = allLeads;
      if (input.search) {
        const s = input.search.toLowerCase();
        filtered = allLeads.filter(l =>
          l.email.toLowerCase().includes(s) ||
          (l.name ?? "").toLowerCase().includes(s) ||
          (l.funnelName ?? "").toLowerCase().includes(s)
        );
      }

      // Get all unique emails to check registration and purchase status
      const emails = [...new Set(filtered.map(l => l.email.toLowerCase()))];

      // Match to users by email
      const matchedUsers = emails.length > 0
        ? await db.select({ id: users.id, email: users.email, createdAt: users.createdAt })
            .from(users)
            .where(sql`LOWER(${users.email}) IN (${sql.join(emails.map(e => sql`${e}`), sql`, `)})`)
        : [];
      const userEmailMap = new Map(matchedUsers.map(u => [u.email.toLowerCase(), u]));

      // Check purchaser status: has any lms_order or digital_purchase
      const purchaserUserIds = matchedUsers.length > 0
        ? await db.selectDistinct({ userId: lmsOrders.userId })
            .from(lmsOrders)
            .where(inArray(lmsOrders.userId, matchedUsers.map(u => u.id)))
        : [];
      const purchaserDpIds = matchedUsers.length > 0
        ? await db.selectDistinct({ userId: digitalPurchases.userId })
            .from(digitalPurchases)
            .where(inArray(digitalPurchases.userId, matchedUsers.map(u => u.id)))
        : [];
      const purchaserIds = new Set([
        ...purchaserUserIds.map(p => p.userId),
        ...purchaserDpIds.map(p => p.userId),
      ]);

      // Annotate each lead with conversion status
      const annotated = filtered.map(l => {
        const user = userEmailMap.get(l.email.toLowerCase());
        const isPurchaser = user ? purchaserIds.has(user.id) : false;
        const isRegistered = !!user;
        const status: "purchaser" | "registered" | "lead" = isPurchaser ? "purchaser" : isRegistered ? "registered" : "lead";
        return {
          ...l,
          conversionStatus: status,
          registeredAt: user?.createdAt ?? null,
          userId: user?.id ?? l.userId,
        };
      });

      // Filter by conversion status
      const statusFiltered = input.conversionStatus === "all"
        ? annotated
        : annotated.filter(l => l.conversionStatus === input.conversionStatus);

      const total = statusFiltered.length;
      const paginated = statusFiltered.slice(offset, offset + input.pageSize);

      return { contacts: paginated, total, page: input.page, pageSize: input.pageSize };
    }),

  /** Conversion funnel summary — Lead → Registered → Purchaser metrics */
  conversionFunnel: protectedProcedure
    .input(z.object({ funnelId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Total leads
      const [{ totalLeads }] = await db
        .select({ totalLeads: sql<number>`COUNT(DISTINCT ${funnelLeads.email})` })
        .from(funnelLeads)
        .where(input.funnelId ? eq(funnelLeads.funnelId, input.funnelId) : sql`1=1`);

      // Get all lead emails
      const leadEmailRows = await db
        .select({ email: funnelLeads.email })
        .from(funnelLeads)
        .where(input.funnelId ? eq(funnelLeads.funnelId, input.funnelId) : sql`1=1`);
      const leadEmails = [...new Set(leadEmailRows.map(r => r.email.toLowerCase()))];

      if (leadEmails.length === 0) {
        return {
          totalLeads: 0, registeredUsers: 0, purchasers: 0,
          leadToRegisteredRate: 0, registeredToPurchaserRate: 0, overallConversionRate: 0,
          byFunnel: [], recentLeads: [],
        };
      }

      // Match to registered users
      const matchedUsers = await db
        .select({ id: users.id, email: users.email, createdAt: users.createdAt })
        .from(users)
        .where(sql`LOWER(${users.email}) IN (${sql.join(leadEmails.map(e => sql`${e}`), sql`, `)})`);
      const registeredUsers = matchedUsers.length;

      // Check purchaser status
      const purchaserLmsIds = matchedUsers.length > 0
        ? await db.selectDistinct({ userId: lmsOrders.userId })
            .from(lmsOrders).where(inArray(lmsOrders.userId, matchedUsers.map(u => u.id)))
        : [];
      const purchaserDpIds = matchedUsers.length > 0
        ? await db.selectDistinct({ userId: digitalPurchases.userId })
            .from(digitalPurchases).where(inArray(digitalPurchases.userId, matchedUsers.map(u => u.id)))
        : [];
      const purchaserIds = new Set([...purchaserLmsIds.map(p => p.userId), ...purchaserDpIds.map(p => p.userId)]);
      const purchasers = purchaserIds.size;

      // Per-funnel breakdown
      const funnelList = await db
        .select({ id: funnels.id, name: funnels.name })
        .from(funnels)
        .where(input.funnelId ? eq(funnels.id, input.funnelId) : sql`1=1`);

      const byFunnel = await Promise.all(funnelList.map(async (f) => {
        const [{ count }] = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${funnelLeads.email})` })
          .from(funnelLeads).where(eq(funnelLeads.funnelId, f.id));
        const funnelEmails = await db
          .select({ email: funnelLeads.email })
          .from(funnelLeads).where(eq(funnelLeads.funnelId, f.id));
        const fEmails = [...new Set(funnelEmails.map(r => r.email.toLowerCase()))];
        const fUsers = fEmails.length > 0
          ? await db.select({ id: users.id }).from(users)
              .where(sql`LOWER(${users.email}) IN (${sql.join(fEmails.map(e => sql`${e}`), sql`, `)})`)
          : [];
        const fPurchasers = fUsers.filter(u => purchaserIds.has(u.id)).length;
        return {
          funnelId: f.id,
          funnelName: f.name,
          leads: Number(count),
          registered: fUsers.length,
          purchasers: fPurchasers,
          registrationRate: count > 0 ? Math.round((fUsers.length / Number(count)) * 100) : 0,
          purchaseRate: fUsers.length > 0 ? Math.round((fPurchasers / fUsers.length) * 100) : 0,
        };
      }));

      // Recent leads (last 10)
      const recentLeads = await db
        .select({ email: funnelLeads.email, name: funnelLeads.name, funnelName: funnels.name, createdAt: funnelLeads.createdAt })
        .from(funnelLeads)
        .leftJoin(funnels, eq(funnelLeads.funnelId, funnels.id))
        .where(input.funnelId ? eq(funnelLeads.funnelId, input.funnelId) : sql`1=1`)
        .orderBy(desc(funnelLeads.createdAt))
        .limit(10);

      return {
        totalLeads: Number(totalLeads),
        registeredUsers,
        purchasers,
        leadToRegisteredRate: totalLeads > 0 ? Math.round((registeredUsers / Number(totalLeads)) * 100) : 0,
        registeredToPurchaserRate: registeredUsers > 0 ? Math.round((purchasers / registeredUsers) * 100) : 0,
        overallConversionRate: totalLeads > 0 ? Math.round((purchasers / Number(totalLeads)) * 100) : 0,
        byFunnel: byFunnel.filter(f => f.leads > 0),
        recentLeads,
      };
    }),

  /** Export all contacts as CSV with conversion status */
  exportAllContactsCSV: protectedProcedure
    .input(z.object({ funnelId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const leads = await db
        .select({
          id: funnelLeads.id, email: funnelLeads.email, name: funnelLeads.name,
          phone: funnelLeads.phone, funnelName: funnels.name, source: funnelLeads.source,
          tags: funnelLeads.tags, ipAddress: funnelLeads.ipAddress,
          referrer: funnelLeads.referrer, createdAt: funnelLeads.createdAt,
        })
        .from(funnelLeads)
        .leftJoin(funnels, eq(funnelLeads.funnelId, funnels.id))
        .where(input.funnelId ? eq(funnelLeads.funnelId, input.funnelId) : sql`1=1`)
        .orderBy(desc(funnelLeads.createdAt));

      const emails = [...new Set(leads.map(l => l.email.toLowerCase()))];
      const matchedUsers = emails.length > 0
        ? await db.select({ id: users.id, email: users.email, createdAt: users.createdAt })
            .from(users)
            .where(sql`LOWER(${users.email}) IN (${sql.join(emails.map(e => sql`${e}`), sql`, `)})`)
        : [];
      const userEmailMap = new Map(matchedUsers.map(u => [u.email.toLowerCase(), u]));
      const purchaserLmsIds = matchedUsers.length > 0
        ? await db.selectDistinct({ userId: lmsOrders.userId }).from(lmsOrders)
            .where(inArray(lmsOrders.userId, matchedUsers.map(u => u.id)))
        : [];
      const purchaserDpIds = matchedUsers.length > 0
        ? await db.selectDistinct({ userId: digitalPurchases.userId }).from(digitalPurchases)
            .where(inArray(digitalPurchases.userId, matchedUsers.map(u => u.id)))
        : [];
      const purchaserIds = new Set([...purchaserLmsIds.map(p => p.userId), ...purchaserDpIds.map(p => p.userId)]);

      const escape = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const headers = ["ID", "Email", "Name", "Phone", "Funnel", "Source", "Tags", "IP Address", "Referrer", "Conversion Status", "Registered At", "Lead Captured At"];
      const rows = leads.map(l => {
        const user = userEmailMap.get(l.email.toLowerCase());
        const isPurchaser = user ? purchaserIds.has(user.id) : false;
        const status = isPurchaser ? "Purchaser" : user ? "Registered" : "Lead";
        return [
          l.id, l.email, l.name, l.phone, l.funnelName, l.source, l.tags,
          l.ipAddress, l.referrer, status,
          user?.createdAt ? new Date(user.createdAt).toISOString() : "",
          l.createdAt ? new Date(l.createdAt).toISOString() : "",
        ].map(escape).join(",");
      });

      const csvContent = [headers.map(escape).join(","), ...rows].join("\n");
      return { csvContent, total: leads.length };
    }),

  /**
   * getEnrollmentCount — public procedure used by the EnrollmentCounter block.
   * Returns the count for the requested entity type. No auth required so it
   * works on public landing pages and standalone funnel pages.
   */
  getEnrollmentCount: publicProcedure
    .input(z.object({
      countType: z.enum([
        "site_users",
        "course", "all_courses",
        "brand_membership",
        "download", "all_downloads",
        "webinar", "all_webinars",
        "bundle", "all_bundles",
      ]),
      entityId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const { countType, entityId } = input;
      let n = 0;
      switch (countType) {
        case "site_users": {
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(users);
          n = Number(r?.c ?? 0);
          break;
        }
        case "course": {
          if (!entityId) { n = 0; break; }
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(lmsEnrollments)
            .where(eq(lmsEnrollments.courseId, entityId));
          n = Number(r?.c ?? 0);
          break;
        }
        case "all_courses": {
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(lmsEnrollments);
          n = Number(r?.c ?? 0);
          break;
        }
        case "brand_membership": {
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(brandMemberships)
            .where(eq(brandMemberships.status, "active"));
          n = Number(r?.c ?? 0);
          break;
        }
        case "download": {
          if (!entityId) { n = 0; break; }
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(digitalPurchases)
            .where(eq(digitalPurchases.productId, entityId));
          n = Number(r?.c ?? 0);
          break;
        }
        case "all_downloads": {
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(digitalPurchases);
          n = Number(r?.c ?? 0);
          break;
        }
        case "webinar": {
          if (!entityId) { n = 0; break; }
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(webinarRegistrations)
            .where(eq(webinarRegistrations.webinarId, entityId));
          n = Number(r?.c ?? 0);
          break;
        }
        case "all_webinars": {
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(webinarRegistrations);
          n = Number(r?.c ?? 0);
          break;
        }
        case "bundle": {
          if (!entityId) { n = 0; break; }
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(bundleEnrollments)
            .where(eq(bundleEnrollments.bundleId, entityId));
          n = Number(r?.c ?? 0);
          break;
        }
        case "all_bundles": {
          const [r] = await db.select({ c: sql<number>`COUNT(*)` }).from(bundleEnrollments);
          n = Number(r?.c ?? 0);
          break;
        }
        default:
          n = 0;
      }
      return { count: n };
    }),

  /** Get all funnels with their pages (including blocks) for the block picker "Copy from Other Pages" tab */
  getFunnelsWithPages: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const allFunnelsList = await db
        .select({ id: funnels.id, name: funnels.name, status: funnels.status })
        .from(funnels)
        .orderBy(asc(funnels.name));
      const result = [];
      for (const funnel of allFunnelsList) {
        const pages = await db
          .select({ id: funnelPages.id, title: funnelPages.title, slug: funnelPages.slug, pageType: funnelPages.pageType, blocks: funnelPages.blocks })
          .from(funnelPages)
          .where(eq(funnelPages.funnelId, funnel.id))
          .orderBy(asc(funnelPages.sortOrder));
        const pagesWithBlocks = pages.filter(p => p.blocks && p.blocks.length > 2);
        if (pagesWithBlocks.length > 0) {
          result.push({ ...funnel, pages: pagesWithBlocks });
        }
      }
      return result;
    }),
});
