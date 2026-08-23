import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearAllSendGridSuppressionLists,
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

  it("reports blocked only when response body contains a suppression", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/asm/suppressions/global/user%40example.com")) {
        return new Response(JSON.stringify({ recipient_email: "user@example.com" }), {
          status: 200,
        });
      }
      if (path.includes("/suppression/bounces/user%40example.com")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const status = await getSendGridSuppressionStatus("user@example.com");
    expect(status.global_unsubscribe).toBe(true);
    expect(status.bounces).toBe(false);
    expect(isSendGridDeliveryBlocked(status)).toBe(true);
  });

  it("clears all bulk suppression lists with delete_all", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (method === "DELETE" && path.endsWith("/suppression/bounces")) {
        return new Response(null, { status: 204 });
      }
      if (method === "DELETE" && path.endsWith("/suppression/blocks")) {
        return new Response(null, { status: 204 });
      }
      if (method === "DELETE" && path.endsWith("/suppression/spam_reports")) {
        return new Response(null, { status: 204 });
      }
      if (method === "DELETE" && path.endsWith("/suppression/invalid_emails")) {
        return new Response(null, { status: 204 });
      }
      if (path.includes("/asm/suppressions/global?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await clearAllSendGridSuppressionLists();
    expect(result.bounces.cleared).toBe(true);
    expect(result.global_unsubscribe.cleared).toBe(true);
  });

  it("clears a single email from all lists", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await clearSendGridSuppressionLists("user@example.com");
    expect(result.global_unsubscribe.status).toBe(204);
    expect(fetch).toHaveBeenCalled();
  });
});
