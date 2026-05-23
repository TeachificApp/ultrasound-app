/**
 * useSubdomain — Detect whether the app is running on a specific subdomain.
 * Returns { isLearnSubdomain, isIHeartEchoSubdomain, isMembersSubdomain, isCombinedBranding }
 * based on window.location.hostname.
 *
 * LMS subdomain hostnames:
 *   - learn.allaboutultrasound.com (production)
 *   - Any hostname starting with "learn."
 *
 * Members subdomain hostnames:
 *   - members.allaboutultrasound.com (current — combined AAUS | iHeartEcho branding)
 *   - member.allaboutultrasound.com  (future — after Thinkific migration)
 *
 * iHeartEcho subdomain hostnames:
 *   - app.iheartecho.net (production — primary)
 *   - app.iheartecho.com (legacy — keep detecting so old links still work)
 *   - iheartecho-etvpnuid.manus.space (staging)
 *   - Any hostname containing "iheartecho" (EXCEPT accreditation.iheartecho.com)
 *
 * Accreditation subdomain hostnames:
 *   - accreditation.iheartecho.com (production)
 *   - Any hostname starting with "accreditation."
 *
 * Combined branding (learn + members) shows "All About Ultrasound | iHeartEcho".
 *
 * For local development, you can test by adding ?subdomain=learn or ?subdomain=iheartecho
 * or ?subdomain=members or ?subdomain=accreditation to the URL.
 */
import { useMemo } from "react";

const LEARN_HOSTNAMES = [
  "learn.allaboutultrasound.com",
];

const MEMBERS_HOSTNAMES = [
  "members.allaboutultrasound.com",
  "member.allaboutultrasound.com",
];

const IHEARTECHO_HOSTNAMES = [
  "app.iheartecho.net",   // primary production domain
  "app.iheartecho.com",   // legacy — keep detecting so old links still work
  "iheartecho-etvpnuid.manus.space",
];

const ACCREDITATION_HOSTNAMES = [
  "accreditation.iheartecho.com",
];

/** The canonical iHeartEcho app URL — used for all outbound links */
export const IHEARTECHO_APP_URL = "https://app.iheartecho.net";
/** The canonical learn subdomain — course/quiz/download/product player access only */
export const LEARN_APP_URL = "https://learn.allaboutultrasound.com";
/** The canonical members subdomain — profile, dashboard, subscriptions */
export const MEMBERS_APP_URL = "https://members.allaboutultrasound.com";
/** The canonical root domain — landing pages, education library, funnels (Cloudflare proxied) */
export const ROOT_DOMAIN_URL = "https://allaboutultrasound.com";

export function useSubdomain() {
  const isLearnSubdomain = useMemo(() => isLearnDomain(), []);
  const isIHeartEchoSubdomain = useMemo(() => isIHeartEchoDomain(), []);
  const isMembersSubdomain = useMemo(() => isMembersDomain(), []);
  const isAccreditationSubdomain = useMemo(() => isAccreditationDomain(), []);
  /** Combined branding applies to learn and members subdomains */
  const isCombinedBranding = useMemo(() => isLearnDomain() || isMembersDomain(), []);

  return { isLearnSubdomain, isIHeartEchoSubdomain, isMembersSubdomain, isAccreditationSubdomain, isCombinedBranding };
}

/**
 * Non-hook versions for use outside React components (e.g., in route config).
 */
export function isLearnDomain(): boolean {
  const hostname = window.location.hostname;
  if (LEARN_HOSTNAMES.includes(hostname)) return true;
  if (hostname.startsWith("learn.")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("subdomain") === "learn") return true;
  return false;
}

export function isMembersDomain(): boolean {
  const hostname = window.location.hostname;
  if (MEMBERS_HOSTNAMES.includes(hostname)) return true;
  if (hostname.startsWith("members.") || hostname.startsWith("member.")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("subdomain") === "members") return true;
  return false;
}

export function isAccreditationDomain(): boolean {
  const hostname = window.location.hostname;
  if (ACCREDITATION_HOSTNAMES.includes(hostname)) return true;
  if (hostname.startsWith("accreditation.")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("subdomain") === "accreditation") return true;
  return false;
}

export function isIHeartEchoDomain(): boolean {
  // accreditation.iheartecho.com is NOT the iHeartEcho app — it's the accreditation division
  if (isAccreditationDomain()) return false;
  const hostname = window.location.hostname;
  if (IHEARTECHO_HOSTNAMES.includes(hostname)) return true;
  if (hostname.includes("iheartecho")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("subdomain") === "iheartecho") return true;
  return false;
}

/** Check if current domain uses combined "All About Ultrasound | iHeartEcho" branding */
export function isCombinedBrandingDomain(): boolean {
  return isLearnDomain() || isMembersDomain();
}
