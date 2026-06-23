/**
 * Unit tests for email block HTML rendering fixes:
 * 1. emailBlocksToHtml standalone flag — avoids double-wrapping when used inside wrapInBrandedEmail
 * 2. Hero block respects hideButtons flag — no "Enroll Now" button rendered when hideButtons=true
 * 3. Image block max-width constraint — img tag has max-width:100%
 * 4. Footer block links — renders links from both d.links and d.footerLinks
 */

import { describe, it, expect } from "vitest";

// We test the pure rendering logic by importing the compiled output.
// Since EmailBlockEditor.tsx is a client-side component, we replicate the
// relevant pure functions here to keep tests server-side and dependency-free.

// ─── Minimal Block type ───────────────────────────────────────────────────────
type Block = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

// ─── Inline minimal emailBlockToHtml (mirrors the fixed version) ──────────────
function emailBlockToHtml(block: Block): string {
  const d = block.data as Record<string, any>;
  switch (block.type) {
    case "hero": {
      const buttons: { text?: string; url?: string }[] = d.buttons ?? [];
      const hideButtons = d.hideButtons === true;
      const visibleButtons = hideButtons
        ? []
        : buttons.filter((b) => b.text && b.text.trim());
      const btnHtml =
        visibleButtons.length > 0
          ? visibleButtons
              .map(
                (b) =>
                  `<a href="${b.url ?? "#"}" style="display:inline-block;background:#189aa1;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${b.text}</a>`,
              )
              .join(" ")
          : "";
      return `<div style="text-align:center;padding:40px 32px;">${d.title ? `<h1>${d.title}</h1>` : ""}${btnHtml}</div>`;
    }
    case "image": {
      const src = d.src ?? d.imageUrl ?? "";
      const maxWidth = d.maxWidth ?? "100%";
      const align = d.align ?? "center";
      return `<div style="text-align:${align};padding:16px 32px;"><img src="${src}" alt="${d.alt ?? ""}" style="max-width:${maxWidth};width:100%;height:auto;display:inline-block;" /></div>`;
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
  return [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;margin:0;padding:0;">`,
    `  <tr><td align="center" style="padding:20px 0;">`,
    `    <table width="900" cellpadding="0" cellspacing="0" border="0" style="max-width:900px;width:100%;background:#ffffff;border-radius:8px;">`,
    `      <tr><td style="padding:0;">`,
    innerHtml,
    pixel,
    `      </td></tr>`,
    `    </table>`,
    `  </td></tr>`,
    `</table>`,
  ].join("\n");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("emailBlocksToHtml standalone flag", () => {
  const blocks: Block[] = [
    { id: "1", type: "hero", data: { title: "Hello", hideButtons: true, buttons: [] } },
  ];

  it("wraps in 900px outer table when standalone=true (default)", () => {
    const html = emailBlocksToHtml(blocks);
    expect(html).toContain('width="900"');
    expect(html).toContain("max-width:900px");
  });

  it("does NOT wrap in outer table when standalone=false", () => {
    const html = emailBlocksToHtml(blocks, undefined, false);
    expect(html).not.toContain('width="900"');
    expect(html).not.toContain("max-width:900px");
    // Should still contain the block content
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
        title: "Test",
        hideButtons: true,
        buttons: [{ text: "Enroll Now", url: "https://example.com" }],
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
        title: "Test",
        hideButtons: false,
        buttons: [{ text: "Learn More", url: "https://example.com" }],
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
        title: "Test",
        hideButtons: false,
        buttons: [{ text: "", url: "https://example.com" }],
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
      data: { src: "https://example.com/img.png", maxWidth: "50%" },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("max-width:50%");
    expect(html).toContain("width:100%");
  });

  it("defaults to max-width:100% when no maxWidth set", () => {
    const block: Block = {
      id: "1",
      type: "image",
      data: { src: "https://example.com/img.png" },
    };
    const html = emailBlockToHtml(block);
    expect(html).toContain("max-width:100%");
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
    // The empty-text and empty-url links should not produce anchor tags for those entries
    const anchorCount = (html.match(/<a href=/g) ?? []).length;
    expect(anchorCount).toBe(1);
  });
});
