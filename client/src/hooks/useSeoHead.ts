/**
 * useSeoHead — industry-standard SEO head tag management
 *
 * Sets document.title, meta description, Open Graph, Twitter Card, canonical URL,
 * and injects/removes a JSON-LD <script> block on mount/unmount.
 *
 * Usage:
 *   useSeoHead({
 *     title: "Abdominal Ultrasound Course",
 *     description: "Learn abdominal scanning protocols...",
 *     image: "https://cdn.example.com/cover.jpg",
 *     canonical: "https://learn.allaboutultrasound.com/courses/abdominal-ultrasound",
 *     type: "article",
 *     jsonLd: { "@type": "Course", ... },
 *   });
 */

import { useEffect } from "react";
import { getSiteMetadataForHostname } from "@shared/siteMetadata";

export interface SeoHeadOptions {
  /** Page title — appended with site name automatically */
  title?: string;
  /** Override the default site name for a dedicated brand experience. */
  siteName?: string;
  /** Set false when title already includes the complete branded title. */
  appendSiteName?: boolean;
  /** Meta description (max ~160 chars for best results) */
  description?: string;
  /** OG image URL — absolute URL required */
  image?: string;
  /** Canonical URL — absolute URL */
  canonical?: string;
  /** OG type — defaults to "website" */
  type?: "website" | "article" | "product";
  /** JSON-LD structured data object — will be serialized and injected */
  jsonLd?: Record<string, unknown> | null;
  /** Additional keywords (comma-separated) */
  keywords?: string;
  /** Twitter card type — defaults to "summary_large_image" */
  twitterCard?: "summary" | "summary_large_image";
  /** Use an explicit account for a page identity on a shared host. */
  twitterSite?: string;
  /** noindex — set true for draft/private pages */
  noindex?: boolean;
}

// Organization-logo default is retained for structured-data builders, not social cards.
const DEFAULT_IMAGE = getSiteMetadataForHostname("app.allaboutultrasound.com")!.favicon;

function setMeta(selector: string, attr: string, value: string) {
  const nodes = document.querySelectorAll<HTMLMetaElement>(selector);
  let el = nodes[0];
  if (!el) {
    el = document.createElement("meta");
    const parts = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (parts) el.setAttribute(parts[1], parts[2]);
    document.head.appendChild(el);
  }
  nodes.forEach((node, index) => { if (index > 0) node.remove(); });
  el.setAttribute(attr, value);
}

function setLink(rel: string, value: string, id?: string) {
  const nodes = document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`);
  let el = nodes[0];
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  nodes.forEach((node, index) => { if (index > 0) node.remove(); });
  if (id) el.setAttribute("data-seo-id", id);
  el.href = value;
}

function setJsonLd(data: Record<string, unknown> | null, id: string) {
  const existing = document.querySelector(`script[data-seo-id="${id}"]`);
  if (!data) { existing?.remove(); return; }
  const el = existing ?? document.createElement("script");
  el.setAttribute("type", "application/ld+json");
  el.setAttribute("data-seo-id", id);
  el.textContent = JSON.stringify({ "@context": "https://schema.org", ...data });
  if (!existing) document.head.appendChild(el);
}

/** Shared server/browser identity; preview query aliases only apply on unknown hosts. */
function getHostMetadata() {
  const hostMetadata = getSiteMetadataForHostname(window.location.hostname);
  if (hostMetadata) return hostMetadata;
  const preview = new URLSearchParams(window.location.search).get("subdomain");
  const previewHosts: Record<string, string> = {
    ultrasoundexpo: "ultrasoundexpo.com", echoexpo: "echocardiographyexpo.com",
    learn: "learn.allaboutultrasound.com", iheartecho: "app.iheartecho.com",
  };
  return getSiteMetadataForHostname(previewHosts[preview ?? ""] ?? "app.allaboutultrasound.com")!;
}

/** Apply a complete, consistent set so navigation cannot leave a mixed-brand card. */
export function applySeoHead(opts: SeoHeadOptions) {
  const defaults = getHostMetadata();
  const siteName = opts.siteName ?? defaults.siteName;
  const fullTitle = opts.title
    ? opts.appendSiteName !== false && siteName ? `${opts.title} | ${siteName}` : opts.title
    : defaults.title;
  const description = opts.description ?? defaults.description;
  const image = new URL(opts.image || defaults.image, window.location.origin).href;
  const canonical = opts.canonical || window.location.origin + window.location.pathname;
  const keywords = opts.keywords ?? defaults.keywords ?? "";
  document.title = fullTitle;
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[name="keywords"]', "content", keywords);
  setMeta('meta[name="robots"]', "content", opts.noindex ? "noindex,nofollow" : "index,follow");
  setMeta('meta[property="og:title"]', "content", fullTitle);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:type"]', "content", opts.type ?? "website");
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[property="og:site_name"]', "content", siteName);
  setMeta('meta[property="og:url"]', "content", canonical);
  for (const [key, value] of [["width", defaults.imageWidth], ["height", defaults.imageHeight]] as const) {
    const selector = `meta[property="og:image:${key}"]`;
    if (value && (!opts.image || opts.image === defaults.image)) setMeta(selector, "content", String(value));
    else document.querySelectorAll(selector).forEach(el => el.remove());
  }
  setMeta('meta[name="twitter:card"]', "content", opts.twitterCard ?? "summary_large_image");
  setMeta('meta[name="twitter:title"]', "content", fullTitle);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image"]', "content", image);
  const twitterSite = opts.twitterSite ?? (siteName === defaults.siteName ? defaults.twitterSite : undefined);
  if (twitterSite) setMeta('meta[name="twitter:site"]', "content", twitterSite);
  else document.querySelectorAll('meta[name="twitter:site"]').forEach(el => el.remove());
  setLink("canonical", canonical, "seo-canonical");
  setJsonLd(opts.jsonLd ?? null, "seo-jsonld");
}

export function useSeoHead(opts: SeoHeadOptions) {
  useEffect(() => {
    applySeoHead(opts);
    return () => { applySeoHead({}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.title, opts.siteName, opts.appendSiteName, opts.description, opts.image, opts.canonical,
    opts.type, opts.keywords, opts.noindex, opts.twitterCard, opts.twitterSite,
    JSON.stringify(opts.jsonLd),
  ]);
}

// ── JSON-LD builders ──────────────────────────────────────────────────────────

export function buildCourseJsonLd(opts: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  provider?: string;
  datePublished?: string;
  price?: number;
  currency?: string;
}) {
  return {
    "@type": "Course",
    name: opts.name,
    description: opts.description ?? "",
    url: opts.url,
    image: opts.image ?? "",
    provider: {
      "@type": "Organization",
      name: opts.provider ?? "All About Ultrasound™",
      sameAs: "https://www.allaboutultrasound.com",
    },
    ...(opts.price !== undefined && {
      offers: {
        "@type": "Offer",
        price: (opts.price / 100).toFixed(2),
        priceCurrency: opts.currency ?? "USD",
        availability: "https://schema.org/InStock",
      },
    }),
  };
}

export function buildProductJsonLd(opts: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  price?: number;
  currency?: string;
}) {
  return {
    "@type": "Product",
    name: opts.name,
    description: opts.description ?? "",
    image: opts.image ?? "",
    url: opts.url,
    brand: {
      "@type": "Brand",
      name: "All About Ultrasound™",
    },
    ...(opts.price !== undefined && {
      offers: {
        "@type": "Offer",
        price: (opts.price / 100).toFixed(2),
        priceCurrency: opts.currency ?? "USD",
        availability: "https://schema.org/InStock",
        url: opts.url,
      },
    }),
  };
}

export function buildArticleJsonLd(opts: {
  headline: string;
  description?: string;
  image?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}) {
  return {
    "@type": "Article",
    headline: opts.headline,
    description: opts.description ?? "",
    image: opts.image ?? "",
    url: opts.url,
    datePublished: opts.datePublished ?? new Date().toISOString(),
    dateModified: opts.dateModified ?? new Date().toISOString(),
    author: {
      "@type": "Person",
      name: opts.authorName ?? "All About Ultrasound™",
    },
    publisher: {
      "@type": "Organization",
      name: "All About Ultrasound™",
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_IMAGE,
      },
    },
  };
}

export function buildWebinarJsonLd(opts: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  startDate?: string;
  endDate?: string;
  isOnline?: boolean;
}) {
  return {
    "@type": "Event",
    name: opts.name,
    description: opts.description ?? "",
    image: opts.image ?? "",
    url: opts.url,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: opts.isOnline !== false
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    ...(opts.startDate && { startDate: opts.startDate }),
    ...(opts.endDate && { endDate: opts.endDate }),
    organizer: {
      "@type": "Organization",
      name: "All About Ultrasound™",
      url: "https://www.allaboutultrasound.com",
    },
  };
}
