/**
 * Prepare TipTap / ChatGPT rich text HTML for email clients.
 * Used when rendering text blocks in campaign emails (preview + send).
 */
import { normalizePastedRichTextHtml } from "./richTextPasteTransform";

function stripEmailUnsafeNodes(doc: Document, root: HTMLElement): void {
  root.querySelectorAll("script, style, iframe, object, embed").forEach(el => {
    if (el.tagName === "IFRAME") {
      const src = el.getAttribute("src") ?? "#";
      const link = doc.createElement("a");
      link.setAttribute("href", src);
      link.textContent = "View content";
      link.setAttribute("style", "color:#189aa1;text-decoration:underline;");
      el.replaceWith(link);
      return;
    }
    el.remove();
  });

  root.querySelectorAll('[data-type="block-math"], [data-type="inline-math"]').forEach(el => {
    const latex = el.getAttribute("data-latex")?.trim() ?? el.textContent?.trim() ?? "";
    const replacement = doc.createElement("span");
    replacement.setAttribute("style", "font-style:italic;color:#4a6070;");
    replacement.textContent = latex ? `[${latex}]` : "";
    el.replaceWith(replacement);
  });

  root.querySelectorAll("img").forEach(img => {
    const style = img.getAttribute("style") ?? "";
    if (!/max-width\s*:/i.test(style)) {
      img.setAttribute("style", `${style}${style ? ";" : ""}max-width:100%;height:auto;display:block;`);
    }
  });
}

/** Normalize rich text HTML for reliable display in email clients. */
export function prepareEmailRichTextHtml(html: string | null | undefined): string {
  if (!html?.trim()) return html ?? "";

  const normalized = normalizePastedRichTextHtml(html);
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="email-rich-text-root">${normalized}</div>`, "text/html");
    const root = doc.getElementById("email-rich-text-root");
    if (!root) return normalized;

    stripEmailUnsafeNodes(doc, root);
    return root.innerHTML;
  } catch {
    return normalized;
  }
}
