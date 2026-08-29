import { buildStudentDashboardUrl } from "@shared/studentDashboardUrls";
import type { SiteNavLinkItem } from "@/hooks/useSiteNavMenu";

/** Canonical all-user dashboard link for quizzes a learner can access. */
export const ALL_USER_QUIZZES_HREF = buildStudentDashboardUrl({
  origin: "relative",
  contentTab: "quizzes",
});

function isQuizNavigationItem(item: SiteNavLinkItem): boolean {
  if (item.label.trim().toLowerCase() === "quizzes") return true;

  try {
    const href = new URL(item.href, "https://learn.allaboutultrasound.com");
    return href.searchParams.get("contentTab") === "quizzes" || href.searchParams.get("tab") === "quizzes";
  } catch {
    return false;
  }
}

/**
 * Keeps Quizzes available even when a CMS-managed header overrides the default
 * navigation. My Quiz Results remains a separate, results-only menu item.
 */
export function ensureAllUserQuizzesNavigation(items: SiteNavLinkItem[]): SiteNavLinkItem[] {
  if (items.some(isQuizNavigationItem)) return items;
  return [...items, { label: "Quizzes", href: ALL_USER_QUIZZES_HREF }];
}
