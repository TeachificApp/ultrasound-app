import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearSendGridSuppressionLists,
  getSendGridSuppressionStatus,
  isSendGridDeliveryBlocked,
} from "./lib/sendgridSuppressions";

describe("sendgridSuppressions", () => {
  const originalKey = process.env.SENDGRID_API_KEY;

  beforeEach(() => {
    process.env.SENDGRID_API_KEY = "SG.test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.SENDGRID_API_KEY = originalKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("treats SendGrid's empty 200 lookup payloads as unsuppressed", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/asm/suppressions/global/")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const status = await getSendGridSuppressionStatus("user@example.com");
    expect(status).toEqual({
      global_unsubscribe: false,
      bounces: false,
      blocks: false,
      spam_reports: false,
      invalid_emails: false,
    });
    expect(isSendGridDeliveryBlocked(status)).toBe(false);
  });

  it("reports blocked only when a suppression response contains the queried address", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/asm/suppressions/global/")) {
        return new Response(JSON.stringify({ recipient_email: "user@example.com" }), { status: 200 });
      }
      if (path.includes("/suppression/bounces/")) {
        return new Response(JSON.stringify([{ email: "user@example.com" }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const status = await getSendGridSuppressionStatus("user@example.com");
    expect(status.global_unsubscribe).toBe(true);
    expect(status.bounces).toBe(true);
    expect(status.blocks).toBe(false);
    expect(isSendGridDeliveryBlocked(status)).toBe(true);
  });

  it("clears only the legacy global marketing suppression when explicitly requested", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await clearSendGridSuppressionLists("user@example.com", ["global_unsubscribe"]);
    expect(result.global_unsubscribe.removed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/asm/suppressions/global/");
  });
});
