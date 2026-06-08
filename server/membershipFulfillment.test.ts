/**
 * Membership fulfillment unit tests
 */
import { describe, it, expect } from "vitest";

describe("membershipFulfillment helpers", () => {
  it("exports membership fulfillment functions", async () => {
    const mod = await import("./lib/membershipFulfillment");
    expect(typeof mod.resolveMembershipPlanId).toBe("function");
    expect(typeof mod.fulfillMembershipPurchase).toBe("function");
    expect(typeof mod.reconcileMembershipFromStripeSession).toBe("function");
  });

  it("resolveMembershipPlanId prefers explicit plan id", async () => {
    const { resolveMembershipPlanId } = await import("./lib/membershipFulfillment");
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const planId = await resolveMembershipPlanId(mockDb as any, { planId: 42, stripePriceId: null });
    expect(planId).toBe(42);
  });

  it("buildPasswordResetEmail welcome mode uses 7-day copy", async () => {
    const { buildPasswordResetEmail } = await import("./_core/email");
    const { htmlBody, subject } = buildPasswordResetEmail({
      firstName: "Test",
      resetUrl: "https://example.com/reset",
      purpose: "welcome",
      expiresInLabel: "7 days",
    });
    expect(subject).toContain("Set your");
    expect(htmlBody).toContain("7 days");
    expect(htmlBody).not.toContain("1 hour");
  });
});
