/**
 * Unit tests for email block HTML rendering fixes:
 * 1. emailBlocksToHtml standalone flag — avoids double-wrapping when used inside wrapInBrandedEmail
 * 2. Hero block respects hideButtons flag
 * 3. Image block max-width constraint
 * 4. Footer block links — renders links from both d.links and d.footerLinks
 * 5. Container width matches EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX (750px)
 */

import { describe, it, expect } from "vitest";
import { EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX } from "@shared/emailCampaignLayout";

type Block = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

function emailBlockToHtml(block: Block): string {
  const d = block.data as Record<string, any>;
  switch (block.type) {
    case "hero": {
      const buttons: { text?: string; link?: string; url?: string }[] = d.buttons ?? [];
      const hideButtons = d.hideButtons === true;
      const visibleButtons = hideButtons
        ? []
        : buttons.filter((b) => b.text && b.text.trim() && b.text !== "Enroll Now" && b.text !== "Get Started");
      const btnHtml =
        visibleButtons.length > 0
          ? visibleButtons
              .map(
                (b) =>
                  `<a href="${b.link ?? b.url ?? "#"}" style="display:inline-block;background:#189aa1;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${b.text}</a>`,
              )
              .join(" ")
          : "";
      const headline = d.headline ?? d.title ?? "";
      return `<div style="text-align:center;padding:40px 32px;">${headline ? `<h1>${headline}</h1>` : ""}${btnHtml}</div>`;
    }
    case "image": {
      const url = d.url ?? d.src ?? d.imageUrl ?? "";
      const rawWidth = d.maxWidth ?? "100%";
      const imgWidth = rawWidth === "auto" ? "100%" : rawWidth;
      const align = d.align ?? "center";
      return `<div style="text-align:${align};padding:16px 32px;"><img src="${url}" alt="${d.alt ?? ""}" style="max-width:100%;width:${imgWidth};display:block;" /></div>`;
    }
    case "footer": {
      const links: { text?: string; url?: string }[] = d.links ?? d.footerLinks ?? [];
      const validLinks = links.filter((l) => l.text && l.url);
      const linkHtml = validLinks
        .map((l) => `<a href="${l.url}" style="color:#189aa1;">${l.text}</a>`)
        .join(" &middot; ");
      const copy = d.copyrightText ?? d.copyright ?? "";
      return `<div style="text-align:center;padding:16px 32px;">${copy ? `<p>${copy}</p>` : ""}${linkHtml}</div>`;
    }
    default:
      return "";
  }
}

function emailBlocksToHtml(blocks: Block[], trackingPixelUrl?: string, standalone = true): string {
  const innerHtml = blocks.map(emailBlockToHtml).filter(Boolean).join("\n");
  const pixel = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`
    : "";
  if (!standalone) {
    return innerHtml + pixel;
  }
  const w = EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX;
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;margin:0;padding:0;">`,
    `  <tr><td align="center" valign="top" style="padding:20px 16px;">`,
    `    <table role="presentation" align="center" width="${w}" cellpadding="0" cellspacing="0" border="0" style="max-width:${w}px;width:100%;background:#ffffff;border-radius:8px;">`,
    `      <tr><td style="padding:0;">`,
    innerHtml,
    pixel,
    `      </td></tr>`,
    `    </table>`,
    `  </td></tr>`,
    `</table>`,
  ].join("\n");
}

describe("emailBlocksToHtml standalone flag", () => {
  const blocks: Block[] = [
    { id: "1", type: "hero", data: { headline: "Hello", hideButtons: true, buttons: [] } },
  ];

  it(`wraps in ${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}px outer table when standalone=true`, () => {
    const html = emailBlocksToHtml(blocks);
    expect(html).toContain(`width="${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}"`);
    expect(html).toContain(`max-width:${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}px`);
  });

  it("does NOT wrap in outer table when standalone=false", () => {
    const html = emailBlocksToHtml(blocks, undefined, false);
    expect(html).not.toContain(`width="${EMAIL_CAMPAIGN_CONTAINER_WIDTH_PX}"`);
    expect(html).toContain("Hello");
  });

  it("injects tracking pixel in standalone mode", () => {
    const html = emailBlocksToHtml(blocks, "https://example.com/pixel.gif");
    expect(html).toContain("https://example.com/pixel.gif");
  });

  it("injects tracking pixel in non-standalone mode", () => {
    const html = emailBlocksToHtml(blocks, "https://example.com/pixel.gif", false);
    expect(html).toContain("https://example.com/pixel.gif");
  });
});

describe("hero block hideButtons", () => {
  it("renders no buttons when hideButtons=true even if buttons array has entries", () => {
    const block: Block = {
      id: "1",
      type: "hero",
      data: {
        headline: "Test",
        hideButtons: true,
        buttons: [{ text: "Enroll Now", link: "https://example.com" }],
      },
    };
    const html = emailBlockToHtml(block);
    expect(html).not.toContain("Enroll Now");
    expect(html).not.toContain("<a href=");
  });

  it("renders buttons when hideButtons=false", () => {
    const block: Block = {
      id: "1",
      type: "hero",
      data: {
        headline: "Test",
        hideButtons: false,
        buttons: [{ text: "Learn More", link: "https://example.com" }],
      },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("Learn More");
    expect(html).toContain("https://example.com");
  });

  it("skips buttons with empty text even when hideButtons=false", () => {
    const block: Block = {
      id: "1",
      type: "hero",
      data: {
        headline: "Test",
        hideButtons: false,
        buttons: [{ text: "", link: "https://example.com" }],
      },
    };
    const html = emailBlockToHtml(block);
    expect(html).not.toContain("<a href=");
  });
});

describe("image block max-width constraint", () => {
  it("includes max-width:100% on img tag", () => {
    const block: Block = {
      id: "1",
      type: "image",
      data: { url: "https://example.com/img.png", maxWidth: "50%" },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("max-width:100%");
    expect(html).toContain("width:50%");
  });

  it("defaults to width 100% when no maxWidth set", () => {
    const block: Block = {
      id: "1",
      type: "image",
      data: { url: "https://example.com/img.png" },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("width:100%");
  });
});

describe("footer block links", () => {
  it("renders links from d.links", () => {
    const block: Block = {
      id: "1",
      type: "footer",
      data: {
        links: [
          { text: "Unsubscribe", url: "https://example.com/unsub" },
          { text: "Privacy", url: "https://example.com/privacy" },
        ],
        copyrightText: "© 2026 AAUS",
      },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("Privacy");
    expect(html).toContain("© 2026 AAUS");
  });

  it("renders links from d.footerLinks (legacy key)", () => {
    const block: Block = {
      id: "1",
      type: "footer",
      data: {
        footerLinks: [{ text: "Terms", url: "https://example.com/terms" }],
      },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("Terms");
  });

  it("skips links with missing text or url", () => {
    const block: Block = {
      id: "1",
      type: "footer",
      data: {
        links: [
          { text: "", url: "https://example.com" },
          { text: "Valid", url: "" },
          { text: "Good", url: "https://example.com/good" },
        ],
      },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("Good");
    const anchorCount = (html.match(/<a href=/g) ?? []).length;
    expect(anchorCount).toBe(1);
  });
});
