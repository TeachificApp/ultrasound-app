import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("learner My Content access repair", () => {
  it("lists public LMS courses for membership and bundle virtual cards", () => {
    const dashboard = readProjectFile("server/routers/dashboardRouter.ts");
    const visibility = readProjectFile("server/lib/lmsCourseVisibility.ts");

    expect(visibility).toContain('"public"');
    expect(visibility).toContain("lmsCourseVisibleInMyContentCondition");
    expect(dashboard).toContain("lmsCourseVisibleInMyContentCondition()");
    expect(dashboard).not.toContain('eq(lmsCourses.status, "published")');
  });

  it("refreshes Stripe-linked LMS access before building My Content", () => {
    const dashboard = readProjectFile("server/routers/dashboardRouter.ts");
    const reconciliation = readProjectFile("server/lib/lmsSubscriptionReconciliation.ts");

    expect(dashboard).toContain("refreshLearnerLmsAccessFromStripe");
    expect(reconciliation).toContain("repairMissingLmsEnrollmentsFromPaidOrdersForUser");
    expect(reconciliation).toContain("syncLmsEnrollmentExpiryFromStripeForUser");
  });
});
