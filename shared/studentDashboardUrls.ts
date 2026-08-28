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

/** Map legacy/broken dashboard paths to the current /my-dashboard format. */
export function normalizeLegacyStudentDashboardLocation(pathname: string, search = ""): string | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isLegacyPath =
    normalizedPath === "/dashboard/my-content"
    || normalizedPath === "/my-dashboard/my-content";
  if (!isLegacyPath && normalizedPath !== "/my-dashboard") return null;

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

  if (isLegacyPath) tab = "content";

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
