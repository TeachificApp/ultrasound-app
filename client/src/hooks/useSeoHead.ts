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
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";

export interface SeoHeadOptions {
  /** Page title — appended with site name automatically */
  title?: string;
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
  /** noindex — set true for draft/private pages */
  noindex?: boolean;
}

const SITE_NAME = "All About Ultrasound™ | iHeartEcho™";
const DEFAULT_IMAGE = resolveAssetUrl(
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
)!;
const DEFAULT_TITLE = "UltrasoundAssist™ — Clinical Ultrasound App";
const DEFAULT_DESC = "UltrasoundAssist™ by All About Ultrasound — clinical protocols, ScanCoach, Navigator, POCUS-Assist, Fetal Echo, flashcards, and case library for ultrasound professionals.";

function setMeta(selector: string, attr: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const parts = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (parts) el.setAttribute(parts[1], parts[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setLink(rel: string, value: string, id?: string) {
  const selector = id ? `link[data-seo-id="${id}"]` : `link[rel="${rel}"]`;
  let el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (id) el.setAttribute("data-seo-id", id);
    document.head.appendChild(el);
  }
  el.href = value;
}

function removeLink(id: string) {
  document.querySelector(`link[data-seo-id="${id}"]`)?.remove();
}

function setJsonLd(data: Record<string, unknown> | null, id: string) {
  const existing = document.querySelector(`script[data-seo-id="${id}"]`);
  if (!data) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement("script");
  el.setAttribute("type", "application/ld+json");
  el.setAttribute("data-seo-id", id);
  el.textContent = JSON.stringify({ "@context": "https://schema.org", ...data });
  if (!existing) document.head.appendChild(el);
}

export function useSeoHead(opts: SeoHeadOptions) {
  useEffect(() => {
    const {
      title,
      description = DEFAULT_DESC,
      image = DEFAULT_IMAGE,
      canonical,
      type = "website",
      jsonLd = null,
      keywords,
      twitterCard = "summary_large_image",
      noindex = false,
    } = opts;

    // ── Title ────────────────────────────────────────────────────────────────
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    document.title = fullTitle;

    // ── Basic meta ───────────────────────────────────────────────────────────
    setMeta('meta[name="description"]', "content", description);
    if (keywords) setMeta('meta[name="keywords"]', "content", keywords);
    if (noindex) {
      setMeta('meta[name="robots"]', "content", "noindex,nofollow");
    } else {
      setMeta('meta[name="robots"]', "content", "index,follow");
    }

    // ── Open Graph ───────────────────────────────────────────────────────────
    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:type"]', "content", type);
    setMeta('meta[property="og:image"]', "content", image);
    setMeta('meta[property="og:image:width"]', "content", "1200");
    setMeta('meta[property="og:image:height"]', "content", "630");
    setMeta('meta[property="og:site_name"]', "content", SITE_NAME);
    if (canonical) setMeta('meta[property="og:url"]', "content", canonical);

    // ── Twitter Card ─────────────────────────────────────────────────────────
    setMeta('meta[name="twitter:card"]', "content", twitterCard);
    setMeta('meta[name="twitter:title"]', "content", fullTitle);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", image);
    setMeta('meta[name="twitter:site"]', "content", "@allaboutultrasound");

    // ── Canonical ────────────────────────────────────────────────────────────
    if (canonical) {
      setLink("canonical", canonical, "seo-canonical");
    } else {
      removeLink("seo-canonical");
    }

    // ── JSON-LD ──────────────────────────────────────────────────────────────
    setJsonLd(jsonLd, "seo-jsonld");

    // ── Cleanup: restore defaults on unmount ─────────────────────────────────
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', "content", DEFAULT_DESC);
      setMeta('meta[property="og:title"]', "content", DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', "content", DEFAULT_DESC);
      setMeta('meta[property="og:type"]', "content", "website");
      setMeta('meta[property="og:image"]', "content", DEFAULT_IMAGE);
      setMeta('meta[name="robots"]', "content", "index,follow");
      removeLink("seo-canonical");
      setJsonLd(null, "seo-jsonld");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.title, opts.description, opts.image, opts.canonical,
    opts.type, opts.keywords, opts.noindex, opts.twitterCard,
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
