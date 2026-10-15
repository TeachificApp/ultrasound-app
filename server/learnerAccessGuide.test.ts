import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("learner access guide", () => {
  it("stores first-three-visit progress in Railway MySQL rather than browser-only state", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/0101_learner_onboarding_progress.sql");

    expect(schema).toContain('mysqlTable("learner_onboarding_progress"');
    expect(schema).toContain('userId: int("user_id").notNull().unique()');
    expect(schema).toContain('learnVisitCount: int("learn_visit_count").default(0).notNull()');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS learner_onboarding_progress");
  });

  it("only presents the guide to learners with active entitlement evidence and caps it at three visits", () => {
    const router = read("server/routers/dashboardRouter.ts");

    expect(router).toContain("registerLearnOnboardingVisit");
    expect(router).toContain("courseEnrollments.filter(hasCourseEnrollmentAccess)");
    expect(router).toContain("downloads.some(isPurchaseAccessActive)");
    expect(router).toContain('row.status === "active"');
    expect(router).toContain("Math.min(existing.visitCount + 1, 3)");
    expect(router).toContain("visitCount > 0 && visitCount <= 3");
    expect(router).toContain("cohortCourseId: activeCohort?.courseId ?? null");
  });

  it("mounts a visual Learn-domain guide with dashboard, cohort, and billing directions", () => {
    const app = read("client/src/App.tsx");
    const guide = read("client/src/components/LearnerAccessGuide.tsx");
    const learnLayout = read("client/src/components/LMSLayout.tsx");

    expect(app).toContain("<LearnerAccessGuide />");
    expect(guide).toContain("/my-dashboard?tab=content");
    expect(guide).toContain("/my-dashboard?tab=subscriptions");
    expect(guide).toContain("My Cohort");
    expect(guide).toContain("first three Learn visits");
    expect(guide).toContain("onboarding_preview=1");
    expect(guide).toContain("onboarding_preview_account=1");
    expect(guide).toContain("<iframe");
    expect(guide).toContain("your own signed-in experience");
    expect(guide).toContain("Select your name or avatar at the top-right, then choose My Dashboard");
    expect(guide).toContain("Click top-right, then My Dashboard");
    expect(guide).toContain("Access your learning");
    expect(guide).not.toContain("Open what you own");
    expect(guide).not.toContain("AccountMenuPreview");
    expect(learnLayout).toContain('get("onboarding_preview_account") === "1"');
  });
});
