import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), values: vi.fn(), select: vi.fn() }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 12, name: "Member" }] }) }) }),
  insert: () => ({ values: mocks.values }),
})) }));
vi.mock("./lib/email/sendTransactionalEmail", () => ({ sendTransactionalEmail: mocks.send }));
import { sendEmail } from "./_core/email";

beforeEach(() => { vi.clearAllMocks(); mocks.values.mockResolvedValue(undefined); });

describe("exact campaign send-log attribution", () => {
  it("logs the accepted provider ID, channel and campaign ID in the same insert", async () => {
    mocks.send.mockImplementation(async opts => { opts.onProviderAccepted?.({ provider: "smtpcom", messageId: "safe-provider-id", channel: "marketing" }); return true; });
    expect(await sendEmail({ to: { name: "Member", email: "member@example.test" }, subject: "Professional education", htmlBody: "<p>News</p>", campaignId: 123 })).toBe(true);
    expect(mocks.values).toHaveBeenCalledOnce();
    const log = mocks.values.mock.calls[0][0];
    expect(log).toMatchObject({ campaignId: 123, emailType: "campaign", status: "sent" });
    expect(JSON.parse(log.metadata)).toEqual({ provider: "smtpcom", providerMessageId: "safe-provider-id", channel: "marketing", acceptance: "provider_accepted" });
    expect(mocks.send.mock.calls[0][0].transactional).toBe(false);
  });

  it("keeps a transactional reset log separate from every campaign", async () => {
    mocks.send.mockImplementation(async opts => { opts.onProviderAccepted?.({ provider: "sendgrid" }); return true; });
    await sendEmail({ to: { name: "Member", email: "member@example.test" }, subject: "Reset your password", htmlBody: "<p>Reset</p>" });
    await new Promise(resolve => setTimeout(resolve, 0));
    const log = mocks.values.mock.calls[0][0];
    expect(log).toMatchObject({ campaignId: null, emailType: "password_reset", status: "sent" });
    expect(JSON.parse(log.metadata).provider).toBe("sendgrid");
    expect(mocks.send.mock.calls[0][0].transactional).toBe(true);
  });
});
