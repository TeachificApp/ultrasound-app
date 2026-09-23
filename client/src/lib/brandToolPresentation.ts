import { detectBrandFromPath } from "@shared/brandScopedRoutes";
import { detectBrandFromHostname, getBrandDisplayConfig, type Brand } from "@shared/brands";

export type BrandToolPresentation = {
  brand: Brand;
  displayName: string;
  shortName: string;
  tagline: string;
  appUrl: string;
  appHost: string;
  publicUrl: string;
  publicHost: string;
  logoUrl: string;
  /** Logo source used only for the video outro. */
  outroLogoUrl: string;
  /** Optional transparent-looking circular crop for an opaque square app icon. */
  outroLogoShape?: "circle";
  primaryColor: string;
  darkColor: string;
  accentColor: string;
  challengeLabel: string;
  socialHashtags: string[];
};

/** Baseline tags required on every Social Post and Quiz Card Generator caption. */
export const STANDARD_SOCIAL_HASHTAGS = [
  "#AllAboutUltrasound",
  "#iHeartEcho",
  "#Ultrasound",
  "#Sonographer",
  "#Sonography",
  "#UltrasoundEducation",
] as const;

export function resolveToolBrand(pathname: string, hostname: string): Brand {
  return detectBrandFromPath(pathname) ?? detectBrandFromHostname(hostname);
}

export function getBrandToolPresentation(brand: Brand): BrandToolPresentation {
  const config = getBrandDisplayConfig(brand);
  const isIHeartEcho = brand === "iheartecho";
  return {
    brand,
    displayName: config.displayName,
    shortName: config.shortName,
    tagline: config.tagline,
    appUrl: config.appUrl,
    appHost: new URL(config.appUrl).hostname,
    publicUrl: config.websiteUrl,
    publicHost: new URL(config.websiteUrl).hostname,
    logoUrl: config.logoUrl,
    outroLogoUrl: config.logoUrl,
    outroLogoShape: isIHeartEcho ? "circle" : undefined,
    primaryColor: config.primaryColor,
    darkColor: config.darkColor,
    accentColor: config.accentColor,
    challengeLabel: isIHeartEcho ? "Daily Echocardiography Challenge" : "Daily Ultrasound Challenge",
    socialHashtags: [...STANDARD_SOCIAL_HASHTAGS],
  };
}
