import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/email/sendTransactionalEmail", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(true),
}));

import { sendTransactionalEmail } from "./lib/email/sendTransactionalEmail";
import { sendEmail } from "./_core/email";
import {
  PURCHASE_ACCESS_ADMIN_EMAIL,
  deliverPurchaseAccessEmail,
  emailsEqual,
  resolvePurchaseAccessRecipients,
} from "./lib/purchaseAccessEmailDelivery";

describe("purchase access email delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detects equal emails case-insensitively", () => {
    expect(emailsEqual("A@Example.com", "a@example.com")).toBe(true);
    expect(emailsEqual("learner@test.com", "payee@test.com")).toBe(false);
  });

  it("returns payee only when checkout email differs from learner", () => {
    const learner = { name: "Learner", email: "learner@example.com" };
    expect(resolvePurchaseAccessRecipients({ learner, payeeEmail: "learner@example.com" }).payee).toBeNull();
    const withPayee = resolvePurchaseAccessRecipients({
      learner,
      payeeEmail: "payee@example.com",
      payeeName: "Payee Parent",
    });
    expect(withPayee.payee).toEqual({ name: "Payee Parent", email: "payee@example.com" });
  });

  it("BCCs admin and sends duplicate to payee via sendEmail purchaseAccess flag", async () => {
    const ok = await sendEmail({
      to: { name: "Learner", email: "learner@example.com" },
      subject: "Your course access",
      htmlBody: "<p>Welcome</p>",
      purchaseAccess: {
        payee: { name: "Payee", email: "payee@example.com" },
      },
    });
    expect(ok).toBe(true);
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(2);
    const first = vi.mocked(sendTransactionalEmail).mock.calls[0]?.[0];
    const second = vi.mocked(sendTransactionalEmail).mock.calls[1]?.[0];
    expect(first?.to.email).toBe("learner@example.com");
    expect(first?.bcc?.some((r) => r.email === PURCHASE_ACCESS_ADMIN_EMAIL)).toBe(true);
    expect(second?.to.email).toBe("payee@example.com");
    expect(second?.bcc?.some((r) => r.email === PURCHASE_ACCESS_ADMIN_EMAIL)).toBe(true);
  });

  it("deliverPurchaseAccessEmail skips payee duplicate when same as primary", async () => {
    const sendOnce = vi.fn().mockResolvedValue(true);
    await deliverPurchaseAccessEmail(
      {
        to: { name: "Same", email: "same@example.com" },
        subject: "Test",
        htmlBody: "<p>x</p>",
        purchaseAccess: { payee: { name: "Same", email: "same@example.com" } },
      },
      sendOnce,
    );
    expect(sendOnce).toHaveBeenCalledTimes(1);
  });
});
