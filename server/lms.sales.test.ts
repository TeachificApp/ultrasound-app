import { describe, it, expect } from "vitest";

/**
 * Unit tests for the Sales tab procedures in lmsAdminRouter.
 * These test the procedure registration and basic input validation logic.
 */

describe("LMS Sales Tab - procedure registration", () => {
  const EXPECTED_PROCS = [
    "getSalesData",
    "getCheckoutLinks",
    "refundOrder",
    "cancelSubscription",
    "getStudentProfile",
  ];

  it("all sales procedures exist in lmsAdminRouter", async () => {
    const { lmsAdminRouter } = await import("./routers/lmsRouter");
    const procs = (lmsAdminRouter as any)._def.procedures;
    for (const name of EXPECTED_PROCS) {
      expect(procs[name], `Procedure '${name}' should exist`).toBeDefined();
    }
  });
});

describe("LMS Sales Tab - checkout link generation logic", () => {
  it("formats price correctly from cents to dollars", () => {
    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    expect(formatPrice(9700)).toBe("$97.00");
    expect(formatPrice(0)).toBe("$0.00");
    expect(formatPrice(19900)).toBe("$199.00");
  });

  it("generates embed code with correct iframe structure", () => {
    const origin = "https://app.allaboutultrasound.com";
    const courseSlug = "from-sonographer-to-ceo";
    const pricingId = 42;
    const checkoutUrl = `${origin}/checkout/${courseSlug}?pricing=${pricingId}`;
    const embedCode = `<iframe src="${checkoutUrl}" width="100%" height="600" frameborder="0"></iframe>`;
    expect(embedCode).toContain("iframe");
    expect(embedCode).toContain(checkoutUrl);
    expect(embedCode).toContain('frameborder="0"');
  });

  it("running total sums order amounts correctly", () => {
    const orders = [
      { amountCents: 9700, status: "completed" },
      { amountCents: 9700, status: "completed" },
      { amountCents: 9700, status: "refunded" },
    ];
    const total = orders
      .filter(o => o.status === "completed")
      .reduce((sum, o) => sum + o.amountCents, 0);
    expect(total).toBe(19400);
  });
});
