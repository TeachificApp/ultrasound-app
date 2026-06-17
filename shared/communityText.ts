/**
 * Helpers for community post body text (rich HTML from TipTap).
 */

/** True when HTML has no meaningful text content */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

/** Append comma-separated hashtags to body so syncHashtags picks them up */
export function appendHashtagsToBody(body: string, hashtags?: string | null): string {
  const tags = (hashtags ?? "")
    .split(/[,\s]+/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
  if (!tags.length) return body;
  const suffix = tags.map((t) => `#${t}`).join(" ");
  return `${body.trim()}\n<p>${suffix}</p>`;
}
