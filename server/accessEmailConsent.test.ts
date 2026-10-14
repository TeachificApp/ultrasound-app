import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/email/sendTransactionalEmail", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(true),
}));

import { sendTransactionalEmail } from "./lib/email/sendTransactionalEmail";
import { sendEmail } from "./_core/email";
import { automaticAccessGrantEmailsEnabled, shouldSendAccessGrantEmail } from "./lib/accessEmailConsent";

describe("access email consent gate", () => {
  const prev = process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS;

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS;
    else process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS = prev;
    vi.clearAllMocks();
  });

  it("blocks automatic access-grant emails when env is unset", () => {
    delete process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS;
    expect(automaticAccessGrantEmailsEnabled()).toBe(false);
    expect(
      shouldSendAccessGrantEmail({ accessGrantEmail: true }),
    ).toBe(false);
    expect(
      shouldSendAccessGrantEmail({ purchaseAccess: {} }),
    ).toBe(false);
  });

  it("allows explicit admin consent regardless of env", () => {
    delete process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS;
    expect(
      shouldSendAccessGrantEmail({ accessGrantEmail: true, explicitAccessEmailConsent: true }),
    ).toBe(true);
  });

  it("sendEmail skips transactional dispatch when access grant is blocked", async () => {
    delete process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS;
    const ok = await sendEmail({
      to: { name: "Test", email: "test@example.com" },
      subject: "Welcome to your course",
      htmlBody: "<p>Hi</p>",
      accessGrantEmail: true,
    });
    expect(ok).toBe(false);
    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
  });

  it("sendEmail delivers when ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS=true", async () => {
    process.env.ALLOW_AUTOMATIC_ACCESS_GRANT_EMAILS = "true";
    const ok = await sendEmail({
      to: { name: "Test", email: "test@example.com" },
      subject: "Welcome",
      htmlBody: "<p>Hi</p>",
      accessGrantEmail: true,
    });
    expect(ok).toBe(true);
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(1);
  });
});
