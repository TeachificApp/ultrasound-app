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
import {
  funnels,
  funnelPages,
  lmsCourses,
  lmsLandingPages,
  workshops,
  digitalProducts,
  physicalProducts,
  bundles,
  webinars,
  marketingSitePages,
  membershipPlans,
  communities,
  ultrasoundExpoEventPages,
  ultrasoundExpoEvents,
  sitePages,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "../_core/env";
import {
  getUltrasoundExpoEditorPage,
  ULTRASOUND_EXPO_SITE_DOMAIN,
} from "../../shared/ultrasoundExpo";
import {
  getMetadataRequestHostname,
  getSiteMetadataForHostname,
} from "../lib/siteMetadata";
import { getPublicSiteTenantForHost } from "../../shared/publicSiteTenants";

function escapeHtml(str: string): string {
  return (
    str
      // Strip newlines and tabs — they break HTML attribute values and cause visible text overflow
      // when the regex replacement fails to match across line boundaries
      .replace(/[\r\n\t]+/g, " ")
      .replace(/ {2,}/g, " ")
      .trim()
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  );
}

/**
 * Resolve the canonical host for a request.
 * Priority:
 *  1. x-canonical-host header set by the Cloudflare Worker
 *  2. CANONICAL_ROOT_DOMAIN env var (fallback for server-side config)
 *  3. The actual request host (no proxy — use as-is)
 */
function getCanonicalHost(req: Request): string {
  const requestHost = getMetadataRequestHostname(req);
  // Expo uses its own canonical site; never inherit a general platform root.
  if (
    requestHost === "ultrasoundexpo.com" ||
    requestHost === "www.ultrasoundexpo.com"
  ) {
    return ULTRASOUND_EXPO_SITE_DOMAIN;
  }
  if (
    requestHost === "echocardiographyexpo.com" ||
    requestHost === "www.echocardiographyexpo.com" ||
    requestHost === "echoexpo.iheartecho.com"
  ) {
    return "echoexpo.iheartecho.com";
  }
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
  keywords?: string | null;
  canonicalUrl: string;
  pageUrl: string;
}): string {
  const { title, description, imageUrl, keywords, canonicalUrl, pageUrl } =
    opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = imageUrl ? escapeHtml(imageUrl) : "";
  const canon = escapeHtml(canonicalUrl);
  const ogUrl = escapeHtml(pageUrl);

  return [
    `<title>${t}</title>`,
    `<link rel="canonical" href="${canon}" />`,
    `<meta name="description" content="${d}" />`,
    keywords
      ? `<meta name="keywords" content="${escapeHtml(keywords)}" />`
      : "",
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
): Promise<PageSeo | null> {
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
        seoKeywords: funnelPages.seoKeywords,
        seoImage: funnelPages.seoImage,
      })
      .from(funnelPages)
      .where(
        and(eq(funnelPages.funnelId, funnel.id), eq(funnelPages.slug, pageSlug))
      )
      .limit(1);
    if (!page) return null;

    return {
      title: page.seoTitle || page.title || (funnel.title as string),
      description: page.seoDescription || "",
      keywords: page.seoKeywords || null,
      image: page.seoImage,
    };
  } catch {
    return null;
  }
}

async function getStandalonePageSeo(pageSlug: string): Promise<PageSeo | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [page] = await db
      .select({
        title: funnelPages.title,
        seoTitle: funnelPages.seoTitle,
        seoDescription: funnelPages.seoDescription,
        seoKeywords: funnelPages.seoKeywords,
        seoImage: funnelPages.seoImage,
      })
      .from(funnelPages)
      .where(eq(funnelPages.slug, pageSlug))
      .limit(1);
    if (!page) return null;

    return {
      title: page.seoTitle || page.title,
      description: page.seoDescription || "",
      keywords: page.seoKeywords || null,
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

type PageSeo = {
  title: string;
  description: string;
  keywords?: string | null;
  image?: string | null;
};

function absoluteAssetUrl(
  asset: string | null | undefined,
  req: Request
): string | null {
  if (!asset) return null;
  if (/^https?:\/\//i.test(asset)) return asset;
  return `https://${getCanonicalHost(req)}${asset.startsWith("/") ? asset : `/${asset}`}`;
}

function injectSeoIntoHtml(
  html: string,
  seo: PageSeo,
  req: Request,
  pathOverride?: string
): string {
  const canonicalHost = getCanonicalHost(req);
  const actualPath = pathOverride ?? req.originalUrl;
  // Canonical URL always uses https on the canonical host
  const canonicalUrl = `https://${canonicalHost}${actualPath}`;
  // OG URL reflects the actual request (may be the subdomain or root)
  const pageUrl =
    canonicalHost === ULTRASOUND_EXPO_SITE_DOMAIN
      ? canonicalUrl
      : `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const metaTags = buildMetaTags({
    title: seo.title,
    description: seo.description,
    imageUrl: absoluteAssetUrl(seo.image, req),
    keywords: seo.keywords,
    canonicalUrl,
    pageUrl,
  });

  // Mark the HTML element so the client-side brand override script skips its meta rewrites
  html = html.replace(/(<html\b[^>]*)(>)/, '$1 data-page-seo="1"$2');
  // Replace <title> tag
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(seo.title)}</title>`
  );
  // Replace existing og:title/og:description/og:image in-place so page values win over brand defaults
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*("[^>]*>)/g,
    `$1${escapeHtml(seo.title)}$2`
  );
  if (seo.description) {
    html = html.replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*("[^>]*>)/g,
      `$1${escapeHtml(seo.description)}$2`
    );
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*("[^>]*>)/g,
      `$1${escapeHtml(seo.description)}$2`
    );
  }
  if (seo.keywords) {
    html = html.replace(
      /(<meta\s+name="keywords"\s+content=")[^"]*("[^>]*>)/g,
      `$1${escapeHtml(seo.keywords)}$2`
    );
  }
  // Replace a generic host-level preview URL with the canonical page URL.
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*("[^>]*>)/g,
    `$1${escapeHtml(pageUrl)}$2`
  );
  const absoluteImage = absoluteAssetUrl(seo.image, req);
  if (absoluteImage) {
    html = html.replace(
      /(<meta\s+property="og:image"\s+content=")[^"]*("[^>]*>)/g,
      `$1${escapeHtml(absoluteImage)}$2`
    );
    html = html.replace(
      /(<meta\s+name="twitter:image"\s+content=")[^"]*("[^>]*>)/g,
      `$1${escapeHtml(absoluteImage)}$2`
    );
  }
  // Replace twitter:title/twitter:description too
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*("[^>]*>)/g,
    `$1${escapeHtml(seo.title)}$2`
  );
  if (seo.description) {
    html = html.replace(
      /(<meta\s+name="twitter:description"\s+content=")[^"]*("[^>]*>)/g,
      `$1${escapeHtml(seo.description)}$2`
    );
  }
  // Remove any existing canonical tag before injecting ours
  html = html.replace(/<link\s+rel="canonical"[^>]*\/?>(\s*)?/gi, "");
  // Append only the tags that are not already present (canonical, og:url, og:type, og:image dims)
  const alreadyHasOgTitle = html.includes('property="og:title"');
  const alreadyHasOgDesc = html.includes('property="og:description"');
  const alreadyHasOgImage = html.includes('property="og:image"');
  const alreadyHasOgType = html.includes('property="og:type"');
  const alreadyHasKeywords = html.includes('name="keywords"');
  const extraTags = buildMetaTags({
    title: seo.title,
    description: seo.description,
    imageUrl: absoluteImage,
    keywords: seo.keywords,
    canonicalUrl,
    pageUrl,
  })
    .split("\n")
    .filter(tag => {
      if (alreadyHasOgTitle && tag.includes('property="og:title"'))
        return false;
      if (alreadyHasOgDesc && tag.includes('property="og:description"'))
        return false;
      if (
        alreadyHasOgImage &&
        (tag.includes('property="og:image"') ||
          tag.includes("og:image:width") ||
          tag.includes("og:image:height"))
      )
        return false;
      if (tag.includes('property="og:url"')) return false;
      if (alreadyHasOgType && tag.includes('property="og:type"')) return false;
      if (tag.includes("<title>")) return false; // already replaced above
      if (tag.includes('name="description"')) return false; // already replaced above
      if (alreadyHasKeywords && tag.includes('name="keywords"')) return false;
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
async function getCourseLandingSeo(slug: string): Promise<PageSeo | null> {
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
        lpSeoKeywords: lmsLandingPages.seoKeywords,
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
      description:
        row.lpSeoDescription ||
        row.courseMetaDescription ||
        row.courseSubtitle ||
        "",
      keywords: row.lpSeoKeywords || null,
      image: row.lpSeoImage || row.courseCover,
    };
  } catch (e: any) {
    console.error(`[getCourseLandingSeo] error: ${e.message}`);
    return null;
  }
}

// ─── Workshop landing page SEO ───────────────────────────────────────────────
async function getWorkshopLandingSeo(slug: string): Promise<PageSeo | null> {
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
        metaKeywords: workshops.metaKeywords,
        seoImage: workshops.seoImage,
      })
      .from(workshops)
      .where(eq(workshops.slug, slug))
      .limit(1);
    if (!row) return null;
    return {
      title: row.seoTitle || row.metaTitle || row.title,
      description: row.seoDescription || row.subtitle || "",
      keywords: row.metaKeywords || null,
      image: row.seoImage || row.cover,
    };
  } catch {
    return null;
  }
}

// ─── Download/digital product landing page SEO ───────────────────────────────
async function getDownloadLandingSeo(slug: string): Promise<PageSeo | null> {
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
        metaKeywords: digitalProducts.metaKeywords,
        seoImage: digitalProducts.seoImage,
      })
      .from(digitalProducts)
      .where(eq(digitalProducts.slug, slug))
      .limit(1);
    if (!row) return null;
    return {
      title: row.seoTitle || row.metaTitle || row.title,
      description: row.seoDescription || row.subtitle || "",
      keywords: row.metaKeywords || null,
      image: row.seoImage,
    };
  } catch {
    return null;
  }
}

async function getUltrasoundExpoSeo(req: Request): Promise<PageSeo | null> {
  const host = getMetadataRequestHostname(req);
  if (host !== "ultrasoundexpo.com" && host !== "www.ultrasoundexpo.com")
    return null;

  const pathname = req.path.replace(/^\/+|\/+$/g, "");
  const slug = pathname || "home";
  const definition = getUltrasoundExpoEditorPage(slug);
  if (!definition) return null;

  try {
    const db = await getDb();
    if (db) {
      const [page] = await db
        .select({
          seoTitle: sitePages.seoTitle,
          seoDescription: sitePages.seoDescription,
          seoKeywords: sitePages.seoKeywords,
          seoImage: sitePages.seoImage,
        })
        .from(sitePages)
        .where(
          and(
            eq(sitePages.domain, ULTRASOUND_EXPO_SITE_DOMAIN),
            eq(sitePages.slug, slug),
            eq(sitePages.status, "published")
          )
        )
        .limit(1);
      if (page) {
        return {
          title: page.seoTitle || definition.seo.title,
          description: page.seoDescription || definition.seo.description,
          keywords: page.seoKeywords || null,
          image: page.seoImage || definition.seo.image,
        };
      }
    }
  } catch (error: any) {
    console.error(`[getUltrasoundExpoSeo] ${error.message}`);
  }

  // Keep social previews correctly branded while an editor record is being
  // provisioned or during an isolated database recovery.
  return definition.seo;
}

const ECHO_EXPO_PAGE_SEO: Record<
  string,
  { title: string; description: string }
> = {
  home: {
    title: "EchoExpo™ | The Echocardiography Experience at UltrasoundExpo™",
    description:
      "EchoExpo™ brings cardiac ultrasound education, Echo Skills, Echo Games, hands-on CME, innovation, and a dedicated exhibit hall to Orlando, January 14–16, 2028.",
  },
  attend: {
    title: "Attend EchoExpo™ | Cardiac Ultrasound Event Information",
    description:
      "Explore the EchoExpo™ attendee experience for cardiac ultrasound and echocardiography professionals.",
  },
  exhibit: {
    title: "Exhibit at EchoExpo™ | Reach the Cardiac Imaging Community",
    description:
      "Put your organization in front of cardiac ultrasound and echocardiography professionals at EchoExpo™.",
  },
  sponsor: {
    title: "Sponsor EchoExpo™ | Cardiac Ultrasound Event Partnerships",
    description:
      "Build meaningful visibility with cardiac imaging professionals through EchoExpo™ sponsorship opportunities.",
  },
  program: {
    title: "EchoExpo™ Program | Cardiac Education, Skills, and Innovation",
    description:
      "Explore the developing EchoExpo™ program for echocardiography education, Echo Skills, hands-on learning, and community.",
  },
  expo: {
    title: "EchoExpo™ Exhibit Hall | Cardiac Imaging Innovation",
    description:
      "Discover the dedicated EchoExpo™ exhibit hall for cardiac imaging technology, education, and innovation.",
  },
  connect: {
    title: "Connect at EchoExpo™ | The Cardiac Ultrasound Community",
    description:
      "Meet the cardiac ultrasound professionals, educators, innovators, and organizations shaping what comes next at EchoExpo™.",
  },
  about: {
    title: "About EchoExpo™ | The Cardiac Experience at UltrasoundExpo™",
    description:
      "Learn about EchoExpo™, the dedicated echocardiography and cardiac ultrasound experience within UltrasoundExpo™.",
  },
  register: {
    title: "EchoExpo™ Attendee Registration Coming Soon",
    description: "Attendee registration for EchoExpo™ is coming soon.",
  },
};

function getEchoExpoSeo(
  req: Request
): { title: string; description: string; image?: string | null } | null {
  const host = getMetadataRequestHostname(req);
  const siteMetadata = getSiteMetadataForHostname(host);
  if (siteMetadata?.siteName !== "EchoExpo™") return null;

  const pathname = req.path.replace(/^\/+|\/+$/g, "");
  const slug = pathname || "home";
  const page = ECHO_EXPO_PAGE_SEO[slug];
  if (!page) return null;
  return { ...page, image: siteMetadata.image };
}

async function getMembershipSeo(req: Request): Promise<PageSeo | null> {
  const match = req.path.match(/^\/memberships\/([^/]+)$/);
  if (!match) return null;
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        title: membershipPlans.title,
        subtitle: membershipPlans.subtitle,
        description: membershipPlans.description,
        cover: membershipPlans.coverImage,
        metaTitle: membershipPlans.metaTitle,
        metaDescription: membershipPlans.metaDescription,
        seoKeywords: membershipPlans.seoKeywords,
        seoImage: membershipPlans.seoImage,
      })
      .from(membershipPlans)
      .where(
        and(
          eq(membershipPlans.slug, match[1]),
          eq(membershipPlans.status, "published")
        )
      )
      .limit(1);
    return row
      ? {
          title: row.metaTitle || row.title,
          description:
            row.metaDescription || row.subtitle || row.description || "",
          keywords: row.seoKeywords || null,
          image: row.seoImage || row.cover || null,
        }
      : null;
  } catch (error: any) {
    console.error(`[getMembershipSeo] ${error.message}`);
    return null;
  }
}

async function getCommunitySeo(req: Request): Promise<PageSeo | null> {
  const match = req.path.match(/^\/community\/([^/]+)$/);
  if (!match) return null;
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        title: communities.title,
        description: communities.description,
        cover: communities.coverImage,
        seoTitle: communities.seoTitle,
        seoDescription: communities.seoDescription,
        seoKeywords: communities.seoKeywords,
        seoImage: communities.seoImage,
      })
      .from(communities)
      .where(
        and(
          eq(communities.slug, match[1]),
          eq(communities.status, "published"),
          eq(communities.privacy, "public")
        )
      )
      .limit(1);
    return row
      ? {
          title: row.seoTitle || row.title,
          description: row.seoDescription || row.description || "",
          keywords: row.seoKeywords || null,
          image: row.seoImage || row.cover || null,
        }
      : null;
  } catch (error: any) {
    console.error(`[getCommunitySeo] ${error.message}`);
    return null;
  }
}

async function getSitePageSeo(req: Request): Promise<PageSeo | null> {
  const path = req.path.replace(/^\/+|\/+$/g, "");
  // The internal site-page CMS currently owns single-segment page routes only.
  if (!path || path.includes("/")) return null;
  try {
    const db = await getDb();
    if (!db) return null;
    const host = getMetadataRequestHostname(req);
    const [row] = await db
      .select({
        title: sitePages.title,
        seoTitle: sitePages.seoTitle,
        seoDescription: sitePages.seoDescription,
        seoKeywords: sitePages.seoKeywords,
        seoImage: sitePages.seoImage,
      })
      .from(sitePages)
      .where(
        and(
          eq(sitePages.domain, host),
          eq(sitePages.slug, path.toLowerCase()),
          eq(sitePages.status, "published")
        )
      )
      .limit(1);
    return row
      ? {
          title: row.seoTitle || row.title,
          description: row.seoDescription || "",
          keywords: row.seoKeywords || null,
          image: row.seoImage || null,
        }
      : null;
  } catch (error: any) {
    console.error(`[getSitePageSeo] ${error.message}`);
    return null;
  }
}

async function getExpoEventPageSeo(req: Request): Promise<PageSeo | null> {
  const match = req.path.match(/^\/events\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  try {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({
        eventName: ultrasoundExpoEvents.name,
        pageTitle: ultrasoundExpoEventPages.title,
        seoTitle: ultrasoundExpoEventPages.seoTitle,
        seoDescription: ultrasoundExpoEventPages.seoDescription,
        seoKeywords: ultrasoundExpoEventPages.seoKeywords,
        seoImage: ultrasoundExpoEventPages.seoImage,
      })
      .from(ultrasoundExpoEventPages)
      .innerJoin(
        ultrasoundExpoEvents,
        eq(ultrasoundExpoEventPages.eventId, ultrasoundExpoEvents.id)
      )
      .where(
        and(
          eq(ultrasoundExpoEvents.slug, match[1]),
          eq(ultrasoundExpoEvents.status, "published"),
          eq(ultrasoundExpoEventPages.slug, match[2]),
          eq(ultrasoundExpoEventPages.status, "published"),
          eq(ultrasoundExpoEventPages.accessLevel, "public")
        )
      )
      .limit(1);
    return row
      ? {
          title: row.seoTitle || row.pageTitle || row.eventName,
          description: row.seoDescription || "",
          keywords: row.seoKeywords || null,
          image: row.seoImage || null,
        }
      : null;
  } catch (error: any) {
    console.error(`[getExpoEventPageSeo] ${error.message}`);
    return null;
  }
}

async function getPublicContentSeo(req: Request): Promise<PageSeo | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const product = req.path.match(/^\/products\/([^/]+)$/);
    const bundle = req.path.match(/^\/bundles\/([^/]+)$/);
    const webinar = req.path.match(/^\/webinars\/([^/]+)$/);
    if (product) {
      const [row] = await db
        .select({
          title: physicalProducts.title,
          subtitle: physicalProducts.subtitle,
          metaTitle: physicalProducts.metaTitle,
          seoTitle: physicalProducts.seoTitle,
          seoDescription: physicalProducts.seoDescription,
          metaKeywords: physicalProducts.metaKeywords,
          seoImage: physicalProducts.seoImage,
          thumbnail: physicalProducts.thumbnailUrl,
        })
        .from(physicalProducts)
        .where(eq(physicalProducts.slug, product[1]))
        .limit(1);
      return row
        ? {
            title: row.seoTitle || row.metaTitle || row.title,
            description: row.seoDescription || row.subtitle || "",
            keywords: row.metaKeywords,
            image: row.seoImage || row.thumbnail,
          }
        : null;
    }
    if (bundle) {
      const [row] = await db
        .select({
          title: bundles.title,
          subtitle: bundles.subtitle,
          metaTitle: bundles.metaTitle,
          metaDescription: bundles.metaDescription,
          metaKeywords: bundles.metaKeywords,
          seoImage: bundles.seoImage,
          cover: bundles.coverImage,
        })
        .from(bundles)
        .where(eq(bundles.slug, bundle[1]))
        .limit(1);
      return row
        ? {
            title: row.metaTitle || row.title,
            description: row.metaDescription || row.subtitle || "",
            keywords: row.metaKeywords,
            image: row.seoImage || row.cover,
          }
        : null;
    }
    if (webinar) {
      const [row] = await db
        .select({
          title: webinars.title,
          subtitle: webinars.subtitle,
          metaTitle: webinars.metaTitle,
          metaDescription: webinars.metaDescription,
          seoKeywords: webinars.seoKeywords,
          seoImage: webinars.seoImage,
          cover: webinars.coverImage,
        })
        .from(webinars)
        .where(eq(webinars.slug, webinar[1]))
        .limit(1);
      return row
        ? {
            title: row.metaTitle || row.title,
            description: row.metaDescription || row.subtitle || "",
            keywords: row.seoKeywords,
            image: row.seoImage || row.cover,
          }
        : null;
    }
    const tenant = getPublicSiteTenantForHost(getMetadataRequestHostname(req));
    if (tenant) {
      const [row] = await db
        .select({
          title: marketingSitePages.title,
          seoTitle: marketingSitePages.seoTitle,
          seoDescription: marketingSitePages.seoDescription,
          seoKeywords: marketingSitePages.seoKeywords,
          seoImage: marketingSitePages.seoImage,
        })
        .from(marketingSitePages)
        .where(
          and(
            eq(marketingSitePages.siteKey, tenant.key),
            eq(marketingSitePages.path, req.path),
            eq(marketingSitePages.isPublished, true),
            eq(marketingSitePages.visibility, "public")
          )
        )
        .limit(1);
      return row
        ? {
            title: row.seoTitle || row.title || tenant.siteName,
            description: row.seoDescription || "",
            keywords: row.seoKeywords,
            image: row.seoImage,
          }
        : null;
    }
  } catch (error: any) {
    console.error(`[getPublicContentSeo] ${error.message}`);
  }
  return null;
}

/**
 * Resolve per-page SEO data for a given request path.
 * Returns null when the path does not match a known landing page type.
 */
export async function getPageSeoForRequest(
  req: Request
): Promise<PageSeo | null> {
  const expoSeo = await getUltrasoundExpoSeo(req);
  if (expoSeo) return expoSeo;
  const echoExpoSeo = getEchoExpoSeo(req);
  if (echoExpoSeo) return echoExpoSeo;
  const eventPageSeo = await getExpoEventPageSeo(req);
  if (eventPageSeo) return eventPageSeo;
  const sitePageSeo = await getSitePageSeo(req);
  if (sitePageSeo) return sitePageSeo;
  const membershipSeo = await getMembershipSeo(req);
  if (membershipSeo) return membershipSeo;
  const communitySeo = await getCommunitySeo(req);
  if (communitySeo) return communitySeo;
  const pathname = req.path; // e.g. /courses/live-vascular...
  const courseMatch = pathname.match(/^\/courses\/([^/]+)$/);
  if (courseMatch) return getCourseLandingSeo(courseMatch[1]);
  const workshopMatch = pathname.match(/^\/workshops\/([^/]+)$/);
  if (workshopMatch) return getWorkshopLandingSeo(workshopMatch[1]);
  const downloadMatch = pathname.match(/^\/downloads\/([^/]+)$/);
  if (downloadMatch) return getDownloadLandingSeo(downloadMatch[1]);
  const contentSeo = await getPublicContentSeo(req);
  if (contentSeo) return contentSeo;
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
  seo: PageSeo,
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
    const seo = await getFunnelPageSeo(
      req.params.funnelSlug,
      req.params.pageSlug
    );
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
