import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lmsRouterSource = readFileSync(
  resolve(process.cwd(), "server/routers/lmsRouter.ts"),
  "utf8",
);
const productAnalyticsSource = readFileSync(
  resolve(process.cwd(), "server/routers/productAnalyticsRouter.ts"),
  "utf8",
);
const embeddedCheckoutSource = lmsRouterSource.slice(
  lmsRouterSource.indexOf("createEmbeddedCheckoutSession: publicProcedure"),
  lmsRouterSource.indexOf("getCheckoutSessionStatus: publicProcedure"),
);

describe("course checkout provisional-order safety", () => {
  it("uses the shared cents conversion for every provisional course order", () => {
    expect(lmsRouterSource.match(/amount: toCheckoutAmountCents\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps a failed checkout setup as an audit record instead of a pending payment", () => {
    expect(lmsRouterSource.match(/set\(\{ status: "failed" \}\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(lmsRouterSource.match(/eq\(lmsOrders\.status, "pending"\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("clears the non-payment provisional order created before a zero-cost promotion is resolved", () => {
    expect(lmsRouterSource).toContain("fully discounted enrollment has no Stripe payment to reconcile");
    expect(lmsRouterSource).toContain("return { freeEnrollment: true, courseSlug: course.slug, url: null };");
  });

  it("routes explicitly free embedded course offers through enrollment rather than Stripe", () => {
    expect(embeddedCheckoutSource).toContain("const grantEmbeddedFreeCourseAccess = async () =>");
    expect(embeddedCheckoutSource).toContain('if (pricingType === "free") return grantEmbeddedFreeCourseAccess();');
    expect(embeddedCheckoutSource.indexOf("primaryPricingType === \"free\"")).toBeLessThan(
      embeddedCheckoutSource.indexOf("const stripe = getStripeClient()"),
    );
  });

  it("links created embedded Stripe sessions to their provisional order and fails that order on setup errors", () => {
    expect(embeddedCheckoutSource).toContain("const attachPendingOrderToEmbeddedSession = async");
    expect(embeddedCheckoutSource.match(/await attachPendingOrderToEmbeddedSession\(session\.id\)/g)).toHaveLength(3);
    expect(embeddedCheckoutSource).toContain("const failPendingEmbeddedOrder = async");
    expect(embeddedCheckoutSource).toContain("await failPendingEmbeddedOrder();");
  });

  it("counts only paid course and funnel records in administrator product analytics", () => {
    expect(productAnalyticsSource).toContain("COUNT(DISTINCT CASE WHEN lo.status = 'paid' THEN lo.id END) AS purchaseCount");
    expect(productAnalyticsSource).toContain("COUNT(DISTINCT CASE WHEN fp2.status = 'paid' THEN fp2.id END) AS purchaseCount");
  });
});
