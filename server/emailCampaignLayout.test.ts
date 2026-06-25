import { describe, it, expect } from "vitest";
import {
  EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX,
  EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH,
  normalizeCampaignEmailHtml,
  renderCampaignImageHtml,
  resolveCampaignImageWidth,
  wrapInBrandedCampaignEmail,
} from "../shared/emailCampaignLayout";

describe("emailCampaignLayout", () => {
  it("uses 750px container in branded wrapper", () => {
    const html = wrapInBrandedCampaignEmail("<p>Hi</p>", "Preview");
    expect(html).toContain(`width="${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}"`);
    expect(html).toContain(`max-width:${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}px`);
    expect(html).not.toContain("max-width:600px");
  });

  it("defaults image width to 50%", () => {
    expect(resolveCampaignImageWidth()).toBe(EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH);
    expect(resolveCampaignImageWidth("100%")).toBe(EMAIL_CAMPAIGN_DEFAULT_IMAGE_WIDTH);
    expect(resolveCampaignImageWidth("25%")).toBe("25%");
  });

  it("renders image blocks at 50% by default", () => {
    const html = renderCampaignImageHtml({ src: "https://example.com/a.png", alt: "A" });
    expect(html).toContain('width="50%"');
    expect(html).toContain("width:50%");
  });

  it("normalizes legacy 600px containers and full-width images", () => {
    const legacy = `<table width="600" style="max-width:600px"><tr><td><img src="x" width="100%" /></td></tr></table>`;
    const out = normalizeCampaignEmailHtml(legacy);
    expect(out).toContain(`width="${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}"`);
    expect(out).toContain(`max-width:${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}px`);
    expect(out).toContain('width="50%"');
    expect(out).not.toContain('width="100%"');
  });
});
