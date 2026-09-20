/**
 * marketingSiteRouter — dual-brand public website and blog CMS.
 *
 * Both public sites are maintained from Platform Admin tools but are served from
 * independent public-domain tenants. The .net tenant host is a noindex review
 * environment; the same rows promote to the matching .com host without changing
 * paths or requiring a second content copy.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { marketingSitePages, marketingSiteSettings } from "../../drizzle/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";
import {
  PUBLIC_SITE_TENANTS,
  PUBLIC_SITE_TENANT_KEYS,
  getPublicSiteTenant,
  publicSiteOrigin,
  type PublicSiteTenantKey,
} from "@shared/publicSiteTenants";
import {
  bulkImportPublicSite,
  ensurePublicSiteSettings,
  importPublicSitePage,
  type PublicSiteImportScope,
} from "../lib/marketingSiteImport";

const tenantKeySchema = z.enum(PUBLIC_SITE_TENANT_KEYS);
const pageTypeSchema = z.enum(["all", "page", "blog"]);
const pageStatusSchema = z.enum(["draft", "published"]);

function requirePlatformAdmin(ctx: { user?: { role?: string; roles?: string[] } }) {
  const role = ctx.user?.role ?? "";
  const roles = ctx.user?.roles ?? [];
  if (role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform Admin access required" });
  }
}

function normalizePath(raw: string): string {
  let path = raw.trim().split("?")[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/index.html" || path === "/home.html") path = "/";
  return path;
}

function requireSourceUrl(inputUrl: string, tenantKey: PublicSiteTenantKey) {
  const tenant = getPublicSiteTenant(tenantKey);
  if (!tenant) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown public-site tenant" });
  const url = new URL(inputUrl);
  const expected = new URL(tenant.sourceOrigin).hostname.replace(/^www\./, "");
  if (url.hostname.replace(/^www\./, "") !== expected) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Imports for ${tenant.siteName} must use ${tenant.sourceOrigin}` });
  }
}

function pageTypeCondition(input: z.infer<typeof pageTypeSchema>) {
  if (input === "page") return eq(marketingSitePages.pageType, "page");
  if (input === "blog") return eq(marketingSitePages.pageType, "blog_post");
  return undefined;
}

const publicPageShape = {
  id: marketingSitePages.id,
  path: marketingSitePages.path,
  title: marketingSitePages.title,
  pageType: marketingSitePages.pageType,
  blocks: marketingSitePages.blocks,
  seoTitle: marketingSitePages.seoTitle,
  seoDescription: marketingSitePages.seoDescription,
  seoImage: marketingSitePages.seoImage,
  blogExcerpt: marketingSitePages.blogExcerpt,
  blogAuthor: marketingSitePages.blogAuthor,
  blogCategory: marketingSitePages.blogCategory,
  blogPublishedAt: marketingSitePages.blogPublishedAt,
  redirectUrl: marketingSitePages.redirectUrl,
  isPublished: marketingSitePages.isPublished,
};

export const marketingSitePublicRouter = router({
  getSettings: publicProcedure
    .input(z.object({ tenantKey: tenantKeySchema }))
    .query(async ({ input }) => {
      const tenant = getPublicSiteTenant(input.tenantKey)!;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // The public root remains usable while an administrator is waiting for
      // the additive CMS migration or the controlled source import. A missing
      // settings row/table must never make a brand domain fall back to the app.
      let settings: typeof marketingSiteSettings.$inferSelect | undefined;
      try {
        [settings] = await db.select().from(marketingSiteSettings)
          .where(eq(marketingSiteSettings.siteKey, tenant.key)).limit(1);
      } catch {
        settings = undefined;
      }
      let nav: unknown[] = [];
      let footer: unknown = null;
      try { nav = settings?.navJson ? JSON.parse(settings.navJson) : []; } catch { nav = []; }
      try { footer = settings?.footerJson ? JSON.parse(settings.footerJson) : null; } catch { footer = null; }
      return {
        tenant: {
          key: tenant.key,
          brand: tenant.brand,
          siteName: settings?.siteName ?? tenant.siteName,
          currentHost: tenant.currentHost,
          promotionHost: tenant.promotionHost,
          promotionOrigin: publicSiteOrigin(tenant, "promotion"),
          blogIndexPath: tenant.blogIndexPath,
        },
        isStaging: settings?.isStaging ?? true,
        stagingBannerText: settings?.stagingBannerText ?? `Preview on ${tenant.currentHost}`,
        faviconUrl: settings?.faviconUrl ?? null,
        globalCss: settings?.globalCss ?? null,
        nav,
        footer,
      };
    }),

  getPageByPath: publicProcedure
    .input(z.object({ tenantKey: tenantKeySchema, path: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const path = normalizePath(input.path);
      let page: typeof marketingSitePages.$inferSelect | undefined;
      try {
        [page] = await db.select(publicPageShape).from(marketingSitePages)
          .where(and(
            eq(marketingSitePages.siteKey, input.tenantKey),
            eq(marketingSitePages.path, path),
            eq(marketingSitePages.isPublished, true),
          ))
          .limit(1);
      } catch {
        // The client renders the branded root fallback for / and retains a
        // real 404 for unknown non-root paths until CMS content exists.
        page = undefined;
      }
      if (!page) return null;
      if (page.pageType === "redirect" && page.redirectUrl) return { redirectUrl: page.redirectUrl, page: null };
      let blocks: unknown[] = [];
      try { blocks = page.blocks ? JSON.parse(page.blocks) : []; } catch { blocks = []; }
      return { redirectUrl: null, page: { ...page, blocks } };
    }),

  listBlogPosts: publicProcedure
    .input(z.object({ tenantKey: tenantKeySchema, limit: z.number().min(1).max(100).default(24), offset: z.number().min(0).default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { posts: [], total: 0 };
      const conditions = [
        eq(marketingSitePages.siteKey, input.tenantKey),
        eq(marketingSitePages.pageType, "blog_post"),
        eq(marketingSitePages.isPublished, true),
      ];
      const posts = await db.select({
        id: marketingSitePages.id,
        path: marketingSitePages.path,
        title: marketingSitePages.title,
        excerpt: marketingSitePages.blogExcerpt,
        author: marketingSitePages.blogAuthor,
        category: marketingSitePages.blogCategory,
        publishedAt: marketingSitePages.blogPublishedAt,
        image: marketingSitePages.seoImage,
      }).from(marketingSitePages).where(and(...conditions))
        .orderBy(desc(marketingSitePages.blogPublishedAt), desc(marketingSitePages.updatedAt))
        .limit(input.limit).offset(input.offset);
      const [count] = await db.select({ count: sql<number>`count(*)` }).from(marketingSitePages).where(and(...conditions));
      return { posts, total: Number(count?.count ?? 0) };
    }),
});

export const marketingSiteAdminRouter = router({
  listTenants: protectedProcedure.query(({ ctx }) => {
    requirePlatformAdmin(ctx);
    return PUBLIC_SITE_TENANTS.map((tenant) => ({
      key: tenant.key,
      brand: tenant.brand,
      siteName: tenant.siteName,
      currentHost: tenant.currentHost,
      promotionHost: tenant.promotionHost,
      sourceOrigin: tenant.sourceOrigin,
      blogIndexPath: tenant.blogIndexPath,
    }));
  }),

  getImportStatus: protectedProcedure
    .input(z.object({ tenantKey: tenantKeySchema }))
    .query(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenant = getPublicSiteTenant(input.tenantKey)!;
      const settings = await ensurePublicSiteSettings(db, tenant.key);
      const counts = await db.execute(sql`
        SELECT pageType, importStatus, COUNT(*) as cnt FROM marketingSitePages
        WHERE siteKey = ${tenant.key} GROUP BY pageType, importStatus
      `);
      const byStatus: Record<string, number> = {};
      for (const row of (counts[0] as unknown as any[]) ?? []) {
        byStatus[`${row.pageType}:${row.importStatus}`] = Number(row.cnt);
      }
      const [totalRow] = await db.select({ count: sql<number>`count(*)` }).from(marketingSitePages)
        .where(eq(marketingSitePages.siteKey, tenant.key));
      return {
        tenant,
        settings,
        totalPages: Number(totalRow?.count ?? 0),
        byStatus,
        currentUrl: publicSiteOrigin(tenant),
        promotionUrl: publicSiteOrigin(tenant, "promotion"),
      };
    }),

  listPages: protectedProcedure
    .input(z.object({
      tenantKey: tenantKeySchema,
      type: pageTypeSchema.default("all"),
      search: z.string().max(250).optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [eq(marketingSitePages.siteKey, input.tenantKey)];
      const type = pageTypeCondition(input.type);
      if (type) conditions.push(type);
      if (input.search) conditions.push(like(marketingSitePages.path, `%${input.search}%`));
      return db.select({
        id: marketingSitePages.id,
        path: marketingSitePages.path,
        title: marketingSitePages.title,
        pageType: marketingSitePages.pageType,
        isPublished: marketingSitePages.isPublished,
        importStatus: marketingSitePages.importStatus,
        sourceUrl: marketingSitePages.sourceUrl,
        blogPublishedAt: marketingSitePages.blogPublishedAt,
        updatedAt: marketingSitePages.updatedAt,
      }).from(marketingSitePages).where(and(...conditions))
        .orderBy(desc(marketingSitePages.blogPublishedAt), marketingSitePages.path).limit(input.limit);
    }),

  getPage: protectedProcedure
    .input(z.object({ id: z.number(), tenantKey: tenantKeySchema }))
    .query(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db.select().from(marketingSitePages)
        .where(and(eq(marketingSitePages.id, input.id), eq(marketingSitePages.siteKey, input.tenantKey))).limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  createPage: protectedProcedure
    .input(z.object({
      tenantKey: tenantKeySchema,
      title: z.string().trim().min(1).max(500),
      path: z.string().trim().min(1).max(500),
      pageType: z.enum(["page", "blog_post"]).default("page"),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const path = normalizePath(input.path);
      const [existing] = await db.select({ id: marketingSitePages.id }).from(marketingSitePages)
        .where(and(eq(marketingSitePages.siteKey, input.tenantKey), eq(marketingSitePages.path, path))).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A public page already uses this path." });
      const [result] = await db.insert(marketingSitePages).values({
        siteKey: input.tenantKey,
        path,
        title: input.title,
        pageType: input.pageType,
        blocks: "[]",
        seoTitle: input.title,
        isPublished: false,
        importStatus: "pending",
        blogPublishedAt: input.pageType === "blog_post" ? new Date() : null,
      });
      return { id: Number((result as { insertId: number }).insertId), path };
    }),

  savePage: protectedProcedure
    .input(z.object({
      id: z.number(),
      tenantKey: tenantKeySchema,
      path: z.string().trim().min(1).max(500).optional(),
      title: z.string().trim().min(1).max(500).optional(),
      pageType: z.enum(["page", "blog_post", "redirect"]).optional(),
      blocks: z.string().optional(),
      seoTitle: z.string().max(255).nullable().optional(),
      seoDescription: z.string().nullable().optional(),
      seoImage: z.string().max(512).nullable().optional(),
      blogExcerpt: z.string().nullable().optional(),
      blogAuthor: z.string().max(255).nullable().optional(),
      blogCategory: z.string().max(160).nullable().optional(),
      blogPublishedAt: z.date().nullable().optional(),
      redirectUrl: z.string().max(1000).nullable().optional(),
      isPublished: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: marketingSitePages.id }).from(marketingSitePages)
        .where(and(eq(marketingSitePages.id, input.id), eq(marketingSitePages.siteKey, input.tenantKey))).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.blocks !== undefined) {
        try { JSON.parse(input.blocks); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Page blocks must be valid JSON." }); }
      }
      const { id, tenantKey, path, ...rest } = input;
      const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (path !== undefined) updates.path = normalizePath(path);
      await db.update(marketingSitePages).set(updates).where(eq(marketingSitePages.id, id));
      return { ok: true };
    }),

  deletePage: protectedProcedure
    .input(z.object({ id: z.number(), tenantKey: tenantKeySchema }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(marketingSitePages)
        .where(and(eq(marketingSitePages.id, input.id), eq(marketingSitePages.siteKey, input.tenantKey)));
      return { ok: true };
    }),

  saveNavigation: protectedProcedure
    .input(z.object({ tenantKey: tenantKeySchema, navJson: z.string().max(30000) }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.navJson); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Navigation must be valid JSON." }); }
      await ensurePublicSiteSettings(db, input.tenantKey);
      await db.update(marketingSiteSettings).set({ navJson: input.navJson, updatedAt: new Date() })
        .where(eq(marketingSiteSettings.siteKey, input.tenantKey));
      return { ok: true };
    }),

  importUrl: protectedProcedure
    .input(z.object({ tenantKey: tenantKeySchema, url: z.string().url(), reimportExisting: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      requireSourceUrl(input.url, input.tenantKey);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return importPublicSitePage(db, input.tenantKey, input.url, { skipExisting: !input.reimportExisting });
    }),

  runBulkImport: protectedProcedure
    .input(z.object({
      tenantKey: tenantKeySchema,
      scope: z.enum(["all", "pages", "blog"]).default("all"),
      limit: z.number().min(1).max(500).optional(),
      reimportExisting: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return bulkImportPublicSite(db, {
        tenantKey: input.tenantKey,
        scope: input.scope as PublicSiteImportScope,
        limit: input.limit,
        reimportExisting: input.reimportExisting,
      });
    }),
});

export const marketingSiteRouter = router({
  public: marketingSitePublicRouter,
  admin: marketingSiteAdminRouter,
});
