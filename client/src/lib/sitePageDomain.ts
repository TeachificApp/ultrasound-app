/**
 * Resolve the site_pages / site_nav_menus domain key for the current host.
 */
import { SITE_PAGE_DOMAINS, type SitePageDomain } from "@shared/sitePagesConstants";
import {
  isLearnDomain,
  isMembersDomain,
  isIHeartEchoDomain,
  isAccreditationDomain,
  isMarketingStagingDomain,
} from "@/hooks/useSubdomain";

const DOMAIN_VALUES = new Set<string>(SITE_PAGE_DOMAINS.map((d) => d.value));

export function getSitePageDomain(): SitePageDomain | string {
  const host = window.location.hostname.toLowerCase();

  if (DOMAIN_VALUES.has(host)) {
    return host as SitePageDomain;
  }

  if (isLearnDomain()) return "learn.allaboutultrasound.com";
  if (isMembersDomain()) return "members.allaboutultrasound.com";
  if (isAccreditationDomain()) return "accreditation.iheartecho.com";
  if (host === "app.iheartecho.net") return "app.iheartecho.net";
  if (isIHeartEchoDomain()) return "app.iheartecho.com";
  if (isMarketingStagingDomain()) return "allaboutultrasound.com";

  if (host === "app.allaboutultrasound.com" || host.startsWith("app.")) {
    return "app.allaboutultrasound.com";
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("siteDomain");
    if (forced && DOMAIN_VALUES.has(forced)) return forced;
    if (isLearnDomain()) return "learn.allaboutultrasound.com";
    return "app.allaboutultrasound.com";
  }

  return host;
}
