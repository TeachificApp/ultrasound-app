import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./emailLogger", () => ({
  logEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("sendCertificateEmail", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.SENDGRID_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.SENDGRID_API_KEY = "sg-test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.SENDGRID_API_KEY = originalApiKey;
    vi.clearAllMocks();
  });

  it("logs successful certificate sends to email_send_log", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" }) as typeof fetch;
    const { sendCertificateEmail } = await import("./certificateEmail");
    const { logEmail } = await import("./emailLogger");

    const sent = await sendCertificateEmail({
      to: { name: "Katie Smith", email: "katie@example.com" },
      courseTitle: "Echo CME Review",
      certificateUrl: "https://cdn.example.com/cert.pdf",
      pdfBuffer: Buffer.from("pdf"),
      issuedAt: new Date("2026-08-26T12:00:00Z"),
      userId: 42,
    });

    expect(sent).toBe(true);
    expect(logEmail).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      recipientEmail: "katie@example.com",
      emailType: "certificate",
      status: "sent",
    }));
  });

  it("logs failed certificate sends when SendGrid rejects", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" }) as typeof fetch;
    const { sendCertificateEmail } = await import("./certificateEmail");
    const { logEmail } = await import("./emailLogger");

    const sent = await sendCertificateEmail({
      to: { name: "Katie Smith", email: "katie@example.com" },
      courseTitle: "Echo CME Review",
      certificateUrl: "https://cdn.example.com/cert.pdf",
      pdfBuffer: Buffer.from("pdf"),
      issuedAt: new Date("2026-08-26T12:00:00Z"),
      userId: 42,
    });

    expect(sent).toBe(false);
    expect(logEmail).toHaveBeenCalledWith(expect.objectContaining({
      emailType: "certificate",
      status: "failed",
    }));
  });
});
