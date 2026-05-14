/**
 * funnelRouter.ts — Standalone Funnel Builder (ClickFunnels-style)
 * Supports creating multi-step sales funnels independent of courses/downloads,
 * with optional product attachment and order bump integration.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { funnels, funnelPages, funnelLeads, funnelTemplates, lmsCourses, digitalProducts, digitalBundles } from "../../drizzle/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

// ─── Admin Router ────────────────────────────────────────────────────────────

export const funnelRouter = router({
  /** List all products (courses, downloads, bundles) for order bump picker */
  listAllProducts: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    const [courses, downloads, bundles] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, price: lmsCourses.price, thumbnailUrl: lmsCourses.thumbnailUrl }).from(lmsCourses).orderBy(asc(lmsCourses.title)),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, price: digitalProducts.price, thumbnailUrl: digitalProducts.thumbnailUrl }).from(digitalProducts).orderBy(asc(digitalProducts.title)),
      db.select({ id: digitalBundles.id, name: digitalBundles.name, price: digitalBundles.price, thumbnailUrl: digitalBundles.thumbnailUrl }).from(digitalBundles).orderBy(asc(digitalBundles.name)),
    ]);
    return [
      ...courses.map(c => ({ id: c.id, type: "course" as const, name: c.title, price: c.price ?? 0, imageUrl: c.thumbnailUrl ?? "" })),
      ...downloads.map(d => ({ id: d.id, type: "download" as const, name: d.title, price: d.price ?? 0, imageUrl: d.thumbnailUrl ?? "" })),
      ...bundles.map(b => ({ id: b.id, type: "bundle" as const, name: b.name, price: b.price ?? 0, imageUrl: b.thumbnailUrl ?? "" })),
    ];
  }),

  /** List all funnels */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    const rows = await db
      .select()
      .from(funnels)
      .orderBy(asc(funnels.sortOrder), desc(funnels.updatedAt));
    // Get page counts for each funnel
    const result = [];
    for (const funnel of rows) {
      const pages = await db
        .select()
        .from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      result.push({ ...funnel, pages });
    }
    return result;
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
      // Auto-generate slug from title if not provided
      const pageSlug = input.slug || slugify(input.title);
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
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
      const pageSlug = original.slug + "-copy-" + Date.now().toString(36).slice(-4);
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
            unit_amount: page.customPrice,
          },
          quantity: 1,
        });
      }

      if (lineItems.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No product configured for this page" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      // Find thank you page for success redirect
      const allPages = await db.select().from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      const thankYouPage = allPages.find(p => p.pageType === "thank_you");
      const successUrl = thankYouPage
        ? `${input.origin}/f/${funnel.slug}/${thankYouPage.slug}?success=1`
        : `${input.origin}/f/${funnel.slug}/${page.slug}?success=1`;
      const cancelUrl = `${input.origin}/f/${funnel.slug}/${page.slug}`;

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
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      // Track conversion
      await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${page.id}`);
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
});

// ─── Public Router (for rendering funnel pages) ─────────────────────────────

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
      // Get next page info if connected
      let nextPage = null;
      if (page.nextPageId) {
        const [np] = await db
          .select({ slug: funnelPages.slug, title: funnelPages.title, pageType: funnelPages.pageType })
          .from(funnelPages)
          .where(eq(funnelPages.id, page.nextPageId));
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
            unit_amount: selectedProduct.price,
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
              unit_amount: bump.price,
            },
            quantity: 1,
          });
        }
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      // Find thank you page for success redirect
      const allPages = await db.select().from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      const thankYouPage = allPages.find(p => p.pageType === "thank_you");
      const successRedirect = checkoutBlock.data?.successRedirect;
      const successUrl = successRedirect
        ? (successRedirect.startsWith("http") ? successRedirect : `${input.origin}${successRedirect}`)
        : thankYouPage
          ? `${input.origin}/f/${funnel.slug}/${thankYouPage.slug}?success=1`
          : `${input.origin}/f/${funnel.slug}/${page.slug}?success=1`;
      const cancelUrl = `${input.origin}/f/${funnel.slug}/${page.slug}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.email,
        allow_promotion_codes: true,
        line_items: lineItems,
        metadata: {
          type: "funnel_form_purchase",
          funnel_id: funnel.id.toString(),
          funnel_page_id: page.id.toString(),
          customer_email: input.email,
          customer_name: `${input.firstName || ""} ${input.lastName || ""}`.trim(),
          customer_phone: input.phone || "",
          bumps_added: input.addedBumpIndexes.join(","),
          user_id: ctx.user?.id?.toString() || "",
        },
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
        sourcePage: input.origin ? `${input.origin}/f/${funnel.slug}/${page.slug}` : null,
      });

      // Track conversion
      await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${page.id}`);
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

      // Calculate total amount
      let totalAmount = selectedProduct.price; // cents
      const bumpDetails: string[] = [];
      for (const bumpIdx of input.addedBumpIndexes) {
        const bump = orderBumps[bumpIdx];
        if (bump && bump.price > 0) {
          totalAmount += bump.price;
          bumpDetails.push(bump.title);
        }
      }

      if (totalAmount < 50) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Minimum charge amount is $0.50" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

      // Build description for the payment
      let description = selectedProduct.name;
      if (bumpDetails.length > 0) {
        description += " + " + bumpDetails.join(", ");
      }

      // Find thank you page for success redirect
      const allPages = await db.select().from(funnelPages)
        .where(eq(funnelPages.funnelId, funnel.id))
        .orderBy(asc(funnelPages.sortOrder));
      const thankYouPage = allPages.find(p => p.pageType === "thank_you");
      const successRedirect = checkoutBlock.data?.successRedirect;
      const successUrl = successRedirect
        ? (successRedirect.startsWith("http") ? successRedirect : `${input.origin}${successRedirect}`)
        : thankYouPage
          ? `${input.origin}/f/${funnel.slug}/${thankYouPage.slug}?success=1`
          : `${input.origin}/f/${funnel.slug}/${page.slug}?success=1`;

      // Create PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
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
          bumps_added: input.addedBumpIndexes.join(","),
          user_id: ctx.user?.id?.toString() || "",
          success_url: successUrl,
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
        sourcePage: input.origin ? `${input.origin}/f/${funnel.slug}/${page.slug}` : null,
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
      });
      // Track conversion
      await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${input.funnelPageId}`);
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
