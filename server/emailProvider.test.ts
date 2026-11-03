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
    delete process.env.SMPTCOM_API_KEY;
    delete process.env.SMPTCOM_FROM_EMAIL;
  });

  it("defaults transactional mail to sendgrid", () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.TRANSACTIONAL_EMAIL_PROVIDER;
    expect(getEmailProviderId()).toBe("sendgrid");
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
    delete process.env.SMTPCOM_API_KEY;
    delete process.env.SMPTCOM_API_KEY;
    delete process.env.SMTPCOM_CHANNEL;
    expect(isEmailProviderConfigured()).toBe(false);
    process.env.SENDGRID_API_KEY = "SG.test";
    expect(isEmailProviderConfigured()).toBe(true);
  });

  it("defaults campaign mail to smtpcom", async () => {
    const { getCampaignEmailProviderId } = await import("./lib/email/providerConfig");
    delete process.env.CAMPAIGN_EMAIL_PROVIDER;
    expect(getCampaignEmailProviderId()).toBe("smtpcom");
  });

  it("uses smtpcom-specific from env when provider is smtpcom", () => {
    process.env.SMTPCOM_API_KEY = "smtp-test-key";
    process.env.SMTPCOM_CHANNEL = "campaign";
    process.env.SMTPCOM_FROM_EMAIL = "smtp@example.com";
    process.env.SMTPCOM_FROM_NAME = "SMTP Sender";
    const sender = resolveEmailSender({ provider: "smtpcom" });
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
    const payload = JSON.parse(String(init.body));
    expect(payload.mail_settings.bypass_list_management.enable).toBe(true);
  });

  it("routes campaign mail through SMTP.com, not transactional SendGrid", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.SENDGRID_FROM_EMAIL = "noreply@example.com";
    process.env.SMTPCOM_API_KEY = "smtp-test-key";
    process.env.SMTPCOM_CHANNEL = "campaign";
    process.env.SMTPCOM_FROM_EMAIL = "news@example.com";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"status":"success"}' });
    global.fetch = fetchMock as typeof fetch;

    const { sendEmail } = await import("./_core/email");
    await sendEmail({
      to: { name: "Member", email: "member@example.com" },
      subject: "Monthly news",
      htmlBody: "<p>News</p>",
      campaignId: 42,
      listUnsubscribeUrl: "https://example.com/unsubscribe",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.smtp.com/v4/messages");
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

  it("returns false when no transactional provider credentials are available", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SMTPCOM_API_KEY;
    delete process.env.SMTPCOM_CHANNEL;
    const ok = await sendTransactionalEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });
    expect(ok).toBe(false);
  });
});

describe("sendCampaignEmail", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("posts to SMTP.com for campaigns by default", async () => {
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.SMTPCOM_API_KEY = "smtp-test-key";
    process.env.SMTPCOM_CHANNEL = "campaign";
    process.env.SMTPCOM_FROM_EMAIL = "news@example.com";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"status":"success"}' });
    global.fetch = fetchMock as typeof fetch;

    const { sendCampaignEmail } = await import("./lib/email/sendCampaignEmail");
    const ok = await sendCampaignEmail({
      to: { name: "User", email: "user@example.com" },
      subject: "Newsletter",
      htmlBody: "<p>Hi</p>",
      campaignId: 1,
      listUnsubscribeUrl: "https://example.com/u",
    });

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.smtp.com/v4/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer smtp-test-key");
    const body = JSON.parse(String(init.body));
    expect(body.channel).toBe("campaign");
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
    delete process.env.SMPTCOM_API_KEY;
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
