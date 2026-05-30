/**
 * Shared brand definitions used by both server and client.
 * This file lives in /shared/ so it can be imported from either side.
 */

export type Brand = "aaus" | "iheartecho";

export const BRAND_DOMAINS: Record<string, Brand> = {
  "app.allaboutultrasound.com": "aaus",
  "allaboutultrasound.com": "aaus",
  "learn.allaboutultrasound.com": "aaus",
  "members.allaboutultrasound.com": "aaus",  // current subdomain (will become member. after Thinkific migration)
  "member.allaboutultrasound.com": "aaus",   // future subdomain
  "app.iheartecho.com": "iheartecho",
  "iheartecho.com": "iheartecho",
  "app.iheartecho.net": "iheartecho",
  "iheartecho.net": "iheartecho",
  "accreditation.iheartecho.com": "iheartecho",
};

export const ALL_BRANDS: Brand[] = ["aaus", "iheartecho"];

/**
 * BrandMode determines the visual branding context:
 * - "aaus"       → app.allaboutultrasound.com — All About Ultrasound branding only
 * - "iheartecho" → app.iheartecho.com — iHeartEcho branding only
 * - "combined"   → learn/members.allaboutultrasound.com — "All About Ultrasound | iHeartEcho" combined branding
 */
export type BrandMode = "aaus" | "iheartecho" | "combined";

/** Detect the base brand from hostname (for data/auth purposes) */
export function detectBrandFromHostname(hostname: string): Brand {
  const h = hostname.toLowerCase();
  if (h.includes("iheartecho")) return "iheartecho";
  return "aaus";
}

/** Detect the brand mode from hostname (for visual branding/messaging) */
export function detectBrandMode(hostname: string): BrandMode {
  const h = hostname.toLowerCase();
  if (h.includes("iheartecho")) return "iheartecho";
  if (h.includes("learn.") || h.includes("members.") || h.includes("member.")) return "combined";
  return "aaus";
}

/** Brand display config for emails and UI */
export interface BrandDisplayConfig {
  brandMode: BrandMode;
  displayName: string;
  shortName: string;
  tagline: string;
  senderEmail: string;
  senderName: string;
  supportEmail: string;
  websiteUrl: string;
  appUrl: string;
  logoUrl: string;
  primaryColor: string;
  darkColor: string;
  accentColor: string;
}

const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
const IHE_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/iheartecho_logo_ring_01cc7ccd.webp";

export function getBrandDisplayConfig(mode: BrandMode): BrandDisplayConfig {
  switch (mode) {
    case "iheartecho":
      return {
        brandMode: "iheartecho",
        displayName: "iHeartEcho™",
        shortName: "iHeartEcho™",
        tagline: "Echocardiography Clinical Intelligence",
        senderEmail: "noreply@iheartecho.com",
        senderName: "iHeartEcho™",
        supportEmail: "support@iheartecho.com",
        websiteUrl: "https://www.iheartecho.com",
        appUrl: "https://app.iheartecho.net",
        logoUrl: IHE_LOGO,
        primaryColor: "#189aa1",
        darkColor: "#0e1e2e",
        accentColor: "#4ad9e0",
      };
    case "combined":
      return {
        brandMode: "combined",
        displayName: "All About Ultrasound | iHeartEcho™",
        shortName: "All About Ultrasound",
        tagline: "General, Vascular & Cardiac Ultrasound Clinical Intelligence",
        senderEmail: "noreply@allaboutultrasound.com",
        senderName: "All About Ultrasound | iHeartEcho™",
        supportEmail: "support@allaboutultrasound.com",
        websiteUrl: "https://www.allaboutultrasound.com",
        appUrl: "https://app.allaboutultrasound.com",
        logoUrl: AAUS_LOGO,
        primaryColor: "#189aa1",
        darkColor: "#0e1e2e",
        accentColor: "#4ad9e0",
      };
    case "aaus":
    default:
      return {
        brandMode: "aaus",
        displayName: "All About Ultrasound\u2122",
        shortName: "All About Ultrasound",
        tagline: "General & Vascular Ultrasound Clinical Intelligence",
        senderEmail: "noreply@allaboutultrasound.com",
        senderName: "All About Ultrasound\u2122",
        supportEmail: "support@allaboutultrasound.com",
        websiteUrl: "https://www.allaboutultrasound.com",
        appUrl: "https://app.allaboutultrasound.com",
        logoUrl: AAUS_LOGO,
        primaryColor: "#189aa1",
        darkColor: "#0e1e2e",
        accentColor: "#4ad9e0",
      };
  }
}
