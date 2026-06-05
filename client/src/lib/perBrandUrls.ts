import { getAdminUrl } from "@/hooks/useSubdomain";
import { withBrandTag } from "@shared/brandScopedRoutes";
import type { Brand } from "@shared/brands";

/** Absolute or relative admin URL with `-aaus` / `-ihe` suffix for tRPC brand scoping. */
export function perBrandAdminUrl(path: string, brand: Brand): string {
  return getAdminUrl(withBrandTag(path, brand));
}

/** User-facing path with brand suffix (relative). */
export function perBrandUserPath(path: string, brand: Brand): string {
  return withBrandTag(path, brand);
}
