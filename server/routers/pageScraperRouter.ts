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
 */
function stripInvisible(text: string): string {
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

// Checkmark chars and common icon class patterns (includes ❌ cross marks used in "NOT for you" sections)
const CHECKMARK_CHARS = /[✓✔✅☑✗☒✘❌❎]/u;
const CHECKMARK_LINE_START = /^[\s]*[✓✔✅☑✗☒✘❌❎]/u;
const CHECKMARK_ENTITY_START = /^[\s]*(?:&#10003;|&#10004;|&#9989;|&#9745;|&check;|&#10060;|&#10062;)/i;
const DASH_BULLET_LINE = /^[\s]*[-–—]\s+\S/;
// Cross-mark chars only (✗ ☒ ✘ ❌ ❎) — used to tag items as crossed: true
const CROSS_MARK_LINE_START = /^[\s]*[✗☒✘❌❎]/u;

function stripCheckmark(text: string): string {
  return text.replace(/^[\s]*[✓✔✅☑✗☒✘❌❎]\s*/u, "").trim();
}

/** Return true if a line starts with a cross/negative mark */
function isCrossLine(text: string): boolean {
  return CROSS_MARK_LINE_START.test(text);
}

function stripDashBullet(text: string): string {
  return text.replace(/^[\s]*[-–—]\s+/, "").trim();
}

/**
 * Split a flat string that has checkmarks embedded mid-string (no newlines).
 * ClickFunnels pages often produce text like:
 *   "✔ Built for general sonographers✔ Live, structured✔ Learn vascular"
 * because <br> tags get stripped and zero-width spaces collapse.
 */
function splitOnInlineCheckmarks(text: string): Array<{ text: string; crossed: boolean }> | null {
  const checkmarkCount = (text.match(/[✓✔✅☑✗☒✘]/gu) || []).length;
  if (checkmarkCount < 2) return null;

  // Insert a sentinel newline before each checkmark that is preceded by a non-whitespace char
  const normalized = text.replace(/([^\s\n])([✓✔✅☑✗☒✘])/gu, "$1\n$2");

  const lines = normalized.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const checkLines = lines.filter(l => CHECKMARK_LINE_START.test(l));
  if (checkLines.length < 2) return null;

  const items = lines.map(l => ({
    text: stripCheckmark(l) || l,
    crossed: isCrossLine(l),
  })).filter(i => Boolean(i.text));
  return items.length >= 2 ? items : null;
}

/**
 * Split a flat string that has dash bullets embedded mid-string.
 */
function splitOnInlineDashes(text: string): string[] | null {
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

function extractListItems($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): Array<{ text: string; crossed: boolean }> {
  return $ul
    .children("li")
    .map((_j: number, li: any) => {
      const raw = cleanTextFlat($(li).text());
      const crossed = isCrossLine(raw);
      return { text: stripCheckmark(raw) || raw, crossed };
    })
    .get()
    .filter((i: any) => Boolean(i.text));
}

/**
 * Try to split a block of text into individual checkmark lines or dash-bullet lines.
 */
type ChecklistItem = { text: string; crossed: boolean };
type ExtractedList =
  | { type: "checklist"; items: ChecklistItem[] }
  | { type: "bullets"; items: string[] };

function tryExtractInlineList(text: string): ExtractedList | null {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length >= 2) {
    const checkLines = lines.filter(l => CHECKMARK_LINE_START.test(l) || CHECKMARK_ENTITY_START.test(l));
    if (checkLines.length >= lines.length / 2 && checkLines.length >= 2) {
      return {
        type: "checklist",
        items: lines.map(l => ({
          text: stripCheckmark(l) || l,
          crossed: isCrossLine(l),
        })).filter(i => Boolean(i.text)),
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

  const flatText = text.replace(/\n/g, "").trim();

  if (CHECKMARK_LINE_START.test(flatText)) {
    const inlineItems = splitOnInlineCheckmarks(flatText);
    if (inlineItems && inlineItems.length >= 2) {
      return { type: "checklist", items: inlineItems };
    }
  }

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
    /^\d+\s*(hours?|minutes?|seconds?):?$/i,
    /^working\.{0,3}$/i,
    /^loading\.{0,3}$/i,
    /^please wait\.{0,3}$/i,
  ];
  return noisePatterns.some(p => p.test(text));
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
 */
function textToBlocks(rawText: string): ScrapedBlock[] {
  const result: ScrapedBlock[] = [];

  if (!rawText || rawText.length < 8 || isNoise(rawText)) return result;

    const inlineList = tryExtractInlineList(rawText);
  if (inlineList) {
    if (inlineList.type === "checklist") {
      result.push({ id: uid(), type: "checklist", data: { headline: "", items: inlineList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
    } else {
      result.push({ id: uid(), type: "bullets", data: { headline: "", items: (inlineList.items as string[]), iconColor: "#179ca3", bgColor: "#f8fffe" } });
    }
    return result;
  }
  const paragraphs = rawText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length >= 8 && !isNoise(p));
  for (const para of paragraphs) {
    const subList = tryExtractInlineList(para);
    if (subList) {
      if (subList.type === "checklist") {
        result.push({ id: uid(), type: "checklist", data: { headline: "", items: subList.items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
      } else {
        result.push({ id: uid(), type: "bullets", data: { headline: "", items: (subList.items as string[]), iconColor: "#179ca3", bgColor: "#f8fffe" } });
      }
    } else {
      const htmlContent = para.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
      result.push({ id: uid(), type: "text", data: { html: `<p>${htmlContent}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
    }
  }

  return result;
}

// ─── Column width detection ───────────────────────────────────────────────────

/**
 * Detect the Bootstrap column width (1–12) from a class string.
 * Supports: col-md-6, col-sm-4, col-lg-3, col-6, etc.
 */
function getBootstrapColWidth(cls: string): number {
  const match = cls.match(/\bcol(?:-(?:xs|sm|md|lg|xl|xxl))?-(\d+)\b/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Check if a class string indicates a column element.
 */
function isColumnClass(cls: string): boolean {
  return /\bcol(?:-(?:xs|sm|md|lg|xl|xxl))?-\d+\b/.test(cls) ||
    /\bcol_(?:left|right|center)\b/.test(cls) ||
    /\binnerContent\b/.test(cls);
}

/**
 * Check if a class string indicates a row/grid container.
 */
function isRowClass(cls: string): boolean {
  return /\brow\b/.test(cls) ||
    /\bgrid\b/.test(cls) ||
    /\bflex-row\b/.test(cls);
}

/**
 * Detect inline CSS grid or flex two-column layout.
 */
function hasInlineTwoColumnStyle(el: any): boolean {
  const style = (el.attribs?.style || "").toLowerCase();
  return (
    /grid-template-columns\s*:\s*[^;]*\s+[^;]*/.test(style) ||
    /display\s*:\s*grid/.test(style) ||
    (style.includes("display") && style.includes("flex") && style.includes("width") && style.includes("50"))
  );
}

/**
 * Collect all direct column children of a row element.
 * Returns array of { el, colWidth } where colWidth is 1–12.
 */
function getRowColumns($: cheerio.CheerioAPI, rowEl: any): Array<{ el: any; colWidth: number }> {
  const cols: Array<{ el: any; colWidth: number }> = [];
  $(rowEl).children().each((_i, child) => {
    const cls = child.attribs?.class || "";
    if (isColumnClass(cls)) {
      const width = getBootstrapColWidth(cls);
      cols.push({ el: child, colWidth: width || 6 });
    }
  });
  return cols;
}

/**
 * Convert a column element's content into a flat HTML string for use in
 * two_column / divided_columns / three_column blocks.
 * Images become <img> tags, headings/paragraphs become their HTML.
 */
function colToHtml($: cheerio.CheerioAPI, colEl: any, baseUrl: string): string {
  const parts: string[] = [];
  const $col = $(colEl);

  function collectHtml(el: any) {
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    const $el = $(el);

    if (tag === "img") {
      const src = resolveUrl($el.attr("src") || $el.attr("data-src") || "", baseUrl);
      if (src && !src.includes("data:") && !src.includes("pixel")) {
        const alt = $el.attr("alt") || "";
        parts.push(`<img src="${src}" alt="${alt}" style="max-width:100%;display:block;margin:0 auto;" />`);
      }
      return;
    }

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      const text = cleanTextFlat($el.text());
      // Don't apply noise filter to headings — short headings like "WHAT", "WHEN", "WHY" are valid
      if (text && text.length >= 1) parts.push(`<${tag}>${text}</${tag}>`);
      return;
    }

    if (tag === "p") {
      $el.find("br").replaceWith("\n");
      const text = cleanText($el.text());
      if (text && text.length >= 4 && !isNoise(text)) {
        // Check if this paragraph contains br-separated checkmarks → convert to checklist HTML
        const inlineList = tryExtractInlineList(text);
        if (inlineList && inlineList.items.length >= 2) {
          if (inlineList.type === "checklist") {
            const listHtml = inlineList.items.map(item => {
              const icon = item.crossed ? "✗" : "✔";
              const style = item.crossed ? " style=\"text-decoration:line-through;color:#999;\"" : "";
              return `<li${style}>${icon} ${item.text}</li>`;
            }).join("");
            parts.push(`<ul class="checklist">${listHtml}</ul>`);
          } else {
            const listHtml = (inlineList.items as string[]).map(item => `<li>${item}</li>`).join("");
            parts.push(`<ul>${listHtml}</ul>`);
          }
        } else {
          const htmlContent = text.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
          parts.push(`<p>${htmlContent}</p>`);
        }
      }
      return;
    }

    if (tag === "ul") {
      const items = extractListItems($, $el);
      if (items.length > 0) {
        const isCheck = isChecklistUl($, $el);
        const listHtml = items.map(item => {
          if (isCheck) {
            const icon = item.crossed ? "✗" : "✔";
            const style = item.crossed ? " style=\"text-decoration:line-through;color:#999;\"" : "";
            return `<li${style}>${icon} ${item.text}</li>`;
          }
          return `<li>${item.text}</li>`;
        }).join("");
        parts.push(`<ul${isCheck ? " class=\"checklist\"" : ""}>${listHtml}</ul>`);
      }
      return;
    }

    if (tag === "ol") {
      const items = $el.children("li").map((_j: number, li: any) => cleanTextFlat($(li).text())).get().filter(Boolean);
      if (items.length > 0) {
        parts.push(`<ol>${items.map(i => `<li>${i}</li>`).join("")}</ol>`);
      }
      return;
    }

    if (tag === "a") {
      const text = cleanTextFlat($el.text());
      const href = $el.attr("href") || "";
      if (text && text.length >= 3 && !isNoise(text)) {
        if (isCTALink($, $el)) {
          parts.push(`<p><a href="${href}" style="display:inline-block;padding:12px 24px;background:#179ca3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">${text}</a></p>`);
        } else {
          parts.push(`<p><a href="${href}">${text}</a></p>`);
        }
      }
      return;
    }

    // Recurse into container elements
    if (["div", "section", "article", "figure", "figcaption", "span", "strong", "em", "b", "i"].includes(tag)) {
      const hasBlockChildren = $el.children("p, h1, h2, h3, h4, h5, h6, ul, ol, div, section, img, a").length > 0;
      if (!hasBlockChildren) {
        $el.find("br").replaceWith("\n");
        const text = cleanText($el.text());
        if (text && text.length >= 8 && !isNoise(text)) {
          const htmlContent = text.split("\n").map(l => l.trim()).filter(Boolean).join("<br>");
          parts.push(`<p>${htmlContent}</p>`);
        }
        return;
      }
      $el.children().each((_i, child) => collectHtml(child));
    }
  }

  $col.children().each((_i, child) => collectHtml(child));
  return parts.join("\n");
}

/**
 * Check if a column contains primarily an image (and minimal text).
 */
function colIsImage($: cheerio.CheerioAPI, colEl: any, baseUrl: string): string | null {
  const $col = $(colEl);
  const imgs = $col.find("img").toArray();
  if (imgs.length === 0) return null;
  const textLength = cleanTextFlat($col.text()).length;
  if (textLength > 80) return null; // Has substantial text too — not pure image
  const src = resolveUrl($(imgs[0]).attr("src") || $(imgs[0]).attr("data-src") || "", baseUrl);
  if (!src || src.includes("data:") || src.includes("pixel")) return null;
  return src;
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
    ".elCountdownTimer, .elCountdown, .countdown, [class*='countdown'], [class*='timer'], " +
    "[data-state-node-script-id]"
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

  /**
   * Try to handle a row element with Bootstrap-style column children.
   * Returns true if the row was handled as a multi-column block.
   */
  function tryHandleRow(el: any): boolean {
    const cls = el.attribs?.class || "";
    if (!isRowClass(cls)) return false;

    const cols = getRowColumns($, el);
    if (cols.length < 2) return false;

    // Mark all column elements as processed
    cols.forEach(c => processed.add(c.el));
    processed.add(el);

    // Determine total width to understand layout
    const totalWidth = cols.reduce((sum, c) => sum + c.colWidth, 0);
    const colCount = cols.length;

    // ── Three-column layout (col-md-4 × 3) ──────────────────────────────
    if (colCount === 3 || (colCount >= 3 && totalWidth >= 10)) {
      const col1Html = colToHtml($, cols[0].el, baseUrl);
      const col2Html = colToHtml($, cols[1].el, baseUrl);
      const col3Html = colToHtml($, cols[2].el, baseUrl);
      if (col1Html || col2Html || col3Html) {
        blocks.push({
          id: uid(),
          type: "three_column",
          data: {
            col1Html: col1Html || "<p></p>",
            col2Html: col2Html || "<p></p>",
            col3Html: col3Html || "<p></p>",
            bgColor: "#ffffff",
            showDividers: true,
            dividerColor: "#e5e7eb",
            dividerStyle: "solid",
            dividerWidth: 1,
            dividerRadius: 0,
          },
        });
        return true;
      }
    }

    // ── Two-column layout (col-md-6 × 2) ────────────────────────────────
    if (colCount === 2) {
      const leftCol = cols[0];
      const rightCol = cols[1];

      // Check if one column is primarily an image
      const leftImgSrc = colIsImage($, leftCol.el, baseUrl);
      const rightImgSrc = colIsImage($, rightCol.el, baseUrl);

      if (leftImgSrc || rightImgSrc) {
        // Image + content → column_layout block with image block on one side
        const imgSrc = leftImgSrc || rightImgSrc!;
        const contentCol = leftImgSrc ? rightCol : leftCol;
        const contentBlocks: ScrapedBlock[] = [];

        // Collect blocks from the content column
        const tempBlocks: ScrapedBlock[] = [];
        const savedBlocks = blocks.splice(0, blocks.length);
        // Temporarily redirect block output to tempBlocks
        const $contentCol = $(contentCol.el);
        $contentCol.find("br").replaceWith("\n");

        // Walk the content column
        function walkCol(colEl: any) {
          const tag = colEl.tagName?.toLowerCase();
          if (!tag) return;
          const $el = $(colEl);

          if (tag === "img") return; // Skip images in content column
          if (tag === "h2" || tag === "h3" || tag === "h4") {
            const text = cleanTextFlat($el.text());
            if (text && !isNoise(text)) {
              const level = tag === "h2" ? "h2" : "h3";
              tempBlocks.push({ id: uid(), type: "text", data: { html: `<${level}>${text}</${level}>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
            }
            return;
          }
          if (tag === "p") {
            $el.find("br").replaceWith("\n");
            const rawText = cleanText($el.text());
            tempBlocks.push(...textToBlocks(rawText));
            return;
          }
          if (tag === "ul") {
            const items = extractListItems($, $el);
            if (items.length > 0) {
              if (isChecklistUl($, $el)) {
                tempBlocks.push({ id: uid(), type: "checklist", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#f8fffe" } });
              } else {
                tempBlocks.push({ id: uid(), type: "bullets", data: { headline: "", items: items.map(i => i.text), iconColor: "#179ca3", bgColor: "#f8fffe" } });
              }
            }
            return;
          }
          if (tag === "ol") {
            const items = $el.children("li").map((_j: number, li: any) => cleanTextFlat($(li).text())).get().filter(Boolean);
            if (items.length > 0) {
              tempBlocks.push({ id: uid(), type: "numbered_list", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#ffffff" } });
            }
            return;
          }
          if (["div", "section", "article", "figure", "figcaption", "span"].includes(tag)) {
            const hasBlockChildren = $el.children("p, h1, h2, h3, h4, h5, h6, ul, ol, div, section, img, a").length > 0;
            if (!hasBlockChildren) {
              $el.find("br").replaceWith("\n");
              const rawText = cleanText($el.text());
              tempBlocks.push(...textToBlocks(rawText));
              return;
            }
            $el.children().each((_i, child) => walkCol(child));
          }
        }

        $contentCol.children().each((_i, child) => walkCol(child));

        // Restore main blocks
        blocks.push(...savedBlocks);

        if (tempBlocks.length > 0 || imgSrc) {
          // Build column_layout block: image on one side, content blocks on other
          const imageBlock: ScrapedBlock = {
            id: uid(),
            type: "image",
            data: { url: imgSrc, alt: "", caption: "", align: "center", maxWidth: "auto", showShadow: true },
          };

          const isImageLeft = !!leftImgSrc;
          blocks.push({
            id: uid(),
            type: "column_layout",
            data: {
              leftBlocks: isImageLeft ? [imageBlock] : tempBlocks,
              rightBlocks: isImageLeft ? tempBlocks : [imageBlock],
              leftRatio: 50,
              gap: 32,
              bgColor: "transparent",
              paddingX: 32,
              paddingY: 16,
            },
          });
          return true;
        }
      }

      // Both columns have text content → two_column block
      const leftHtml = colToHtml($, leftCol.el, baseUrl);
      const rightHtml = colToHtml($, rightCol.el, baseUrl);

      if (leftHtml || rightHtml) {
        // Calculate left ratio from column widths
        const leftRatio = leftCol.colWidth > 0 && rightCol.colWidth > 0
          ? Math.round((leftCol.colWidth / (leftCol.colWidth + rightCol.colWidth)) * 100)
          : 50;

        blocks.push({
          id: uid(),
          type: "two_column",
          data: {
            leftType: "rich_text",
            rightType: "rich_text",
            leftHtml: leftHtml || "<p></p>",
            rightHtml: rightHtml || "<p></p>",
            leftRatio,
            bgColor: "#ffffff",
          },
        });
        return true;
      }
    }

    // ── Four+ columns → divided_columns ─────────────────────────────────
    if (colCount >= 4) {
      const colHtmls = cols.map(c => ({ html: colToHtml($, c.el, baseUrl) || "<p></p>" }));
      blocks.push({
        id: uid(),
        type: "divided_columns",
        data: { columns: colHtmls, gap: 24, bgColor: "#ffffff" },
      });
      return true;
    }

    return false;
  }

  function walk(el: any) {
    if (!el || processed.has(el)) return;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;

    const $el = $(el);
    const cls = el.attribs?.class || "";

    // ── Row/grid containers → try multi-column detection first ────────────
    if ((tag === "div" || tag === "section") && (isRowClass(cls) || hasInlineTwoColumnStyle(el))) {
      if (tryHandleRow(el)) return;
    }

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
        blocks.push({ id: uid(), type: "bullets", data: { headline: "", items: items.map(i => i.text), iconColor: "#179ca3", bgColor: "#f8fffe" } });
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
        processed.add(el);
        $el.find("br").replaceWith("\n");
        const rawText = cleanText($el.text());
        blocks.push(...textToBlocks(rawText));
        return;
      }

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
