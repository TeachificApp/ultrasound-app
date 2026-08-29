/** Labels for post-purchase / post-subscribe CTAs (admin-configured buttons resolve to these when user already has access). */

export const SUBSCRIPTION_RESUME_LABEL = "Resume";
export const PURCHASE_ACCESS_LABEL = "Access";

export function subscriptionResumeHref(membershipSlug: string): string {
  return `/my-memberships/${membershipSlug}`;
}

export function courseResumeHref(courseSlug: string): string {
  return `/courses/${courseSlug}/player`;
}

export function downloadAccessHref(downloadSlug: string): string {
  return `/downloads/${downloadSlug}/files`;
}

export function bundleAccessHref(): string {
  return "/my-courses";
}

export function productAccessHref(): string {
  return "/my-dashboard";
}

export function premiumResumeHref(brand: "aaus" | "iheartecho"): string {
  return brand === "iheartecho" ? "/iheartecho" : "/";
}
