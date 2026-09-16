import { detectBrandFromPath } from "@shared/brandScopedRoutes";
import { detectBrandFromHostname, getBrandDisplayConfig, type Brand } from "@shared/brands";

export type BrandToolPresentation = {
  brand: Brand;
  displayName: string;
  shortName: string;
  tagline: string;
  appUrl: string;
  appHost: string;
  logoUrl: string;
  primaryColor: string;
  darkColor: string;
  accentColor: string;
  challengeLabel: string;
  socialHashtags: string[];
};

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
    logoUrl: config.logoUrl,
    primaryColor: config.primaryColor,
    darkColor: config.darkColor,
    accentColor: config.accentColor,
    challengeLabel: isIHeartEcho ? "Daily Echocardiography Challenge" : "Daily Ultrasound Challenge",
    socialHashtags: isIHeartEcho
      ? ["#iHeartEcho", "#Echocardiography", "#CardiacUltrasound", "#EchoEducation", "#DailyChallenge"]
      : ["#AllAboutUltrasound", "#UltrasoundAssist", "#Ultrasound", "#DailyChallenge", "#Sonography"],
  };
}
