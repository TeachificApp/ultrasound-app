/** Staging replica of www.allaboutultrasound.com — NOT indexed, NOT production. */
export const MARKETING_STAGING_HOST = "site.allaboutultrasound.com";
export const MARKETING_SOURCE_ORIGIN = "https://www.allaboutultrasound.com";
export const MARKETING_SOURCE_HOST = "www.allaboutultrasound.com";
export const MARKETING_SITE_KEY = "aau-staging";

export function isMarketingStagingHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return h === MARKETING_STAGING_HOST || h === "site.allaboutultrasound.com";
}

/** Map a source URL path to staging path (preserve Weebly .html structure). */
export function sourceUrlToPath(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    let p = u.pathname || "/";
    if (p === "/index.html" || p === "/home.html") p = "/";
    if (!p.startsWith("/")) p = `/${p}`;
    return p;
  } catch {
    return "/";
  }
}

/** Rewrite internal AAU links to staging host for review. */
export function rewriteLinkForStaging(href: string, stagingOrigin = `https://${MARKETING_STAGING_HOST}`): string {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  try {
    const u = new URL(href, MARKETING_SOURCE_ORIGIN);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "allaboutultrasound.com" || host.endsWith(".allaboutultrasound.com")) {
      if (host.startsWith("member.") || host.startsWith("learn.") || host.startsWith("app.") || host.startsWith("store.")) {
        return u.href;
      }
      return `${stagingOrigin}${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* keep relative */
    if (href.startsWith("/")) return `${stagingOrigin}${href}`;
  }
  return href;
}
