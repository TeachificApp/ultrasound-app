import { useMemo } from "react";
import { useLocation } from "wouter";
import { detectBrandFromPath } from "@shared/brandScopedRoutes";
import type { Brand } from "@shared/brands";
import { getBrandDisplayConfig } from "@shared/brands";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

/** Resolve admin brand from `-aaus` / `-ihe` URL suffix, then hostname fallback. */
export function useAdminBrand(): Brand {
  const [location] = useLocation();
  return useMemo(
    () => detectBrandFromPath(location) ?? (isIHeartEchoDomain() ? "iheartecho" : "aaus"),
    [location],
  );
}

export function getAdminBrandLabel(brand: Brand): string {
  return getBrandDisplayConfig(brand).displayName;
}
