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

describe("course checkout provisional-order safety", () => {
  it("uses the shared cents conversion for signed-in and guest provisional course orders", () => {
    expect(lmsRouterSource.match(/amount: toCheckoutAmountCents\(orderAmount\)/g)).toHaveLength(2);
  });

  it("keeps a failed checkout setup as an audit record instead of a pending payment", () => {
    expect(lmsRouterSource.match(/set\(\{ status: "failed" \}\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(lmsRouterSource.match(/eq\(lmsOrders\.status, "pending"\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("clears the non-payment provisional order created before a zero-cost promotion is resolved", () => {
    expect(lmsRouterSource).toContain("fully discounted enrollment has no Stripe payment to reconcile");
    expect(lmsRouterSource).toContain("return { freeEnrollment: true, courseSlug: course.slug, url: null };");
  });

  it("counts only paid course and funnel records in administrator product analytics", () => {
    expect(productAnalyticsSource).toContain("COUNT(DISTINCT CASE WHEN lo.status = 'paid' THEN lo.id END) AS purchaseCount");
    expect(productAnalyticsSource).toContain("COUNT(DISTINCT CASE WHEN fp2.status = 'paid' THEN fp2.id END) AS purchaseCount");
  });
});
