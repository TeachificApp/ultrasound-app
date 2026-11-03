import { afterEach, describe, expect, it, vi } from "vitest";
import { getSmtpCampaignReport, parseSmtpChannelStats, parseSmtpMessages, summarizeSmtpCampaignMessages } from "./lib/email/smtpCampaignReporting";
import { usesSmtpCampaignAnalytics } from "../shared/smtpCampaignReport";
import { readFileSync } from "node:fs";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; vi.unstubAllGlobals(); });
const message = (id: string, email: string, campaignId: string = "25") => ({
  msg_id: id, channel: "marketing", smtp_vars: { campaignId }, msg_data: { rcpt_to: email },
  details: { delivery: { event: "delivered" } }, opens: { items: [{ open_time: "one" }, { open_time: "two" }] },
  clicks: { items: [{ click_time: "one" }] }, unsubs: { items: [] }, abuse: { complaints: [] },
});
const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value });

describe("SMTP.com metric and attribution contracts", () => {
  it("preserves historical SendGrid analytics and starts the switch on November 3 Eastern", () => {
    expect(usesSmtpCampaignAnalytics({ sentAt: "2026-11-03T04:59:59Z" })).toBe(false);
    expect(usesSmtpCampaignAnalytics({ sentAt: "2026-11-03T05:00:00Z", createdAt: "2026-10-30T00:00:00Z" })).toBe(true);
  });

  it("selects only the configured channel and does not pretend total events are unique counts", () => {
    const stats = parseSmtpChannelStats({ status: "success", data: { marketing: { accepted: 14667, delivered: 12849, opened: 1552, clicked: 13815 }, transactional: { accepted: 50 } } }, "marketing");
    expect(stats).toMatchObject({ accepted: 14667, delivered: 12849, opened: 1552, clicked: 13815, failed: null });
    expect(stats).not.toHaveProperty("uniqueOpens");
    expect(parseSmtpChannelStats({ accepted: 14717, delivered: 12899 }, "marketing")).toBeNull();
    expect(parseSmtpChannelStats({ status: "success", data: { other: { accepted: 400 } } }, "marketing")).toBeNull();
  });

  it("matches by echoed campaign ID or saved message ID, rejects other campaigns/channels, and dedupes recipient identity", () => {
    const first = message("m1", "Reader@Example.test");
    const result = summarizeSmtpCampaignMessages([first, first, message("m2", "reader@example.test"), message("foreign", "foreign@example.test", "26"), { ...message("transactional", "foreign@example.test"), channel: "transactional" }], "marketing", 25);
    expect(result).toMatchObject({ matchedMessages: 2, uniqueOpenRecipients: 1, uniqueClickRecipients: 1, partial: false, counts: { accepted: 2, delivered: 2, opened: 4, clicked: 2 } });
    expect(summarizeSmtpCampaignMessages([message("foreign", "foreign@example.test", "26")], "marketing", 25)).toBeNull();
    expect(summarizeSmtpCampaignMessages([{ ...message("mapped", "reader@example.test", "26"), smtp_vars: {} }], "marketing", 25, ["mapped", "missing"])).toMatchObject({ matchedMessages: 1, partial: true });
  });

  it("does not convert missing engagement arrays or delivery events into fabricated zero counts", () => {
    const result = summarizeSmtpCampaignMessages([{ ...message("m1", "reader@example.test"), opens: undefined, clicks: undefined, details: undefined }], "marketing", 25);
    expect(result).toMatchObject({ counts: { opened: null, clicked: null, delivered: null }, uniqueOpenRecipients: null, uniqueClickRecipients: null });
    expect(() => parseSmtpMessages({ status: "fail", data: { items: [] } })).toThrow();
  });
});

describe("SMTP.com read-only reporting", () => {
  it("reports unavailable when credentials are absent without making an external call", async () => {
    delete process.env.SMTPCOM_API_KEY; delete process.env.SMTPCOM_CHANNEL;
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const report = await getSmtpCampaignReport({ campaignId: 30, start: new Date("2026-11-03T00:00:00Z") });
    expect(report).toMatchObject({ status: "unconfigured", channel: null, campaign: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses documented GET pagination and RFC 2822 dates, header-only authentication, and caches normalized results", async () => {
    process.env.SMTPCOM_API_KEY = "report-test-key"; process.env.SMTPCOM_CHANNEL = "marketing";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "success", data: { items: [{ name: "marketing" }] } }))
      .mockResolvedValueOnce(response({ status: "success", data: { marketing: { accepted: 100, delivered: 90, opened: 12, clicked: 18 } } }))
      .mockResolvedValueOnce(response({ status: "success", data: { items: Array.from({ length: 1000 }, (_, i) => message(`other-${i}`, "other@example.test", "99")) } }))
      .mockResolvedValueOnce(response({ status: "success", data: { items: [message("ours", "reader@example.test", "31")] } }));
    vi.stubGlobal("fetch", fetchMock);
    const input = { campaignId: 31, start: new Date("2026-11-03T00:00:00Z") };
    const report = await getSmtpCampaignReport(input);
    expect(report).toMatchObject({ status: "ready", channel: { counts: { accepted: 100 } }, campaign: { matchedMessages: 1, counts: { accepted: 1 }, uniqueOpenRecipients: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [url, opts] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("report-test-key");
      expect(opts).toMatchObject({ method: "GET", headers: { "X-SMTPCOM-API": "report-test-key", Accept: "application/json" } });
      expect(new URL(String(url)).searchParams.get("limit")).toBe("1000");
    }
    const page1 = new URL(String(fetchMock.mock.calls[2][0]));
    const page2 = new URL(String(fetchMock.mock.calls[3][0]));
    expect(page1.searchParams.get("start")).toBe("Tue, 03 Nov 2026 00:00:00 +0000");
    expect(page1.searchParams.has("event")).toBe(false);
    expect(page1.searchParams.get("offset")).toBe("0");
    expect(page2.searchParams.get("offset")).toBe("1000");
    await getSmtpCampaignReport(input);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not leak API error bodies or report zero for authorization errors", async () => {
    process.env.SMTPCOM_API_KEY = "private-test-key"; process.env.SMTPCOM_CHANNEL = "marketing";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ secret: "private-test-key" }) }));
    const report = await getSmtpCampaignReport({ campaignId: 32, start: new Date("2026-11-03T00:00:00Z") });
    expect(report.status).toBe("error");
    expect(report.channel).toBeNull(); expect(report.campaign).toBeNull();
    expect(JSON.stringify(report)).not.toContain("private-test-key");
  });

  it("retains channel results when detailed message retention prevents historical campaign matching", async () => {
    process.env.SMTPCOM_API_KEY = "report-test-key"; process.env.SMTPCOM_CHANNEL = "marketing";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: "success", data: { items: [{ name: "marketing" }] } }))
      .mockResolvedValueOnce(response({ status: "success", data: { marketing: { accepted: 100 } } }))
      .mockResolvedValueOnce({ ok: false, status: 400 });
    vi.stubGlobal("fetch", fetchMock);
    const report = await getSmtpCampaignReport({ campaignId: 33, start: new Date("2026-11-03T00:00:00Z"), period: "this_week" });
    expect(report).toMatchObject({ status: "ready", channel: { counts: { accepted: 100 } }, campaign: null, period: "this_week" });
    expect(report.campaignNotice).toContain("not zero");
  });

  it("keeps the endpoint admin-only and direct send-log attribution replaces the unsafe retroactive tag", () => {
    const router = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
    const email = readFileSync(new URL("./_core/email.ts", import.meta.url), "utf8");
    expect(router).toContain("getSmtpCampaignReport: protectedProcedure");
    const procedure = router.slice(router.indexOf("getSmtpCampaignReport: protectedProcedure"), router.indexOf("getCampaignAnalytics: protectedProcedure"));
    expect(procedure).toContain("await assertAdmin(ctx.user.id)");
    expect(router).not.toContain("WHERE recipient_email = ${recipient.email} AND campaign_id IS NULL");
    expect(email).toContain("campaignId: opts.campaignId ?? null");
    expect(email).toContain("providerMessageId: receipt.messageId");
  });
});
