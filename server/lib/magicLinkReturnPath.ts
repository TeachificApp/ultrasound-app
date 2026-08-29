import { normalizeLegacyStudentDashboardLocation } from "../../shared/studentDashboardUrls";

const DEFAULT_MAGIC_LINK_RETURN_PATH = "/my-dashboard";

const SAFE_PREFIXES = [
  "/my-dashboard",
  "/dashboard",
  "/courses",
  "/course/",
  "/content",
  "/lessons/",
  "/lesson/",
  "/quiz",
  "/quizzes",
  "/profile",
  "/subscriptions",
  "/downloads",
  "/certificates",
  "/community",
  "/teach",
];

/** Keep magic-link redirects inside valid learner application routes, never old marketing or funnel paths. */
export function resolveMagicLinkReturnPath(rawReturnPath?: string | null): string {
  if (!rawReturnPath || !rawReturnPath.startsWith("/") || rawReturnPath.startsWith("//")) {
    return DEFAULT_MAGIC_LINK_RETURN_PATH;
  }
  let parsed: URL;
  try {
    parsed = new URL(rawReturnPath, "https://learner.local");
  } catch {
    return DEFAULT_MAGIC_LINK_RETURN_PATH;
  }
  const safePath = SAFE_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(prefix));
  if (!safePath) return DEFAULT_MAGIC_LINK_RETURN_PATH;
  if (parsed.pathname === "/dashboard" || parsed.pathname.startsWith("/dashboard/")) {
    const legacyDashboard = normalizeLegacyStudentDashboardLocation(parsed.pathname, parsed.search);
    if (legacyDashboard) return legacyDashboard;
  } else if (parsed.pathname === "/my-dashboard" && parsed.search) {
    const normalized = normalizeLegacyStudentDashboardLocation(parsed.pathname, parsed.search);
    if (normalized) return normalized;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
