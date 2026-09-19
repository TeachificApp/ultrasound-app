import type { Brand } from "./brands";

export type PublicSiteTenantKey = "aaus-net" | "iheartecho-net";

export type PublicSiteTenant = {
  key: PublicSiteTenantKey;
  brand: Brand;
  siteName: string;
  /** Current review/launch hostname. Kept noindex until the .com promotion. */
  currentHost: string;
  /** Final public hostname used at the controlled promotion step. */
  promotionHost: string;
  /** Existing public source used by the administrator-controlled importer. */
  sourceOrigin: string;
  /** Canonical blog index path retained from the source site. */
  blogIndexPath: string;
  /** Source path prefix used to identify article rows during import. */
  blogPathPrefix: string;
};

export const PUBLIC_SITE_TENANTS: readonly PublicSiteTenant[] = [
  {
    key: "aaus-net",
    brand: "aaus",
    siteName: "All About Ultrasound™",
    currentHost: "www.allaboutultrasound.net",
    promotionHost: "www.allaboutultrasound.com",
    sourceOrigin: "https://www.allaboutultrasound.com",
    blogIndexPath: "/making-waves-blog.html",
    blogPathPrefix: "/making-waves-blog/",
  },
  {
    key: "iheartecho-net",
    brand: "iheartecho",
    siteName: "iHeartEcho™",
    currentHost: "www.iheartecho.net",
    promotionHost: "www.iheartecho.com",
    sourceOrigin: "https://www.iheartecho.com",
    blogIndexPath: "/echoblog.html",
    blogPathPrefix: "/echoblog/",
  },
] as const;

export const PUBLIC_SITE_TENANT_KEYS = PUBLIC_SITE_TENANTS.map((tenant) => tenant.key) as [
  PublicSiteTenantKey,
  ...PublicSiteTenantKey[],
];

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().split(":")[0]!.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getPublicSiteTenant(key: PublicSiteTenantKey | string): PublicSiteTenant | null {
  return PUBLIC_SITE_TENANTS.find((tenant) => tenant.key === key) ?? null;
}

export function getPublicSiteTenantForBrand(brand: Brand): PublicSiteTenant {
  return PUBLIC_SITE_TENANTS.find((tenant) => tenant.brand === brand) ?? PUBLIC_SITE_TENANTS[0]!;
}

/** Matches both the temporary .net host and its eventual .com promotion host. */
export function getPublicSiteTenantForHost(hostname: string): PublicSiteTenant | null {
  const host = normalizeHost(hostname);
  return PUBLIC_SITE_TENANTS.find(
    (tenant) => host === tenant.currentHost || host === tenant.promotionHost,
  ) ?? null;
}

export function isPublicSiteHost(hostname: string): boolean {
  return getPublicSiteTenantForHost(hostname) !== null;
}

/** .net hosts are intentionally non-indexed until the matching .com promotion. */
export function isPublicSiteStagingHost(hostname: string): boolean {
  const tenant = getPublicSiteTenantForHost(hostname);
  return Boolean(tenant && normalizeHost(hostname) === tenant.currentHost);
}

export function publicSiteOrigin(tenant: PublicSiteTenant, mode: "current" | "promotion" = "current"): string {
  return `https://${mode === "promotion" ? tenant.promotionHost : tenant.currentHost}`;
}

/**
 * The .net review hosts canonically reference the existing .com public URLs.
 * After DNS promotion the same source data self-canonicalizes on the .com host.
 */
export function canonicalPublicSiteOrigin(tenant: PublicSiteTenant, hostname?: string): string {
  return isPublicSiteStagingHost(hostname ?? tenant.currentHost)
    ? publicSiteOrigin(tenant, "promotion")
    : publicSiteOrigin(tenant, "promotion");
}

export function publicSiteAdminPath(brand: Brand): string {
  return `/admin/public-site-${brand === "iheartecho" ? "ihe" : "aaus"}`;
}

export function publicSiteTargetForSourceHost(hostname: string): PublicSiteTenant | null {
  const host = normalizeHost(hostname).replace(/^www\./, "");
  if (host === "allaboutultrasound.com") return getPublicSiteTenant("aaus-net");
  if (host === "iheartecho.com" || host === "iheartecho.net") return getPublicSiteTenant("iheartecho-net");
  return null;
}
