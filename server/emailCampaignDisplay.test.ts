// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { prepareEmailRichTextHtml } from "@shared/emailRichTextHtml";
import { normalizeCampaignEmailHtml, EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX } from "@shared/emailCampaignLayout";

describe("prepareEmailRichTextHtml", () => {
  it("preserves bold and strips ChatGPT metadata for email text blocks", () => {
    const input =
      '<p data-start="0"><span style="font-weight: 600;">Important</span> ✅ update</p><ul><li><strong>Item</strong></li></ul>';
    const output = prepareEmailRichTextHtml(input);

    expect(output).toContain("<strong>Important</strong>");
    expect(output).toContain("<strong>Item</strong>");
    expect(output).toContain("✅");
    expect(output).not.toContain("data-start");
    expect(output).not.toContain("font-weight");
  });

  it("merges emoji-only blocks and keeps following text inline", () => {
    const input = "<p>📌</p><p><strong>Follow up</strong></p>";
    const output = prepareEmailRichTextHtml(input);

    expect(output).toContain("📌");
    expect(output).toContain("<strong>Follow up</strong>");
    expect(output.match(/<p/g)?.length).toBe(1);
  });

  it("replaces math nodes with readable fallback text", () => {
    const input = '<p>Formula: <span data-type="inline-math" data-latex="E=mc^2"></span></p>';
    const output = prepareEmailRichTextHtml(input);

    expect(output).toContain("[E=mc^2]");
    expect(output).not.toContain("data-type");
  });

  it("replaces iframes with view links", () => {
    const input = '<p>Watch:</p><iframe src="https://example.com/video"></iframe>';
    const output = prepareEmailRichTextHtml(input);

    expect(output).toContain('href="https://example.com/video"');
    expect(output).toContain("View content");
    expect(output).not.toContain("<iframe");
  });
});

describe("normalizeCampaignEmailHtml", () => {
  it("upgrades legacy 600px and 900px containers to the campaign width", () => {
    const legacy600 = '<table width="600" style="max-width:600px;">';
    const legacy900 = '<table width="900" style="max-width:900px;">';

    expect(normalizeCampaignEmailHtml(legacy600)).toContain(`width="${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}"`);
    expect(normalizeCampaignEmailHtml(legacy600)).toContain(`max-width:${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}px`);
    expect(normalizeCampaignEmailHtml(legacy900)).toContain(`width="${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}"`);
    expect(normalizeCampaignEmailHtml(legacy900)).toContain(`max-width:${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}px`);
  });

  it("neutralizes stub CTA hrefs and strips leaked editor attributes", () => {
    const input =
      '<a href="https://" data-start="1" containerstyle="foo">Buy</a><p data-end="2"><strong>Hello</strong></p>';
    const output = normalizeCampaignEmailHtml(input);

    expect(output).toContain('href="#"');
    expect(output).not.toContain("data-start");
    expect(output).not.toContain("data-end");
    expect(output).not.toContain("containerstyle");
    expect(output).toContain("<strong>Hello</strong>");
  });
});
