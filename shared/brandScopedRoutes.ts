/**
 * Brand suffix helpers for per-brand clinical tools (AAUS / iHeartEcho).
 * URLs append `-aaus` or `-ihe` so platform admins on app.allaboutultrasound.com
 * can manage either brand via the `_brand` tRPC query param.
 */

import type { Brand } from "./brands";

export type BrandTag = "aaus" | "ihe";

/** Admin tool base paths (no brand suffix). */
export const PER_BRAND_ADMIN_BASE_PATHS = [
  "/admin/cases",
  "/admin/quickfire",
  "/admin/scancoach",
  "/admin/navigator",
  "/admin/thinkific-webhook",
  "/admin/challenge-cards",
  "/admin/social-content",
  "/admin/soundbytes",
] as const;

/** User-facing learning tools that are brand-scoped. */
export const PER_BRAND_USER_BASE_PATHS = ["/quickfire", "/soundbytes"] as const;

export function brandToTag(brand: Brand): BrandTag {
  return brand === "iheartecho" ? "ihe" : "aaus";
}

export function tagToBrand(tag: BrandTag): Brand {
  return tag === "ihe" ? "iheartecho" : "aaus";
}

/** Strip a trailing `-aaus` or `-ihe` segment from a path. */
export function stripBrandTag(path: string): string {
  if (path.endsWith("-aaus") || path.endsWith("-ihe")) {
    return path.slice(0, path.lastIndexOf("-"));
  }
  return path;
}

/** Append brand tag: `/admin/cases` + `iheartecho` → `/admin/cases-ihe` */
export function withBrandTag(path: string, brand: Brand): string {
  const base = stripBrandTag(path);
  return `${base}-${brandToTag(brand)}`;
}

const BRAND_TAG_RE = /-(aaus|ihe)(?:\/|$)/i;

/** Read brand from pathname when URL contains `-aaus` or `-ihe`. */
export function detectBrandFromPath(pathname: string): Brand | null {
  const lower = pathname.toLowerCase();
  const match = lower.match(BRAND_TAG_RE);
  if (!match) return null;
  return tagToBrand(match[1] as BrandTag);
}

export function isPerBrandAdminPath(path: string): boolean {
  const base = stripBrandTag(path.split("?")[0] ?? path);
  return (PER_BRAND_ADMIN_BASE_PATHS as readonly string[]).includes(base);
}

export function isPerBrandUserPath(path: string): boolean {
  const base = stripBrandTag(path.split("?")[0] ?? path);
  return (PER_BRAND_USER_BASE_PATHS as readonly string[]).includes(base);
}
