import type { Request } from "express";
import { getSiteMetadataForHostname, normalizeMetadataHostname } from "../../shared/siteMetadata";
export { getSiteMetadataForHostname, normalizeMetadataHostname } from "../../shared/siteMetadata";
export type { SiteMetadata } from "../../shared/siteMetadata";

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

/** Resolve the original public hostname, not a reverse proxy's internal service. */
export function getMetadataRequestHostname(req: Pick<Request, "hostname" | "headers" | "get">): string {
  const headers = req.headers ?? {};
  const candidates = [
    headerValue(headers["x-app-hostname"]),
    headerValue(headers["x-public-hostname"]),
    headerValue(headers["x-canonical-host"]),
    headerValue(headers["x-forwarded-host"]),
    req.get?.("host") ?? "",
    req.hostname ?? "",
  ].map(normalizeMetadataHostname);
  return candidates.find((host) => Boolean(getSiteMetadataForHostname(host))) ?? candidates.find(Boolean) ?? "";
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function upsertTag(html: string, matcher: RegExp, tag: string): string {
  let found = false;
  const result = html.replace(matcher, () => {
    if (found) return "";
    found = true;
    return tag;
  });
  return found ? result : result.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function metaMatcher(attribute: "name" | "property", key: string): RegExp {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<meta\\s+[^>]*\\b${attribute}=["']${escapedKey}["'][^>]*>`, "gi");
}

function upsertMetaTag(html: string, attribute: "name" | "property", key: string, content: string): string {
  return upsertTag(html, metaMatcher(attribute, key), `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(content)}" />`);
}

function upsertCanonicalLink(html: string, canonical: string): string {
  return upsertTag(html, /<link\s+[^>]*\brel=["']canonical["'][^>]*>/gi, `<link rel="canonical" href="${escapeHtmlAttribute(canonical)}" />`);
}

function upsertIconLink(html: string, rel: "icon" | "apple-touch-icon", href: string): string {
  return upsertTag(html, new RegExp(`<link\\s+[^>]*\\brel=["']${rel}["'][^>]*>`, "gi"), `<link rel="${rel}" href="${escapeHtmlAttribute(href)}" />`);
}

/** Applied to HTML on the server: social crawlers do not execute the browser bootstrap. */
export function injectSiteMetadataIntoHtml(html: string, hostname: string, requestPath = "/"): string {
  const host = normalizeMetadataHostname(hostname);
  const metadata = getSiteMetadataForHostname(host);
  if (!metadata || !host) return html;
  const path = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  const canonical = `https://${host}${path}`;
  let result = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttribute(metadata.title)}</title>`);
  if (!/<html\b[^>]*\bdata-site-metadata=/i.test(result)) {
    result = result.replace(/(<html\b[^>]*)(>)/i, '$1 data-site-metadata="1"$2');
  }
  result = upsertMetaTag(result, "name", "description", metadata.description);
  result = upsertMetaTag(result, "name", "keywords", metadata.keywords ?? "");
  result = upsertMetaTag(result, "property", "og:title", metadata.title);
  result = upsertMetaTag(result, "property", "og:description", metadata.description);
  result = upsertMetaTag(result, "property", "og:type", "website");
  result = upsertMetaTag(result, "property", "og:url", canonical);
  result = upsertMetaTag(result, "property", "og:image", metadata.image);
  result = upsertMetaTag(result, "property", "og:image:alt", metadata.title);
  for (const [key, value] of [["width", metadata.imageWidth], ["height", metadata.imageHeight]] as const) {
    result = value
      ? upsertMetaTag(result, "property", `og:image:${key}`, String(value))
      : result.replace(metaMatcher("property", `og:image:${key}`), "");
  }
  result = upsertMetaTag(result, "property", "og:site_name", metadata.siteName);
  result = upsertMetaTag(result, "name", "twitter:card", "summary_large_image");
  result = upsertMetaTag(result, "name", "twitter:title", metadata.title);
  result = upsertMetaTag(result, "name", "twitter:description", metadata.description);
  result = upsertMetaTag(result, "name", "twitter:image", metadata.image);
  result = metadata.twitterSite
    ? upsertMetaTag(result, "name", "twitter:site", metadata.twitterSite)
    : result.replace(metaMatcher("name", "twitter:site"), "");
  result = upsertMetaTag(result, "name", "theme-color", metadata.themeColor);
  result = upsertMetaTag(result, "name", "apple-mobile-web-app-title", metadata.appTitle);
  result = upsertIconLink(result, "icon", metadata.favicon);
  result = upsertIconLink(result, "apple-touch-icon", metadata.favicon);
  return upsertCanonicalLink(result, canonical);
}
