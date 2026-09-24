/**
 * marketingSiteImport.ts — tenant-aware public-site importer.
 *
 * Imports each current public site into a separate editable public-site tenant.
 * Imports are administrator-triggered; the importer does not run automatically at
 * deployment time. Source links are normalized so legacy member links point to
 * Learn, and each tenant remains independently publishable and editable.
 */
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { htmlToBlocks, type ScrapedBlock } from "../routers/pageScraperRouter";
import { marketingSitePages, marketingSiteSettings } from "../../drizzle/schema";
import { storagePut } from "../storage";
import {
  getPublicSiteTenant,
  getPublicSiteTenantForHost,
  getPublicSiteTenantForBrand,
  publicSiteOrigin,
  type PublicSiteTenant,
  type PublicSiteTenantKey,
} from "@shared/publicSiteTenants";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; AAU-IHeartEcho-PublicSiteImporter/2.0)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export type PublicSiteImportScope = "all" | "pages" | "blog";

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
  kind: "page" | "blog_post";
  error?: string;
  rewrites?: RewriteCounts;
}

export interface PublicSiteImportOptions {
  tenantKey: PublicSiteTenantKey;
  scope?: PublicSiteImportScope;
  reimportExisting?: boolean;
  urls?: string[];
  limit?: number;
}

/** Keeps each source asset to one download/upload across a sitemap import. */
type ImportAssetCache = Map<string, string>;

/**
 * Verified legacy-course destinations.  Keep this intentionally small and
 * explicit: a source URL is changed only when it identifies one specific
 * current Learn course. Generic "CME" or "education" calls-to-action are
 * left on their normal Learn landing path instead of being guessed into an
 * unrelated course.
 */
const LEGACY_CME_COURSE_DESTINATIONS = {
  "allaboutultrasound.teachable.com/purchase?product_id=4100340":
    "https://learn.allaboutultrasound.com/courses/all-about-upper-extremity-duplex-cme",
  "member.allaboutultrasound.com/products/all-about-upper-extremity-duplex-sdms-cme":
    "https://learn.allaboutultrasound.com/courses/all-about-upper-extremity-duplex-cme",
  "member.allaboutultrasound.com/products/all-about-hemodialysis-access-mapping-25-sdms-cme":
    "https://learn.allaboutultrasound.com/courses/all-about-hemodialysis-access-mapping-25-sdms-cme",
  "member.allaboutultrasound.com/products/all-about-venous-insufficiency-sdms-cme":
    "https://learn.allaboutultrasound.com/courses/all-about-venous-insufficiency-cme",
  "www.iheartecho.com/advanced-cardiac-sonography-program.html":
    "https://learn.allaboutultrasound.com/courses/advanced-cardiac-sonographer-acs-mastery-course",
  "iheartecho.com/advanced-cardiac-sonography-program.html":
    "https://learn.allaboutultrasound.com/courses/advanced-cardiac-sonographer-acs-mastery-course",
} as const;

type RewriteCounts = {
  legacyMemberLinks: number;
  sourceLinks: number;
  crossBrandLinks: number;
  cmeCourseLinks: number;
};

function normalizePath(raw: string): string {
  try {
    const parsed = new URL(raw);
    let path = parsed.pathname || "/";
    if (path === "/index.html" || path === "/home.html") path = "/";
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    let path = raw.split("?")[0] || "/";
    if (path === "/index.html" || path === "/home.html") path = "/";
    return path.startsWith("/") ? path : `/${path}`;
  }
}

function sourceUrlToPathForTenant(sourceUrl: string, tenant: PublicSiteTenant): string {
  const path = normalizePath(sourceUrl);
  return path === "/" ? "/" : path;
}

function isBlogPath(path: string, tenant: PublicSiteTenant): boolean {
  return path === tenant.blogIndexPath || path.startsWith(tenant.blogPathPrefix);
}

function isBlogPostPath(path: string, tenant: PublicSiteTenant): boolean {
  return path.startsWith(tenant.blogPathPrefix) && path !== tenant.blogIndexPath;
}

function shouldImportPath(path: string, tenant: PublicSiteTenant, scope: PublicSiteImportScope): boolean {
  if (scope === "all") return true;
  const article = isBlogPostPath(path, tenant);
  return scope === "blog" ? article : !article;
}

function toAbsoluteUrl(raw: string, base: string): URL | null {
  try {
    return new URL(raw, base);
  } catch {
    return null;
  }
}

/**
 * Rewrites imported public content without rewriting content on the source site:
 * - source-site links become same-tenant relative links;
 * - legacy member links always go to Learn;
 * - cross-brand marketing links point to the current .net review host, with a
 *   documented one-step promotion rewrite available when the .com hosts launch.
 */
export function rewritePublicSiteLink(
  href: string,
  tenant: PublicSiteTenant,
  counts?: RewriteCounts,
): string {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("data:")) {
    return href;
  }

  const url = toAbsoluteUrl(href, tenant.sourceOrigin);
  if (!url) return href;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const destinationKey = `${url.hostname.toLowerCase()}${url.pathname}${url.search}`;
  const courseDestination = LEGACY_CME_COURSE_DESTINATIONS[
    destinationKey as keyof typeof LEGACY_CME_COURSE_DESTINATIONS
  ];
  if (courseDestination) {
    if (counts) counts.cmeCourseLinks += 1;
    return `${courseDestination}${url.hash}`;
  }

  if (host === "member.allaboutultrasound.com" || host === "members.allaboutultrasound.com") {
    if (counts) counts.legacyMemberLinks += 1;
    return `https://learn.allaboutultrasound.com${url.pathname}${url.search}${url.hash}`;
  }

  // All legacy Teachable checkout URLs have been retired. Known products above
  // retain their exact Learn course destination; every other legacy checkout
  // reaches the current Learn catalog rather than an obsolete payment page.
  if (host === "allaboutultrasound.teachable.com") {
    if (counts) counts.legacyMemberLinks += 1;
    return "https://learn.allaboutultrasound.com";
  }

  if (host === new URL(tenant.sourceOrigin).hostname.toLowerCase().replace(/^www\./, "")) {
    if (counts) counts.sourceLinks += 1;
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const otherTenant = getPublicSiteTenantForHost(url.hostname)
    ?? (host === "allaboutultrasound.com" ? getPublicSiteTenantForBrand("aaus") : null)
    ?? (host === "iheartecho.com" || host === "iheartecho.net" ? getPublicSiteTenantForBrand("iheartecho") : null);
  if (otherTenant) {
    if (counts) counts.crossBrandLinks += 1;
    return `${publicSiteOrigin(otherTenant)}${url.pathname}${url.search}${url.hash}`;
  }

  return url.href;
}

function rewriteBareUrls(value: string, tenant: PublicSiteTenant, counts: RewriteCounts): string {
  return value.replace(/https?:\/\/[^\s<>"']+/gi, (url) => rewritePublicSiteLink(url, tenant, counts));
}

function rewriteValue(value: unknown, tenant: PublicSiteTenant, counts: RewriteCounts, fieldName?: string): unknown {
  if (typeof value === "string") {
    // Preserve rich-text and embed HTML while replacing only URL attribute values.
    if (/<[a-z][\s\S]*>/i.test(value)) {
      const $ = cheerio.load(value, { xmlMode: false }, false);
      $("[href]").each((_, element) => {
        const original = $(element).attr("href");
        if (original) $(element).attr("href", rewritePublicSiteLink(original, tenant, counts));
      });
      $("*").contents().each((_, node: any) => {
        if (node.type === "text" && typeof node.data === "string") {
          node.data = rewriteBareUrls(node.data, tenant, counts);
        }
      });
      // Keep source image/video references intact until mirrorValueAssets has
      // transferred the owned asset into this tenant's durable storage.
      return $.root().html() ?? value;
    }
    if (fieldName && /(image|logo|icon|photo|picture|background|poster|thumbnail|avatar|media)/i.test(fieldName)) return value;
    if (/^(https?:\/\/|\/)/i.test(value)) return rewritePublicSiteLink(value, tenant, counts);
    return rewriteBareUrls(value, tenant, counts);
  }
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item, tenant, counts, fieldName));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteValue(item, tenant, counts, key)]));
  }
  return value;
}

function rewriteBlocksForTenant(blocks: ScrapedBlock[], tenant: PublicSiteTenant) {
  const counts: RewriteCounts = { legacyMemberLinks: 0, sourceLinks: 0, crossBrandLinks: 0, cmeCourseLinks: 0 };
  return {
    blocks: blocks.map((block) => ({ ...block, data: rewriteValue(block.data, tenant, counts) as Record<string, unknown> })),
    counts,
  };
}

function isSourceAssetUrl(value: string, tenant: PublicSiteTenant) {
  try {
    const sourceHost = new URL(tenant.sourceOrigin).hostname.replace(/^www\./, "");
    return new URL(value).hostname.replace(/^www\./, "") === sourceHost;
  } catch {
    return false;
  }
}

function contentTypeExtension(contentType: string, sourceUrl: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
    "image/svg+xml": ".svg", "video/mp4": ".mp4", "video/webm": ".webm",
  };
  if (extensions[contentType]) return extensions[contentType]!;
  try { return new URL(sourceUrl).pathname.match(/\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm)$/i)?.[0]?.toLowerCase() ?? ".bin"; } catch { return ".bin"; }
}

async function mirrorSourceAsset(url: string, tenant: PublicSiteTenant, cache: ImportAssetCache): Promise<string> {
  if (!isSourceAssetUrl(url, tenant)) return url;
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "application/octet-stream";
    if (!/^(image|video)\//.test(contentType)) throw new Error(`Unsupported asset type ${contentType}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 40 * 1024 * 1024) throw new Error("Asset exceeds import size limit");
    const key = `marketing-sites/${tenant.key}/assets/${createHash("sha256").update(url).digest("hex").slice(0, 24)}${contentTypeExtension(contentType, url)}`;
    const { url: mirroredUrl } = await storagePut(key, bytes, contentType);
    cache.set(url, mirroredUrl);
    return mirroredUrl;
  } catch (error) {
    console.warn("[PublicSiteImport] Asset mirror failed", { tenant: tenant.key, url, error: error instanceof Error ? error.message : String(error) });
    return url;
  }
}

async function mirrorValueAssets(value: unknown, tenant: PublicSiteTenant, cache: ImportAssetCache, fieldName?: string): Promise<unknown> {
  if (typeof value === "string") {
    if (/<[a-z][\s\S]*>/i.test(value)) {
      const $ = cheerio.load(value, { xmlMode: false }, false);
      for (const element of $("img[src], source[src], video[poster]").toArray()) {
        for (const attribute of ["src", "poster"]) {
          const original = $(element).attr(attribute);
          if (original) $(element).attr(attribute, await mirrorSourceAsset(original, tenant, cache));
        }
      }
      return $.root().html() ?? value;
    }
    return fieldName && /(image|logo|icon|photo|picture|background|poster|thumbnail|avatar|media)/i.test(fieldName)
      ? mirrorSourceAsset(value, tenant, cache)
      : value;
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => mirrorValueAssets(item, tenant, cache, fieldName)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await mirrorValueAssets(item, tenant, cache, key)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}

async function mirrorBlocksForTenant(blocks: ScrapedBlock[], tenant: PublicSiteTenant, cache: ImportAssetCache) {
  return Promise.all(blocks.map(async (block) => ({ ...block, data: await mirrorValueAssets(block.data, tenant, cache) as Record<string, unknown> })));
}

function extractSeo($: cheerio.CheerioAPI) {
  return {
    seoTitle: $("title").first().text().trim() || $("meta[property='og:title']").attr("content") || "",
    seoDescription: $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "",
    seoImage: $("meta[property='og:image']").attr("content") || "",
  };
}

function extractBlogMetadata($: cheerio.CheerioAPI) {
  const jsonLdDates: string[] = [];
  $("script[type='application/ld+json']").each((_, script) => {
    try {
      const data = JSON.parse($(script).text());
      const candidates = Array.isArray(data) ? data : [data, ...(Array.isArray(data?.["@graph"]) ? data["@graph"] : [])];
      for (const candidate of candidates) {
        if (typeof candidate?.datePublished === "string") jsonLdDates.push(candidate.datePublished);
      }
    } catch {
      // Invalid source JSON-LD does not prevent importing visible page content.
    }
  });
  const published = $("meta[property='article:published_time']").attr("content")
    || $("meta[name='date']").attr("content")
    || jsonLdDates[0]
    || null;
  const author = $("meta[name='author']").attr("content") || $("[rel='author']").first().text().trim() || null;
  const category = $("meta[property='article:section']").attr("content") || null;
  const excerpt = $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || null;
  const parsedDate = published && !Number.isNaN(Date.parse(published)) ? new Date(published) : null;
  return { blogExcerpt: excerpt, blogAuthor: author, blogCategory: category, blogPublishedAt: parsedDate };
}

export async function fetchSitemapUrls(tenant: PublicSiteTenant): Promise<string[]> {
  const sitemapUrl = `${tenant.sourceOrigin}/sitemap.xml`;
  const response = await fetch(sitemapUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Sitemap fetch failed: HTTP ${response.status}`);
  const xml = await response.text();
  const sourceOrigin = new URL(tenant.sourceOrigin).origin;
  return [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]!.trim()))]
    .filter((url) => url.startsWith(sourceOrigin));
}

export async function fetchPageHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("Not HTML");
  return response.text();
}

/** Extract top-level nav links from an imported public-site homepage. */
export function extractNavFromHtml(html: string, tenant: PublicSiteTenant): NavItem[] {
  const $ = cheerio.load(html);
  const items: NavItem[] = [];
  const rewriteCounts: RewriteCounts = { legacyMemberLinks: 0, sourceLinks: 0, crossBrandLinks: 0, cmeCourseLinks: 0 };
  $("#wsite-nav-menu a, .wsite-menu-default a, nav a").each((_, element) => {
    const label = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href") || "";
    if (!label || !href || href === "#") return;
    items.push({ label, href: rewritePublicSiteLink(href, tenant, rewriteCounts) });
  });
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}|${item.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

export async function ensurePublicSiteSettings(db: any, tenantKey: PublicSiteTenantKey) {
  const tenant = getPublicSiteTenant(tenantKey);
  if (!tenant) throw new Error(`Unknown public-site tenant: ${tenantKey}`);
  const [existing] = await db.select().from(marketingSiteSettings)
    .where(eq(marketingSiteSettings.siteKey, tenant.key)).limit(1);
  if (existing) return existing;

  await db.insert(marketingSiteSettings).values({
    siteKey: tenant.key,
    hostDomain: tenant.currentHost,
    sourceDomain: new URL(tenant.sourceOrigin).hostname,
    siteName: tenant.siteName,
    isStaging: true,
    stagingBannerText: `Preview on ${tenant.currentHost} — final promotion target: ${tenant.promotionHost}`,
  });
  const [created] = await db.select().from(marketingSiteSettings)
    .where(eq(marketingSiteSettings.siteKey, tenant.key)).limit(1);
  return created!;
}

export async function importPublicSitePage(
  db: any,
  tenantKey: PublicSiteTenantKey,
  sourceUrl: string,
  opts?: { skipExisting?: boolean; assetCache?: ImportAssetCache },
): Promise<ImportPageResult> {
  const tenant = getPublicSiteTenant(tenantKey);
  if (!tenant) throw new Error(`Unknown public-site tenant: ${tenantKey}`);
  const path = sourceUrlToPathForTenant(sourceUrl, tenant);
  const kind = isBlogPostPath(path, tenant) ? "blog_post" as const : "page" as const;

  if (opts?.skipExisting) {
    const [existing] = await db.select().from(marketingSitePages)
      .where(and(eq(marketingSitePages.siteKey, tenant.key), eq(marketingSitePages.path, path)))
      .limit(1);
    if (existing?.importStatus === "imported") {
      return { path, sourceUrl, title: existing.title ?? "", blockCount: 0, status: "skipped", kind };
    }
  }

  try {
    const html = await fetchPageHtml(sourceUrl);
    const $ = cheerio.load(html);
    const seo = extractSeo($);
    const title = seo.seoTitle || $("h1").first().text().trim() || path;
    const parsed = htmlToBlocks(html, sourceUrl);
    const rewritten = rewriteBlocksForTenant(parsed, tenant);
    const assetCache = opts?.assetCache ?? new Map<string, string>();
    const mirroredBlocks = await mirrorBlocksForTenant(rewritten.blocks, tenant, assetCache);
    const seoImageUrl = seo.seoImage ? (() => {
      try { return new URL(seo.seoImage, sourceUrl).href; } catch { return seo.seoImage; }
    })() : "";
    const mirroredSeoImage = seoImageUrl ? await mirrorSourceAsset(seoImageUrl, tenant, assetCache) : "";
    const blog = kind === "blog_post" ? extractBlogMetadata($) : {};

    const values = {
      siteKey: tenant.key,
      path,
      title,
      pageType: kind,
      blocks: JSON.stringify(mirroredBlocks),
      seoTitle: seo.seoTitle || title,
      seoDescription: seo.seoDescription,
      seoImage: mirroredSeoImage || seo.seoImage,
      ...blog,
      sourceUrl,
      isPublished: true,
      importStatus: "imported" as const,
      importError: null,
      linkAuditJson: JSON.stringify({
        sourceUrl,
        importedAt: new Date().toISOString(),
        rewritten: rewritten.counts,
        currentHost: tenant.currentHost,
        promotionHost: tenant.promotionHost,
      }),
      importedAt: new Date(),
      updatedAt: new Date(),
    };

    const [existing] = await db.select().from(marketingSitePages)
      .where(and(eq(marketingSitePages.siteKey, tenant.key), eq(marketingSitePages.path, path)))
      .limit(1);
    if (existing) await db.update(marketingSitePages).set(values).where(eq(marketingSitePages.id, existing.id));
    else await db.insert(marketingSitePages).values(values);

    return { path, sourceUrl, title, blockCount: mirroredBlocks.length, status: "imported", kind, rewrites: rewritten.counts };
  } catch (error: any) {
    const message = error?.message ?? "Import failed";
    const failedValues = {
      siteKey: tenant.key,
      path,
      title: path,
      pageType: kind,
      sourceUrl,
      importStatus: "failed" as const,
      importError: message,
      isPublished: false,
      updatedAt: new Date(),
    };
    const [existing] = await db.select().from(marketingSitePages)
      .where(and(eq(marketingSitePages.siteKey, tenant.key), eq(marketingSitePages.path, path)))
      .limit(1);
    if (existing) await db.update(marketingSitePages).set(failedValues).where(eq(marketingSitePages.id, existing.id));
    else await db.insert(marketingSitePages).values(failedValues);
    return { path, sourceUrl, title: path, blockCount: 0, status: "failed", kind, error: message };
  }
}

export async function importPublicSiteNavigation(db: any, tenantKey: PublicSiteTenantKey) {
  const tenant = getPublicSiteTenant(tenantKey);
  if (!tenant) throw new Error(`Unknown public-site tenant: ${tenantKey}`);
  const html = await fetchPageHtml(`${tenant.sourceOrigin}/`);
  const nav = extractNavFromHtml(html, tenant);
  await ensurePublicSiteSettings(db, tenant.key);
  await db.update(marketingSiteSettings).set({ navJson: JSON.stringify(nav), lastImportAt: new Date(), updatedAt: new Date() })
    .where(eq(marketingSiteSettings.siteKey, tenant.key));
  return nav;
}

export async function bulkImportPublicSite(
  db: any,
  options: PublicSiteImportOptions,
): Promise<{ total: number; results: ImportPageResult[]; tenant: PublicSiteTenant }> {
  const tenant = getPublicSiteTenant(options.tenantKey);
  if (!tenant) throw new Error(`Unknown public-site tenant: ${options.tenantKey}`);
  await ensurePublicSiteSettings(db, tenant.key);
  try {
    await importPublicSiteNavigation(db, tenant.key);
  } catch (error) {
    console.warn("[PublicSiteImport] Navigation extraction failed", { tenant: tenant.key });
  }

  const scope = options.scope ?? "all";
  const urls = options.urls ?? await fetchSitemapUrls(tenant);
  const selected = urls
    .filter((url) => shouldImportPath(sourceUrlToPathForTenant(url, tenant), tenant, scope))
    .sort((left, right) => {
      const a = sourceUrlToPathForTenant(left, tenant);
      const b = sourceUrlToPathForTenant(right, tenant);
      if (a === "/") return -1;
      if (b === "/") return 1;
      return a.localeCompare(b);
    });
  const batch = options.limit ? selected.slice(0, options.limit) : selected;
  const results: ImportPageResult[] = [];
  const assetCache: ImportAssetCache = new Map();
  for (const sourceUrl of batch) {
    const result = await importPublicSitePage(db, tenant.key, sourceUrl, {
      skipExisting: options.reimportExisting !== true,
      assetCache,
    });
    results.push(result);
    console.log(`[PublicSiteImport] ${tenant.key} ${result.status} ${result.path}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await db.update(marketingSiteSettings).set({ lastImportAt: new Date() })
    .where(eq(marketingSiteSettings.siteKey, tenant.key));
  return { total: batch.length, results, tenant };
}

/**
 * Compatibility exports for the original AAUS staging utility. New work should
 * use the tenant-specific public-site functions above.
 */
export const importMarketingPage = async (db: any, sourceUrl: string, opts?: { skipExisting?: boolean }) =>
  importPublicSitePage(db, "aaus-net", sourceUrl, opts);
export const bulkImportMarketingSite = async (db: any, opts?: { limit?: number; skipExisting?: boolean }) =>
  bulkImportPublicSite(db, { tenantKey: "aaus-net", limit: opts?.limit, reimportExisting: opts?.skipExisting === false });
export const ensureMarketingSiteSettings = async (db: any) => ensurePublicSiteSettings(db, "aaus-net");
export const importHomepageNav = async (db: any) => importPublicSiteNavigation(db, "aaus-net");
export const sourceUrlToPath = (sourceUrl: string) => normalizePath(sourceUrl);
