/**
 * Resolve legacy Manus CloudFront / storage:// URLs to Railway/R2-served paths.
 * Used by client (via /manus-storage proxy) and server (direct R2 public URL when configured).
 */

const AAUS_CDN_PREFIX =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/";

const AAUS_TENANT = "UrcfdRVE8J6mpMNR48QuFe";

const LEGACY_CDN_ROOT = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434";

/** Reconstruct the legacy Manus CloudFront URL for a manus-storage / R2 object key. */
export function legacyCloudFrontUrlForStorageKey(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  if (normalized.includes("/")) {
    return `${LEGACY_CDN_ROOT}/${normalized}`;
  }
  return `${LEGACY_CDN_ROOT}/${AAUS_TENANT}/${normalized}`;
}

/** Extract the R2/manus-storage object key from a legacy asset URL. */
export function extractManusStorageKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/manus-storage/")) {
    return trimmed.slice("/manus-storage/".length);
  }

  if (trimmed.startsWith("storage://")) {
    return trimmed.slice("storage://".length).replace(/^\/+/, "");
  }

  if (trimmed.startsWith(AAUS_CDN_PREFIX)) {
    return trimmed.slice(AAUS_CDN_PREFIX.length);
  }

  const aausMatch = trimmed.match(new RegExp(`${AAUS_TENANT}/(.+)$`));
  if (aausMatch?.[1]) return aausMatch[1];

  // Other Manus tenants (e.g. iHeartEcho) keep tenant folder + filename in R2
  if (trimmed.includes("cloudfront.net/") || trimmed.includes("310519663401463434/")) {
    const parts = trimmed.split("/");
    if (parts.length >= 2) return parts.slice(-2).join("/");
  }

  return null;
}

/** Rewrite legacy CDN/storage refs to a loadable URL for this deployment. */
export function resolveAssetUrl(
  url: string | null | undefined,
  r2PublicBase?: string | null,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/manus-storage/")) return trimmed;

  if (trimmed.startsWith("/api/media/") || trimmed.startsWith("/media/")) return trimmed;

  if (/^data:/i.test(trimmed)) return trimmed;

  const r2Base = r2PublicBase?.replace(/\/+$/, "") ?? null;
  if (r2Base && trimmed.startsWith(r2Base + "/")) return trimmed;

  if (/\.r2\.dev\//.test(trimmed)) return trimmed;

  const key = extractManusStorageKey(trimmed);
  if (key) {
    if (r2Base) return `${r2Base}/${key.replace(/^\/+/, "")}`;
    return `/manus-storage/${key.replace(/^\/+/, "")}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;

  return trimmed;
}
