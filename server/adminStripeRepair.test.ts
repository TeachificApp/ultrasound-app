import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production Stripe repair admin wiring", () => {
  it("exposes getStripeRepairSnapshot on adminUser router", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers/adminUserRouter.ts"), "utf8");
    expect(source).toContain("getStripeRepairSnapshot");
    expect(source).toContain("buildAdminStripeRepairSnapshot");
  });

  it("exposes workshop reconcile from Stripe checkout session", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers/workshopRouter.ts"), "utf8");
    expect(source).toContain("reconcileStripeWorkshopCheckout");
    expect(source).toContain("fulfillWorkshopCheckoutFromStripeSession");
  });

  it("documents CLI repair script", () => {
    const doc = readFileSync(resolve(process.cwd(), "docs/PRODUCTION_PURCHASE_REPAIR.md"), "utf8");
    expect(doc).toContain("membership.reconcileStripeMembership");
    expect(doc).toContain("workshopAdmin.reconcileStripeWorkshopCheckout");
  });
});
