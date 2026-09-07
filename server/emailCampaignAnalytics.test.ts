import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CAMPAIGN_DESTINATION_UNAVAILABLE,
  campaignEventDestination,
  escapeCampaignCsvCell,
  parseCampaignEventMetadata,
} from "./lib/emailCampaignAnalytics";

describe("campaign analytics event normalization", () => {
  it("uses the current click destination and variant metadata", () => {
    expect(parseCampaignEventMetadata('{"recipient":"reader@example.test","url":"https://example.test/course","variant":"B"}')).toEqual({
      destinationUrl: "https://example.test/course",
      variant: "B",
      recipientEmail: "reader@example.test",
    });
  });

  it("keeps legacy destination URLs visible and groups recipient-only metadata as unavailable", () => {
    expect(campaignEventDestination("https://example.test/legacy")).toBe("https://example.test/legacy");
    expect(campaignEventDestination('{"recipient":"reader@example.test"}')).toBe(CAMPAIGN_DESTINATION_UNAVAILABLE);
    expect(campaignEventDestination(null)).toBe(CAMPAIGN_DESTINATION_UNAVAILABLE);
    expect(parseCampaignEventMetadata('{"recipient":"reader@example.test"}').recipientEmail).toBe("reader@example.test");
  });

  it("makes every client-exported event cell safe for spreadsheet readers", () => {
    expect(escapeCampaignCsvCell('=HYPERLINK("https://example.test")')).toBe('"\'=HYPERLINK(""https://example.test"")"');
    expect(escapeCampaignCsvCell("normal text")).toBe('"normal text"');
  });
});

describe("complete campaign event export contract", () => {
  it("exports all event types rather than only click rows and the dialog uses the complete export", () => {
    const router = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
    const dashboard = readFileSync(new URL("../client/src/pages/EmailCampaignDashboard.tsx", import.meta.url), "utf8");
    const clickBreakdown = router.slice(
      router.indexOf("getClickLinkBreakdown: protectedProcedure"),
      router.indexOf("exportClickEvents: protectedProcedure"),
    );

    expect(router).toContain("exportCampaignEvents: protectedProcedure");
    expect(router).toMatch(/exportCampaignEvents[\s\S]*?WHERE e\.campaignId = \$\{input\.campaignId\}[\s\S]*?ORDER BY e\.createdAt DESC/);
    expect(router).not.toMatch(/exportCampaignEvents[\s\S]*?WHERE e\.campaignId = \$\{input\.campaignId\}[\s\S]{0,120}AND e\.eventType = 'click'/);
    expect(clickBreakdown).toContain("campaignEventDestination(r.metadata)");
    expect(clickBreakdown).not.toContain("metadata IS NOT NULL");
    expect(dashboard).toContain("trpc.emailCampaign.exportCampaignEvents.useQuery");
    expect(dashboard).toContain("Export All Event Data");
    expect(dashboard).toContain("formulaSafe");
  });
});
