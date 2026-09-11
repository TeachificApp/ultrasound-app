import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const courseLandingSource = readFileSync(
  fileURLToPath(new URL("../client/src/pages/CourseLanding.tsx", import.meta.url)),
  "utf8",
);
const lmsRouterSource = readFileSync(
  fileURLToPath(new URL("./routers/lmsRouter.ts", import.meta.url)),
  "utf8",
);

describe("course enrollment deadline waitlist routing", () => {
  it("treats passed course registration deadlines as waitlist mode for cohort courses", () => {
    expect(courseLandingSource).toContain("const isEnrollmentClosedWaitlist = !enrollment && isEnrollmentClosed && isCohortCourse;");
    expect(courseLandingSource).toContain("|| isEnrollmentClosedWaitlist");
    expect(courseLandingSource).not.toContain("!isEnrollmentClosed && ((course as any).cohortGroups?.length ?? 0) > 0");
  });

  it("routes checkout CTAs to waitlist when registration has closed", () => {
    expect(courseLandingSource).toContain("const handleCheckoutOrWaitlist = (pricingOptionId?: number) => {");
    expect(courseLandingSource).toContain("onCheckoutPage={handleCheckoutOrWaitlist}");
    expect(courseLandingSource).toContain("if (showWaitlistCta) { handleWaitlistCta(); return; }");
  });

  it("marks hasOpenGroup false when course enrollment close date has passed", () => {
    expect(lmsRouterSource).toContain("const isCourseEnrollmentOpen =");
    expect(lmsRouterSource).toContain("const hasOpenGroup = isCourseEnrollmentOpen && visibleCohortGroups.some(isCohortGroupOnSale);");
  });
});
