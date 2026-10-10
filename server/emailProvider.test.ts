import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEmailProviderId,
  isEmailProviderConfigured,
  resolveEffectiveEmailProvider,
  resolveEmailSender,
} from "./lib/email/providerConfig";
import { sendTransactionalEmail } from "./lib/email/sendTransactionalEmail";

describe("email provider config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to smtpcom", () => {
    delete process.env.EMAIL_PROVIDER;
    expect(getEmailProviderId()).toBe("smtpcom");
  });

  it("accepts sendgrid when explicitly set", () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    expect(getEmailProviderId()).toBe("sendgrid");
  });

  it("accepts smtpcom aliases", () => {
    process.env.EMAIL_PROVIDER = "smtp.com";
    expect(getEmailProviderId()).toBe("smtpcom");
    process.env.EMAIL_PROVIDER = "smtpcom";
    expect(getEmailProviderId()).toBe("smtpcom");
  });

  it("requires SENDGRID_API_KEY for sendgrid provider", () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    delete process.env.SENDGRID_API_KEY;
    expect(isEmailProviderConfigured()).toBe(false);
    process.env.SENDGRID_API_KEY = "SG.test";
    expect(isEmailProviderConfigured()).toBe(true);
  });

  it("requires SMTPCOM_API_KEY and SMTPCOM_CHANNEL when smtpcom is preferred and no fallback", () => {
    process.env.EMAIL_PROVIDER = "smtpcom";
    delete process.env.SMTPCOM_API_KEY;
    delete process.env.SMTPCOM_CHANNEL;
    delete process.env.SENDGRID_API_KEY;
    expect(isEmailProviderConfigured()).toBe(false);
    process.env.SMTPCOM_API_KEY = "key";
    expect(isEmailProviderConfigured()).toBe(false);
    process.env.SMTPCOM_CHANNEL = "main";
    expect(isEmailProviderConfigured()).toBe(true);
  });

  it("falls back to sendgrid when smtpcom is preferred but not configured", () => {
    process.env.EMAIL_PROVIDER = "smtpcom";
    delete process.env.SMTPCOM_API_KEY;
    delete process.env.SMTPCOM_CHANNEL;
    process.env.SENDGRID_API_KEY = "SG.test";
    expect(resolveEffectiveEmailProvider()).toBe("sendgrid");
    expect(isEmailProviderConfigured()).toBe(true);
  });

  it("uses smtpcom-specific from env when provider is smtpcom", () => {
    process.env.EMAIL_PROVIDER = "smtpcom";
    process.env.SMTPCOM_API_KEY = "smtp-test-key";
    process.env.SMTPCOM_CHANNEL = "transactional";
    process.env.SMTPCOM_FROM_EMAIL = "smtp@example.com";
    process.env.SMTPCOM_FROM_NAME = "SMTP Sender";
    const sender = resolveEmailSender({});
    expect(sender.email).toBe("smtp@example.com");
    expect(sender.name).toBe("SMTP Sender");
  });

  it("uses the requested iHeartEcho sender name instead of a global provider name", () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "SG.test";
    process.env.SENDGRID_FROM_EMAIL = "transactional@example.com";
    process.env.SENDGRID_FROM_NAME = "All About Ultrasound™";

    const sender = resolveEmailSender({ brandMode: "iheartecho" });

    expect(sender.email).toBe("transactional@example.com");
    expect(sender.name).toBe("iHeartEcho™");
  });

  it("uses the combined sender name for Learn email on either Learn domain", () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "SG.test";
    process.env.SENDGRID_FROM_NAME = "All About Ultrasound™";

    const sender = resolveEmailSender({ brandMode: "combined" });

    expect(sender.name).toBe("All About Ultrasound™ | iHeartEcho™");
  });

  it("keeps an explicit campaign sender name as the final override", () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "SG.test";
    process.env.SENDGRID_FROM_NAME = "All About Ultrasound™";

    const sender = resolveEmailSender({ brandMode: "iheartecho", fromName: "iHeartEcho CME Team" });

    expect(sender.name).toBe("iHeartEcho CME Team");
  });
});

describe("sendTransactionalEmail", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("posts to SendGrid when provider is sendgrid", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.SENDGRID_FROM_EMAIL = "noreply@example.com";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as typeof fetch;

    const ok = await sendTransactionalEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SG.test-key");
  });

  it("sends iHeartEcho account email with the iHeartEcho mailbox display name", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.SENDGRID_FROM_EMAIL = "noreply@example.com";
    process.env.SENDGRID_FROM_NAME = "All About Ultrasound™";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as typeof fetch;

    const ok = await sendTransactionalEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Reset your iHeartEcho™ password",
      htmlBody: "<p>Reset your password</p>",
      brandMode: "iheartecho",
      transactional: true,
    });

    expect(ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.from.name).toBe("iHeartEcho™");
    expect(payload.reply_to.name).toBe("iHeartEcho™");
  });

  it("posts to SMTP.com when provider is smtpcom", async () => {
    process.env.EMAIL_PROVIDER = "smtpcom";
    process.env.SMTPCOM_API_KEY = "smtp-test-key";
    process.env.SMTPCOM_CHANNEL = "transactional";
    process.env.SMTPCOM_FROM_EMAIL = "noreply@example.com";
    process.env.SMTPCOM_FROM_NAME = "Example";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"status":"success"}' });
    global.fetch = fetchMock as typeof fetch;

    const ok = await sendTransactionalEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.smtp.com/v4/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer smtp-test-key");
    const body = JSON.parse(String(init.body));
    expect(body.channel).toBe("transactional");
    expect(body.subject).toBe("Hello");
    expect(body.recipients.to[0].address).toBe("user@example.com");
  });

  it("returns false when no provider credentials are available", async () => {
    process.env.EMAIL_PROVIDER = "smtpcom";
    delete process.env.SMTPCOM_API_KEY;
    delete process.env.SMTPCOM_CHANNEL;
    delete process.env.SENDGRID_API_KEY;
    const ok = await sendTransactionalEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });
    expect(ok).toBe(false);
  });

  it("falls back to sendgrid when smtpcom preferred but not configured", async () => {
    process.env.EMAIL_PROVIDER = "smtpcom";
    delete process.env.SMTPCOM_API_KEY;
    delete process.env.SMTPCOM_CHANNEL;
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.SENDGRID_FROM_EMAIL = "noreply@example.com";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as typeof fetch;

    const ok = await sendTransactionalEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Magic link",
      htmlBody: "<p>Sign in</p>",
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
  });
});

describe("listSmtpComChannels", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("returns error when API key is missing", async () => {
    const { listSmtpComChannels } = await import("./lib/email/providers/smtpcomChannels");
    delete process.env.SMTPCOM_API_KEY;
    const result = await listSmtpComChannels();
    expect(result.ok).toBe(false);
    expect(result.channels).toEqual([]);
  });

  it("parses channel list from SMTP.com API", async () => {
    const { listSmtpComChannels } = await import("./lib/email/providers/smtpcomChannels");
    process.env.SMTPCOM_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: "success",
          data: { items: [{ name: "transactional", label: "Transactional" }] },
        }),
    }) as typeof fetch;

    const result = await listSmtpComChannels();
    expect(result.ok).toBe(true);
    expect(result.channels).toEqual([{ name: "transactional", label: "Transactional" }]);
  });
});
