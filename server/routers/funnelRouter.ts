/**
 * funnelRouter.ts — Standalone Funnel Builder (ClickFunnels-style)
 * Supports creating multi-step sales funnels independent of courses/downloads,
 * with optional product attachment and order bump integration.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { funnels, funnelPages, funnelLeads } from "../../drizzle/schema";
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
  /** List all funnels */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    const rows = await db
      .select()
      .from(funnels)
      .orderBy(desc(funnels.updatedAt));
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const { id, ...data } = input;
      await db.update(funnelPages).set(data).where(eq(funnelPages.id, id));
      return { success: true };
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
        .where(and(eq(funnels.slug, input.slug), eq(funnels.status, "active")));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });
      // Track view
      await db.execute(sql`UPDATE funnels SET total_views = total_views + 1 WHERE id = ${funnel.id}`);
      const pages = await db
        .select()
        .from(funnelPages)
        .where(and(eq(funnelPages.funnelId, funnel.id), eq(funnelPages.isActive, true)))
        .orderBy(asc(funnelPages.sortOrder));
      return { ...funnel, pages };
    }),

  /** Get a specific funnel page (public) */
  getPage: publicProcedure
    .input(z.object({ funnelSlug: z.string(), pageSlug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const [funnel] = await db
        .select()
        .from(funnels)
        .where(and(eq(funnels.slug, input.funnelSlug), eq(funnels.status, "active")));
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });
      const [page] = await db
        .select()
        .from(funnelPages)
        .where(
          and(
            eq(funnelPages.funnelId, funnel.id),
            eq(funnelPages.slug, input.pageSlug),
            eq(funnelPages.isActive, true)
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await db.insert(funnelLeads).values({
        funnelId: input.funnelId,
        funnelPageId: input.funnelPageId,
        email: input.email,
        name: input.name || null,
        phone: input.phone || null,
        customFields: input.customFields ? JSON.stringify(input.customFields) : null,
        userId: ctx.user?.id || null,
        source: "funnel",
      });
      // Track conversion
      await db.execute(sql`UPDATE funnel_pages SET conversions = conversions + 1 WHERE id = ${input.funnelPageId}`);
      return { success: true };
    }),
});
