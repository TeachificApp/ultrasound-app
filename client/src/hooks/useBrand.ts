/**
 * Brand detection for multi-tenant architecture.
 * Detects whether the user is on the AAUS or iHeartEcho app based on hostname.
 */

export type Brand = "aaus" | "iheartecho";

export interface BrandConfig {
  brand: Brand;
  name: string;
  shortName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  domain: string;
  logoText: string;
}

const BRAND_CONFIGS: Record<Brand, BrandConfig> = {
  aaus: {
    brand: "aaus",
    name: "All About Ultrasound™",
    shortName: "All About Ultrasound",
    tagline: "General & Vascular Ultrasound Clinical Intelligence",
    primaryColor: "#0d9488", // teal-600
    accentColor: "#14b8a6", // teal-500
    domain: "app.allaboutultrasound.com",
    logoText: "UltrasoundAssist™",
  },
  iheartecho: {
    brand: "iheartecho",
    name: "iHeartEcho™",
    shortName: "iHeartEcho",
    tagline: "Echocardiography Clinical Intelligence",
    primaryColor: "#189aa1", // teal brand
    accentColor: "#4ad9e0", // aqua accent
    domain: "app.iheartecho.com",
    logoText: "EchoAssist™",
  },
};

/** Detect brand from current hostname */
export function detectBrand(): Brand {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes("iheartecho")) return "iheartecho";
  return "aaus";
}

/** Get the full brand config for the current hostname */
export function getBrandConfig(): BrandConfig {
  return BRAND_CONFIGS[detectBrand()];
}

/** Hook to get brand info (stable — hostname doesn't change during session) */
export function useBrand(): BrandConfig {
  return getBrandConfig();
}
