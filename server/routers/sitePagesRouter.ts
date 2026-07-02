/**
 * sitePagesRouter — Multi-domain site page CMS (Weebly-style admin).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { siteNavMenus, sitePages } from "../../drizzle/schema";
import {
  SITE_NAV_MENU_KEYS,
  SITE_PAGE_DOMAINS,
  type SiteNavItem,
} from "../../shared/sitePagesConstants";
import {
  buildSitePageTree,
  ensureDefaultSitePages,
  newNavItemId,
  validateSiteSlug,
} from "../lib/sitePageTree";

function requireAdmin(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

const domainSchema = z.string().min(3).max(255);

const navItemSchema: z.ZodType<SiteNavItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string().min(1).max(200),
    href: z.string().max(512).optional(),
    sitePageId: z.number().optional(),
    openInNewTab: z.boolean().optional(),
    hidden: z.boolean().optional(),
    children: z.array(navItemSchema).optional(),
  }),
);

export const sitePagesAdminRouter = router({
  listDomains: protectedProcedure.query(() => SITE_PAGE_DOMAINS),

  listPageTree: protectedProcedure
    .input(z.object({ domain: domainSchema }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      return buildSitePageTree(input.domain, ctx.user.id);
    }),

  getPage: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(sitePages).where(eq(sitePages.id, input.pageId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createPage: protectedProcedure
    .input(
      z.object({
        domain: domainSchema,
        title: z.string().min(1).max(300),
        slug: z.string().min(1).max(200),
        pageKind: z
          .enum(["standard", "home", "legal_privacy", "legal_terms", "error_404", "login", "sales", "system"])
          .default("standard"),
        parentPageId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const slugErr = validateSiteSlug(input.slug);
      if (slugErr) throw new TRPCError({ code: "BAD_REQUEST", message: slugErr });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(sitePages).values({
        domain: input.domain,
        slug: input.slug.toLowerCase(),
        title: input.title,
        pageKind: input.pageKind,
        status: "draft",
        blocks: "[]",
        parentPageId: input.parentPageId ?? null,
        createdByUserId: ctx.user.id,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  updatePageMeta: protectedProcedure
    .input(
      z.object({
        pageId: z.number(),
        title: z.string().min(1).max(300).optional(),
        slug: z.string().min(1).max(200).optional(),
        status: z.enum(["draft", "published"]).optional(),
        showInHeaderNav: z.boolean().optional(),
        showInSidebarNav: z.boolean().optional(),
        showInProfileNav: z.boolean().optional(),
        isHiddenFromNav: z.boolean().optional(),
        isHomePage: z.boolean().optional(),
        navSortOrder: z.number().int().optional(),
        parentPageId: z.number().nullable().optional(),
        externalUrl: z.string().max(512).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.slug !== undefined) {
        const slugErr = validateSiteSlug(input.slug);
        if (slugErr) throw new TRPCError({ code: "BAD_REQUEST", message: slugErr });
        updates.slug = input.slug.toLowerCase();
      }
      if (input.status !== undefined) updates.status = input.status;
      if (input.showInHeaderNav !== undefined) updates.showInHeaderNav = input.showInHeaderNav;
      if (input.showInSidebarNav !== undefined) updates.showInSidebarNav = input.showInSidebarNav;
      if (input.showInProfileNav !== undefined) updates.showInProfileNav = input.showInProfileNav;
      if (input.isHiddenFromNav !== undefined) updates.isHiddenFromNav = input.isHiddenFromNav;
      if (input.isHomePage !== undefined) updates.isHomePage = input.isHomePage;
      if (input.navSortOrder !== undefined) updates.navSortOrder = input.navSortOrder;
      if (input.parentPageId !== undefined) updates.parentPageId = input.parentPageId;
      if (input.externalUrl !== undefined) updates.externalUrl = input.externalUrl;

      if (input.isHomePage) {
        const [page] = await db.select().from(sitePages).where(eq(sitePages.id, input.pageId)).limit(1);
        if (page) {
          await db.update(sitePages).set({ isHomePage: false }).where(eq(sitePages.domain, page.domain));
        }
      }

      await db.update(sitePages).set(updates).where(eq(sitePages.id, input.pageId));
      return { ok: true };
    }),

  saveBlocks: protectedProcedure
    .input(z.object({ pageId: z.number(), blocks: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      JSON.parse(input.blocks);
      await db.update(sitePages).set({ blocks: input.blocks }).where(eq(sitePages.id, input.pageId));
      return { ok: true };
    }),

  saveSeo: protectedProcedure
    .input(
      z.object({
        pageId: z.number(),
        seoTitle: z.string().max(255).optional(),
        seoDescription: z.string().optional(),
        seoImage: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(sitePages)
        .set({
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          seoImage: input.seoImage ?? null,
        })
        .where(eq(sitePages.id, input.pageId));
      return { ok: true };
    }),

  deletePage: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db.select().from(sitePages).where(eq(sitePages.id, input.pageId)).limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      if (["legal_privacy", "legal_terms", "error_404", "login"].includes(page.pageKind)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "System pages cannot be deleted" });
      }
      await db.delete(sitePages).where(eq(sitePages.id, input.pageId));
      return { ok: true };
    }),

  reorderPages: protectedProcedure
    .input(
      z.object({
        domain: domainSchema,
        orderedPageIds: z.array(z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (let i = 0; i < input.orderedPageIds.length; i++) {
        await db
          .update(sitePages)
          .set({ navSortOrder: i })
          .where(and(eq(sitePages.id, input.orderedPageIds[i]!), eq(sitePages.domain, input.domain)));
      }
      return { ok: true };
    }),

  getNavMenu: protectedProcedure
    .input(z.object({ domain: domainSchema, menuKey: z.enum(SITE_NAV_MENU_KEYS) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(siteNavMenus)
        .where(and(eq(siteNavMenus.domain, input.domain), eq(siteNavMenus.menuKey, input.menuKey)))
        .limit(1);
      if (!row) return { items: [] as SiteNavItem[] };
      try {
        return { items: JSON.parse(row.itemsJson) as SiteNavItem[] };
      } catch {
        return { items: [] as SiteNavItem[] };
      }
    }),

  saveNavMenu: protectedProcedure
    .input(
      z.object({
        domain: domainSchema,
        menuKey: z.enum(SITE_NAV_MENU_KEYS),
        items: z.array(navItemSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const json = JSON.stringify(input.items);
      const [existing] = await db
        .select({ id: siteNavMenus.id })
        .from(siteNavMenus)
        .where(and(eq(siteNavMenus.domain, input.domain), eq(siteNavMenus.menuKey, input.menuKey)))
        .limit(1);
      if (existing) {
        await db
          .update(siteNavMenus)
          .set({ itemsJson: json, updatedByUserId: ctx.user.id })
          .where(eq(siteNavMenus.id, existing.id));
      } else {
        await db.insert(siteNavMenus).values({
          domain: input.domain,
          menuKey: input.menuKey,
          itemsJson: json,
          updatedByUserId: ctx.user.id,
        });
      }
      return { ok: true };
    }),

  listPagesForNavPicker: protectedProcedure
    .input(z.object({ domain: domainSchema }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      await ensureDefaultSitePages(input.domain, ctx.user.id);
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: sitePages.id,
          title: sitePages.title,
          slug: sitePages.slug,
          status: sitePages.status,
        })
        .from(sitePages)
        .where(and(eq(sitePages.domain, input.domain), eq(sitePages.status, "published")))
        .orderBy(asc(sitePages.navSortOrder), asc(sitePages.title));
    }),

  newNavItemId: protectedProcedure.query(() => newNavItemId()),

  // ── Editable Zones (default pages) ──────────────────────────────────────────

  getPageZones: protectedProcedure
    .input(z.object({ domain: domainSchema, slug: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select({ id: sitePages.id, editableZones: sitePages.editableZones })
        .from(sitePages)
        .where(and(eq(sitePages.domain, input.domain), eq(sitePages.slug, input.slug.toLowerCase())))
        .limit(1);
      if (!row) return null;
      try {
        return { id: row.id, zones: row.editableZones ? JSON.parse(row.editableZones) : {} };
      } catch {
        return { id: row.id, zones: {} };
      }
    }),

  savePageZones: protectedProcedure
    .input(
      z.object({
        domain: domainSchema,
        slug: z.string().min(1).max(200),
        zones: z.record(z.string(), z.string().max(2000)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const json = JSON.stringify(input.zones);
      const [existing] = await db
        .select({ id: sitePages.id })
        .from(sitePages)
        .where(and(eq(sitePages.domain, input.domain), eq(sitePages.slug, input.slug.toLowerCase())))
        .limit(1);
      if (existing) {
        await db
          .update(sitePages)
          .set({ editableZones: json })
          .where(eq(sitePages.id, existing.id));
        return { ok: true };
      }
      // Auto-create the page record if it doesn't exist yet
      await db.insert(sitePages).values({
        domain: input.domain,
        slug: input.slug.toLowerCase(),
        title: input.slug.replace(/^\//,'').replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Home',
        pageKind: 'standard',
        status: 'published',
        blocks: '[]',
        editableZones: json,
        createdByUserId: ctx.user.id,
      });
      return { ok: true };
    }),

  // Public: get editable zones for a default page (for frontend rendering)
  getPublicPageZones: publicProcedure
    .input(z.object({ domain: domainSchema, slug: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};
      const [row] = await db
        .select({ editableZones: sitePages.editableZones })
        .from(sitePages)
        .where(and(eq(sitePages.domain, input.domain), eq(sitePages.slug, input.slug.toLowerCase())))
        .limit(1);
      if (!row?.editableZones) return {};
      try { return JSON.parse(row.editableZones) as Record<string, string>; } catch { return {}; }
    }),
});

export const sitePagesPublicRouter = router({
  getBySlug: publicProcedure
    .input(z.object({ domain: domainSchema, slug: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(sitePages)
        .where(
          and(
            eq(sitePages.domain, input.domain),
            eq(sitePages.slug, input.slug.toLowerCase()),
            eq(sitePages.status, "published"),
          ),
        )
        .limit(1);
      return row ?? null;
    }),

  getNavMenu: publicProcedure
    .input(z.object({ domain: domainSchema, menuKey: z.enum(SITE_NAV_MENU_KEYS) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [] as SiteNavItem[] };
      const [row] = await db
        .select()
        .from(siteNavMenus)
        .where(and(eq(siteNavMenus.domain, input.domain), eq(siteNavMenus.menuKey, input.menuKey)))
        .limit(1);
      if (!row) {
        const flagColumn =
          input.menuKey === "header"
            ? sitePages.showInHeaderNav
            : input.menuKey === "sidebar"
              ? sitePages.showInSidebarNav
              : input.menuKey === "profile"
                ? sitePages.showInProfileNav
                : null;
        if (!flagColumn) return { items: [] as SiteNavItem[] };
        const autoPages = await db
          .select({
            id: sitePages.id,
            title: sitePages.title,
            slug: sitePages.slug,
          })
          .from(sitePages)
          .where(
            and(
              eq(sitePages.domain, input.domain),
              eq(sitePages.status, "published"),
              eq(flagColumn, true),
              eq(sitePages.isHiddenFromNav, false),
            ),
          )
          .orderBy(asc(sitePages.navSortOrder));
        return {
          items: autoPages.map((p) => ({
            id: `page-${p.id}`,
            label: p.title,
            href: `/${p.slug}`,
            sitePageId: p.id,
          })),
        };
      }
      try {
        const items = JSON.parse(row.itemsJson) as SiteNavItem[];
        return { items: items.filter((i) => !i.hidden) };
      } catch {
        return { items: [] as SiteNavItem[] };
      }
    }),
});

export const sitePagesRouter = router({
  admin: sitePagesAdminRouter,
  public: sitePagesPublicRouter,
});
