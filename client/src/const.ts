export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Thinkific Free Membership enrollment — all new user registrations go here
export const THINKIFIC_FREE_MEMBERSHIP_URL = "https://member.allaboutultrasound.com/enroll/3714918?price_id=4664963";
export const THINKIFIC_FREE_MEMBERSHIP_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-free-member-access";

// Thinkific Premium Membership enrollment
export const THINKIFIC_PREMIUM_MONTHLY_URL = "https://member.allaboutultrasound.com/enroll/3714929?price_id=4664974";
export const THINKIFIC_PREMIUM_ANNUAL_URL = "https://member.allaboutultrasound.com/enroll/3714929?price_id=4664977";
export const THINKIFIC_PREMIUM_MEMBERSHIP_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-premium-membership";
export const THINKIFIC_PREMIUM_PAGE = "https://member.allaboutultrasound.com/bundles/ultrasoundassist-app-premium-membership";

/**
 * Free membership enrollment URL with origin-tracking redirect.
 * Users who start from UltrasoundAssist are sent back to /enrolled after completing
 * the Thinkific free enrollment, via Thinkific's redirect_url parameter.
 */
export const getThinkificFreeEnrollUrl = () => {
  const returnUrl = `${window.location.origin}/enrolled`;
  return `${THINKIFIC_FREE_MEMBERSHIP_URL}&redirect_url=${encodeURIComponent(returnUrl)}`;
};

// Return the local magic-link login page.
export const getLoginUrl = () => "/login";
