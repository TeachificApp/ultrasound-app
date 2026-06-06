export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// ─── AAUS (All About Ultrasound) Thinkific URLs ─────────────────────────────
export const THINKIFIC_FREE_MEMBERSHIP_URL = "https://member.allaboutultrasound.com/enroll/3714918?price_id=4664963";
export const THINKIFIC_FREE_MEMBERSHIP_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-free-member-access";
export const THINKIFIC_PREMIUM_MONTHLY_URL = "/premium";
export const THINKIFIC_PREMIUM_ANNUAL_URL = "/premium";
export const THINKIFIC_PREMIUM_MEMBERSHIP_PAGE = "/premium";
export const THINKIFIC_PREMIUM_PAGE = "/premium";

// ─── iHeartEcho Thinkific URLs ───────────────────────────────────────────────
export const IHE_THINKIFIC_FREE_URL = "https://member.allaboutultrasound.com/enroll/3707211?price_id=4656299";
export const IHE_THINKIFIC_PREMIUM_MONTHLY_URL = "/premium";
export const IHE_THINKIFIC_PREMIUM_ANNUAL_URL = "/premium";

/**
 * Brand-aware helpers — detect hostname and return the correct Thinkific URL.
 */
const isIHE = () => typeof window !== "undefined" && window.location.hostname.toLowerCase().includes("iheartecho");

export const getThinkificFreeUrl = () => {
  const base = isIHE() ? IHE_THINKIFIC_FREE_URL : THINKIFIC_FREE_MEMBERSHIP_URL;
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${base}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

export const getThinkificPremiumMonthlyUrlBrand = () => "/premium";

export const getThinkificPremiumAnnualUrlBrand = () => "/premium";

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
export const getThinkificPremiumMonthlyUrl = () => "/premium";

/**
 * Premium annual enrollment URL with origin-tracking redirect.
 * Users who purchase Premium (annual) are sent back to /enrolled after checkout.
 */
export const getThinkificPremiumAnnualUrl = () => "/premium";

/** Local login page, optionally preserving post-login return path. */
export const getLoginUrl = (returnTo?: string) => {
  if (!returnTo || returnTo === "/login") return "/login";
  const path = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
  return `/login?returnTo=${encodeURIComponent(path)}`;
};
