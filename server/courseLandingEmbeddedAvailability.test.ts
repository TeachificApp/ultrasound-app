import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CourseLanding.tsx", import.meta.url), "utf8");
const workshopCheckoutSource = readFileSync(new URL("../client/src/pages/WorkshopCheckout.tsx", import.meta.url), "utf8");
const workshopRouterSource = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");
const workshopLandingSource = readFileSync(new URL("../client/src/pages/WorkshopLanding.tsx", import.meta.url), "utf8");

describe("embedded CourseLanding availability actions", () => {
  it("routes cohort-group Waitlist cards to shared name-and-email capture and hides capacity urgency", () => {
    expect(source).toContain('const isWaitlistCG = data.status === "waitlist";');
    expect(source).toContain('const hideGroupEnrollmentPresentation = shouldHideEnrollmentPresentation({ status: data.status });');
    expect(source).toContain('productType="cohort_group"');
    expect(source).toContain('{maxStudentsCG != null && !hideGroupEnrollmentPresentation && (');
  });

  it("keeps embedded workshop Waitlist actions out of checkout and renders closed enrollment as disabled", () => {
    expect(source).toContain('inst.status === "waitlist"');
    expect(source).toContain('inst.status === "enrollment_closed"');
    expect(source).toContain('disabled variant="outline">Enrollment Closed</Button>');
    expect(source).toContain('productType="workshop_instance"');
    expect(source).toContain('!hideEnrollmentPresentation');
  });

  it("keeps restricted workshop checkout sessions outside of the Stripe payment form", () => {
    expect(workshopCheckoutSource).toContain('sessionMeta?.availabilityStatus === "waitlist"');
    expect(workshopCheckoutSource).toContain('sessionMeta?.availabilityStatus === "enrollment_closed"');
    expect(workshopCheckoutSource).toContain('productType="workshop_instance"');
    expect(workshopCheckoutSource).toContain('Button disabled variant="outline">Enrollment Closed</Button>');
  });

  it("returns structured restricted availability before reaching Stripe checkout creation", () => {
    expect(workshopRouterSource).toContain('availabilityStatus: instance.status === "waitlist" ? "waitlist" as const : "enrollment_closed" as const');
    expect(workshopRouterSource.indexOf('availabilityStatus: instance.status')).toBeLessThan(workshopRouterSource.indexOf('stripe.checkout.sessions.create'));
  });

  it("evaluates CourseLanding enrollment deadlines through the shared Eastern scheduled-time policy", () => {
    expect(source).toContain('isScheduledDeadlineOpen(enrollmentDeadline, "America/New_York")');
    expect(source).toContain('scheduledWallTimeToUtc(enrollmentDeadline!, "America/New_York")');
  });

  it("keeps the CourseLanding main Enrollment Closed CTA disabled", () => {
    expect(source).toContain('(course as any).status === "enrollment_closed"');
    expect(source).toContain('Enrollment Closed\n                </Button>');
  });

  it("keeps the CourseLanding cohort embed Enrollment Closed CTA disabled and out of the enrollment branch", () => {
    expect(source).toContain('const isClosedCG = data.status === "enrollment_closed";');
    expect(source).toContain('{showEnrollNow && isClosedCG && (');
    expect(source).toContain('!isSoldOutCG && !hideGroupEnrollmentPresentation');
  });

  it("keeps the WorkshopLanding instance Enrollment Closed CTA out of checkout", () => {
    expect(workshopLandingSource).toContain('if (instance?.status === "enrollment_closed" || instance?.availableForPurchase === false) return;');
    expect(workshopLandingSource).toContain('inst.status === "enrollment_closed" || inst.availableForPurchase === false');
    expect(workshopLandingSource).toContain('disabled variant="outline">Enrollment Closed</Button>');
  });

  it("keeps the WorkshopCheckout Enrollment Closed state non-actionable", () => {
    expect(workshopLandingSource).toContain('if (instance?.status === "enrollment_closed" || instance?.availableForPurchase === false) return;');
    expect(workshopCheckoutSource).toContain('Button disabled variant="outline">Enrollment Closed</Button>');
  });
});
