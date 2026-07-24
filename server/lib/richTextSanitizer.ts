/**
 * richTextSanitizer.ts
 * Strips non-standard HTML attributes that leak in from copy-paste (Google Docs,
 * Microsoft Word, TinyMCE, Sheets, etc.) before storing rich text in the database.
 *
 * Uses cheerio (already a project dependency) so no extra packages are needed.
 */
import * as cheerio from "cheerio";

/** Attribute names that are never valid in TipTap/ProseMirror HTML */
const BANNED_ATTRS = [
  "containerstyle",
  "wrapperstyle",
  "containerStyle",
  "wrapperStyle",
];

/** Attribute name prefixes that are never valid */
const BANNED_PREFIXES = [
  "data-mce-",
  "data-stringify-",
  "data-sheets-",
  "data-google-",
  "data-ogsb",
  "data-ogsc",
  "data-ogab",
  "data-ogac",
];

/**
 * Sanitize a rich-text HTML string by removing non-standard attributes
 * while preserving all valid HTML structure and inline styles.
 *
 * Returns the original string unchanged if it is null, undefined, or empty.
 */
export function sanitizeRichText(html: string | null | undefined): string | null | undefined {
  if (!html) return html;

  try {
    const $ = cheerio.load(html, { xmlMode: false });

    $("*").each((_i, el) => {
      if (el.type !== "tag") return;
      const attribs = el.attribs ?? {};
      for (const attr of Object.keys(attribs)) {
        if (BANNED_ATTRS.includes(attr)) {
          delete attribs[attr];
          continue;
        }
        for (const prefix of BANNED_PREFIXES) {
          if (attr.startsWith(prefix)) {
            delete attribs[attr];
            break;
          }
        }
      }
    });

    // cheerio.load wraps content in <html><body>…</body></html>; extract body only
    return $("body").html() ?? html;
  } catch {
    // If parsing fails for any reason, return the original string unchanged
    return html;
  }
}
