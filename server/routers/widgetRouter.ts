import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, and, inArray, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  embedWidgets, lmsCourses, digitalProducts, digitalBundles, webinars,
  membershipPlans, physicalProducts, workshops, communities, workshopInstances,
} from "../../drizzle/schema";

function assertAdmin(ctx: any) {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

const widgetItemSchema = z.object({
  type: z.enum(["course", "quiz", "cohort", "download", "bundle", "webinar", "membership", "physical", "workshop", "community"]),
  id: z.number().int().positive(),
});

const widgetInputSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().max(255).optional(),
  subtitle: z.string().max(500).optional(),
  layout: z.enum(["grid", "carousel", "list"]).default("grid"),
  theme: z.enum(["light", "dark", "brand"]).default("light"),
  cardStyle: z.enum(["standard", "compact", "minimal"]).default("standard"),
  showPrice: z.boolean().default(true),
  showEnrollButton: z.boolean().default(true),
  showCourseDetails: z.boolean().default(false),
  buttonText: z.string().max(100).default("Enroll Now"),
  buttonUrl: z.string().max(500).optional(),
  maxCards: z.number().int().min(1).max(50).default(6),
  items: z.array(widgetItemSchema).default([]),
  isActive: z.boolean().default(true),
});

export const widgetAdminRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(embedWidgets).orderBy(desc(embedWidgets.createdAt));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [widget] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, input.id));
      if (!widget) throw new TRPCError({ code: "NOT_FOUND" });
      return widget;
    }),

  create: protectedProcedure
    .input(widgetInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const token = generateToken();
      const [result] = await db.insert(embedWidgets).values({
        token,
        name: input.name,
        title: input.title ?? null,
        subtitle: input.subtitle ?? null,
        layout: input.layout,
        theme: input.theme,
        cardStyle: input.cardStyle,
        showPrice: input.showPrice,
        showEnrollButton: input.showEnrollButton,
        showCourseDetails: input.showCourseDetails,
        buttonText: input.buttonText,
        buttonUrl: input.buttonUrl ?? null,
        maxCards: input.maxCards,
        items: JSON.stringify(input.items),
        isActive: input.isActive,
      });
      const [widget] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, (result as any).insertId));
      return widget;
    }),

  update: protectedProcedure
    .input(widgetInputSchema.extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, items, ...rest } = input;
      await db.update(embedWidgets).set({
        ...rest,
        items: JSON.stringify(items),
      }).where(eq(embedWidgets.id, id));
      const [widget] = await db.select().from(embedWidgets).where(eq(embedWidgets.id, id));
      return widget;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(embedWidgets).where(eq(embedWidgets.id, input.id));
      return { success: true };
    }),

  regenerateToken: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const token = generateToken();
      await db.update(embedWidgets).set({ token }).where(eq(embedWidgets.id, input.id));
      return { token };
    }),

  /** List all publishable content across every product type for the picker */
  listAllContent: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    function shape(rows: any[], type: string, coverKey = "coverImageUrl") {
      return rows.map(r => ({
        id: r.id as number,
        type,
        title: (r.title ?? "") as string,
        coverImageUrl: (r[coverKey] ?? r.thumbnailUrl ?? r.coverImage ?? null) as string | null,
      }));
    }

    const [courses, downloads, bundles, webinarRows, memberships, physicals, workshopRows, communityRows] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, type: lmsCourses.type })
        .from(lmsCourses).where(eq(lmsCourses.status, "public")),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, thumbnailUrl: digitalProducts.thumbnailUrl })
        .from(digitalProducts).where(eq(digitalProducts.status, "published")),
      db.select({ id: digitalBundles.id, title: digitalBundles.title, thumbnailUrl: digitalBundles.thumbnailUrl })
        .from(digitalBundles).where(eq(digitalBundles.status, "published")),
      db.select({ id: webinars.id, title: webinars.title, coverImage: webinars.coverImage })
        .from(webinars).where(eq(webinars.status, "published")),
      db.select({ id: membershipPlans.id, title: membershipPlans.title, coverImage: membershipPlans.coverImage })
        .from(membershipPlans).where(eq(membershipPlans.status, "published")),
      db.select({ id: physicalProducts.id, title: physicalProducts.title, thumbnailUrl: physicalProducts.thumbnailUrl })
        .from(physicalProducts).where(eq(physicalProducts.status, "published")),
      db.select({ id: workshops.id, title: workshops.title, coverImageUrl: workshops.coverImageUrl })
        .from(workshops).where(eq(workshops.status, "public")),
      db.select({ id: communities.id, title: communities.title, coverImage: communities.coverImage })
        .from(communities).where(eq(communities.status, "published")),
    ]);

    return [
      // Courses: split by type (course vs quiz)
      ...courses.map(r => ({ id: r.id, type: r.type as string, title: r.title, coverImageUrl: r.coverImageUrl ?? null })),
      ...shape(downloads, "download", "thumbnailUrl"),
      ...shape(bundles, "bundle", "thumbnailUrl"),
      ...shape(webinarRows, "webinar", "coverImage"),
      ...shape(memberships, "membership", "coverImage"),
      ...shape(physicals, "physical", "thumbnailUrl"),
      ...shape(workshopRows, "workshop", "coverImageUrl"),
      ...shape(communityRows, "community", "coverImage"),
    ];
  }),
});

export const widgetPublicRouter = router({
  /** Public endpoint: fetch widget config + card data by token */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [widget] = await db
        .select()
        .from(embedWidgets)
        .where(and(eq(embedWidgets.token, input.token), eq(embedWidgets.isActive, true)));
      if (!widget) throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found or inactive" });

      // Parse items and fetch data for all product types
      let items: Array<{ type: string; id: number }> = [];
      try { items = JSON.parse(widget.items || "[]"); } catch {}

      // Helper to normalise a row into a unified card shape
      function toCard(row: any, itemType: string, overrides: Partial<any> = {}): any {
        return {
          id: row.id,
          slug: row.slug ?? null,
          title: row.title ?? "",
          subtitle: row.subtitle ?? null,
          coverImageUrl: row.coverImageUrl ?? row.thumbnailUrl ?? row.coverImage ?? null,
          type: itemType,
          price: row.price ?? row.discountPrice ?? 0,
          isFree: row.isFree ?? row.accessType === "free" ?? false,
          pricingType: row.pricingType ?? row.billingInterval ?? null,
          subscriptionInterval: row.subscriptionInterval ?? row.billingInterval ?? null,
          currency: row.currency ?? "usd",
          brand: row.brand ?? null,
          itemType,
          ...overrides,
        };
      }

      // Bucket item IDs by type
      const byType = (t: string) => items.filter(i => i.type === t).map(i => i.id);
      const courseIds    = [...byType("course"), ...byType("quiz"), ...byType("cohort")];
      const downloadIds  = byType("download");
      const bundleIds    = byType("bundle");
      const webinarIds   = byType("webinar");
      const membershipIds = byType("membership");
      const physicalIds  = byType("physical");
      const workshopIds  = byType("workshop");
      const communityIds = byType("community");

      const allCards: Map<string, any> = new Map(); // key = `${type}:${id}`

      // Courses & quizzes (include enrollmentCloseDate for cohorts when showCourseDetails is on)
      if (courseIds.length > 0) {
        const rows = await db.select({
          id: lmsCourses.id, slug: lmsCourses.slug, title: lmsCourses.title,
          subtitle: lmsCourses.subtitle, coverImageUrl: lmsCourses.coverImageUrl,
          type: lmsCourses.type, price: lmsCourses.price, isFree: lmsCourses.isFree,
          pricingType: lmsCourses.pricingType, subscriptionInterval: lmsCourses.subscriptionInterval,
          currency: lmsCourses.currency, brand: lmsCourses.brand,
          enrollmentCloseDate: lmsCourses.enrollmentCloseDate,
        }).from(lmsCourses).where(and(inArray(lmsCourses.id, courseIds), eq(lmsCourses.status, "public")));
        rows.forEach(r => allCards.set(`${r.type}:${r.id}`, toCard(r, r.type, {
          enrollmentCloseDate: widget.showCourseDetails ? (r.enrollmentCloseDate ?? null) : undefined,
        })));
      }

      // Digital downloads
      if (downloadIds.length > 0) {
        const rows = await db.select({
          id: digitalProducts.id, slug: digitalProducts.slug, title: digitalProducts.title,
          subtitle: digitalProducts.subtitle, thumbnailUrl: digitalProducts.thumbnailUrl,
          price: digitalProducts.price, isFree: digitalProducts.isFree,
          currency: digitalProducts.currency,
        }).from(digitalProducts).where(and(inArray(digitalProducts.id, downloadIds), eq(digitalProducts.status, "published")));
        rows.forEach(r => allCards.set(`download:${r.id}`, toCard(r, "download")));
      }

      // Bundles
      if (bundleIds.length > 0) {
        const rows = await db.select({
          id: digitalBundles.id, slug: digitalBundles.slug, title: digitalBundles.title,
          subtitle: digitalBundles.subtitle, thumbnailUrl: digitalBundles.thumbnailUrl,
          discountPrice: digitalBundles.discountPrice, currency: digitalBundles.currency, brand: digitalBundles.brand,
        }).from(digitalBundles).where(and(inArray(digitalBundles.id, bundleIds), eq(digitalBundles.status, "published")));
        rows.forEach(r => allCards.set(`bundle:${r.id}`, toCard(r, "bundle", { price: r.discountPrice })));
      }

      // Webinars
      if (webinarIds.length > 0) {
        const rows = await db.select({
          id: webinars.id, slug: webinars.slug, title: webinars.title,
          subtitle: webinars.subtitle, coverImage: webinars.coverImage,
          brand: webinars.brand,
        }).from(webinars).where(and(inArray(webinars.id, webinarIds), eq(webinars.status, "published")));
        rows.forEach(r => allCards.set(`webinar:${r.id}`, toCard(r, "webinar", { isFree: false })));
      }

      // Memberships
      if (membershipIds.length > 0) {
        const rows = await db.select({
          id: membershipPlans.id, slug: membershipPlans.slug, title: membershipPlans.title,
          subtitle: membershipPlans.subtitle, coverImage: membershipPlans.coverImage,
          price: membershipPlans.price, currency: membershipPlans.currency,
          billingInterval: membershipPlans.billingInterval, brand: membershipPlans.brand,
        }).from(membershipPlans).where(and(inArray(membershipPlans.id, membershipIds), eq(membershipPlans.status, "published")));
        rows.forEach(r => allCards.set(`membership:${r.id}`, toCard(r, "membership", { pricingType: "subscription", subscriptionInterval: r.billingInterval })));
      }

      // Physical products
      if (physicalIds.length > 0) {
        const rows = await db.select({
          id: physicalProducts.id, slug: physicalProducts.slug, title: physicalProducts.title,
          subtitle: physicalProducts.subtitle, thumbnailUrl: physicalProducts.thumbnailUrl,
          price: physicalProducts.price, isFree: physicalProducts.isFree,
          currency: physicalProducts.currency, brand: physicalProducts.brand,
        }).from(physicalProducts).where(and(inArray(physicalProducts.id, physicalIds), eq(physicalProducts.status, "published")));
        rows.forEach(r => allCards.set(`physical:${r.id}`, toCard(r, "physical")));
      }

      // Workshops — include next upcoming instance for date/location details
      if (workshopIds.length > 0) {
        const rows = await db.select({
          id: workshops.id, slug: workshops.slug, title: workshops.title,
          subtitle: workshops.subtitle, coverImageUrl: workshops.coverImageUrl,
          price: workshops.price, isFree: workshops.isFree,
          currency: workshops.currency, brand: workshops.brand,
        }).from(workshops).where(and(inArray(workshops.id, workshopIds), eq(workshops.status, "public")));
        // Fetch upcoming instances for date/location display
        if (rows.length > 0 && widget.showCourseDetails) {
          const now = new Date();
          const instances = await db.select({
            workshopId: workshopInstances.workshopId,
            startDate: workshopInstances.startDate,
            endDate: workshopInstances.endDate,
            locationType: workshopInstances.locationType,
            venueName: workshopInstances.venueName,
            venueCity: workshopInstances.venueCity,
            venueState: workshopInstances.venueState,
            timezone: workshopInstances.timezone,
          }).from(workshopInstances)
            .where(and(
              inArray(workshopInstances.workshopId, rows.map(r => r.id)),
              eq(workshopInstances.status, "published"),
            ))
            .orderBy(workshopInstances.startDate);
          const instanceMap = new Map<number, any>();
          instances.forEach(inst => {
            if (!instanceMap.has(inst.workshopId) && inst.startDate && new Date(inst.startDate) >= now) {
              instanceMap.set(inst.workshopId, inst);
            }
          });
          rows.forEach(r => {
            const inst = instanceMap.get(r.id);
            allCards.set(`workshop:${r.id}`, toCard(r, "workshop", {
              nextInstanceDate: inst?.startDate ?? null,
              nextInstanceEndDate: inst?.endDate ?? null,
              locationType: inst?.locationType ?? null,
              venueName: inst?.venueName ?? null,
              venueCity: inst?.venueCity ?? null,
              venueState: inst?.venueState ?? null,
              timezone: inst?.timezone ?? null,
            }));
          });
        } else {
          rows.forEach(r => allCards.set(`workshop:${r.id}`, toCard(r, "workshop")));
        }
      }

      // Communities
      if (communityIds.length > 0) {
        const rows = await db.select({
          id: communities.id, slug: communities.slug, title: communities.title,
          coverImage: communities.coverImage, brand: communities.brand,
          accessType: communities.accessType,
        }).from(communities).where(and(inArray(communities.id, communityIds), eq(communities.status, "published")));
        rows.forEach(r => allCards.set(`community:${r.id}`, toCard(r, "community", { isFree: r.accessType === "free", price: 0 })));
      }

      // Preserve admin-specified order, apply maxCards limit
      const cards = items
        .map(i => allCards.get(`${i.type}:${i.id}`))
        .filter(Boolean)
        .slice(0, widget.maxCards);

      return {
        widget: {
          id: widget.id,
          name: widget.name,
          title: widget.title,
          subtitle: widget.subtitle,
          layout: widget.layout,
          theme: widget.theme,
          cardStyle: widget.cardStyle,
          showPrice: widget.showPrice,
          showEnrollButton: widget.showEnrollButton,
          showCourseDetails: widget.showCourseDetails,
          buttonText: widget.buttonText,
          buttonUrl: widget.buttonUrl,
        },
        cards,
      };
    }),
});
