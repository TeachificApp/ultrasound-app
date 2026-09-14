import { buildStudentDashboardUrl } from "@shared/studentDashboardUrls";
import type { SiteNavLinkItem } from "@/hooks/useSiteNavMenu";

/** Canonical all-user dashboard link for quizzes a learner can access. */
export const ALL_USER_QUIZZES_HREF = buildStudentDashboardUrl({
  origin: "relative",
  contentTab: "quizzes",
});

function isQuizNavigationItem(item: SiteNavLinkItem): boolean {
  const normalizedLabel = item.label.trim().toLowerCase();
  if (normalizedLabel === "quizzes" || normalizedLabel === "my quiz results") return true;

  try {
    const href = new URL(item.href, "https://learn.allaboutultrasound.com");
    return href.pathname === "/my-quizzes"
      || href.searchParams.get("contentTab") === "quizzes"
      || href.searchParams.get("tab") === "quizzes";
  } catch {
    return false;
  }
}

/**
 * Quiz discovery belongs only inside My Dashboard → My Content. Strip legacy
 * or CMS-managed quiz links from top and profile navigation until a future
 * explicit navigation request approves one.
 */
export function removeQuizNavigationItems(items: SiteNavLinkItem[]): SiteNavLinkItem[] {
  return items.filter((item) => !isQuizNavigationItem(item));
}
