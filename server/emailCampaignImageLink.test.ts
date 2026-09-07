import { describe, expect, it } from "vitest";
import { emailBlockToHtml } from "../client/src/components/EmailBlockEditor";
import { normalizeCampaignEmailHtml } from "../shared/emailCampaignLayout";
import { wrapLinksForTracking } from "./lib/emailCampaignTracking";

describe("campaign image links", () => {
  it("keeps an editor-authored relative image link clickable in the sent email HTML", () => {
    const html = emailBlockToHtml({
      id: "image-1",
      type: "image",
      data: {
        url: "https://cdn.example.test/banner.png",
        alt: "Course banner",
        linkUrl: "/courses/fetal-echo",
      },
    } as any);

    expect(html).toContain('<a href="https://learn.allaboutultrasound.com/courses/fetal-echo"');
    expect(html).toContain('<img src="https://cdn.example.test/banner.png"');
    expect(normalizeCampaignEmailHtml(html)).toContain('href="https://learn.allaboutultrasound.com/courses/fetal-echo"');
  });

  it("retains a compatible legacy image destination and lets click tracking wrap its anchor", () => {
    const html = emailBlockToHtml({
      id: "image-legacy",
      type: "image",
      data: { url: "https://cdn.example.test/legacy.png", link: "https://example.test/details" },
    } as any);

    const tracked = wrapLinksForTracking(html, 25, "u42");
    expect(tracked).toContain("/api/email/track/click/25/u42?url=");
    expect(tracked).toContain(encodeURIComponent("https://example.test/details"));
    expect(tracked).toContain('<img src="https://cdn.example.test/legacy.png"');
  });

  it("does not wrap a placeholder image destination", () => {
    const html = emailBlockToHtml({
      id: "image-stub",
      type: "image",
      data: { url: "https://cdn.example.test/banner.png", linkUrl: "https://" },
    } as any);

    expect(html).not.toContain("<a href=");
  });
});
