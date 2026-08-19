import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserByEmail: vi.fn(),
  sendEmail: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getUserByEmail: mocks.getUserByEmail,
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));
vi.mock("./_core/email", () => ({
  sendEmail: mocks.sendEmail,
  emailWrapper: (body: string) => body,
  buildFunnelPurchaseConfirmationEmail: vi.fn(),
  buildPaymentFailedEmail: vi.fn(() => ({ subject: "Payment failed", htmlBody: "<p>Update payment</p>", previewText: "Update payment" })),
}));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./lib/stripeClient", () => ({
  getStripeClient: () => ({ paymentIntents: { update: vi.fn().mockResolvedValue({}) }, subscriptions: { update: vi.fn().mockResolvedValue({}) } }),
}));
vi.mock("./routers/downloadsRouter", () => ({ sendPurchaseConfirmationEmail: vi.fn() }));
vi.mock("./lib/orderBumpCheckout", () => ({ fulfillOrderBumpPurchase: vi.fn() }));
vi.mock("./routes/autoLogin", () => ({ generateAutoLoginToken: vi.fn() }));

import { handleInvoicePaid, handleInvoicePaymentFailed } from "./webhooks/stripe";

function createDb(selectRows: unknown[][]) {
  const updates: Record<string, unknown>[] = [];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const rows = selectRows.shift() ?? [];
        const result = Promise.resolve(rows);
        Object.assign(result, { limit: vi.fn().mockResolvedValue(rows) });
        return result;
      }),
    })),
  }));
  return {
    select,
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updates.push(values);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
    insert: vi.fn(),
    updates,
  };
}

describe("recurring invoice entitlement lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.notifyOwner.mockResolvedValue(undefined);
  });

  it("invoice.paid renews brand and native membership access and extends LMS course access", async () => {
    const db = createDb([
      [{ id: 1, userId: 8, brand: "aaus", source: "stripe" }],
      [{ id: 2, planId: 4 }],
      [],
      [{ id: 3 }],
    ]);
    mocks.getDb.mockResolvedValue(db);
    const periodEndSeconds = 1_800_000_000;

    await handleInvoicePaid({
      subscription: "sub_renewal",
      lines: { data: [{ period: { end: periodEndSeconds } }] },
    });

    const expectedDate = new Date(periodEndSeconds * 1000);
    expect(db.updates).toContainEqual({ status: "active", tier: "premium", expiresAt: expectedDate });
    expect(db.updates).toContainEqual({ status: "active", currentPeriodEnd: expectedDate.getTime() });
    expect(db.updates).toContainEqual({ accessExpiresAt: expectedDate });
  });

  it("invoice.payment_failed preserves access during retry but revokes a brand entitlement after the final failed attempt", async () => {
    const membership = { id: 7, userId: 8, brand: "aaus" };
    const db = createDb([[membership], [membership], [], []]);
    mocks.getDb.mockResolvedValue(db);
    mocks.getUserByEmail.mockResolvedValue({ id: 8, firstName: "Member", name: "Member Test" });

    await handleInvoicePaymentFailed({
      subscription: "sub_failed",
      customer_email: "member@example.com",
      attempt_count: 2,
      next_payment_attempt: 1_800_000_000,
    });
    expect(db.updates).toHaveLength(0);

    await handleInvoicePaymentFailed({
      subscription: "sub_failed",
      customer_email: "member@example.com",
      attempt_count: 3,
      next_payment_attempt: null,
    });
    expect(db.updates).toContainEqual({ status: "cancelled", tier: "free" });
    expect(mocks.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Subscription Cancelled") }));
  });

  it("invoice.payment_failed expires native plan access and LMS subscription access after the terminal retry", async () => {
    const db = createDb([
      [],
      [{ id: 12, planId: 4 }],
      [{ id: 99 }],
    ]);
    mocks.getDb.mockResolvedValue(db);
    mocks.getUserByEmail.mockResolvedValue({ id: 8, firstName: "Member", name: "Member Test" });

    await handleInvoicePaymentFailed({
      subscription: "sub_native_lms_failed",
      customer_email: "member@example.com",
      attempt_count: 3,
      next_payment_attempt: null,
    });

    expect(db.updates).toContainEqual({ status: "expired", cancelAtPeriodEnd: false });
    expect(db.updates.some((update) => update.accessExpiresAt instanceof Date)).toBe(true);
  });
});
