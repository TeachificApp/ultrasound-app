import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Learn Cross-Training catalog", () => {
  it("adds the dedicated public catalog route and navigation item after Workshops", () => {
    const app = source("client/src/App.tsx");
    const layout = source("client/src/components/LMSLayout.tsx");

    expect(app).toContain('const CrossTrainingBrowse = lazy(() => import("./pages/CrossTrainingBrowse"))');
    expect(app).toContain('<Route path="/cross-training" component={CrossTrainingBrowse} />');
    expect(layout).toContain('{ label: "Cross-Training", href: "/cross-training"');
    expect(layout).toContain('const withCrossTraining = ensureAfter(headerNavWithoutQuizItems, { label: "Cross-Training", href: "/cross-training" }, "/workshops");');
  });

  it("includes direct UltrasoundAssist and EchoAssist links in desktop and mobile Learn navigation", () => {
    const layout = source("client/src/components/LMSLayout.tsx");

    expect(layout).toContain('const AAUS_APP_URL = "https://app.allaboutultrasound.com"');
    expect(layout).toContain('const IHE_APP_URL = "https://app.iheartecho.com"');
    expect(layout).toContain("UltrasoundAssist™");
    expect(layout).toContain("EchoAssist™");
  });

  it("resolves cohort courses from the Cross-Training collection, including waitlist programs", () => {
    const router = source("server/routers/lmsRouter.ts");

    expect(router).toContain("listCrossTrainingCohorts: publicProcedure");
    expect(router).toContain("lmsCollectionCourses");
    expect(router).toContain('eq(lmsCourses.type, "cohort")');
    expect(router).toContain("lmsCourses.status} IN ('public', 'waitlist', 'presale')");
    expect(router).toContain("lmsCohortGroups.status} IN ('open', 'presale', 'waitlist', 'active')");
    expect(router).toContain("const statusPriority: Record<string, number> = { open: 0, presale: 1, waitlist: 2, active: 3 }");
  });

  it("renders a searchable cohort catalog with live cohort dates and availability", () => {
    const page = source("client/src/pages/CrossTrainingBrowse.tsx");

    expect(page).toContain("trpc.lms.listCrossTrainingCohorts.useQuery()");
    expect(page).toContain("Search cross-training cohorts…");
    expect(page).toContain("CourseInstanceInfo type=\"cohort\"");
    expect(page).toContain("Cross-Training Cohorts");
    expect(page).toContain('isWaitlist ? "Waitlist" : "Cross-Training"');
  });
});
