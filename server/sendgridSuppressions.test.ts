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

  it("reports blocked when any suppression list contains the email", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/asm/suppressions/global/")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const status = await getSendGridSuppressionStatus("user@example.com");
    expect(status.global_unsubscribe).toBe(true);
    expect(status.bounces).toBe(false);
    expect(isSendGridDeliveryBlocked(status)).toBe(true);
  });

  it("clears all suppression lists for transactional resubscribe", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await clearSendGridSuppressionLists("user@example.com");
    expect(result.global_unsubscribe.removed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/asm/suppressions/global/");
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("/suppression/bounces/");
  });
});
