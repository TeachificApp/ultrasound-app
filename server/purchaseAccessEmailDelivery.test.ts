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

  it("sends the learner's tokenized message only to the learner and safe receipts to payer and admin", async () => {
    const tokenizedUrl = "https://learn.allaboutultrasound.com/auth/access?token=private-token";
    const ok = await sendEmail({
      to: { name: "Learner", email: "learner@example.com" },
      subject: "Your course access",
      htmlBody: `<p><a href="${tokenizedUrl}">Access</a></p>`,
      purchaseAccess: {
        payee: { name: "Payee", email: "payee@example.com" },
      },
    });

    expect(ok).toBe(true);
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(3);
    const [learner, payee, admin] = vi.mocked(sendTransactionalEmail).mock.calls.map((call) => call[0]);

    expect(learner?.to.email).toBe("learner@example.com");
    expect(learner?.htmlBody).toContain(tokenizedUrl);
    expect(learner?.bcc).toBeUndefined();

    expect(payee?.to.email).toBe("payee@example.com");
    expect(payee?.htmlBody).not.toContain(tokenizedUrl);
    expect(payee?.htmlBody).toContain("does not include any sign-in or access link");
    expect(payee?.bcc).toBeUndefined();

    expect(admin?.to.email).toBe(PURCHASE_ACCESS_ADMIN_EMAIL);
    expect(admin?.htmlBody).not.toContain(tokenizedUrl);
    expect(admin?.htmlBody).toContain("does not include any sign-in or access link");
    expect(admin?.bcc).toBeUndefined();
  });

  it("does not duplicate the learner message when payer and learner match", async () => {
    const tokenizedUrl = "https://learn.allaboutultrasound.com/auth/access?token=private-token";
    const ok = await sendEmail({
      to: { name: "Same", email: "same@example.com" },
      subject: "Test",
      htmlBody: `<p>${tokenizedUrl}</p>`,
      purchaseAccess: { payee: { name: "Same", email: "same@example.com" } },
    });

    expect(ok).toBe(true);
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(2);
    const [learner, admin] = vi.mocked(sendTransactionalEmail).mock.calls.map((call) => call[0]);
    expect(learner?.to.email).toBe("same@example.com");
    expect(learner?.htmlBody).toContain(tokenizedUrl);
    expect(admin?.to.email).toBe(PURCHASE_ACCESS_ADMIN_EMAIL);
    expect(admin?.htmlBody).not.toContain(tokenizedUrl);
  });

  it("does not fail a learner delivery when a non-access receipt fails", async () => {
    const sendOnce = vi.fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("payer receipt unavailable"))
      .mockResolvedValueOnce(false);

    const delivered = await deliverPurchaseAccessEmail({
      to: { name: "Learner", email: "learner@example.com" },
      subject: "Your course access",
      htmlBody: "private-token",
      purchaseAccess: { payee: { name: "Payer", email: "payer@example.com" } },
    }, sendOnce);

    expect(delivered).toBe(true);
    expect(sendOnce).toHaveBeenCalledTimes(3);
    expect(sendOnce.mock.calls[1]?.[0].htmlBody).not.toContain("private-token");
    expect(sendOnce.mock.calls[2]?.[0].htmlBody).not.toContain("private-token");
  });
});
