import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn().mockResolvedValue(undefined);
const getDbMock = vi.fn().mockResolvedValue({ insert: () => ({ values: insertMock }) });

vi.mock("./db", () => ({
  getDb: () => getDbMock(),
}));

vi.mock("../drizzle/schema", () => ({
  webhookEvents: { id: "webhookEvents" },
}));

describe("logDuplicatePaymentFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockResolvedValue({ insert: () => ({ values: insertMock }) });
  });

  it("writes duplicate_flagged row to webhookEvents", async () => {
    const { logDuplicatePaymentFlag } = await import("./lib/duplicatePaymentLog");
    await logDuplicatePaymentFlag({
      kind: "lms_duplicate_payment",
      email: "buyer@example.com",
      productName: "Course A",
      userId: 42,
      stripePaymentIntentId: "pi_test_123",
      message: "Duplicate LMS payment",
      rawPayload: { courseId: 1 },
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "stripe",
        resource: "duplicate_payment",
        action: "lms_duplicate_payment",
        outcome: "duplicate_flagged",
        email: "buyer@example.com",
        productName: "Course A",
      }),
    );
  });

  it("no-ops when database unavailable", async () => {
    getDbMock.mockResolvedValueOnce(null);
    const { logDuplicatePaymentFlag } = await import("./lib/duplicatePaymentLog");
    await expect(
      logDuplicatePaymentFlag({
        kind: "membership_duplicate_subscription",
        message: "test",
      }),
    ).resolves.toBeUndefined();
    expect(insertMock).not.toHaveBeenCalled();
  });
});
