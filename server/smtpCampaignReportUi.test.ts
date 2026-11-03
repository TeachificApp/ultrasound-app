import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SmtpCampaignAnalyticsPanel from "../client/src/components/admin/SmtpCampaignAnalyticsPanel";
import type { SmtpCampaignReport } from "../shared/smtpCampaignReport";

// The app uses Vite's automatic JSX transform; this repository's Vitest transform uses classic JSX.
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

const unavailable: SmtpCampaignReport = {
  status: "unconfigured", checkedAt: Date.parse("2026-11-03T18:00:00Z"), period: "this_day", channel: null, campaign: null,
  notice: "SMTP.com reporting is not connected.", campaignNotice: "Campaign counts cannot be attributed yet.",
};
const render = (report: SmtpCampaignReport) => renderToStaticMarkup(React.createElement(SmtpCampaignAnalyticsPanel, { report, period: "this_day", onPeriodChange: vi.fn(), onRefresh: vi.fn(), isLoading: false, isFetching: false, isError: false }));

describe("SMTP.com analytics display honesty", () => {
  it("renders missing reports as unavailable rather than zero engagement", () => {
    const html = render(unavailable);
    expect(html).toContain("SMTP.com reporting is not connected.");
    expect(html).toContain("aria-label=\"Unavailable\"");
    expect(html).toContain("Campaign counts cannot be attributed yet.");
    expect(html).not.toContain("0% rate");
  });

  it("separates channel totals, campaign matching and transactional delivery", () => {
    const html = render(unavailable);
    expect(html).toContain("Channel-wide provider totals");
    expect(html).toContain("not campaign-specific");
    expect(html).toContain("not unique-recipient counts");
    expect(html).toContain("Open events");
    expect(html).toContain("Click events");
    expect(html).toContain("Transactional emails remain on SendGrid");
    expect(html).toContain("Refresh SMTP.com report");
  });
});
