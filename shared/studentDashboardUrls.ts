export type StudentDashboardMainTab =
  | "profile"
  | "content"
  | "subscriptions"
  | "purchases"
  | "certificates"
  | "instructor"
  | "revenue_partner";

export type StudentDashboardContentTab =
  | "courses"
  | "quizzes"
  | "downloads"
  | "webinars"
  | "workshops"
  | "products"
  | "bundles"
  | "memberships"
  | "communities";

export const STUDENT_DASHBOARD_MAIN_TABS = new Set<StudentDashboardMainTab>([
  "profile",
  "content",
  "subscriptions",
  "purchases",
  "certificates",
  "instructor",
  "revenue_partner",
]);

export const STUDENT_DASHBOARD_CONTENT_TABS = new Set<StudentDashboardContentTab>([
  "courses",
  "quizzes",
  "downloads",
  "webinars",
  "workshops",
  "products",
  "bundles",
  "memberships",
  "communities",
]);

const LEGACY_CONTENT_TAB_ALIASES: Record<string, StudentDashboardContentTab> = {
  quizzes: "quizzes",
  courses: "courses",
  downloads: "downloads",
  webinars: "webinars",
  workshops: "workshops",
  products: "products",
  bundles: "bundles",
  memberships: "memberships",
  communities: "communities",
  cohorts: "courses",
};

export const APP_STUDENT_DASHBOARD_ORIGIN = "https://app.allaboutultrasound.com";
export const LEARN_APP_ORIGIN = "https://learn.allaboutultrasound.com";
export const STUDENT_DASHBOARD_PATH = "/my-dashboard";

export function buildStudentDashboardUrl(opts?: {
  origin?: typeof APP_STUDENT_DASHBOARD_ORIGIN | typeof LEARN_APP_ORIGIN | "relative";
  tab?: StudentDashboardMainTab;
  contentTab?: StudentDashboardContentTab;
}) {
  const origin = opts?.origin === "relative" ? "" : (opts?.origin ?? APP_STUDENT_DASHBOARD_ORIGIN);
  const params = new URLSearchParams();
  const tab = opts?.tab ?? (opts?.contentTab ? "content" : undefined);
  if (tab) params.set("tab", tab);
  if (opts?.contentTab) params.set("contentTab", opts.contentTab);
  const qs = params.toString();
  return `${origin}/my-dashboard${qs ? `?${qs}` : ""}`;
}

export function buildQuizCoursePlayerUrl(courseSlug: string) {
  return `${LEARN_APP_ORIGIN}/courses/${courseSlug}/player`;
}

const LEGACY_DASHBOARD_SUBPATH_TABS: Record<string, StudentDashboardMainTab> = {
  subscriptions: "subscriptions",
  purchases: "purchases",
  certificates: "certificates",
  profile: "profile",
  content: "content",
  instructor: "instructor",
  revenue_partner: "revenue_partner",
};

/** Map legacy/broken dashboard paths to the current /my-dashboard format. */
export function normalizeLegacyStudentDashboardLocation(pathname: string, search = ""): string | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isLegacyPath =
    normalizedPath === "/dashboard"
    || normalizedPath === "/dashboard/my-content"
    || normalizedPath === "/my-dashboard/my-content";
  const isLegacyDashboardSubpath =
    normalizedPath.startsWith("/dashboard/")
    && normalizedPath !== "/dashboard/my-content";
  if (!isLegacyPath && !isLegacyDashboardSubpath && normalizedPath !== "/my-dashboard") return null;

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawTab = params.get("tab");
  params.delete("tab");

  let tab: StudentDashboardMainTab = "content";
  let contentTab = params.get("contentTab") as StudentDashboardContentTab | null;

  if (rawTab) {
    if (STUDENT_DASHBOARD_MAIN_TABS.has(rawTab as StudentDashboardMainTab)) {
      tab = rawTab as StudentDashboardMainTab;
    } else {
      tab = "content";
      const alias = LEGACY_CONTENT_TAB_ALIASES[rawTab];
      if (alias) contentTab = alias;
    }
  }

  if (normalizedPath === "/dashboard/my-content" || normalizedPath === "/my-dashboard/my-content") {
    tab = "content";
  } else if (normalizedPath === "/dashboard") {
    tab = rawTab && STUDENT_DASHBOARD_MAIN_TABS.has(rawTab as StudentDashboardMainTab)
      ? (rawTab as StudentDashboardMainTab)
      : "content";
  } else if (isLegacyDashboardSubpath) {
    const subpath = normalizedPath.slice("/dashboard/".length);
    const mappedTab = LEGACY_DASHBOARD_SUBPATH_TABS[subpath];
    if (mappedTab) tab = mappedTab;
  }

  const next = new URLSearchParams();
  next.set("tab", tab);
  if (contentTab && STUDENT_DASHBOARD_CONTENT_TABS.has(contentTab)) {
    next.set("contentTab", contentTab);
  }
  for (const [key, value] of params.entries()) {
    if (key !== "contentTab") next.set(key, value);
  }
  const qs = next.toString();
  return `/my-dashboard${qs ? `?${qs}` : ""}`;
}

/** Rewrite legacy /dashboard links to /my-dashboard (relative or same-origin absolute). */
export function resolveStudentDashboardHref(href: string): string {
  if (!href) return href;
  const isAbsolute = /^https?:\/\//i.test(href);
  try {
    const parsed = new URL(href, LEARN_APP_ORIGIN);
    const mapped = normalizeLegacyStudentDashboardLocation(parsed.pathname, parsed.search);
    if (!mapped) return href;
    if (isAbsolute) return `${parsed.origin}${mapped}`;
    return mapped;
  } catch {
    return href;
  }
}
