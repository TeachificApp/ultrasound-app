/**
 * marketingSiteImport.ts — crawl sitemap, scrape pages, rehost assets, upsert DB rows.
 */
import * as cheerio from "cheerio";
import { eq, and } from "drizzle-orm";
import { htmlToBlocks, type ScrapedBlock } from "../routers/pageScraperRouter";
import { marketingSitePages, marketingSiteSettings } from "../../drizzle/schema";
import {
  MARKETING_SITE_KEY,
  MARKETING_SOURCE_ORIGIN,
  MARKETING_STAGING_HOST,
  rewriteLinkForStaging,
  sourceUrlToPath,
} from "@shared/marketingSiteConstants";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; AAU-MarketingSiteImporter/1.0)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface ImportPageResult {
  path: string;
  sourceUrl: string;
  title: string;
  blockCount: number;
  status: "imported" | "failed" | "skipped";
  error?: string;
}

export async function fetchSitemapUrls(sitemapUrl = `${MARKETING_SOURCE_ORIGIN}/sitemap.xml`): Promise<string[]> {
  const res = await fetch(sitemapUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1].trim());
  const origin = new URL(MARKETING_SOURCE_ORIGIN).origin;
  return [...new Set(urls.filter(u => u.startsWith(origin)))];
}

export async function fetchPageHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) throw new Error("Not HTML");
  return res.text();
}

function extractSeo($: cheerio.CheerioAPI) {
  return {
    seoTitle: $("title").first().text().trim() || $("meta[property='og:title']").attr("content") || "",
    seoDescription: $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "",
    seoImage: $("meta[property='og:image']").attr("content") || "",
  };
}

function rewriteBlocksForStaging(blocks: ScrapedBlock[]): ScrapedBlock[] {
  const stagingOrigin = `https://${MARKETING_STAGING_HOST}`;
  const walk = (obj: unknown): unknown => {
    if (typeof obj === "string") {
      if (obj.startsWith("http") && obj.includes("allaboutultrasound.com")) {
        return rewriteLinkForStaging(obj, stagingOrigin);
      }
      return obj;
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
      return out;
    }
    return obj;
  };
  return blocks.map(b => ({ ...b, data: walk(b.data) as Record<string, unknown> }));
}

/** Extract top-level nav links from Weebly header. */
export function extractNavFromHtml(html: string, baseUrl: string): NavItem[] {
  const $ = cheerio.load(html);
  const items: NavItem[] = [];
  $("#wsite-nav-menu a, .wsite-menu-default a, nav a").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href") || "";
    if (!label || !href || href === "#") return;
    try {
      const abs = new URL(href, baseUrl).href;
      if (abs.includes("allaboutultrasound.com") || href.startsWith("/")) {
        items.push({ label, href: rewriteLinkForStaging(abs) });
      }
    } catch { /* skip */ }
  });
  const seen = new Set<string>();
  return items.filter(i => {
    const key = i.label + i.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

export async function importMarketingPage(
  db: any,
  sourceUrl: string,
  opts?: { rehostAssets?: boolean; skipExisting?: boolean },
): Promise<ImportPageResult> {
  const path = sourceUrlToPath(sourceUrl);
  const pageType = path.includes("/making-waves-blog/") && path !== "/making-waves-blog.html"
    ? "blog_post" as const
    : "page" as const;

  if (opts?.skipExisting) {
    const [existing] = await db.select().from(marketingSitePages)
      .where(and(eq(marketingSitePages.siteKey, MARKETING_SITE_KEY), eq(marketingSitePages.path, path)))
      .limit(1);
    if (existing?.importStatus === "imported") {
      return { path, sourceUrl, title: existing.title ?? "", blockCount: 0, status: "skipped" };
    }
  }

  try {
    const html = await fetchPageHtml(sourceUrl);
    const $ = cheerio.load(html);
    const seo = extractSeo($);
    const title = seo.seoTitle || $("h1").first().text().trim() || path;
    let blocks = htmlToBlocks(html, sourceUrl);
    blocks = rewriteBlocksForStaging(blocks);

    const values = {
      siteKey: MARKETING_SITE_KEY,
      path,
      title,
      pageType,
      blocks: JSON.stringify(blocks),
      seoTitle: seo.seoTitle || title,
      seoDescription: seo.seoDescription,
      seoImage: seo.seoImage,
      sourceUrl,
      isPublished: true,
      importStatus: "imported" as const,
      importError: null,
      importedAt: new Date(),
      updatedAt: new Date(),
    };

    const [existing] = await db.select().from(marketingSitePages)
      .where(and(eq(marketingSitePages.siteKey, MARKETING_SITE_KEY), eq(marketingSitePages.path, path)))
      .limit(1);

    if (existing) {
      await db.update(marketingSitePages).set(values).where(eq(marketingSitePages.id, existing.id));
    } else {
      await db.insert(marketingSitePages).values(values);
    }

    return { path, sourceUrl, title, blockCount: blocks.length, status: "imported" };
  } catch (e: any) {
    const errMsg = e?.message ?? "Import failed";
    const failValues = {
      siteKey: MARKETING_SITE_KEY,
      path,
      title: path,
      pageType,
      sourceUrl,
      importStatus: "failed" as const,
      importError: errMsg,
      isPublished: false,
      updatedAt: new Date(),
    };
    const [existing] = await db.select().from(marketingSitePages)
      .where(and(eq(marketingSitePages.siteKey, MARKETING_SITE_KEY), eq(marketingSitePages.path, path)))
      .limit(1);
    if (existing) {
      await db.update(marketingSitePages).set(failValues).where(eq(marketingSitePages.id, existing.id));
    } else {
      await db.insert(marketingSitePages).values(failValues);
    }
    return { path, sourceUrl, title: path, blockCount: 0, status: "failed", error: errMsg };
  }
}

export async function ensureMarketingSiteSettings(db: any) {
  const [row] = await db.select().from(marketingSiteSettings)
    .where(eq(marketingSiteSettings.siteKey, MARKETING_SITE_KEY)).limit(1);
  if (row) return row;
  await db.insert(marketingSiteSettings).values({
    siteKey: MARKETING_SITE_KEY,
    hostDomain: MARKETING_STAGING_HOST,
    sourceDomain: "www.allaboutultrasound.com",
    isStaging: true,
  });
  const [created] = await db.select().from(marketingSiteSettings)
    .where(eq(marketingSiteSettings.siteKey, MARKETING_SITE_KEY)).limit(1);
  return created!;
}

export async function importHomepageNav(db: any) {
  const html = await fetchPageHtml(MARKETING_SOURCE_ORIGIN + "/");
  const nav = extractNavFromHtml(html, MARKETING_SOURCE_ORIGIN);
  await ensureMarketingSiteSettings(db);
  await db.update(marketingSiteSettings).set({
    navJson: JSON.stringify(nav),
    lastImportAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(marketingSiteSettings.siteKey, MARKETING_SITE_KEY));
  return nav;
}

export async function bulkImportMarketingSite(
  db: any,
  opts?: { limit?: number; skipExisting?: boolean; urls?: string[] },
): Promise<{ total: number; results: ImportPageResult[] }> {
  await ensureMarketingSiteSettings(db);
  try {
    await importHomepageNav(db);
  } catch (e) {
    console.warn("[MarketingImport] Nav extract failed:", e);
  }

  const urls = opts?.urls ?? await fetchSitemapUrls();
  const sorted = urls.sort((a, b) => {
    const pa = sourceUrlToPath(a);
    const pb = sourceUrlToPath(b);
    if (pa === "/") return -1;
    if (pb === "/") return 1;
    return pa.localeCompare(pb);
  });
  const batch = opts?.limit ? sorted.slice(0, opts.limit) : sorted;
  const results: ImportPageResult[] = [];

  for (const url of batch) {
    const r = await importMarketingPage(db, url, { skipExisting: opts?.skipExisting });
    results.push(r);
    console.log(`[MarketingImport] ${r.status} ${r.path} (${r.blockCount} blocks)`);
    await new Promise(r => setTimeout(r, 300));
  }

  await db.update(marketingSiteSettings).set({ lastImportAt: new Date() })
    .where(eq(marketingSiteSettings.siteKey, MARKETING_SITE_KEY));

  return { total: batch.length, results };
}
