import { getBrandDisplayConfig, type BrandMode } from "@shared/brands";
import { isCombinedBrandingDomain, isIHeartEchoDomain } from "@/hooks/useSubdomain";

export function getAuthPageBrandMode(): BrandMode {
  if (isIHeartEchoDomain()) return "iheartecho";
  if (isCombinedBrandingDomain()) return "combined";
  return "aaus";
}

export function getAuthPageLogoUrl(): string {
  const mode = getAuthPageBrandMode();
  const brandLogo = getBrandDisplayConfig(mode).logoUrl;
  if (mode === "iheartecho") return brandLogo;
  const envLogo = import.meta.env.VITE_APP_LOGO as string | undefined;
  return envLogo?.trim() || brandLogo;
}

export function getAuthPageBrandName(): string {
  return getBrandDisplayConfig(getAuthPageBrandMode()).displayName;
}
