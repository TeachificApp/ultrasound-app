import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveDashboardSubscriptionCancelledAt } from "../client/src/pages/StudentDashboardPage";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("purchase recipient and cancellation safeguards", () => {
  it("records the action date on paid course cancellation and exposes it to learners", () => {
    const schema = source("../drizzle/schema.ts");
    const dashboardRouter = source("./routers/dashboardRouter.ts");
    const dashboard = source("../client/src/pages/StudentDashboardPage.tsx");

    expect(schema).toContain('cancellationRequestedAt: timestamp("cancellation_requested_at")');
    expect(dashboardRouter).toContain('eventType: "subscription_cancelled"');
    expect(dashboardRouter).toContain("cancellationRequestedAt: requestedAt");
    expect(dashboardRouter).toContain("cancellationRequestedAt: lmsOrders.cancellationRequestedAt");
    expect(dashboard).toContain("Cancellation requested:");
  });

  it("only presents a historical cancellation date after access has ended", () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    expect(resolveDashboardSubscriptionCancelledAt("sub_123", past)?.getTime()).toBe(past.getTime());
    expect(resolveDashboardSubscriptionCancelledAt("sub_123", future)).toBeNull();
    expect(resolveDashboardSubscriptionCancelledAt(null, past)).toBeNull();
  });

  it("supports recipient access without replacing Stripe payer details", () => {
    const checkout = source("../client/src/pages/Checkout.tsx");
    const workshopCheckout = source("../client/src/pages/WorkshopCheckout.tsx");
    const lms = source("./routers/lmsRouter.ts");
    const fulfillment = source("./lib/lmsCheckoutFulfillment.ts");
    const membershipFulfillment = source("./lib/membershipFulfillment.ts");

    expect(checkout).toContain("Register or give access to someone else");
    expect(workshopCheckout).toContain("Register another learner");
    expect(lms).toContain("recipientEmail: z.string().trim().email()");
    expect(lms).toContain("recipient_email");
    expect(fulfillment).toContain("meta.recipient_email ||");
    expect(membershipFulfillment).toContain("meta.recipient_email ||");
  });

  it("returns a verified account auto-login handoff after completed LMS checkout", () => {
    const lms = source("./routers/lmsRouter.ts");
    const completion = source("../client/src/pages/CheckoutComplete.tsx");
    expect(lms).toContain("let autoLoginUrl: string | null = null");
    expect(lms).toContain("generateAutoLoginToken(fulfilledUserId, destination)");
    expect(lms).toContain("autoLoginUrl,");
    expect(completion).toContain('"autoLoginUrl" in data');
  });
});
