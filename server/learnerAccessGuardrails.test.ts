import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isLessonDripOutExpired } from "./lib/lessonDripAccess";
import { LMS_MY_CONTENT_COURSE_STATUSES } from "./lib/lmsCourseVisibility";
import { logProductionDatabaseConfigurationWarnings } from "./lib/productionDatabaseGuard";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      listTsFiles(full, acc);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      acc.push(full.replace(/\\/g, "/"));
    }
  }
  return acc;
}

describe("learner LMS access guardrails", () => {
  it("documents allowed LMS course statuses for My Content virtual cards", () => {
    expect(LMS_MY_CONTENT_COURSE_STATUSES).toEqual(["public", "hidden", "private"]);
  });

  it("never filters lms_courses with status published in server code", () => {
    const serverRoot = new URL("../server", import.meta.url).pathname;
    const files = listTsFiles(serverRoot);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(/.*\/server\//, "server/");
      const text = readFileSync(file, "utf8");
      if (text.includes('eq(lmsCourses.status, "published")')) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("refreshes Stripe LMS access on all learner dashboard and player entrypoints", () => {
    const dashboard = readProjectFile("server/routers/dashboardRouter.ts");
    const lmsRouter = readProjectFile("server/routers/lmsRouter.ts");

    expect(dashboard).toContain("maybeRefreshLearnerLmsAccessFromStripe");
    expect(dashboard).toMatch(/getMyContent:[\s\S]*maybeRefreshLearnerLmsAccessFromStripe/);
    expect(dashboard).toMatch(/getMySubscriptions:[\s\S]*maybeRefreshLearnerLmsAccessFromStripe/);

    expect(lmsRouter).toContain("maybeRefreshLearnerLmsAccessFromStripe");
    expect(lmsRouter).toMatch(/getCoursePlayer:[\s\S]*maybeRefreshLearnerLmsAccessFromStripe/);
    expect(lmsRouter).toMatch(/getLesson:[\s\S]*maybeRefreshLearnerLmsAccessFromStripe/);
    expect(lmsRouter).toMatch(/getCourseOverview:[\s\S]*maybeRefreshLearnerLmsAccessFromStripe/);
  });

  it("uses shared My Content course visibility helper for membership virtual cards", () => {
    const dashboard = readProjectFile("server/routers/dashboardRouter.ts");
    expect(dashboard).toContain("lmsCourseVisibleInMyContentCondition()");
    expect(dashboard).not.toContain('eq(lmsCourses.status, "published")');
  });

  it("aligns drip-out expiry with course isDrip (regression for false lockouts)", () => {
    expect(
      isLessonDripOutExpired({ courseIsDrip: false, dripOutDays: 90, daysSinceEnroll: 200 }),
    ).toBe(false);
  });
});

describe("production database guard", () => {
  it("warns when Railway production resolves legacy TiDB", () => {
    const logs: string[] = [];
    const orig = console.error;
    console.error = (msg: string) => logs.push(String(msg));
    try {
      logProductionDatabaseConfigurationWarnings({
        RAILWAY_PRIMARY: "true",
        DATABASE_URL: "mysql://u:p@gateway06.us-east-1.prod.aws.tidbcloud.com:4000/x",
      });
    } finally {
      console.error = orig;
    }
    expect(logs.some((l) => l.includes("CRITICAL") && l.includes("TiDB"))).toBe(true);
  });
});
