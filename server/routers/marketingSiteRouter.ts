/**
 * marketingSiteRouter.ts — staging marketing site admin + public page API.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { marketingSitePages, marketingSiteSettings } from "../../drizzle/schema";
import { eq, and, desc, like, sql } from "drizzle-orm";
import {
  MARKETING_SITE_KEY,
  MARKETING_STAGING_HOST,
} from "@shared/marketingSiteConstants";
import {
  bulkImportMarketingSite,
  importMarketingPage,
  ensureMarketingSiteSettings,
} from "../lib/marketingSiteImport";

async function requireAdmin(ctx: { user?: { role?: string } }) {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

function normalizePath(raw: string): string {
  let p = raw.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
  if (p === "/index.html" || p === "/home.html") p = "/";
  return p;
}

export const marketingSitePublicRouter = router({
  getSettings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await ensureMarketingSiteSettings(db);
    const [settings] = await db.select().from(marketingSiteSettings)
      .where(eq(marketingSiteSettings.siteKey, MARKETING_SITE_KEY)).limit(1);
    let nav: unknown[] = [];
    try { nav = settings?.navJson ? JSON.parse(settings.navJson) : []; } catch { nav = []; }
    return {
      siteKey: MARKETING_SITE_KEY,
      hostDomain: settings?.hostDomain ?? MARKETING_STAGING_HOST,
      siteName: settings?.siteName ?? "All About Ultrasound",
      isStaging: settings?.isStaging ?? true,
      stagingBannerText: settings?.stagingBannerText ?? "Staging Preview — Not Live",
      faviconUrl: settings?.faviconUrl ?? null,
      nav,
    };
  }),

  getPageByPath: publicProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const path = normalizePath(input.path);
      const [page] = await db.select().from(marketingSitePages)
        .where(and(
          eq(marketingSitePages.siteKey, MARKETING_SITE_KEY),
          eq(marketingSitePages.path, path),
          eq(marketingSitePages.isPublished, true),
        ))
        .limit(1);
      if (!page) return null;
      if (page.pageType === "redirect" && page.redirectUrl) {
        return { redirectUrl: page.redirectUrl, page: null };
      }
      let blocks: unknown[] = [];
      try { blocks = page.blocks ? JSON.parse(page.blocks) : []; } catch { blocks = []; }
      return {
        redirectUrl: null,
        page: {
          id: page.id,
          path: page.path,
          title: page.title,
          pageType: page.pageType,
          blocks,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          seoImage: page.seoImage,
        },
      };
    }),
});

export const marketingSiteAdminRouter = router({
  getImportStatus: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await ensureMarketingSiteSettings(db);
    const [settings] = await db.select().from(marketingSiteSettings)
      .where(eq(marketingSiteSettings.siteKey, MARKETING_SITE_KEY)).limit(1);
    const counts = await db.execute(sql`
      SELECT importStatus, COUNT(*) as cnt FROM marketingSitePages
      WHERE siteKey = ${MARKETING_SITE_KEY} GROUP BY importStatus
    `);
    const byStatus: Record<string, number> = {};
    for (const row of (counts[0] as unknown as any[]) ?? []) {
      byStatus[String(row.importStatus)] = Number(row.cnt);
    }
    const [totalRow] = await db.select({ c: sql<number>`count(*)` }).from(marketingSitePages)
      .where(eq(marketingSitePages.siteKey, MARKETING_SITE_KEY));
    return {
      settings,
      totalPages: Number(totalRow?.c ?? 0),
      byStatus,
      stagingUrl: `https://${MARKETING_STAGING_HOST}`,
    };
  }),

  listPages: protectedProcedure
    .input(z.object({ search: z.string().optional(), limit: z.number().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [eq(marketingSitePages.siteKey, MARKETING_SITE_KEY)];
      if (input.search) {
        conditions.push(like(marketingSitePages.path, `%${input.search}%`));
      }
      return db.select({
        id: marketingSitePages.id,
        path: marketingSitePages.path,
        title: marketingSitePages.title,
        pageType: marketingSitePages.pageType,
        importStatus: marketingSitePages.importStatus,
        isPublished: marketingSitePages.isPublished,
        importedAt: marketingSitePages.importedAt,
        sourceUrl: marketingSitePages.sourceUrl,
      }).from(marketingSitePages)
        .where(and(...conditions))
        .orderBy(marketingSitePages.path)
        .limit(input.limit);
    }),

  getPage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [page] = await db.select().from(marketingSitePages).where(eq(marketingSitePages.id, input.id)).limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  savePage: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      blocks: z.string().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      seoImage: z.string().optional(),
      isPublished: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(marketingSitePages).set({ ...rest, updatedAt: new Date() }).where(eq(marketingSitePages.id, id));
      return { success: true };
    }),

  importUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return importMarketingPage(db, input.url, { skipExisting: false });
    }),

  runBulkImport: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).optional(),
      skipExisting: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return bulkImportMarketingSite(db, { limit: input.limit, skipExisting: input.skipExisting });
    }),
});

export const marketingSiteRouter = router({
  public: marketingSitePublicRouter,
  admin: marketingSiteAdminRouter,
});
