/**
 * pageScraper.test.ts — Unit tests for the pageScraperRouter htmlToBlocks logic.
 * Tests are written against replicated helper functions that mirror the router.
 */
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

// ─── Replicate helpers from pageScraperRouter (keep in sync) ─────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function cleanText(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function cleanTextFlat(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
function resolveUrl(src: string, baseUrl: string): string {
  if (!src) return "";
  try { return new URL(src, baseUrl).href; } catch { return src; }
}

const CHECKMARK_CHARS = /[✓✔✅☑✗☒✘]/u;
const CHECKMARK_LINE_START = /^[\s]*[✓✔✅☑✗☒✘]/u;
const CHECKMARK_ENTITY_START = /^[\s]*(?:&#10003;|&#10004;|&#9989;|&#9745;|&check;)/i;
const DASH_BULLET_LINE = /^[\s]*[-–—]\s+\S/;

function stripCheckmark(text: string): string {
  return text.replace(/^[\s]*[✓✔✅☑✗☒✘]\s*/u, "").trim();
}
function stripDashBullet(text: string): string {
  return text.replace(/^[\s]*[-–—]\s+/, "").trim();
}

function isNoise(text: string): boolean {
  const noisePatterns = [
    /^100%\s*secure/i,
    /privacy\s*guaranteed/i,
    /^copyright/i,
    /^all rights reserved/i,
    /^terms of/i,
    /^privacy policy/i,
    /^cookie/i,
    /^powered by/i,
    /^\d+:\d+:\d+$/,
    /^(hours?|minutes?|seconds?)$/i,
  ];
  return text.length < 6 || noisePatterns.some(p => p.test(text));
}

function tryExtractInlineList(text: string): { type: "checklist" | "bullets"; items: string[] } | null {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const checkLines = lines.filter(l => CHECKMARK_LINE_START.test(l) || CHECKMARK_ENTITY_START.test(l));
  if (checkLines.length > lines.length / 2) {
    return { type: "checklist", items: lines.map(l => stripCheckmark(l) || l).filter(Boolean) };
  }
  const dashLines = lines.filter(l => DASH_BULLET_LINE.test(l));
  if (dashLines.length > lines.length / 2) {
    return { type: "bullets", items: lines.map(l => stripDashBullet(l) || l).filter(Boolean) };
  }
  return null;
}

function isChecklistUl($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): boolean {
  const items = $ul.children("li").toArray();
  if (items.length === 0) return false;
  let checkCount = 0;
  for (const li of items) {
    const $li = $(li);
    const rawText = $li.text().trim();
    if (CHECKMARK_LINE_START.test(rawText) || CHECKMARK_ENTITY_START.test(rawText)) { checkCount++; continue; }
    const hasCheckIcon = $li.find("[class*='check'], [class*='tick'], [aria-label*='check'], [aria-label*='Check']").length > 0;
    if (hasCheckIcon) { checkCount++; continue; }
    if (CHECKMARK_CHARS.test($.html($li) || "")) checkCount++;
  }
  return checkCount > items.length / 2;
}

function extractListItems($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): string[] {
  return $ul.children("li")
    .map((_j: number, li: any) => { const raw = cleanTextFlat($(li).text()); return stripCheckmark(raw) || raw; })
    .get().filter(Boolean);
}

interface ScrapedBlock { id: string; type: string; data: Record<string, any>; }

function isCTALink($: cheerio.CheerioAPI, $a: cheerio.Cheerio<any>): boolean {
  const cls = ($a.attr("class") || "").toLowerCase();
  const role = $a.attr("role") || "";
  const btnPatterns = /btn|button|cta|submit|action|primary|secondary|enroll|register|get.started|sign.up|learn.more|secure.your/i;
  if (btnPatterns.test(cls) || role === "button") return true;
  const parentCls = ($a.parent().attr("class") || "").toLowerCase();
  if (btnPatterns.test(parentCls)) return true;
  const text = cleanTextFlat($a.text());
  if (text.length > 0 && text.length < 60 && /^(get|start|enroll|register|sign|learn|secure|join|buy|order|claim|yes|i want)/i.test(text)) return true;
  return false;
}

function htmlToBlocks(html: string, baseUrl: string): ScrapedBlock[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, aside, [role='navigation'], [role='banner'], [role='complementary'], .cookie-banner, #cookie, .popup, .modal, .overlay, .ad, .advertisement, .sidebar, .widget, .menu, .nav, .navbar, .header, .footer, form, input, select, textarea, label, .elCountdownTimer, .countdown, [class*='countdown'], [class*='timer']").remove();

  const blocks: ScrapedBlock[] = [];
  const ogTitle = $("meta[property='og:title']").attr("content") || "";
  const ogDesc = $("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content") || "";
  const ogImage = $("meta[property='og:image']").attr("content") || "";
  const h1Text = cleanTextFlat($("h1").first().text());
  const heroHeadline = h1Text || ogTitle || "";
  if (heroHeadline) {
    blocks.push({ id: uid(), type: "hero", data: { headline: heroHeadline, subheadline: ogDesc || "", bgType: "color", bgColor: "#179ca3", textColor: "#ffffff", align: "center", imageUrl: ogImage ? resolveUrl(ogImage, baseUrl) : "", buttons: [] } });
    $("h1").first().remove();
  }

  const processed = new WeakSet<any>();

  function walk(el: any) {
    if (!el || processed.has(el)) return;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    const $el = $(el);

    if (tag === "img") {
      processed.add(el);
      const src = resolveUrl($el.attr("src") || $el.attr("data-src") || "", baseUrl);
      const alt = $el.attr("alt") || "";
      if (!src || src.includes("data:") || src.includes("pixel") || src.includes("tracking") || src.includes("spacer")) return;
      const w = parseInt($el.attr("width") || "0");
      const h = parseInt($el.attr("height") || "0");
      if ((w > 0 && w < 10) || (h > 0 && h < 10)) return;
      blocks.push({ id: uid(), type: "image", data: { url: src, alt, caption: "", align: "center", maxWidth: "auto", showShadow: true } });
      return;
    }

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      if (!text || isNoise(text)) return;
      const level = tag === "h2" ? "h2" : "h3";
      blocks.push({ id: uid(), type: "text", data: { html: `<${level}>${text}</${level}>`, align: "center", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    if (tag === "p") {
      processed.add(el);
      $el.find("br").replaceWith("\n");
      const rawText = cleanText($el.text());
      if (!rawText || rawText.length < 8 || isNoise(rawText)) return;
      const inlineList = tryExtractInlineList(rawText);
      if (inlineList) {
        if (inlineList.type === "checklist") blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: inlineList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
        else blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: inlineList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
        return;
      }
      const paragraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 8 && !isNoise(p));
      for (const para of paragraphs) {
        const subList = tryExtractInlineList(para);
        if (subList) {
          if (subList.type === "checklist") blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: subList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
          else blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: subList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
        } else {
          const htmlContent = para.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
          blocks.push({ id: uid(), type: "text", data: { html: `<p>${htmlContent}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
        }
      }
      return;
    }

    if (tag === "ul") {
      processed.add(el);
      const items = extractListItems($, $el);
      if (items.length === 0) return;
      if (isChecklistUl($, $el)) blocks.push({ id: uid(), type: "checklist", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
      else blocks.push({ id: uid(), type: "bullets", data: { headline: "", items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
      return;
    }

    if (tag === "ol") {
      processed.add(el);
      const items = $el.children("li").map((_j: number, li: any) => cleanTextFlat($(li).text())).get().filter(Boolean);
      if (items.length === 0) return;
      blocks.push({ id: uid(), type: "numbered_list", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#ffffff" } });
      return;
    }

    if (tag === "a") {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      const href = $el.attr("href") || "";
      if (!text || text.length < 3 || isNoise(text)) return;
      if (isCTALink($, $el)) {
        blocks.push({ id: uid(), type: "cta", data: { headline: "", subheadline: "", buttonText: text, buttonUrl: href.startsWith("#") ? "" : resolveUrl(href, baseUrl), buttonColor: "#179ca3", buttonTextColor: "#ffffff", align: "center", bgColor: "#ffffff" } });
      }
      return;
    }

    if (["div", "section", "article", "main", "figure", "figcaption", "span", "strong", "em", "b", "i"].includes(tag)) {
      const hasBlockChildren = $el.children("p, h1, h2, h3, h4, h5, h6, ul, ol, div, section, article, img, figure, a").length > 0;
      if (!hasBlockChildren) {
        processed.add(el);
        $el.find("br").replaceWith("\n");
        const rawText = cleanText($el.text());
        if (!rawText || rawText.length < 8 || isNoise(rawText)) return;
        const inlineList = tryExtractInlineList(rawText);
        if (inlineList) {
          if (inlineList.type === "checklist") blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: inlineList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
          else blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: inlineList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
          return;
        }
        const paragraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 8 && !isNoise(p));
        for (const para of paragraphs) {
          const subList = tryExtractInlineList(para);
          if (subList) {
            if (subList.type === "checklist") blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: subList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
            else blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: subList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
          } else {
            const htmlContent = para.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
            blocks.push({ id: uid(), type: "text", data: { html: `<p>${htmlContent}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
          }
        }
        return;
      }
      $el.children().each((_i, child) => { if (!processed.has(child)) walk(child); });
      return;
    }

    if (!processed.has(el)) {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      if (text.length >= 20 && !isNoise(text)) blocks.push({ id: uid(), type: "text", data: { html: `<p>${text}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
    }
  }

  const mainEl = $("main, [role='main'], article, .content, .main-content, #content, #main").first();
  const root = mainEl.length ? mainEl : $("body");
  root.children().each((_i, el) => { if (!processed.has(el)) walk(el); });

  const deduped: ScrapedBlock[] = [];
  for (const block of blocks) {
    const last = deduped[deduped.length - 1];
    if (last && last.type === block.type && last.type === "text" && last.data.html === block.data.html) continue;
    if (last && last.type === block.type && (last.type === "checklist" || last.type === "bullets") && JSON.stringify(last.data.items) === JSON.stringify(block.data.items)) continue;
    deduped.push(block);
  }
  return deduped;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const BASE_URL = "https://example.com";

describe("htmlToBlocks — hero block", () => {
  it("extracts H1 as a hero block", () => {
    const html = `<html><body><h1>Welcome to Ultrasound</h1></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].data.headline).toBe("Welcome to Ultrasound");
  });

  it("uses OG title as hero headline when no H1", () => {
    const html = `<html><head><meta property="og:title" content="OG Page Title" /></head><body><p>Some content here on the page.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const hero = blocks.find(b => b.type === "hero");
    expect(hero!.data.headline).toBe("OG Page Title");
  });

  it("uses OG description as hero subheadline", () => {
    const html = `<html><head><meta property="og:title" content="Title" /><meta property="og:description" content="A great description" /></head><body></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "hero")!.data.subheadline).toBe("A great description");
  });

  it("does not duplicate H1 as text block", () => {
    const html = `<html><body><h1>Main Title</h1><p>Paragraph content here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlocks = blocks.filter(b => b.type === "text");
    expect(textBlocks.every(b => !b.data.html?.includes("Main Title"))).toBe(true);
  });
});

describe("htmlToBlocks — text blocks", () => {
  it("extracts H2 as a text block with h2 HTML", () => {
    const html = `<html><body><h2>Section Title</h2></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "text")!.data.html).toContain("<h2>Section Title</h2>");
  });

  it("extracts paragraphs as text blocks", () => {
    const html = `<html><body><p>This is a long enough paragraph for testing.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "text")!.data.html).toContain("This is a long enough paragraph");
  });

  it("skips very short paragraphs (< 8 chars)", () => {
    const html = `<html><body><p>Short</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "text")).toBeUndefined();
  });

  it("deduplicates consecutive identical text blocks", () => {
    const html = `<html><body><p>Duplicate paragraph content here.</p><p>Duplicate paragraph content here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textBlocks = blocks.filter(b => b.type === "text" && b.data.html.includes("Duplicate paragraph"));
    expect(textBlocks.length).toBe(1);
  });

  it("handles empty HTML gracefully", () => {
    expect(htmlToBlocks(`<html><body></body></html>`, BASE_URL)).toEqual([]);
  });
});

describe("htmlToBlocks — image blocks", () => {
  it("extracts IMG as an image block with resolved URL", () => {
    const html = `<html><body><img src="/images/scan.jpg" alt="Ultrasound scan" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const img = blocks.find(b => b.type === "image");
    expect(img!.data.url).toBe("https://example.com/images/scan.jpg");
    expect(img!.data.alt).toBe("Ultrasound scan");
  });

  it("skips data: URI images", () => {
    const html = `<html><body><img src="data:image/png;base64,abc123" alt="base64" /></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "image")).toBeUndefined();
  });

  it("skips 1x1 tracking pixels", () => {
    const html = `<html><body><img src="/pixel.gif" width="1" height="1" /></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "image")).toBeUndefined();
  });
});

describe("htmlToBlocks — list blocks", () => {
  it("extracts plain UL as bullets block", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li><li>Item three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const bulletsBlock = blocks.find(b => b.type === "bullets");
    expect(bulletsBlock!.data.items).toEqual(["Item one", "Item two", "Item three"]);
  });

  it("extracts OL as numbered_list block", () => {
    const html = `<html><body><ol><li>First step</li><li>Second step</li></ol></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "numbered_list")!.data.items).toEqual(["First step", "Second step"]);
  });
});

describe("htmlToBlocks — checklist detection from UL", () => {
  it("detects ✓ checkmark UL as checklist block", () => {
    const html = `<html><body><ul><li>✓ First benefit</li><li>✓ Second benefit</li><li>✓ Third benefit</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist!.data.items).toEqual(["First benefit", "Second benefit", "Third benefit"]);
  });

  it("detects ✔ checkmark UL as checklist block", () => {
    const html = `<html><body><ul><li>✔ Benefit A</li><li>✔ Benefit B</li></ul></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")).toBeDefined();
  });

  it("detects ✅ emoji UL as checklist block", () => {
    const html = `<html><body><ul><li>✅ Feature one</li><li>✅ Feature two</li><li>✅ Feature three</li></ul></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")!.data.items).toEqual(["Feature one", "Feature two", "Feature three"]);
  });

  it("strips checkmark chars from checklist items", () => {
    const html = `<html><body><ul><li>✓ Clean item text</li><li>✓ Another clean item</li></ul></body></html>`;
    const checklist = htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")!;
    for (const item of checklist.data.items) {
      expect(item).not.toMatch(/[✓✔✅☑]/u);
    }
    expect(checklist.data.items[0]).toBe("Clean item text");
  });

  it("detects fa-check icon UL as checklist", () => {
    const html = `<html><body><ul>
      <li><i class="fa fa-check"></i> Item one</li>
      <li><i class="fa fa-check"></i> Item two</li>
      <li><i class="fa fa-check"></i> Item three</li>
    </ul></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")).toBeDefined();
  });

  it("does NOT flag plain UL as checklist", () => {
    const html = `<html><body><ul><li>Item one</li><li>Item two</li></ul></body></html>`;
    expect(htmlToBlocks(html, BASE_URL).find(b => b.type === "checklist")).toBeUndefined();
  });
});

describe("htmlToBlocks — inline list splitting from paragraphs/divs", () => {
  it("splits ✔ multi-line paragraph into checklist block", () => {
    const html = `<html><body><p>✔ Built for general sonographers\n✔ Live, structured, and focused\n✔ Learn vascular foundations</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
    expect(checklist!.data.items[0]).toBe("Built for general sonographers");
  });

  it("splits dash-prefixed multi-line paragraph into bullets block", () => {
    const html = `<html><body><p>- It's not just another modality\n- It's not something you can fake\n- And it's not from random videos</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const bullets = blocks.find(b => b.type === "bullets");
    expect(bullets).toBeDefined();
    expect(bullets!.data.items.length).toBe(3);
    expect(bullets!.data.items[0]).toBe("It's not just another modality");
  });

  it("splits ✔ lines inside a leaf div into checklist block", () => {
    const html = `<html><body><div>✔ Image optimization techniques\n✔ Standard views + probe positioning\n✔ Vascular anatomy simplified</div></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const checklist = blocks.find(b => b.type === "checklist");
    expect(checklist).toBeDefined();
    expect(checklist!.data.items.length).toBe(3);
  });

  it("does NOT split single-line text into a list", () => {
    const html = `<html><body><p>This is just a single paragraph of text about ultrasound.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "checklist")).toBeUndefined();
    expect(blocks.find(b => b.type === "bullets")).toBeUndefined();
    expect(blocks.find(b => b.type === "text")).toBeDefined();
  });
});

describe("htmlToBlocks — noise filtering", () => {
  it("filters '100% Secure - Privacy Guaranteed' text", () => {
    const html = `<html><body><p>100% Secure - Privacy Guaranteed</p><h2>Real Section Title Here</h2></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => JSON.stringify(b.data).includes("Secure"))).toBeUndefined();
    expect(blocks.find(b => b.type === "text")).toBeDefined();
  });

  it("filters countdown timer digits", () => {
    const html = `<html><body><div class="countdown">12:11:17</div><p>Real content paragraph here.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => JSON.stringify(b.data).includes("12:11:17"))).toBeUndefined();
  });

  it("removes nav and footer elements", () => {
    const html = `<html><body><nav><a href="/">Home</a></nav><h1>Main Content</h1><footer>Footer text</footer></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks[0].type).toBe("hero");
    expect(blocks.find(b => JSON.stringify(b.data).includes("Footer text"))).toBeUndefined();
  });
});

describe("htmlToBlocks — CTA detection", () => {
  it("detects anchor with btn class as CTA block", () => {
    const html = `<html><body><a href="https://example.com/enroll" class="btn btn-primary">Get Started Now</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const cta = blocks.find(b => b.type === "cta");
    expect(cta).toBeDefined();
    expect(cta!.data.buttonText).toBe("Get Started Now");
    expect(cta!.data.buttonUrl).toBe("https://example.com/enroll");
  });

  it("detects anchor with role=button as CTA block", () => {
    const html = `<html><body><a href="/signup" role="button">Enroll Today</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "cta")).toBeDefined();
  });

  it("detects action-oriented short anchor text as CTA", () => {
    const html = `<html><body><a href="/course">Get Started</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "cta")).toBeDefined();
  });

  it("does NOT flag regular navigation links as CTA", () => {
    const html = `<html><body><a href="/about">About Us</a></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    expect(blocks.find(b => b.type === "cta")).toBeUndefined();
  });
});

describe("htmlToBlocks — document order preservation", () => {
  it("preserves image before text when image appears first in HTML", () => {
    const html = `<html><body><img src="/scan.jpg" alt="scan" /><p>This is a paragraph about the scan above.</p></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    // Hero is first (no H1 here), then image, then text
    const imgIdx = blocks.findIndex(b => b.type === "image");
    const textIdx = blocks.findIndex(b => b.type === "text");
    expect(imgIdx).toBeLessThan(textIdx);
  });

  it("preserves text before image when text appears first in HTML", () => {
    const html = `<html><body><p>This is a paragraph about the scan below.</p><img src="/scan.jpg" alt="scan" /></body></html>`;
    const blocks = htmlToBlocks(html, BASE_URL);
    const textIdx = blocks.findIndex(b => b.type === "text");
    const imgIdx = blocks.findIndex(b => b.type === "image");
    expect(textIdx).toBeLessThan(imgIdx);
  });
});

describe("tryExtractInlineList", () => {
  it("detects ✔ checkmark lines", () => {
    const result = tryExtractInlineList("✔ Built for sonographers\n✔ Live and structured\n✔ Learn the right way");
    expect(result!.type).toBe("checklist");
    expect(result!.items).toHaveLength(3);
    expect(result!.items[0]).toBe("Built for sonographers");
  });

  it("detects ✅ emoji lines", () => {
    const result = tryExtractInlineList("✅ Feature one\n✅ Feature two\n✅ Feature three");
    expect(result!.type).toBe("checklist");
  });

  it("detects dash-prefixed lines", () => {
    const result = tryExtractInlineList("- First item\n- Second item\n- Third item");
    expect(result!.type).toBe("bullets");
    expect(result!.items[0]).toBe("First item");
  });

  it("returns null for single-line text", () => {
    expect(tryExtractInlineList("This is just a single paragraph.")).toBeNull();
  });

  it("returns null for multi-line non-list text", () => {
    expect(tryExtractInlineList("First line of text\nSecond line of text\nThird line of text")).toBeNull();
  });

  it("strips checkmark from items", () => {
    const result = tryExtractInlineList("✔ Item one\n✔ Item two\n✔ Item three");
    expect(result!.items[0]).not.toMatch(/^[✓✔✅☑]/);
  });

  it("strips dash from bullet items", () => {
    const result = tryExtractInlineList("- First item\n- Second item\n- Third item");
    expect(result!.items[0]).toBe("First item");
  });
});

describe("isNoise", () => {
  it("filters '100% Secure - Privacy Guaranteed'", () => { expect(isNoise("100% Secure - Privacy Guaranteed")).toBe(true); });
  it("filters 'Privacy Guaranteed'", () => { expect(isNoise("Privacy Guaranteed")).toBe(true); });
  it("filters countdown timer '12:11:17'", () => { expect(isNoise("12:11:17")).toBe(true); });
  it("filters 'Hours'", () => { expect(isNoise("Hours")).toBe(true); });
  it("filters 'Copyright 2024'", () => { expect(isNoise("Copyright 2024 All About Ultrasound")).toBe(true); });
  it("does NOT filter legitimate content", () => {
    expect(isNoise("Step Into Vascular Ultrasound with Confidence!")).toBe(false);
    expect(isNoise("Classes start June 1st! Register now.")).toBe(false);
  });
});

describe("stripCheckmark", () => {
  it("strips ✔ from start", () => { expect(stripCheckmark("✔ Item text")).toBe("Item text"); });
  it("strips ✓ from start", () => { expect(stripCheckmark("✓ Item text")).toBe("Item text"); });
  it("strips ✅ from start", () => { expect(stripCheckmark("✅ Item text")).toBe("Item text"); });
  it("strips ☑ from start", () => { expect(stripCheckmark("☑ Item text")).toBe("Item text"); });
  it("handles leading whitespace", () => { expect(stripCheckmark("  ✔ Item text")).toBe("Item text"); });
  it("does not strip from middle", () => { expect(stripCheckmark("Item ✔ text")).toBe("Item ✔ text"); });
});
