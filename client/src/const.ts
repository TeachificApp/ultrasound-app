export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// ─── AAUS (All About Ultrasound) Thinkific URLs ─────────────────────────────
export const THINKIFIC_FREE_MEMBERSHIP_URL = "https://member.allaboutultrasound.com/enroll/3714918?price_id=4664963";
export const THINKIFIC_FREE_MEMBERSHIP_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-free-member-access";
export const THINKIFIC_PREMIUM_MONTHLY_URL = "https://member.allaboutultrasound.com/enroll/3714929?price_id=4664974";
export const THINKIFIC_PREMIUM_ANNUAL_URL = "https://member.allaboutultrasound.com/enroll/3714929?price_id=4664977";
export const THINKIFIC_PREMIUM_MEMBERSHIP_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-premium-membership";
export const THINKIFIC_PREMIUM_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-premium-membership";

// ─── iHeartEcho Thinkific URLs ───────────────────────────────────────────────
export const IHE_THINKIFIC_FREE_URL = "https://member.allaboutultrasound.com/enroll/3707211?price_id=4656299";
export const IHE_THINKIFIC_PREMIUM_MONTHLY_URL = "https://member.allaboutultrasound.com/enroll/3703267?price_id=4651832";
export const IHE_THINKIFIC_PREMIUM_ANNUAL_URL = "https://member.allaboutultrasound.com/enroll/3703267?price_id=4656275";

/**
 * Brand-aware helpers — detect hostname and return the correct Thinkific URL.
 */
const isIHE = () => typeof window !== "undefined" && window.location.hostname.toLowerCase().includes("iheartecho");

export const getThinkificFreeUrl = () => {
  const base = isIHE() ? IHE_THINKIFIC_FREE_URL : THINKIFIC_FREE_MEMBERSHIP_URL;
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${base}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

export const getThinkificPremiumMonthlyUrlBrand = () => {
  const base = isIHE() ? IHE_THINKIFIC_PREMIUM_MONTHLY_URL : THINKIFIC_PREMIUM_MONTHLY_URL;
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${base}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

export const getThinkificPremiumAnnualUrlBrand = () => {
  const base = isIHE() ? IHE_THINKIFIC_PREMIUM_ANNUAL_URL : THINKIFIC_PREMIUM_ANNUAL_URL;
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${base}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

/**
 * Free membership enrollment URL with origin-tracking redirect.
 * Users who start from UltrasoundAssist are sent back to /enrolled after completing
 * the Thinkific free enrollment, via Thinkific's redirect_url parameter.
 */
export const getThinkificFreeEnrollUrl = () => {
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${THINKIFIC_FREE_MEMBERSHIP_URL}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

/**
 * Premium monthly enrollment URL with origin-tracking redirect.
 * Users who purchase Premium are sent back to /enrolled after checkout.
 */
export const getThinkificPremiumMonthlyUrl = () => {
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${THINKIFIC_PREMIUM_MONTHLY_URL}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

/**
 * Premium annual enrollment URL with origin-tracking redirect.
 * Users who purchase Premium (annual) are sent back to /enrolled after checkout.
 */
export const getThinkificPremiumAnnualUrl = () => {
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${THINKIFIC_PREMIUM_ANNUAL_URL}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

// Return the local magic-link login page.
export const getLoginUrl = () => "/login";
