/**
 * LMS checkout fulfillment unit tests
 */
import { describe, it, expect } from "vitest";

describe("lmsCheckoutFulfillment helpers", () => {
  it("exports LMS fulfillment functions", async () => {
    const mod = await import("./lib/lmsCheckoutFulfillment");
    expect(typeof mod.reconcileLmsCheckoutFromStripeSession).toBe("function");
    expect(typeof mod.resolveLmsCourseIdFromSession).toBe("function");
    expect(typeof mod.isLmsHostedCheckoutMetadata).toBe("function");
    expect(typeof mod.extractStripePriceId).toBe("function");
  });

  it("isLmsHostedCheckoutMetadata detects hosted checkout", async () => {
    const { isLmsHostedCheckoutMetadata } = await import("./lib/lmsCheckoutFulfillment");
    expect(isLmsHostedCheckoutMetadata({ course_id: "180001", source: "hosted_checkout_primary" })).toBe(true);
    expect(isLmsHostedCheckoutMetadata({ type: "membership", plan_id: "1" })).toBe(false);
    expect(isLmsHostedCheckoutMetadata({})).toBe(false);
  });

  it("extractStripePriceId reads expanded line items", async () => {
    const { extractStripePriceId } = await import("./lib/lmsCheckoutFulfillment");
    const priceId = extractStripePriceId({
      line_items: { data: [{ price: { id: "price_test123" } }] },
    });
    expect(priceId).toBe("price_test123");
  });

  it("resolveLmsCourseIdFromSession prefers metadata course_id", async () => {
    const { resolveLmsCourseIdFromSession } = await import("./lib/lmsCheckoutFulfillment");
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const courseId = await resolveLmsCourseIdFromSession(
      mockDb as any,
      {},
      { course_id: "290001" },
    );
    expect(courseId).toBe(290001);
  });
});
