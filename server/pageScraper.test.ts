/**
 * pageScraper.test.ts
 * Unit tests for the pageScraperRouter htmlToBlocks logic.
 * We test the scraper by replicating the parsing helpers locally.
 */
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

// ─── Replicate helpers from pageScraperRouter ────────────────────────────────

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

const CHECKMARK_REGEX = /^[\s]*[✓✔✅☑✗☒✘]/u;
const CHECKMARK_ENTITY_REGEX = /^[\s]*(?:&#10003;|&#10004;|&#9989;|&#9745;|&check;)/i;

function stripCheckmark(text: string): string {
  return text.replace(/^[\s]*[✓✔✅☑✗☒✘]\s*/u, "").trim();
}

function isChecklistUl($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): boolean {
  const items = $ul.children("li").toArray();
  if (items.length === 0) return false;
  let checkCount = 0;
  for (const li of items) {
    const $li = $(li);
    const rawText = $li.text();
    const trimmed = rawText.trim();
    if (CHECKMARK_REGEX.test(trimmed) || CHECKMARK_ENTITY_REGEX.test(trimmed)) {
      checkCount++;
      continue;
    }
    const hasCheckIcon = $li.find(
      "[class*='check'], [class*='tick'], [aria-label*='check'], [aria-label*='Check'], [title*='check'], [title*='Check'], svg[class*='check'], img[alt*='check'], img[alt*='Check']"
    ).length > 0;
    if (hasCheckIcon) {
      checkCount++;
      continue;
    }
    const liHtml = $.html($li) || "";
    if (/[✓✔✅☑]/.test(liHtml)) {
      checkCount++;
    }
  }
  return checkCount > items.length / 2;
}

function extractListItems($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): string[] {
  return $ul
    .children("li")
    .map((_j: number, li: any) => {
      const raw = cleanText($(li).text());
      return stripCheckmark(raw) || raw;
    })
    .get()
    .filter(Boolean);
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
      let next = $el.next();
      while (next.length && !["h1", "h2", "h3", "h4"].includes((next[0] as any).tagName?.toLowerCase() ?? "")) {
        const nextTag = (next[0] as any).tagName?.toLowerCase();
        if (nextTag === "p") richHtml += `<p>${cleanText(next.text())}</p>`;
        next = next.next();
      }
      blocks.push({ id: uid(), type: "text", data: { html: richHtml, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    if (tag === "p") {
      if (text.length < 10) return;
      blocks.push({ id: uid(), type: "text", data: { html: `<p>${text}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    if (tag === "ul") {
      const items = extractListItems($, $el);
      if (items.length === 0) return;
      if (isChecklistUl($, $el)) {
        blocks.push({ id: uid(), type: "checklist", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
      } else {
        blocks.push({ id: uid(), type: "bullets", data: { headline: "", items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
      }
      return;
    }

    if (tag === "ol") {
      const items = $el.children("li").map((_j: number, li: any) => cleanText($(li).text())).get().filter(Boolean);
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

const BASE_URL = "https://example.com";

describe("htmlToBlocks — basic extraction", () => {
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

  it("skips data: URI images", () => {
    const html = `<html><body><img src="data:image/png;base64,abc123" alt="base64" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "image")).toBeUndefined();
  });

  it("removes nav, footer, and script elements", () => {
    const html = `<html><body><nav><a href="/">Home</a></nav><h1>Main Content</h1><footer>Footer text</footer></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].data.headline).toBe("Main Content");
    expect(blocks.find(b => JSON.stringify(b.data).includes("Footer text"))).toBeUndefined();
  });

  it("deduplicates consecutive identical text blocks", () => {
    const html = `<html><body><p>Duplicate paragraph content here.</p><p>Duplicate paragraph content here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlocks = blocks.filter(b => b.type === "text" && b.data.html.includes("Duplicate paragraph"));
    expect(textBlocks.length).toBe(1);
  });

  it("handles empty HTML gracefully", () => {
    const html = `<html><body></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks).toEqual([]);
  });
});

describe("htmlToBlocks — regular UL → bullets block", () => {
  it("extracts plain UL as a bullets block", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li><li>Item three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const bulletsBlock = blocks.find(b => b.type === "bullets");
    expect(bulletsBlock).toBeDefined();
    expect(bulletsBlock!.data.items).toEqual(["Item one", "Item two", "Item three"]);
  });

  it("does NOT produce a checklist block for plain UL", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeUndefined();
  });
});

describe("htmlToBlocks — checkmark UL → checklist block", () => {
  it("detects ✓ checkmark emoji and produces checklist block", () => {
    const html = `<html><body><ul><li>✓ First benefit</li><li>✓ Second benefit</li><li>✓ Third benefit</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items).toEqual(["First benefit", "Second benefit", "Third benefit"]);
  });

  it("detects ✔ checkmark emoji and produces checklist block", () => {
    const html = `<html><body><ul><li>✔ Benefit A</li><li>✔ Benefit B</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeDefined();
  });

  it("detects ✅ green checkmark emoji and produces checklist block", () => {
    const html = `<html><body><ul><li>✅ Feature one</li><li>✅ Feature two</li><li>✅ Feature three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items).toEqual(["Feature one", "Feature two", "Feature three"]);
  });

  it("detects ☑ ballot box checkmark and produces checklist block", () => {
    const html = `<html><body><ul><li>☑ Option one</li><li>☑ Option two</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeDefined();
  });

  it("strips checkmark character from item text", () => {
    const html = `<html><body><ul><li>✓ Clean item text</li><li>✓ Another clean item</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    // Items should NOT contain the checkmark character
    for (const item of checklist!.data.items) {
      expect(item).not.toMatch(/[✓✔✅☑]/u);
    }
    expect(checklist!.data.items[0]).toBe("Clean item text");
  });

  it("detects checklist via CSS class check icon", () => {
    const html = `<html><body><ul>
      <li><i class="fa fa-check"></i> Item with icon</li>
      <li><i class="fa fa-check"></i> Another item</li>
      <li><i class="fa fa-check"></i> Third item</li>
    </ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeDefined();
  });

  it("detects checklist via aria-label check icon", () => {
    const html = `<html><body><ul>
      <li><span aria-label="check">✓</span> First</li>
      <li><span aria-label="check">✓</span> Second</li>
    </ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeDefined();
  });

  it("does NOT produce checklist if only minority of items have checkmarks", () => {
    // Only 1 out of 4 items has a checkmark — should remain bullets
    const html = `<html><body><ul><li>✓ Checked item</li><li>Plain item</li><li>Plain item</li><li>Plain item</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeUndefined();
    expect(blocks.find(b => b.type === "bullets")).toBeDefined();
  });

  it("uses checklist accentColor not iconColor", () => {
    const html = `<html><body><ul><li>✅ Item one</li><li>✅ Item two</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.accentColor).toBe("#179ca3");
    expect(checklist!.data).not.toHaveProperty("iconColor");
  });
});

describe("isChecklistUl helper", () => {
  it("returns true for majority checkmark items", () => {
    const $ = cheerio.load(`<ul><li>✓ A</li><li>✓ B</li><li>✓ C</li></ul>`);
    expect(isChecklistUl($, $("ul"))).toBe(true);
  });

  it("returns false for no checkmark items", () => {
    const $ = cheerio.load(`<ul><li>A</li><li>B</li><li>C</li></ul>`);
    expect(isChecklistUl($, $("ul"))).toBe(false);
  });

  it("returns false for empty list", () => {
    const $ = cheerio.load(`<ul></ul>`);
    expect(isChecklistUl($, $("ul"))).toBe(false);
  });

  it("returns true for exactly 50%+ checkmarks (2 of 3)", () => {
    const $ = cheerio.load(`<ul><li>✓ A</li><li>✓ B</li><li>Plain</li></ul>`);
    // 2/3 = 66.7% > 50% → checklist
    expect(isChecklistUl($, $("ul"))).toBe(true);
  });

  it("returns false for exactly 50% (1 of 2)", () => {
    const $ = cheerio.load(`<ul><li>✓ A</li><li>Plain</li></ul>`);
    // 1/2 = 50% — NOT > 50% → not checklist
    expect(isChecklistUl($, $("ul"))).toBe(false);
  });
});

describe("stripCheckmark helper", () => {
  it("strips ✓ from start", () => {
    expect(stripCheckmark("✓ Clean text")).toBe("Clean text");
  });

  it("strips ✔ from start", () => {
    expect(stripCheckmark("✔ Clean text")).toBe("Clean text");
  });

  it("strips ✅ from start", () => {
    expect(stripCheckmark("✅ Clean text")).toBe("Clean text");
  });

  it("strips ☑ from start", () => {
    expect(stripCheckmark("☑ Clean text")).toBe("Clean text");
  });

  it("does not strip from middle of text", () => {
    expect(stripCheckmark("Text ✓ with check in middle")).toBe("Text ✓ with check in middle");
  });

  it("handles leading whitespace before checkmark", () => {
    expect(stripCheckmark("  ✓ Text with leading space")).toBe("Text with leading space");
  });

  it("returns original text if no checkmark", () => {
    expect(stripCheckmark("No checkmark here")).toBe("No checkmark here");
  });
});

describe("resolveUrl helper", () => {
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
    expect(resolveUrl("//cdn.example.com/img.png", "https://example.com")).toBe("https://cdn.example.com/img.png");
  });
});

describe("cleanText helper", () => {
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
