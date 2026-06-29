/**
 * Funnel Page OG Meta + Canonical Tag Injection
 *
 * Intercepts requests for funnel/landing pages and injects:
 *  - Page-specific <title>, <meta name="description">, and OG tags
 *  - A <link rel="canonical"> pointing to the SEO root domain when a
 *    Cloudflare Worker is proxying the page from allaboutultrasound.com.
 *
 * Proxy detection: the Cloudflare Worker sends an `x-canonical-host` header
 * containing the root domain (e.g. "allaboutultrasound.com"). When present,
 * canonical URLs are built against that host instead of the app subdomain.
 *
 * For real browsers the SPA loads normally — no change in behaviour.
 */

import type { Express, Request } from "express";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { funnels, funnelPages, lmsCourses, lmsLandingPages, workshops, digitalProducts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "../_core/env";

function escapeHtml(str: string): string {
  return str
    // Strip newlines and tabs — they break HTML attribute values and cause visible text overflow
    // when the regex replacement fails to match across line boundaries
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Resolve the canonical host for a request.
 * Priority:
 *  1. x-canonical-host header set by the Cloudflare Worker
 *  2. CANONICAL_ROOT_DOMAIN env var (fallback for server-side config)
 *  3. The actual request host (no proxy — use as-is)
 */
function getCanonicalHost(req: Request): string {
  const cfHeader = req.headers["x-canonical-host"];
  if (cfHeader && typeof cfHeader === "string" && cfHeader.trim()) {
    return cfHeader.trim();
  }
  if (ENV.canonicalRootDomain) {
    return ENV.canonicalRootDomain;
  }
  return req.get("host") ?? "";
}

function buildMetaTags(opts: {
  title: string;
  description: string;
  imageUrl?: string | null;
  canonicalUrl: string;
  pageUrl: string;
}): string {
  const { title, description, imageUrl, canonicalUrl, pageUrl } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = imageUrl ? escapeHtml(imageUrl) : "";
  const canon = escapeHtml(canonicalUrl);
  const ogUrl = escapeHtml(pageUrl);

  return [
    `<title>${t}</title>`,
    `<link rel="canonical" href="${canon}" />`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${ogUrl}" />`,
    `<meta property="og:type" content="website" />`,
    img ? `<meta property="og:image" content="${img}" />` : "",
    img ? `<meta property="og:image:width" content="1200" />` : "",
    img ? `<meta property="og:image:height" content="630" />` : "",
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    img ? `<meta name="twitter:image" content="${img}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

async function getFunnelPageSeo(
  funnelSlug: string,
  pageSlug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [funnel] = await db
      .select({ id: funnels.id, title: funnels.name })
      .from(funnels)
      .where(eq(funnels.slug, funnelSlug))
      .limit(1);
    if (!funnel) return null;

    const [page] = await db
      .select({
        title: funnelPages.title,
        seoTitle: funnelPages.seoTitle,
        seoDescription: funnelPages.seoDescription,
        seoImage: funnelPages.seoImage,
      })
      .from(funnelPages)
      .where(
        and(
          eq(funnelPages.funnelId, funnel.id),
          eq(funnelPages.slug, pageSlug)
        )
      )
      .limit(1);
    if (!page) return null;

    return {
      title: page.seoTitle || page.title || (funnel.title as string),
      description: page.seoDescription || "",
      image: page.seoImage,
    };
  } catch {
    return null;
  }
}

async function getStandalonePageSeo(
  pageSlug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [page] = await db
      .select({
        title: funnelPages.title,
        seoTitle: funnelPages.seoTitle,
        seoDescription: funnelPages.seoDescription,
        seoImage: funnelPages.seoImage,
      })
      .from(funnelPages)
      .where(eq(funnelPages.slug, pageSlug))
      .limit(1);
    if (!page) return null;

    return {
      title: page.seoTitle || page.title,
      description: page.seoDescription || "",
      image: page.seoImage,
    };
  } catch {
    return null;
  }
}

function getIndexHtmlPath(): string {
  if (process.env.NODE_ENV === "development") {
    return path.resolve(process.cwd(), "client", "index.html");
  }
  return path.resolve(process.cwd(), "dist", "public", "index.html");
}

function injectSeoIntoHtml(
  html: string,
  seo: { title: string; description: string; image?: string | null },
  req: Request,
  pathOverride?: string
): string {
  const canonicalHost = getCanonicalHost(req);
  const actualPath = pathOverride ?? req.originalUrl;
  // Canonical URL always uses https on the canonical host
  const canonicalUrl = `https://${canonicalHost}${actualPath}`;
  // OG URL reflects the actual request (may be the subdomain or root)
  const pageUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const metaTags = buildMetaTags({
    title: seo.title,
    description: seo.description,
    imageUrl: seo.image,
    canonicalUrl,
    pageUrl,
  });

  // Mark the HTML element so the client-side brand override script skips its meta rewrites
  html = html.replace(/(<html\b[^>]*)(>)/, '$1 data-page-seo="1"$2');
  // Replace <title> tag
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
  // Replace existing og:title/og:description/og:image in-place so page values win over brand defaults
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.title)}$2`);
  if (seo.description) {
    html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.description)}$2`);
    html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.description)}$2`);
  }
  if (seo.image) {
    html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.image)}$2`);
    html = html.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.image)}$2`);
  }
  // Replace twitter:title/twitter:description too
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.title)}$2`);
  if (seo.description) {
    html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*("[^>]*>)/g, `$1${escapeHtml(seo.description)}$2`);
  }
  // Remove any existing canonical tag before injecting ours
  html = html.replace(/<link\s+rel="canonical"[^>]*\/?>(\.s*)?/gi, "");
  // Append only the tags that are not already present (canonical, og:url, og:type, og:image dims)
  const alreadyHasOgTitle = html.includes('property="og:title"');
  const alreadyHasOgDesc = html.includes('property="og:description"');
  const alreadyHasOgImage = html.includes('property="og:image"');
  const extraTags = buildMetaTags({ title: seo.title, description: seo.description, imageUrl: seo.image, canonicalUrl, pageUrl })
    .split("\n")
    .filter(tag => {
      if (alreadyHasOgTitle && tag.includes('property="og:title"')) return false;
      if (alreadyHasOgDesc && tag.includes('property="og:description"')) return false;
      if (alreadyHasOgImage && (tag.includes('property="og:image"') || tag.includes('og:image:width') || tag.includes('og:image:height'))) return false;
      if (tag.includes('<title>')) return false; // already replaced above
      if (tag.includes('name="description"')) return false; // already replaced above
      if (tag.includes('name="twitter:title"')) return false;
      if (tag.includes('name="twitter:description"')) return false;
      if (tag.includes('name="twitter:image"')) return false;
      return true;
    })
    .join("\n    ");
  if (extraTags.trim()) {
    html = html.replace(
      /<\/head>/,
      `    <!-- Page SEO -->\n    ${extraTags}\n  </head>`
    );
  }
  return html;
}

// ─── Course landing page SEO ────────────────────────────────────────────────
async function getCourseLandingSeo(
  slug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        courseTitle: lmsCourses.title,
        courseSubtitle: lmsCourses.subtitle,
        courseCover: lmsCourses.coverImageUrl,
        courseMetaTitle: lmsCourses.metaTitle,
        courseMetaDescription: lmsCourses.metaDescription,
        lpSeoTitle: lmsLandingPages.seoTitle,
        lpSeoDescription: lmsLandingPages.seoDescription,
        lpSeoImage: lmsLandingPages.seoImage,
      })
      .from(lmsCourses)
      .leftJoin(lmsLandingPages, eq(lmsLandingPages.courseId, lmsCourses.id))
      .where(eq(lmsCourses.slug, slug))
      .limit(1);
    if (!row) return null;
    const title = row.lpSeoTitle || row.courseMetaTitle || row.courseTitle;
    if (!title) return null;
    return {
      title,
      description: row.lpSeoDescription || row.courseMetaDescription || row.courseSubtitle || "",
      image: row.lpSeoImage || row.courseCover,
    };
  } catch (e: any) {
    console.error(`[getCourseLandingSeo] error: ${e.message}`);
    return null;
  }
}

// ─── Workshop landing page SEO ───────────────────────────────────────────────
async function getWorkshopLandingSeo(
  slug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        title: workshops.title,
        subtitle: workshops.subtitle,
        cover: workshops.coverImageUrl,
        metaTitle: workshops.metaTitle,
        seoTitle: workshops.seoTitle,
        seoDescription: workshops.seoDescription,
        seoImage: workshops.seoImage,
      })
      .from(workshops)
      .where(eq(workshops.slug, slug))
      .limit(1);
    if (!row) return null;
    return {
      title: row.seoTitle || row.metaTitle || row.title,
      description: row.seoDescription || row.subtitle || "",
      image: row.seoImage || row.cover,
    };
  } catch {
    return null;
  }
}

// ─── Download/digital product landing page SEO ───────────────────────────────
async function getDownloadLandingSeo(
  slug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        title: digitalProducts.title,
        subtitle: digitalProducts.subtitle,
        metaTitle: digitalProducts.metaTitle,
        seoTitle: digitalProducts.seoTitle,
        seoDescription: digitalProducts.seoDescription,
        seoImage: digitalProducts.seoImage,
      })
      .from(digitalProducts)
      .where(eq(digitalProducts.slug, slug))
      .limit(1);
    if (!row) return null;
    return {
      title: row.seoTitle || row.metaTitle || row.title,
      description: row.seoDescription || row.subtitle || "",
      image: row.seoImage,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve per-page SEO data for a given request path.
 * Returns null when the path does not match a known landing page type.
 */
export async function getPageSeoForRequest(
  req: Request
): Promise<{ title: string; description: string; image?: string | null } | null> {
  const pathname = req.path; // e.g. /courses/live-vascular...
  const courseMatch = pathname.match(/^\/courses\/([^/]+)$/);
  if (courseMatch) return getCourseLandingSeo(courseMatch[1]);
  const workshopMatch = pathname.match(/^\/workshops\/([^/]+)$/);
  if (workshopMatch) return getWorkshopLandingSeo(workshopMatch[1]);
  const downloadMatch = pathname.match(/^\/downloads\/([^/]+)$/);
  if (downloadMatch) return getDownloadLandingSeo(downloadMatch[1]);
  // Standalone pages: /p/:slug
  const standaloneMatch = pathname.match(/^\/p\/([^/]+)$/);
  if (standaloneMatch) return getStandalonePageSeo(standaloneMatch[1]);
  return null;
}

/**
 * Inject per-page SEO tags into an HTML string.
 * Exported for use in the Vite SPA handler (vite.ts).
 */
export function injectPageSeoIntoHtml(
  html: string,
  seo: { title: string; description: string; image?: string | null },
  req: Request,
  pathOverride?: string
): string {
  return injectSeoIntoHtml(html, seo, req, pathOverride);
}

export function registerFunnelOgMetaRoutes(app: Express) {
  // ── Course landing pages: /courses/:slug ──────────────────────────────────
  app.get("/courses/:slug", async (req, res, next) => {
    // Skip non-crawlers (real browsers will get the SPA; only inject for scrapers)
    // We always inject so that og:tags are present for all clients
    const seo = await getCourseLandingSeo(req.params.slug);
    if (!seo) return next();
    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();
    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectSeoIntoHtml(html, seo, req);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });

  // ── Workshop landing pages: /workshops/:slug ──────────────────────────────
  app.get("/workshops/:slug", async (req, res, next) => {
    const seo = await getWorkshopLandingSeo(req.params.slug);
    if (!seo) return next();
    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();
    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectSeoIntoHtml(html, seo, req);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });

  // ── Download landing pages: /downloads/:slug ─────────────────────────────
  app.get("/downloads/:slug", async (req, res, next) => {
    const seo = await getDownloadLandingSeo(req.params.slug);
    if (!seo) return next();
    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();
    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectSeoIntoHtml(html, seo, req);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });

  // ── Funnel pages: /:funnelSlug/:pageSlug ──────────────────────────────────
  app.get("/:funnelSlug/:pageSlug", async (req, res, next) => {
    const seo = await getFunnelPageSeo(req.params.funnelSlug, req.params.pageSlug);
    if (!seo) return next();

    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();

    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectSeoIntoHtml(html, seo, req);

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });

  // ── Standalone landing pages: /p/:pageSlug ────────────────────────────────
  app.get("/p/:pageSlug", async (req, res, next) => {
    const seo = await getStandalonePageSeo(req.params.pageSlug);
    if (!seo) return next();

    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();

    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectSeoIntoHtml(html, seo, req);

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
