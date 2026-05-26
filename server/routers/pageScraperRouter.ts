import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as cheerio from "cheerio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapedBlock {
  type: string;
  data: Record<string, any>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Checkmark detection — returns true if the text/HTML of a list item starts
 * with a common checkmark character or emoji, OR if the item contains a
 * checkmark icon element (SVG/img with check-related class/aria-label).
 *
 * Detected patterns:
 *   Unicode: ✓ ✔ ✅ ☑ ✗ (cross — treated as check for design purposes)
 *   HTML entities: &#10003; &#10004; &#9989; &#9745;
 *   CSS classes: fa-check, icon-check, check-icon, checkmark, bi-check
 *   Aria labels: aria-label containing "check"
 */
const CHECKMARK_REGEX = /^[\s]*[✓✔✅☑✗☒✘]/u;
const CHECKMARK_ENTITY_REGEX = /^[\s]*(?:&#10003;|&#10004;|&#9989;|&#9745;|&check;)/i;

function stripCheckmark(text: string): string {
  // Remove leading checkmark emoji/char and any trailing whitespace after it
  return text.replace(/^[\s]*[✓✔✅☑✗☒✘]\s*/u, "").trim();
}

/**
 * Determine if a <ul> element should be rendered as a checklist block.
 * Returns true if the majority (>50%) of its <li> items start with a
 * checkmark character/emoji, or if any <li> contains a checkmark icon element.
 */
function isChecklistUl($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): boolean {
  const items = $ul.children("li").toArray();
  if (items.length === 0) return false;

  let checkCount = 0;

  for (const li of items) {
    const $li = $(li);
    const rawText = $li.text();
    const trimmed = rawText.trim();

    // Check text starts with a checkmark char
    if (CHECKMARK_REGEX.test(trimmed) || CHECKMARK_ENTITY_REGEX.test(trimmed)) {
      checkCount++;
      continue;
    }

    // Check for checkmark icon elements inside the <li>
    // Covers: <i class="fa fa-check">, <span class="checkmark">, SVG with title "check", etc.
    const hasCheckIcon = $li.find(
      "[class*='check'], [class*='tick'], [aria-label*='check'], [aria-label*='Check'], [title*='check'], [title*='Check'], svg[class*='check'], img[alt*='check'], img[alt*='Check']"
    ).length > 0;

    if (hasCheckIcon) {
      checkCount++;
      continue;
    }

    // Check for ✓ anywhere in the HTML of the li (covers icon fonts rendering as text)
    const liHtml = $.html($li) || "";
    if (/[✓✔✅☑]/.test(liHtml)) {
      checkCount++;
    }
  }

  // If more than half the items have checkmarks → treat as checklist
  return checkCount > items.length / 2;
}

/**
 * Extract list items from a <ul>, stripping leading checkmark chars from text.
 */
function extractListItems($: cheerio.CheerioAPI, $ul: cheerio.Cheerio<any>): string[] {
  return $ul
    .children("li")
    .map((_j: number, li: any) => {
      const raw = cleanText($(li).text());
      return stripCheckmark(raw) || raw; // fallback to original if stripping empties it
    })
    .get()
    .filter(Boolean);
}

/**
 * Convert a scraped URL's HTML into an ordered list of landing-page blocks.
 * Mapping strategy:
 *   - First H1 (or OG title) + meta description → hero block
 *   - H2 / H3 headings with following paragraphs → text block (rich HTML)
 *   - Standalone paragraphs / long text → text block
 *   - Images (with meaningful src) → image block
 *   - UL with checkmark items → checklist block
 *   - UL without checkmarks → bullets block
 *   - OL → numbered_list block
 *   - Anchor buttons / CTA-like links → cta_standalone block
 *   - Everything else that has text → text block (rich HTML fallback)
 */
function htmlToBlocks(html: string, baseUrl: string): ScrapedBlock[] {
  const $ = cheerio.load(html);

  // Remove noisy elements
  $("script, style, noscript, nav, footer, header, aside, [role='navigation'], [role='banner'], [role='complementary'], .cookie-banner, #cookie, .popup, .modal, .overlay, .ad, .advertisement, .sidebar, .widget, .menu, .nav, .navbar, .header, .footer").remove();

  const blocks: ScrapedBlock[] = [];

  // ── Hero block from OG/meta + first H1 ──────────────────────────────────
  const ogTitle = $("meta[property='og:title']").attr("content") || "";
  const ogDesc = $("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content") || "";
  const ogImage = $("meta[property='og:image']").attr("content") || "";
  const h1Text = cleanText($("h1").first().text());

  const heroHeadline = h1Text || ogTitle || "";
  if (heroHeadline) {
    blocks.push({
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
    // Remove the H1 so it's not duplicated below
    $("h1").first().remove();
  }

  // ── Walk the main content area ───────────────────────────────────────────
  // Try to find main content container
  const mainEl = $("main, [role='main'], article, .content, .main-content, #content, #main").first();
  const root = mainEl.length ? mainEl : $("body");

  root.children().each((_i, el) => {
    const tag = (el as any).tagName?.toLowerCase();
    if (!tag) return;

    const $el = $(el);
    const text = cleanText($el.text());
    if (!text && tag !== "img") return;

    // ── Headings ──────────────────────────────────────────────────────────
    if (tag === "h2" || tag === "h3" || tag === "h4") {
      // Collect following siblings until next heading
      let richHtml = `<${tag === "h2" ? "h2" : "h3"}>${text}</${tag === "h2" ? "h2" : "h3"}>`;
      let next = $el.next();
      while (next.length && !["h1", "h2", "h3", "h4"].includes((next[0] as any).tagName?.toLowerCase() ?? "")) {
        const nextTag = (next[0] as any).tagName?.toLowerCase();
        if (nextTag === "p") {
          richHtml += `<p>${cleanText(next.text())}</p>`;
        } else if (nextTag === "ul") {
          richHtml += `<ul>${next.children("li").map((_j: number, li: any) => `<li>${cleanText($(li).text())}</li>`).get().join("")}</ul>`;
        } else if (nextTag === "ol") {
          richHtml += `<ol>${next.children("li").map((_j: number, li: any) => `<li>${cleanText($(li).text())}</li>`).get().join("")}</ol>`;
        }
        next = next.next();
      }
      blocks.push({ type: "text", data: { html: richHtml, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    // ── Paragraphs ────────────────────────────────────────────────────────
    if (tag === "p") {
      if (text.length < 10) return; // skip tiny snippets
      blocks.push({ type: "text", data: { html: `<p>${text}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
      return;
    }

    // ── Unordered lists → checklist or bullets block ──────────────────────
    if (tag === "ul") {
      const items = extractListItems($, $el);
      if (items.length === 0) return;

      if (isChecklistUl($, $el)) {
        // Checkmark list → checklist block
        blocks.push({
          type: "checklist",
          data: { headline: "", items, accentColor: "#179ca3", bgColor: "#f8fffe" },
        });
      } else {
        // Regular list → bullets block
        blocks.push({ type: "bullets", data: { headline: "", items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
      }
      return;
    }

    // ── Ordered lists → numbered_list block ──────────────────────────────
    if (tag === "ol") {
      const items = $el.children("li").map((_j: number, li: any) => cleanText($(li).text())).get().filter(Boolean);
      if (items.length === 0) return;
      blocks.push({ type: "numbered_list", data: { headline: "", items, accentColor: "#179ca3", bgColor: "#ffffff" } });
      return;
    }

    // ── Images ────────────────────────────────────────────────────────────
    if (tag === "img") {
      const src = resolveUrl($el.attr("src") || "", baseUrl);
      const alt = $el.attr("alt") || "";
      if (!src || src.includes("data:") || src.includes("pixel") || src.includes("tracking")) return;
      blocks.push({ type: "image", data: { url: src, alt, caption: "", align: "center", maxWidth: "auto", showShadow: true } });
      return;
    }

    // ── Sections / divs — recurse into content ────────────────────────────
    if (tag === "section" || tag === "div" || tag === "article") {
      // Check for image inside
      const imgs = $el.find("img");
      imgs.each((_j, img) => {
        const src = resolveUrl($(img).attr("src") || "", baseUrl);
        if (src && !src.includes("data:") && !src.includes("pixel")) {
          blocks.push({ type: "image", data: { url: src, alt: $(img).attr("alt") || "", caption: "", align: "center", maxWidth: "auto", showShadow: true } });
        }
      });

      // Check for headings inside
      $el.find("h2, h3").each((_j, h) => {
        const hText = cleanText($(h).text());
        if (hText) {
          blocks.push({ type: "text", data: { html: `<h2>${hText}</h2>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
        }
      });

      // Paragraphs inside
      $el.find("p").each((_j, p) => {
        const pText = cleanText($(p).text());
        if (pText && pText.length >= 10) {
          blocks.push({ type: "text", data: { html: `<p>${pText}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
        }
      });

      // Lists inside — detect checklist vs bullets
      $el.find("ul").each((_j, ul) => {
        const $ul = $(ul);
        const items = extractListItems($, $ul);
        if (items.length > 0) {
          if (isChecklistUl($, $ul)) {
            blocks.push({
              type: "checklist",
              data: { headline: "", items, accentColor: "#179ca3", bgColor: "#f8fffe" },
            });
          } else {
            blocks.push({ type: "bullets", data: { headline: "", items, iconColor: "#179ca3", bgColor: "#f8fffe" } });
          }
        }
      });
      return;
    }

    // ── Fallback: any element with substantial text → rich text ──────────
    if (text.length >= 20) {
      blocks.push({ type: "text", data: { html: `<p>${text}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
    }
  });

  // ── Deduplicate consecutive identical text blocks ────────────────────────
  const deduped: ScrapedBlock[] = [];
  for (const block of blocks) {
    const last = deduped[deduped.length - 1];
    if (last && last.type === "text" && block.type === "text" && last.data.html === block.data.html) continue;
    deduped.push(block);
  }

  // ── Add IDs ──────────────────────────────────────────────────────────────
  return deduped.map((b) => ({ ...b, id: uid() }));
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
            "User-Agent": "Mozilla/5.0 (compatible; UltrasoundAssist/1.0; +https://allaboutultrasound.com)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
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
      const pageTitle = cleanText($("title").first().text()) || $("meta[property='og:title']").attr("content") || "";

      return {
        blocks,
        pageTitle,
        sourceUrl: input.url,
        blockCount: blocks.length,
      };
    }),
});
