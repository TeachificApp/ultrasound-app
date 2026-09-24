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
import { eq, and, asc, desc, like, sql } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
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
import {
  createPublicPageAccessCookie,
  hasPublicPageAccess,
  publicPageAccessCookieHeader,
} from "../lib/marketingSitePageAccess";

const tenantKeySchema = z.enum(PUBLIC_SITE_TENANT_KEYS);
const pageTypeSchema = z.enum(["all", "page", "blog"]);
const pageStatusSchema = z.enum(["draft", "published"]);
const visibilitySchema = z.enum(["public", "site_password", "members_or_groups"]);
const headerTypeSchema = z.enum(["standard", "splash", "no_header"]);

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

async function assertTenantParent(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tenantKey: PublicSiteTenantKey,
  parentId: number | null | undefined,
  pageId?: number,
) {
  if (parentId === undefined || parentId === null) return null;
  if (parentId === pageId) throw new TRPCError({ code: "BAD_REQUEST", message: "A page cannot be its own parent." });
  const [parent] = await db.select({ id: marketingSitePages.id, pageType: marketingSitePages.pageType })
    .from(marketingSitePages)
    .where(and(eq(marketingSitePages.id, parentId), eq(marketingSitePages.siteKey, tenantKey)))
    .limit(1);
  if (!parent) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a folder/page from this public site." });
  if (parent.pageType !== "page") throw new TRPCError({ code: "BAD_REQUEST", message: "Only website pages can be used as a parent folder." });
  return parent.id;
}

function assertNoPageTreeCycles(rows: Array<{ id: number; parentId: number | null }>) {
  const parentById = new Map(rows.map((row) => [row.id, row.parentId]));
  for (const row of rows) {
    const visited = new Set<number>();
    let current: number | null | undefined = row.id;
    while (current !== null && current !== undefined) {
      if (visited.has(current)) throw new TRPCError({ code: "BAD_REQUEST", message: "Page nesting cannot contain a cycle." });
      visited.add(current);
      current = parentById.get(current);
    }
  }
}

const publicPageShape = {
  id: marketingSitePages.id,
  parentId: marketingSitePages.parentId,
  path: marketingSitePages.path,
  title: marketingSitePages.title,
  pageType: marketingSitePages.pageType,
  blocks: marketingSitePages.blocks,
  hideInNavigation: marketingSitePages.hideInNavigation,
  visibility: marketingSitePages.visibility,
  headerType: marketingSitePages.headerType,
  seoTitle: marketingSitePages.seoTitle,
  seoDescription: marketingSitePages.seoDescription,
  seoKeywords: marketingSitePages.seoKeywords,
  seoImage: marketingSitePages.seoImage,
  hideFromSearch: marketingSitePages.hideFromSearch,
  blogExcerpt: marketingSitePages.blogExcerpt,
  blogAuthor: marketingSitePages.blogAuthor,
  blogCategory: marketingSitePages.blogCategory,
  blogPublishedAt: marketingSitePages.blogPublishedAt,
  blogSidebarMode: marketingSitePages.blogSidebarMode,
  blogSidebarBlocks: marketingSitePages.blogSidebarBlocks,
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
      let blogSidebarBlocks: unknown[] = [];
      try { nav = settings?.navJson ? JSON.parse(settings.navJson) : []; } catch { nav = []; }
      try { footer = settings?.footerJson ? JSON.parse(settings.footerJson) : null; } catch { footer = null; }
      try { blogSidebarBlocks = settings?.blogSidebarBlocks ? JSON.parse(settings.blogSidebarBlocks) : []; } catch { blogSidebarBlocks = []; }
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
        blogSidebarBlocks,
      };
    }),

  listNavigation: publicProcedure
    .input(z.object({ tenantKey: tenantKeySchema }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: marketingSitePages.id,
        parentId: marketingSitePages.parentId,
        path: marketingSitePages.path,
        title: marketingSitePages.title,
        pageType: marketingSitePages.pageType,
        visibility: marketingSitePages.visibility,
        headerType: marketingSitePages.headerType,
        sortOrder: marketingSitePages.sortOrder,
      }).from(marketingSitePages).where(and(
        eq(marketingSitePages.siteKey, input.tenantKey),
        eq(marketingSitePages.pageType, "page"),
        eq(marketingSitePages.isPublished, true),
        eq(marketingSitePages.hideInNavigation, false),
      )).orderBy(asc(marketingSitePages.sortOrder), asc(marketingSitePages.path));
    }),

  getPageByPath: publicProcedure
    .input(z.object({ tenantKey: tenantKeySchema, path: z.string().min(1).max(500) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const path = normalizePath(input.path);
      let page: typeof marketingSitePages.$inferSelect | undefined;
      try {
        [page] = await db.select().from(marketingSitePages)
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
      const accessMode = page.visibility ?? "public";
      const hasPasswordAccess = accessMode === "site_password"
        && hasPublicPageAccess(ctx.req.headers.cookie, page.id, input.tenantKey);
      const hasMemberAccess = accessMode === "members_or_groups" && Boolean(ctx.user);
      if (accessMode === "site_password" && !hasPasswordAccess) {
        return {
          redirectUrl: null,
          accessRequired: "site_password" as const,
          page: { id: page.id, path: page.path, title: page.title, visibility: accessMode, headerType: page.headerType },
        };
      }
      if (accessMode === "members_or_groups" && !hasMemberAccess) {
        return {
          redirectUrl: null,
          accessRequired: "members_or_groups" as const,
          page: { id: page.id, path: page.path, title: page.title, visibility: accessMode, headerType: page.headerType },
        };
      }
      if (page.pageType === "redirect" && page.redirectUrl) return { redirectUrl: page.redirectUrl, page: null };
      let blocks: unknown[] = [];
      try { blocks = page.blocks ? JSON.parse(page.blocks) : []; } catch { blocks = []; }
      return {
        redirectUrl: null,
        accessRequired: null,
        page: {
          id: page.id,
          parentId: page.parentId,
          path: page.path,
          title: page.title,
          pageType: page.pageType,
          blocks,
          hideInNavigation: page.hideInNavigation,
          visibility: page.visibility,
          headerType: page.headerType,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          seoKeywords: page.seoKeywords,
          seoImage: page.seoImage,
          hideFromSearch: page.hideFromSearch,
          blogExcerpt: page.blogExcerpt,
          blogAuthor: page.blogAuthor,
          blogCategory: page.blogCategory,
          blogPublishedAt: page.blogPublishedAt,
          blogSidebarMode: page.blogSidebarMode,
          blogSidebarBlocks: page.blogSidebarBlocks,
          redirectUrl: page.redirectUrl,
          isPublished: page.isPublished,
        },
      };
    }),

  verifyPagePassword: publicProcedure
    .input(z.object({ tenantKey: tenantKeySchema, path: z.string().min(1).max(500), password: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db.select({
        id: marketingSitePages.id,
        visibility: marketingSitePages.visibility,
        sitePasswordHash: marketingSitePages.sitePasswordHash,
      }).from(marketingSitePages).where(and(
        eq(marketingSitePages.siteKey, input.tenantKey),
        eq(marketingSitePages.path, normalizePath(input.path)),
        eq(marketingSitePages.isPublished, true),
      )).limit(1);
      if (!page || page.visibility !== "site_password" || !page.sitePasswordHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This protected page is unavailable." });
      }
      const isValid = await bcrypt.compare(input.password, page.sitePasswordHash);
      if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "The password is not correct." });
      const token = createPublicPageAccessCookie(page.id, input.tenantKey);
      ctx.res.setHeader("Set-Cookie", publicPageAccessCookieHeader(token));
      return { ok: true };
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
        eq(marketingSitePages.visibility, "public"),
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
        parentId: marketingSitePages.parentId,
        path: marketingSitePages.path,
        title: marketingSitePages.title,
        pageType: marketingSitePages.pageType,
        isPublished: marketingSitePages.isPublished,
        hideInNavigation: marketingSitePages.hideInNavigation,
        visibility: marketingSitePages.visibility,
        headerType: marketingSitePages.headerType,
        hideFromSearch: marketingSitePages.hideFromSearch,
        sortOrder: marketingSitePages.sortOrder,
        importStatus: marketingSitePages.importStatus,
        sourceUrl: marketingSitePages.sourceUrl,
        blogPublishedAt: marketingSitePages.blogPublishedAt,
        updatedAt: marketingSitePages.updatedAt,
      }).from(marketingSitePages).where(and(...conditions))
        .orderBy(asc(marketingSitePages.sortOrder), desc(marketingSitePages.blogPublishedAt), marketingSitePages.path).limit(input.limit);
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
      const { sitePasswordHash: _sitePasswordHash, ...safePage } = page;
      return { ...safePage, sitePasswordConfigured: Boolean(_sitePasswordHash) };
    }),

  createPage: protectedProcedure
    .input(z.object({
      tenantKey: tenantKeySchema,
      title: z.string().trim().min(1).max(500),
      path: z.string().trim().min(1).max(500),
      pageType: z.enum(["page", "blog_post"]).default("page"),
      parentId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const path = normalizePath(input.path);
      const [existing] = await db.select({ id: marketingSitePages.id }).from(marketingSitePages)
        .where(and(eq(marketingSitePages.siteKey, input.tenantKey), eq(marketingSitePages.path, path))).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A public page already uses this path." });
      const parentId = await assertTenantParent(db, input.tenantKey, input.parentId);
      if (input.pageType !== "page" && parentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Blog posts cannot be nested in the website page tree." });
      const [lastOrder] = await db.select({ highest: sql<number>`coalesce(max(${marketingSitePages.sortOrder}), -1)` })
        .from(marketingSitePages).where(eq(marketingSitePages.siteKey, input.tenantKey));
      const [result] = await db.insert(marketingSitePages).values({
        siteKey: input.tenantKey,
        parentId,
        path,
        title: input.title,
        pageType: input.pageType,
        blocks: "[]",
        seoTitle: input.title,
        isPublished: false,
        importStatus: "pending",
        sortOrder: Number(lastOrder?.highest ?? -1) + 1,
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
      parentId: z.number().int().positive().nullable().optional(),
      hideInNavigation: z.boolean().optional(),
      visibility: visibilitySchema.optional(),
      /** Plaintext only in transit; the server hashes it and never returns it. Null clears a configured password. */
      sitePassword: z.string().min(8).max(200).nullable().optional(),
      headerType: headerTypeSchema.optional(),
      blocks: z.string().optional(),
      seoTitle: z.string().max(255).nullable().optional(),
      seoDescription: z.string().nullable().optional(),
      seoKeywords: z.string().max(1000).nullable().optional(),
      seoImage: z.string().max(512).nullable().optional(),
      headerCode: z.string().max(100_000).nullable().optional(),
      footerCode: z.string().max(100_000).nullable().optional(),
      hideFromSearch: z.boolean().optional(),
      blogExcerpt: z.string().nullable().optional(),
      blogAuthor: z.string().max(255).nullable().optional(),
      blogCategory: z.string().max(160).nullable().optional(),
      blogPublishedAt: z.date().nullable().optional(),
      blogSidebarMode: z.enum(["inherit", "override"]).optional(),
      blogSidebarBlocks: z.string().max(300_000).nullable().optional(),
      redirectUrl: z.string().max(1000).nullable().optional(),
      isPublished: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: marketingSitePages.id, pageType: marketingSitePages.pageType, visibility: marketingSitePages.visibility, sitePasswordHash: marketingSitePages.sitePasswordHash }).from(marketingSitePages)
        .where(and(eq(marketingSitePages.id, input.id), eq(marketingSitePages.siteKey, input.tenantKey))).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.blocks !== undefined) {
        try { JSON.parse(input.blocks); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Page blocks must be valid JSON." }); }
      }
      if (input.blogSidebarBlocks !== undefined && input.blogSidebarBlocks !== null) {
        try { JSON.parse(input.blogSidebarBlocks); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Article sidebar blocks must be valid JSON." }); }
      }
      const { id, tenantKey, path, parentId, sitePassword, pageType, ...rest } = input;
      const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (pageType !== undefined) updates.pageType = pageType;
      if (path !== undefined) {
        const normalizedPath = normalizePath(path);
        const [pathConflict] = await db.select({ id: marketingSitePages.id }).from(marketingSitePages).where(and(
          eq(marketingSitePages.siteKey, tenantKey), eq(marketingSitePages.path, normalizedPath),
        )).limit(1);
        if (pathConflict && pathConflict.id !== id) throw new TRPCError({ code: "CONFLICT", message: "A public page already uses this path." });
        updates.path = normalizedPath;
      }
      const effectivePageType = pageType ?? existing.pageType;
      if (parentId !== undefined) {
        if (effectivePageType !== "page" && parentId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Only website pages can be nested in the page tree." });
        updates.parentId = await assertTenantParent(db, tenantKey, parentId, id);
        const tenantRows = await db.select({ id: marketingSitePages.id, parentId: marketingSitePages.parentId })
          .from(marketingSitePages).where(eq(marketingSitePages.siteKey, tenantKey));
        assertNoPageTreeCycles(tenantRows.map((row) => ({
          id: row.id,
          parentId: row.id === id ? (updates.parentId as number | null) : row.parentId,
        })));
      }
      if (effectivePageType !== "page" && parentId === undefined) updates.parentId = null;
      if (sitePassword !== undefined) updates.sitePasswordHash = sitePassword === null ? null : await bcrypt.hash(sitePassword, 12);
      const effectiveVisibility = (updates.visibility as z.infer<typeof visibilitySchema> | undefined) ?? existing.visibility;
      if (effectiveVisibility === "site_password" && (!updates.sitePasswordHash && (!existing.sitePasswordHash || sitePassword === null))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Set a site password before using password-protected visibility." });
      }
      await db.update(marketingSitePages).set(updates).where(eq(marketingSitePages.id, id));
      return { ok: true };
    }),

  savePageTree: protectedProcedure
    .input(z.object({
      tenantKey: tenantKeySchema,
      placements: z.array(z.object({ id: z.number().int().positive(), parentId: z.number().int().positive().nullable(), sortOrder: z.number().int().min(0).max(10_000) })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ids = input.placements.map((placement) => placement.id);
      if (new Set(ids).size !== ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Each page may only appear once in the tree." });
      const tenantRows = await db.select({ id: marketingSitePages.id, parentId: marketingSitePages.parentId, pageType: marketingSitePages.pageType })
        .from(marketingSitePages).where(eq(marketingSitePages.siteKey, input.tenantKey));
      const byId = new Map(tenantRows.map((row) => [row.id, row]));
      for (const placement of input.placements) {
        const page = byId.get(placement.id);
        if (!page) throw new TRPCError({ code: "FORBIDDEN", message: "Every page moved must belong to this brand site." });
        if (page.pageType !== "page") throw new TRPCError({ code: "BAD_REQUEST", message: "Only website pages appear in the page tree." });
        if (placement.parentId !== null) {
          const parent = byId.get(placement.parentId);
          if (!parent || parent.pageType !== "page") throw new TRPCError({ code: "BAD_REQUEST", message: "A page folder must belong to this brand site." });
          if (placement.parentId === placement.id) throw new TRPCError({ code: "BAD_REQUEST", message: "A page cannot be its own parent." });
        }
      }
      const parentById = new Map(tenantRows.map((row) => [row.id, row.parentId]));
      for (const placement of input.placements) parentById.set(placement.id, placement.parentId);
      assertNoPageTreeCycles([...parentById.entries()].map(([id, parentId]) => ({ id, parentId })));
      await db.transaction(async (tx) => {
        for (const placement of input.placements) {
          await tx.update(marketingSitePages).set({ parentId: placement.parentId, sortOrder: placement.sortOrder, updatedAt: new Date() })
            .where(and(eq(marketingSitePages.id, placement.id), eq(marketingSitePages.siteKey, input.tenantKey)));
        }
      });
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

  saveBlogSidebar: protectedProcedure
    .input(z.object({ tenantKey: tenantKeySchema, blocks: z.string().max(300_000) }))
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try { JSON.parse(input.blocks); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Blog sidebar blocks must be valid JSON." }); }
      await ensurePublicSiteSettings(db, input.tenantKey);
      await db.update(marketingSiteSettings).set({ blogSidebarBlocks: input.blocks, updatedAt: new Date() })
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
