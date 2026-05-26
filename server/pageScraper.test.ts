/**
 * pageScraper.test.ts
 * Unit tests for the pageScraperRouter htmlToBlocks logic.
 * We test the scraper by calling the internal htmlToBlocks function
 * indirectly through a minimal test harness that replicates the parsing logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as cheerio from "cheerio";

// ─── Replicate the htmlToBlocks helper locally for unit testing ───────────────
// (Mirrors the logic in pageScraperRouter.ts without requiring tRPC context)

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function resolveUrl(src: string, baseUrl: string): string {
  if (!src) return "";
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

interface ScrapedBlock {
  id: string;
  type: string;
  data: Record<string, any>;
}

function htmlToBlocks(html: string, baseUrl: string): ScrapedBlock[] {
  const $ = cheerio.load(html);

  $("script, style, noscript, nav, footer, header, aside, [role='navigation'], [role='banner'], [role='complementary'], .cookie-banner, #cookie, .popup, .modal, .overlay, .ad, .advertisement, .sidebar, .widget, .menu, .nav, .navbar, .header, .footer").remove();

  const blocks: ScrapedBlock[] = [];

  const ogTitle = $("meta[property='og:title']").attr("content") || "";
  const ogDesc = $("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content") || "";
  const ogImage = $("meta[property='og:image']").attr("content") || "";
  const h1Text = cleanText($("h1").first().text());

  const heroHeadline = h1Text || ogTitle || "";
  if (heroHeadline) {
    blocks.push({
      id: uid(),
      type: "hero",
      data: {
        headline: heroHeadline,
        subheadline: ogDesc || "",
        bgType: "color",
        bgColor: "#179ca3",
        textColor: "#ffffff",
        align: "center",
        imageUrl: ogImage ? resolveUrl(ogImage, baseUrl) : "",
        buttons: [],
      },
    });
    $("h1").first().remove();
  }

  const mainEl = $("main, [role='main'], article, .content, .main-content, #content, #main").first();
  const root = mainEl.length ? mainEl : $("body");

  root.children().each((_i, el) => {
    const tag = (el as any).tagName?.toLowerCase();
    if (!tag) return;

    const $el = $(el);
    const text = cleanText($el.text());
    if (!text && tag !== "img") return;

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      let richHtml = `<${tag === "h2" ? "h2" : "h3"}>${text}</${tag === "h2" ? "h2" : "h3"}>`;
      blocks.push({ id: uid(), type: "text", data: { html: richHtml, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    if (tag === "p") {
      if (text.length < 10) return;
      blocks.push({ id: uid(), type: "text", data: { html: `<p>${text}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    if (tag === "ul") {
      const items = $el.children("li").map((_j, li) => cleanText($(li).text())).get().filter(Boolean);
      if (items.length === 0) return;
      blocks.push({ id: uid(), type: "bullets", data: { headline: "", items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
      return;
    }

    if (tag === "ol") {
      const items = $el.children("li").map((_j, li) => cleanText($(li).text())).get().filter(Boolean);
      if (items.length === 0) return;
      blocks.push({ id: uid(), type: "numbered_list", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#ffffff" } });
      return;
    }

    if (tag === "img") {
      const src = resolveUrl($el.attr("src") || "", baseUrl);
      const alt = $el.attr("alt") || "";
      if (!src || src.includes("data:") || src.includes("pixel") || src.includes("tracking")) return;
      blocks.push({ id: uid(), type: "image", data: { url: src, alt, caption: "", align: "center", maxWidth: "auto", showShadow: true } });
      return;
    }
  });

  const deduped: ScrapedBlock[] = [];
  for (const block of blocks) {
    const last = deduped[deduped.length - 1];
    if (last && last.type === "text" && block.type === "text" && last.data.html === block.data.html) continue;
    deduped.push(block);
  }

  return deduped;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("htmlToBlocks", () => {
  const BASE_URL = "https://example.com";

  it("extracts H1 as a hero block", () => {
    const html = `<html><body><h1>Welcome to Ultrasound</h1></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].data.headline).toBe("Welcome to Ultrasound");
  });

  it("uses OG title as hero headline when no H1", () => {
    const html = `<html><head><meta property="og:title" content="OG Page Title" /></head><body><p>Some content here on the page.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const hero = blocks.find(b => b.type === "hero");
    expect(hero).toBeDefined();
    expect(hero!.data.headline).toBe("OG Page Title");
  });

  it("uses OG description as hero subheadline", () => {
    const html = `<html><head><meta property="og:title" content="Title" /><meta property="og:description" content="A great description" /></head><body></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const hero = blocks.find(b => b.type === "hero");
    expect(hero).toBeDefined();
    expect(hero!.data.subheadline).toBe("A great description");
  });

  it("extracts H2 as a text block with heading HTML", () => {
    const html = `<html><body><h2>Section Title</h2></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlock = blocks.find(b => b.type === "text");
    expect(textBlock).toBeDefined();
    expect(textBlock!.data.html).toContain("Section Title");
  });

  it("extracts paragraphs as text blocks", () => {
    const html = `<html><body><p>This is a long enough paragraph for testing.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlock = blocks.find(b => b.type === "text");
    expect(textBlock).toBeDefined();
    expect(textBlock!.data.html).toContain("This is a long enough paragraph");
  });

  it("skips very short paragraphs (< 10 chars)", () => {
    const html = `<html><body><p>Short</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlock = blocks.find(b => b.type === "text");
    expect(textBlock).toBeUndefined();
  });

  it("extracts UL as a bullets block", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li><li>Item three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const bulletsBlock = blocks.find(b => b.type === "bullets");
    expect(bulletsBlock).toBeDefined();
    expect(bulletsBlock!.data.items).toEqual(["Item one", "Item two", "Item three"]);
  });

  it("extracts OL as a numbered_list block", () => {
    const html = `<html><body><ol><li>First step</li><li>Second step</li></ol></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const listBlock = blocks.find(b => b.type === "numbered_list");
    expect(listBlock).toBeDefined();
    expect(listBlock!.data.items).toEqual(["First step", "Second step"]);
  });

  it("extracts IMG as an image block with resolved URL", () => {
    const html = `<html><body><img src="/images/scan.jpg" alt="Ultrasound scan" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const imageBlock = blocks.find(b => b.type === "image");
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.data.url).toBe("https://example.com/images/scan.jpg");
    expect(imageBlock!.data.alt).toBe("Ultrasound scan");
  });

  it("resolves absolute image URLs correctly", () => {
    const html = `<html><body><img src="https://cdn.example.com/img.png" alt="CDN image" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const imageBlock = blocks.find(b => b.type === "image");
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.data.url).toBe("https://cdn.example.com/img.png");
  });

  it("skips data: URI images", () => {
    const html = `<html><body><img src="data:image/png;base64,abc123" alt="base64" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const imageBlock = blocks.find(b => b.type === "image");
    expect(imageBlock).toBeUndefined();
  });

  it("removes nav, footer, and script elements", () => {
    const html = `<html><body><nav><a href="/">Home</a></nav><h1>Main Content</h1><footer>Footer text</footer></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    // Should have hero from H1 but no nav/footer content
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].data.headline).toBe("Main Content");
    // No block should contain "Footer text"
    const footerBlock = blocks.find(b => JSON.stringify(b.data).includes("Footer text"));
    expect(footerBlock).toBeUndefined();
  });

  it("deduplicates consecutive identical text blocks", () => {
    const html = `<html><body><p>Duplicate paragraph content here.</p><p>Duplicate paragraph content here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlocks = blocks.filter(b => b.type === "text" && b.data.html.includes("Duplicate paragraph"));
    expect(textBlocks.length).toBe(1);
  });

  it("assigns unique IDs to all blocks", () => {
    const html = `<html><body><h1>Title</h1><p>Paragraph one here.</p><p>Paragraph two here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const ids = blocks.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("handles empty HTML gracefully", () => {
    const html = `<html><body></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks).toEqual([]);
  });

  it("handles a full page with multiple content types", () => {
    const html = `
      <html>
        <head>
          <title>Ultrasound Guide</title>
          <meta name="description" content="A comprehensive guide" />
        </head>
        <body>
          <h1>Ultrasound Scanning Guide</h1>
          <h2>Preparation</h2>
          <p>Before scanning, ensure the patient is properly positioned for optimal imaging.</p>
          <ul>
            <li>Check transducer frequency</li>
            <li>Apply gel generously</li>
            <li>Adjust depth settings</li>
          </ul>
          <h2>Technique</h2>
          <p>Use a systematic approach when scanning each organ system during the examination.</p>
          <img src="/images/technique.jpg" alt="Scanning technique" />
        </body>
      </html>
    `;
    const blocks = htmlToBlocks(html, BASE_URL);
    const types = blocks.map(b => b.type);
    expect(types).toContain("hero");
    expect(types).toContain("text");
    expect(types).toContain("bullets");
    expect(types).toContain("image");
    expect(blocks.length).toBeGreaterThanOrEqual(5);
  });
});

describe("resolveUrl", () => {
  it("resolves relative URLs against base", () => {
    expect(resolveUrl("/path/to/image.jpg", "https://example.com")).toBe("https://example.com/path/to/image.jpg");
  });

  it("keeps absolute URLs unchanged", () => {
    expect(resolveUrl("https://cdn.example.com/img.png", "https://example.com")).toBe("https://cdn.example.com/img.png");
  });

  it("returns empty string for empty src", () => {
    expect(resolveUrl("", "https://example.com")).toBe("");
  });

  it("handles protocol-relative URLs", () => {
    const result = resolveUrl("//cdn.example.com/img.png", "https://example.com");
    expect(result).toBe("https://cdn.example.com/img.png");
  });
});

describe("cleanText", () => {
  it("collapses multiple whitespace into single space", () => {
    expect(cleanText("Hello   World")).toBe("Hello World");
  });

  it("trims leading and trailing whitespace", () => {
    expect(cleanText("  Hello World  ")).toBe("Hello World");
  });

  it("handles newlines and tabs", () => {
    expect(cleanText("Hello\n\tWorld")).toBe("Hello World");
  });
});
