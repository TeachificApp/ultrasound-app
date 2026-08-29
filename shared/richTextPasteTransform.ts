/**
 * Rich-text clipboard helpers shared by TipTap editors (lessons, email, landing pages).
 * Keeps ChatGPT / Google Docs paste formatting while fixing emoji-only block breaks.
 */

const NON_STANDARD_ATTRS = [
  "containerstyle",
  "wrapperstyle",
  "containerStyle",
  "wrapperStyle",
];

const BANNED_ATTR_PREFIXES = ["data-mce", "data-stringify", "data-sheets"];

/** ChatGPT copy-paste metadata that TipTap would otherwise show as raw attributes. */
const CHATGPT_ATTRS = ["data-start", "data-end", "data-is-only-node", "data-is-last-node"];

export function isEmojiOnlyText(text: string): boolean {
  if (!text.trim()) return false;
  const stripped = text
    .replace(/\p{Emoji}/gu, "")
    .replace(/[\u200D\uFE0F\u20E3]/g, "")
    .replace(/\s/g, "");
  return stripped.length === 0;
}

/** Merge emoji-only lines with the following text line for plain-text paste. */
export function mergeEmojiOnlyPlainTextLines(text: string): string {
  const lines = text.split("\n");
  const merged: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed && isEmojiOnlyText(trimmed) && i + 1 < lines.length && lines[i + 1].trim()) {
      merged.push(`${trimmed} ${lines[i + 1].trim()}`);
      i += 2;
    } else {
      merged.push(line);
      i += 1;
    }
  }
  return merged.join("\n");
}

/** True when clipboard HTML has emoji-only block elements (broken layout). */
export function pastedHtmlHasEmojiOnlyBlocks(pastedHtml: string): boolean {
  if (!pastedHtml.trim()) return false;
  const emojiOnlyBlockRe =
    /<(?:p|div|li)[^>]*>\s*(?:[\p{Emoji_Presentation}\u200D\uFE0F\u20E3\s]+)\s*<\/(?:p|div|li)>/mu;
  return emojiOnlyBlockRe.test(pastedHtml);
}

/**
 * Use plain-text clipboard only when HTML is missing or has broken emoji blocks.
 * Preserves bold/lists/headings when ChatGPT HTML is well-formed.
 */
export function shouldFallbackToPlainTextEmojiPaste(args: {
  pastedHtml: string;
  pastedText: string;
  hasImage: boolean;
}): boolean {
  const { pastedHtml, pastedText, hasImage } = args;
  if (hasImage || !pastedText.trim()) return false;
  const hasEmoji = /\p{Emoji}/u.test(pastedText);
  if (!hasEmoji) return false;
  return pastedHtmlHasEmojiOnlyBlocks(pastedHtml) || !pastedHtml.trim();
}

export function plainTextToPasteHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map(para => {
      const lines = para.split(/\n/);
      const inner = lines
        .map(l => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
        .join("<br>");
      return `<p>${inner}</p>`;
    })
    .join("");
}

function parseStyle(style: string): { bold: boolean; italic: boolean; underline: boolean } {
  return {
    bold: /font-weight:\s*(bold|[6-9]00|bolder)/i.test(style),
    italic: /font-style:\s*italic/i.test(style),
    underline: /text-decoration(?:-line)?:\s*[^;]*underline/i.test(style),
  };
}

/** Convert inline style spans (ChatGPT, Google Docs) to semantic tags TipTap understands. */
function normalizeInlineStyleSpans(doc: Document): void {
  const spans = Array.from(doc.body.querySelectorAll<HTMLSpanElement>("span[style]")).reverse();
  for (const span of spans) {
    const style = span.getAttribute("style") ?? "";
    const { bold, italic, underline } = parseStyle(style);
    if (!bold && !italic && !underline) continue;

    let target: HTMLElement = span;
    const wrap = (tag: string) => {
      const el = doc.createElement(tag);
      while (target.firstChild) el.appendChild(target.firstChild);
      target.replaceWith(el);
      target = el;
    };

    if (bold) wrap("strong");
    if (italic) wrap("em");
    if (underline) wrap("u");
  }
}

function mergeEmojiOnlyBlocks(doc: Document): void {
  const blockEls = Array.from(doc.body.querySelectorAll<HTMLElement>("p, li, div"));
  for (let bi = 0; bi < blockEls.length - 1; bi++) {
    const el = blockEls[bi];
    const next = blockEls[bi + 1];
    if (!el.parentNode || el.parentNode !== next.parentNode) continue;
    const text = el.textContent?.trim() ?? "";
    if (text && isEmojiOnlyText(text)) {
      const space = doc.createTextNode(`${text} `);
      next.insertBefore(space, next.firstChild);
      el.remove();
      bi -= 1;
    }
  }
}

function convertMathMlToTipTap(doc: Document): void {
  doc.body.querySelectorAll<HTMLElement>("math").forEach(mathEl => {
    const annotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation?.textContent?.trim() ?? "";
    if (!latex) return;

    const isBlock =
      mathEl.getAttribute("display") === "block" ||
      mathEl.closest(".math-display, .katex-display, [data-display='block']") !== null;

    const replacement = isBlock ? doc.createElement("div") : doc.createElement("span");
    replacement.setAttribute("data-type", isBlock ? "block-math" : "inline-math");
    replacement.setAttribute("data-latex", latex);

    const container = mathEl.closest(".math, .math-inline, .math-display") ?? mathEl;
    container.replaceWith(replacement);
  });
}

function stripNonStandardAttributes(doc: Document): void {
  doc.body.querySelectorAll("*").forEach(el => {
    NON_STANDARD_ATTRS.forEach(attr => el.removeAttribute(attr));
    CHATGPT_ATTRS.forEach(attr => el.removeAttribute(attr));
    Array.from(el.attributes).forEach(a => {
      if (BANNED_ATTR_PREFIXES.some(prefix => a.name.startsWith(prefix))) {
        el.removeAttribute(a.name);
      }
    });
  });
}

/** Normalize pasted HTML before TipTap parses it. Safe to call in browser paste handlers. */
export function normalizePastedRichTextHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    convertMathMlToTipTap(doc);
    stripNonStandardAttributes(doc);
    normalizeInlineStyleSpans(doc);
    mergeEmojiOnlyBlocks(doc);
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
