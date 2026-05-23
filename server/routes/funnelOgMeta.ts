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
import { funnels, funnelPages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "../_core/env";

function escapeHtml(str: string): string {
  return str
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

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
  // Remove any existing canonical tag before injecting ours
  html = html.replace(/<link\s+rel="canonical"[^>]*\/?>(\s*)?/gi, "");
  html = html.replace(
    /<\/head>/,
    `    <!-- Page SEO -->\n    ${metaTags}\n  </head>`
  );
  return html;
}

export function registerFunnelOgMetaRoutes(app: Express) {
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
