import { APP_URL, IHEARTECHO_APP_URL, isIHeartEchoDomain } from "@/hooks/useSubdomain";
import { withBrandTag } from "@shared/brandScopedRoutes";
import type { Brand } from "@shared/brands";

function perBrandAppUrl(path: string, brand: Brand): string {
  const taggedPath = withBrandTag(path, brand);
  if (typeof window === "undefined") {
    return `${brand === "iheartecho" ? IHEARTECHO_APP_URL : APP_URL}${taggedPath}`;
  }

  const alreadyOnSelectedHost = brand === "iheartecho"
    ? isIHeartEchoDomain()
    : window.location.hostname === "app.allaboutultrasound.com";

  return alreadyOnSelectedHost
    ? taggedPath
    : `${brand === "iheartecho" ? IHEARTECHO_APP_URL : APP_URL}${taggedPath}`;
}

/** Brand-specific administrator URL, including the selected application host and route tag. */
export function perBrandAdminUrl(path: string, brand: Brand): string {
  return perBrandAppUrl(path, brand);
}

/** User-facing selected-brand URL. Use for cross-brand navigations from administrative tools. */
export function perBrandUserUrl(path: string, brand: Brand): string {
  return perBrandAppUrl(path, brand);
}

/** User-facing path with a brand suffix for in-brand client-side routes. */
export function perBrandUserPath(path: string, brand: Brand): string {
  return withBrandTag(path, brand);
}
