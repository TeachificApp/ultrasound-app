import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Pre-sale enrollment and registration paths", () => {
  it("assigns workshop Pre-sale access across checkout, free enrollment, grants, review enrollment, and waitlist grants", () => {
    const workshopRouter = source("server/routers/workshopRouter.ts");
    const webhook = source("server/webhooks/stripe.ts");
    const cmeReviewerGrant = source("server/routers/cmeActivityFormRouter.ts");

    expect(workshopRouter).toContain('accessLevel: instance.status === "presale" ? "presale" : "full"');
    expect(workshopRouter).toContain('accessLevel: instanceAvailability?.status === "presale" ? "presale" : "full"');
    expect(webhook).toContain('accessLevel: instanceAvailability?.status === "presale" ? "presale" : "full"');
    expect(cmeReviewerGrant).toContain('accessLevel: inst.status === "presale" ? "presale" : "full"');
  });

  it("fulfills paid webinar checkout in the webhook without relying on the return page and preserves Pre-sale access", () => {
    const webhook = source("server/webhooks/stripe.ts");
    const lmsRouter = source("server/routers/lmsRouter.ts");

    expect(webhook).toContain("async function handleWebinarCheckoutCompleted");
    expect(webhook).toContain("await handleWebinarCheckoutCompleted(sessionObj);");
    expect(webhook).toContain('accessLevel: webinar.status === "presale" ? "presale" : "full"');
    expect(lmsRouter).toContain('meta.type === "webinar"');
  });

  it("assigns webinar Pre-sale access for registration, promotions, order bumps, and administrator or form grants", () => {
    const webinarRouter = source("server/routers/webinarRouter.ts");
    const orderBumps = source("server/lib/orderBumpCheckout.ts");
    const formGrants = source("server/lib/formAccessGrant.ts");
    const adminGrants = source("server/routers/adminUserRouter.ts");
    const cmeReviewerGrant = source("server/routers/cmeActivityFormRouter.ts");

    expect(webinarRouter.match(/accessLevel: webinar\.status === "presale" \? "presale" : "full"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(orderBumps).toContain('accessLevel: webinar?.status === "presale" ? "presale" : "full"');
    expect(formGrants).toContain('accessLevel: webinar?.status === "presale" ? "presale" : "full"');
    expect(adminGrants).toContain('accessLevel: webinar?.status === "presale" ? "presale" : "full"');
    expect(cmeReviewerGrant).toContain('accessLevel: webinar?.status === "presale" ? "presale" : "full"');
  });
});
