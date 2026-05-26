import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as cheerio from "cheerio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapedBlock {
  id: string;
  type: string;
  data: Record<string, any>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function cleanText(text: string): string {
  // Collapse whitespace but preserve meaningful newlines for multi-line detection
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanTextFlat(text: string): string {
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

// Checkmark chars and common icon class patterns
const CHECKMARK_CHARS = /[✓✔✅☑✗☒✘]/u;
const CHECKMARK_LINE_START = /^[\s]*[✓✔✅☑✗☒✘]/u;
const CHECKMARK_ENTITY_START = /^[\s]*(?:&#10003;|&#10004;|&#9989;|&#9745;|&check;)/i;
const DASH_BULLET_LINE = /^[\s]*[-–—]\s+\S/; // lines like "- Item text"

function stripCheckmark(text: string): string {
  return text.replace(/^[\s]*[✓✔✅☑✗☒✘]\s*/u, "").trim();
}

function stripDashBullet(text: string): string {
  return text.replace(/^[\s]*[-–—]\s+/, "").trim();
}

/**
 * Determine if a <ul> element should be rendered as a checklist block.
 * Returns true if the majority (>50%) of its <li> items start with a checkmark.
 */
function isChecklistUl($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): boolean {
  const items = $ul.children("li").toArray();
  if (items.length === 0) return false;
  let checkCount = 0;
  for (const li of items) {
    const $li = $(li);
    const rawText = $li.text().trim();
    if (CHECKMARK_LINE_START.test(rawText) || CHECKMARK_ENTITY_START.test(rawText)) {
      checkCount++;
      continue;
    }
    const hasCheckIcon = $li.find(
      "[class*='check'], [class*='tick'], [aria-label*='check'], [aria-label*='Check'], [title*='check'], [title*='Check'], svg[class*='check'], img[alt*='check'], img[alt*='Check']"
    ).length > 0;
    if (hasCheckIcon) { checkCount++; continue; }
    const liHtml = $.html($li) || "";
    if (CHECKMARK_CHARS.test(liHtml)) checkCount++;
  }
  return checkCount > items.length / 2;
}

function extractListItems($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): string[] {
  return $ul
    .children("li")
    .map((_j: number, li: any) => {
      const raw = cleanTextFlat($(li).text());
      return stripCheckmark(raw) || raw;
    })
    .get()
    .filter(Boolean);
}

/**
 * Try to split a block of text into individual checkmark lines or dash-bullet lines.
 * Returns an array of clean item strings, or null if the text doesn't look like a list.
 */
function tryExtractInlineList(text: string): { type: "checklist" | "bullets"; items: string[] } | null {
  // Split on newlines
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Check if majority of lines start with checkmarks
  const checkLines = lines.filter(l => CHECKMARK_LINE_START.test(l) || CHECKMARK_ENTITY_START.test(l));
  if (checkLines.length > lines.length / 2) {
    return {
      type: "checklist",
      items: lines.map(l => stripCheckmark(l) || l).filter(Boolean),
    };
  }

  // Check if majority of lines start with dashes
  const dashLines = lines.filter(l => DASH_BULLET_LINE.test(l));
  if (dashLines.length > lines.length / 2) {
    return {
      type: "bullets",
      items: lines.map(l => stripDashBullet(l) || l).filter(Boolean),
    };
  }

  return null;
}

/**
 * Noise filter — returns true if the text is a short trust/privacy/legal string
 * that shouldn't become a standalone block.
 */
function isNoise(text: string): boolean {
  const t = text.toLowerCase();
  if (text.length < 6) return true;
  const noisePatterns = [
    /^100%\s*secure/i,
    /privacy\s*guaranteed/i,
    /^copyright/i,
    /^all rights reserved/i,
    /^terms of/i,
    /^privacy policy/i,
    /^cookie/i,
    /^powered by/i,
    /^\d+:\d+:\d+$/, // timer digits like "12:11:17"
    /^(hours?|minutes?|seconds?)$/i,
  ];
  return noisePatterns.some(p => p.test(t));
}

/**
 * Detect if an anchor element looks like a CTA button.
 * Checks: button-like class names, role="button", or is a direct child of a CTA container.
 */
function isCTALink($: cheerio.CheerioAPI, $a: cheerio.Cheerio<any>): boolean {
  const cls = ($a.attr("class") || "").toLowerCase();
  const role = $a.attr("role") || "";
  const btnPatterns = /btn|button|cta|submit|action|primary|secondary|enroll|register|get.started|sign.up|learn.more|secure.your/i;
  if (btnPatterns.test(cls) || role === "button") return true;
  // Parent has button-like class
  const parentCls = ($a.parent().attr("class") || "").toLowerCase();
  if (btnPatterns.test(parentCls)) return true;
  // Text itself is short and action-oriented
  const text = cleanTextFlat($a.text());
  if (text.length > 0 && text.length < 60 && /^(get|start|enroll|register|sign|learn|secure|join|buy|order|claim|yes|i want)/i.test(text)) return true;
  return false;
}

// ─── Main converter ───────────────────────────────────────────────────────────

/**
 * Convert a scraped URL's HTML into an ordered list of landing-page blocks.
 *
 * Improvements over v1:
 * 1. Recursive walk preserves document order (images inline with text)
 * 2. Multi-line ✔ paragraphs split into individual checklist items
 * 3. Dash-prefixed lines (-Item) split into bullets block
 * 4. Paragraph breaks preserved — each paragraph becomes its own text block
 * 5. CTA anchor buttons detected and mapped to cta block
 * 6. Noise strings filtered (trust badges, timer digits, etc.)
 * 7. Deduplication of consecutive identical blocks
 */
function htmlToBlocks(html: string, baseUrl: string): ScrapedBlock[] {
  const $ = cheerio.load(html);

  // Remove noisy structural elements
  $(
    "script, style, noscript, nav, footer, header, aside, " +
    "[role='navigation'], [role='banner'], [role='complementary'], " +
    ".cookie-banner, #cookie, .popup, .modal, .overlay, " +
    ".ad, .advertisement, .sidebar, .widget, " +
    ".menu, .nav, .navbar, .header, .footer, " +
    "form, input, select, textarea, label, " + // skip form elements
    ".elCountdownTimer, .countdown, [class*='countdown'], [class*='timer']" // skip countdown timers
  ).remove();

  const blocks: ScrapedBlock[] = [];

  // ── Hero block from OG/meta + first H1 ──────────────────────────────────
  const ogTitle = $("meta[property='og:title']").attr("content") || "";
  const ogDesc = $("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content") || "";
  const ogImage = $("meta[property='og:image']").attr("content") || "";
  const h1Text = cleanTextFlat($("h1").first().text());

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

  // Track already-processed nodes to avoid double-processing
  const processed = new WeakSet<any>();

  /**
   * Recursively walk the DOM tree and emit blocks in document order.
   * We walk depth-first, but we only emit a block for the "most specific"
   * element — i.e. we don't emit a block for a div AND then re-emit all
   * its children separately.
   */
  function walk(el: any) {
    if (!el || processed.has(el)) return;
    const tag = el.tagName?.toLowerCase();
    if (!tag) {
      // Text node — handled by parent
      return;
    }

    const $el = $(el);

    // ── Images ────────────────────────────────────────────────────────────
    if (tag === "img") {
      processed.add(el);
      const src = resolveUrl($el.attr("src") || $el.attr("data-src") || "", baseUrl);
      const alt = $el.attr("alt") || "";
      if (!src || src.includes("data:") || src.includes("pixel") || src.includes("tracking") || src.includes("spacer")) return;
      // Skip tiny tracking pixels
      const w = parseInt($el.attr("width") || "0");
      const h = parseInt($el.attr("height") || "0");
      if ((w > 0 && w < 10) || (h > 0 && h < 10)) return;
      blocks.push({ id: uid(), type: "image", data: { url: src, alt, caption: "", align: "center", maxWidth: "auto", showShadow: true } });
      return;
    }

    // ── H2/H3/H4 headings ─────────────────────────────────────────────────
    if (tag === "h2" || tag === "h3" || tag === "h4") {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      if (!text || isNoise(text)) return;
      const level = tag === "h2" ? "h2" : "h3";
      blocks.push({ id: uid(), type: "text", data: { html: `<${level}>${text}</${level}>`, align: "center", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    // ── Paragraphs ────────────────────────────────────────────────────────
    if (tag === "p") {
      processed.add(el);
      // Get raw text preserving line breaks from <br>
      // Replace <br> with newline before extracting text
      $el.find("br").replaceWith("\n");
      const rawText = cleanText($el.text());
      if (!rawText || rawText.length < 8 || isNoise(rawText)) return;

      // Try to split into a list if the paragraph contains checkmark/dash lines
      const inlineList = tryExtractInlineList(rawText);
      if (inlineList) {
        if (inlineList.type === "checklist") {
          blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: inlineList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
        } else {
          blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: inlineList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
        }
        return;
      }

      // Split on double newlines to create separate text blocks
      const paragraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 8 && !isNoise(p));
      for (const para of paragraphs) {
        // Each sub-paragraph might itself be a list
        const subList = tryExtractInlineList(para);
        if (subList) {
          if (subList.type === "checklist") {
            blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: subList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
          } else {
            blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: subList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
          }
        } else {
          // Preserve single-line breaks as <br> in HTML
          const htmlContent = para.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
          blocks.push({ id: uid(), type: "text", data: { html: `<p>${htmlContent}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
        }
      }
      return;
    }

    // ── Unordered lists ───────────────────────────────────────────────────
    if (tag === "ul") {
      processed.add(el);
      const items = extractListItems($, $el);
      if (items.length === 0) return;
      if (isChecklistUl($, $el)) {
        blocks.push({ id: uid(), type: "checklist", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
      } else {
        blocks.push({ id: uid(), type: "bullets", data: { headline: "", items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
      }
      return;
    }

    // ── Ordered lists ─────────────────────────────────────────────────────
    if (tag === "ol") {
      processed.add(el);
      const items = $el.children("li").map((_j: number, li: any) => cleanTextFlat($(li).text())).get().filter(Boolean);
      if (items.length === 0) return;
      blocks.push({ id: uid(), type: "numbered_list", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#ffffff" } });
      return;
    }

    // ── CTA anchor buttons ────────────────────────────────────────────────
    if (tag === "a") {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      const href = $el.attr("href") || "";
      if (!text || text.length < 3 || isNoise(text)) return;
      if (isCTALink($, $el)) {
        blocks.push({
          id: uid(),
          type: "cta",
          data: {
            headline: "",
            subheadline: "",
            buttonText: text,
            buttonUrl: href.startsWith("#") ? "" : resolveUrl(href, baseUrl),
            buttonColor: "#179ca3",
            buttonTextColor: "#ffffff",
            align: "center",
            bgColor: "#ffffff",
          },
        });
      }
      return;
    }

    // ── Divs, sections, articles — recurse into children in order ─────────
    if (["div", "section", "article", "main", "figure", "figcaption", "span", "strong", "em", "b", "i"].includes(tag)) {
      // Check if this element has ONLY text content (no block children)
      // If so, treat it as a text block directly
      const hasBlockChildren = $el.children("p, h1, h2, h3, h4, h5, h6, ul, ol, div, section, article, img, figure, a").length > 0;

      if (!hasBlockChildren) {
        // Leaf-level div/span with text — treat like a paragraph
        processed.add(el);
        $el.find("br").replaceWith("\n");
        const rawText = cleanText($el.text());
        if (!rawText || rawText.length < 8 || isNoise(rawText)) return;

        const inlineList = tryExtractInlineList(rawText);
        if (inlineList) {
          if (inlineList.type === "checklist") {
            blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: inlineList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
          } else {
            blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: inlineList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
          }
          return;
        }

        const paragraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 8 && !isNoise(p));
        for (const para of paragraphs) {
          const subList = tryExtractInlineList(para);
          if (subList) {
            if (subList.type === "checklist") {
              blocks.push({ id: uid(), type: "checklist", data: { headline: "", items: subList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
            } else {
              blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: subList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
            }
          } else {
            const htmlContent = para.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
            blocks.push({ id: uid(), type: "text", data: { html: `<p>${htmlContent}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
          }
        }
        return;
      }

      // Container with block children — recurse into children in DOM order
      $el.children().each((_i, child) => {
        if (!processed.has(child)) walk(child);
      });
      return;
    }

    // ── Fallback: any element with substantial text ───────────────────────
    if (!processed.has(el)) {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      if (text.length >= 20 && !isNoise(text)) {
        blocks.push({ id: uid(), type: "text", data: { html: `<p>${text}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      }
    }
  }

  // Walk from the best content root
  const mainEl = $("main, [role='main'], article, .content, .main-content, #content, #main").first();
  const root = mainEl.length ? mainEl : $("body");

  root.children().each((_i, el) => {
    if (!processed.has(el)) walk(el);
  });

  // ── Deduplicate consecutive identical text blocks ────────────────────────
  const deduped: ScrapedBlock[] = [];
  for (const block of blocks) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      last.type === block.type &&
      last.type === "text" &&
      last.data.html === block.data.html
    ) continue;
    // Also deduplicate consecutive checklist/bullets with identical items
    if (
      last &&
      last.type === block.type &&
      (last.type === "checklist" || last.type === "bullets") &&
      JSON.stringify(last.data.items) === JSON.stringify(block.data.items)
    ) continue;
    deduped.push(block);
  }

  return deduped;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const pageScraperRouter = router({
  scrapeUrl: protectedProcedure
    .input(z.object({
      url: z.string().url("Must be a valid URL"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }

      let html: string;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(input.url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
          },
        });
        clearTimeout(timeout);
        if (!res.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Failed to fetch URL: HTTP ${res.status}` });
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "URL did not return HTML content" });
        }
        html = await res.text();
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        if (err?.name === "AbortError") {
          throw new TRPCError({ code: "TIMEOUT", message: "Request timed out after 15 seconds" });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: `Could not fetch URL: ${err?.message || "Unknown error"}` });
      }

      const blocks = htmlToBlocks(html, input.url);
      const $ = cheerio.load(html);
      const pageTitle = cleanTextFlat($("title").first().text()) || $("meta[property='og:title']").attr("content") || "";

      return {
        blocks,
        pageTitle,
        sourceUrl: input.url,
        blockCount: blocks.length,
      };
    }),
});
