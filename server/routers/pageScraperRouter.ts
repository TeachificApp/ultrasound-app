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

/**
 * Strip invisible/zero-width Unicode characters that ClickFunnels and similar
 * page builders inject between inline elements. These break regex matching.
 * Strips: U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM/ZWNBSP),
 *         U+00AD (soft hyphen), U+2060 (word joiner), U+180E (Mongolian VS)
 */
function stripInvisible(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E]/g, "");
}

function cleanText(text: string): string {
  return stripInvisible(text).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanTextFlat(text: string): string {
  return stripInvisible(text).replace(/\s+/g, " ").trim();
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
const DASH_BULLET_LINE = /^[\s]*[-–—]\s+\S/;

function stripCheckmark(text: string): string {
  return text.replace(/^[\s]*[✓✔✅☑✗☒✘]\s*/u, "").trim();
}

function stripDashBullet(text: string): string {
  return text.replace(/^[\s]*[-–—]\s+/, "").trim();
}

/**
 * Split a flat string that has checkmarks embedded mid-string (no newlines).
 * ClickFunnels pages often produce text like:
 *   "✔ Built for general sonographers✔ Live, structured✔ Learn vascular"
 * because <br> tags get stripped and zero-width spaces collapse.
 * This function splits on any checkmark char that appears after non-whitespace content.
 */
function splitOnInlineCheckmarks(text: string): string[] | null {
  // Only attempt if the text contains multiple checkmarks
  const checkmarkCount = (text.match(/[✓✔✅☑✗☒✘]/gu) || []).length;
  if (checkmarkCount < 2) return null;

  // Insert a sentinel newline before each checkmark that is preceded by a non-whitespace char
  // This avoids lookbehind regex compatibility issues
  // Replace: <non-space><checkmark> → <non-space>\n<checkmark>
  const normalized = text.replace(/([^\s\n])([✓✔✅☑✗☒✘])/gu, "$1\n$2");

  const lines = normalized.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Verify majority are checkmark lines
  const checkLines = lines.filter(l => CHECKMARK_LINE_START.test(l));
  if (checkLines.length < 2) return null;

  const items = lines.map(l => stripCheckmark(l) || l).filter(Boolean);
  return items.length >= 2 ? items : null;
}

/**
 * Split a flat string that has dash bullets embedded mid-string.
 * e.g. "-It's not just another modality-It's not something you can fake"
 */
function splitOnInlineDashes(text: string): string[] | null {
  // Only if multiple dash-bullet patterns exist
  const dashCount = (text.match(/(?<=[^\s])-(?=[A-Z"'])/g) || []).length;
  if (dashCount < 2) return null;

  const parts = text.split(/(?<=[^\s])(?=-[A-Z"'])/).map(p => stripDashBullet(p.trim())).filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

/**
 * Determine if a <ul> element should be rendered as a checklist block.
 */
function isChecklistUl($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): boolean {
  const items = $ul.children("li").toArray();
  if (items.length === 0) return false;
  let checkCount = 0;
  for (const li of items) {
    const $li = $(li);
    const rawText = stripInvisible($li.text().trim());
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
 * Handles both newline-separated AND inline (no newline) checkmark runs.
 */
function tryExtractInlineList(text: string): { type: "checklist" | "bullets"; items: string[] } | null {
  // First try newline-split approach
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length >= 2) {
    const checkLines = lines.filter(l => CHECKMARK_LINE_START.test(l) || CHECKMARK_ENTITY_START.test(l));
    if (checkLines.length > lines.length / 2) {
      return {
        type: "checklist",
        items: lines.map(l => stripCheckmark(l) || l).filter(Boolean),
      };
    }

    const dashLines = lines.filter(l => DASH_BULLET_LINE.test(l));
    if (dashLines.length > lines.length / 2) {
      return {
        type: "bullets",
        items: lines.map(l => stripDashBullet(l) || l).filter(Boolean),
      };
    }
  }

  // If no newlines found, try inline splitting (ClickFunnels-style concatenated checkmarks)
  const flatText = text.replace(/\n/g, "").trim();

  // Check if the flat text starts with a checkmark and has multiple checkmarks
  if (CHECKMARK_LINE_START.test(flatText)) {
    const inlineItems = splitOnInlineCheckmarks(flatText);
    if (inlineItems && inlineItems.length >= 2) {
      return { type: "checklist", items: inlineItems };
    }
  }

  // Check for inline dash bullets
  if (DASH_BULLET_LINE.test(flatText)) {
    const inlineDashes = splitOnInlineDashes(flatText);
    if (inlineDashes && inlineDashes.length >= 2) {
      return { type: "bullets", items: inlineDashes };
    }
  }

  return null;
}

/**
 * Noise filter — returns true if the text is a short trust/privacy/legal string.
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
    /^\d+:\d+:\d+$/,
    /^(hours?|minutes?|seconds?)$/i,
  ];
  return noisePatterns.some(p => p.test(t));
}

/**
 * Detect if an anchor element looks like a CTA button.
 */
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

/**
 * Process a text string (from a <p> or leaf div) into one or more blocks.
 * Handles: inline checklists, inline dash bullets, paragraph splitting.
 */
function textToBlocks(rawText: string): ScrapedBlock[] {
  const result: ScrapedBlock[] = [];

  if (!rawText || rawText.length < 8 || isNoise(rawText)) return result;

  // Try to split into a list first
  const inlineList = tryExtractInlineList(rawText);
  if (inlineList) {
    if (inlineList.type === "checklist") {
      result.push({ id: uid(), type: "checklist", data: { headline: "", items: inlineList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
    } else {
      result.push({ id: uid(), type: "bullets", data: { headline: "", items: inlineList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
    }
    return result;
  }

  // Split on double newlines to create separate text blocks
  const paragraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 8 && !isNoise(p));
  for (const para of paragraphs) {
    // Each sub-paragraph might itself be a list
    const subList = tryExtractInlineList(para);
    if (subList) {
      if (subList.type === "checklist") {
        result.push({ id: uid(), type: "checklist", data: { headline: "", items: subList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
      } else {
        result.push({ id: uid(), type: "bullets", data: { headline: "", items: subList.items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
      }
    } else {
      const htmlContent = para.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
      result.push({ id: uid(), type: "text", data: { html: `<p>${htmlContent}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
    }
  }

  return result;
}

// ─── Main converter ───────────────────────────────────────────────────────────

export function htmlToBlocks(html: string, baseUrl: string): ScrapedBlock[] {
  const $ = cheerio.load(html);

  // Remove noisy structural elements
  $(
    "script, style, noscript, nav, footer, header, aside, " +
    "[role='navigation'], [role='banner'], [role='complementary'], " +
    ".cookie-banner, #cookie, .popup, .modal, .overlay, " +
    ".ad, .advertisement, .sidebar, .widget, " +
    ".menu, .nav, .navbar, .header, .footer, " +
    "form, input, select, textarea, label, " +
    ".elCountdownTimer, .countdown, [class*='countdown'], [class*='timer']"
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

  const processed = new WeakSet<any>();

  function walk(el: any) {
    if (!el || processed.has(el)) return;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;

    const $el = $(el);

    // ── Images ────────────────────────────────────────────────────────────
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
      // Replace <br> with newline BEFORE extracting text to preserve line structure
      $el.find("br").replaceWith("\n");
      const rawText = cleanText($el.text());
      blocks.push(...textToBlocks(rawText));
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

    // ── Divs, sections, articles — recurse or treat as leaf ──────────────
    if (["div", "section", "article", "main", "figure", "figcaption", "span", "strong", "em", "b", "i"].includes(tag)) {
      const hasBlockChildren = $el.children("p, h1, h2, h3, h4, h5, h6, ul, ol, div, section, article, img, figure, a").length > 0;

      if (!hasBlockChildren) {
        // Leaf-level element with text — treat like a paragraph
        processed.add(el);
        $el.find("br").replaceWith("\n");
        const rawText = cleanText($el.text());
        blocks.push(...textToBlocks(rawText));
        return;
      }

      // Container with block children — recurse in DOM order
      $el.children().each((_i, child) => {
        if (!processed.has(child)) walk(child);
      });
      return;
    }

    // ── Fallback ─────────────────────────────────────────────────────────
    if (!processed.has(el)) {
      processed.add(el);
      const text = cleanTextFlat($el.text());
      if (text.length >= 20 && !isNoise(text)) {
        blocks.push(...textToBlocks(text));
      }
    }
  }

  const mainEl = $("main, [role='main'], article, .content, .main-content, #content, #main").first();
  const root = mainEl.length ? mainEl : $("body");

  root.children().each((_i, el) => {
    if (!processed.has(el)) walk(el);
  });

  // ── Deduplicate consecutive identical blocks ──────────────────────────────
  const deduped: ScrapedBlock[] = [];
  for (const block of blocks) {
    const last = deduped[deduped.length - 1];
    if (last && last.type === block.type && last.type === "text" && last.data.html === block.data.html) continue;
    if (last && last.type === block.type && (last.type === "checklist" || last.type === "bullets") && JSON.stringify(last.data.items) === JSON.stringify(block.data.items)) continue;
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
