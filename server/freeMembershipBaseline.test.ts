import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("Free Membership automatic baseline contracts", () => {
  it("reconciles a silent active Free Membership and its included access without importing delivery helpers", () => {
    const source = readSource("server/lib/ensureFreeMembership.ts");

    expect(source).toContain('status: "active"');
    expect(source).toContain('cancelAtPeriodEnd: false');
    expect(source).toContain('await fulfillMembershipPlanAccess');
    expect(source).toContain('source: "membership"');
    expect(source).not.toMatch(/send(?:MembershipWelcome|Enrollment|DownloadAccess|BundleAccess|QuizAccess)Email/);
  });

  it("grants a configured membership community silently and preserves direct membership welcome behavior", () => {
    const fulfillment = readSource("server/lib/membershipFulfillment.ts");
    const membershipRouter = readSource("server/routers/membershipRouter.ts");

    expect(fulfillment).toContain("async function grantCommunityAccess");
    expect(fulfillment).toContain('case "community":');
    expect(fulfillment).toContain('memberStatus: "approved"');
    expect(fulfillment).toContain('existing.status !== "open"');
    expect(fulfillment).toContain('accessExpiresAt: null');
    expect(fulfillment).toContain('status: "open"');
    expect(membershipRouter).toContain("skipEmail: false");
    expect(membershipRouter).toContain("forceWelcomeEmail: true");
  });

  it("covers confirmed and complimentary content-grant boundaries without changing their existing access-email calls", () => {
    const lmsRouter = readSource("server/routers/lmsRouter.ts");
    const enrollmentAdmin = readSource("server/routers/lmsEnrollmentAdminRouter.ts");
    const downloadsRouter = readSource("server/routers/downloadsRouter.ts");
    const adminUser = readSource("server/routers/adminUserRouter.ts");
    const formGrant = readSource("server/lib/formAccessGrant.ts");
    const fulfillment = readSource("server/lib/fulfillmentEngine.ts");

    expect(lmsRouter).toContain("ensureFreeMembership(ctx.user.id, { db })");
    expect(lmsRouter).toContain("ensureFreeMembership(user.id, { db })");
    expect(enrollmentAdmin).toContain("ensureFreeMembership(userId, { db })");
    expect(downloadsRouter).toContain("ensureFreeMembership(userId, { db })");
    expect(adminUser).toContain("await ensureFreeMembership(input.userId, { db })");
    expect(formGrant).toContain("await ensureFreeMembership(userId, { db })");
    expect(fulfillment).toContain("await ensureFreeMembership(userId, { db })");
    expect(lmsRouter).toContain("sendEnrollmentEmailForUser");
    expect(downloadsRouter).toContain("sendDownloadAccessEmail");
  });

  it("delivers one direct bundle-level email and no included-product email from the Stripe bundle handler", () => {
    const source = readSource("server/webhooks/stripe.ts");
    const start = source.indexOf("async function handleDigitalBundleCheckoutCompleted");
    const end = source.indexOf("async function handlePhysicalProductCheckoutCompleted", start);
    const bundleHandler = source.slice(start, end);

    expect(bundleHandler).toContain("sendBundleAccessEmail");
    expect(bundleHandler).not.toContain("sendPurchaseConfirmationEmail(userId, item.productId)");
  });
});
