import { stripHtmlForExport } from "./questionBankExport";

/** Plain-text label from iSpring group/question fields (may contain HTML). */
export function plainTextFromISpring(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  return stripHtmlForExport(value);
}

/** Prefer parser plain text; fall back to stripping rewritten HTML. */
export function plainTextFromISpringContent(
  plain: string | undefined,
  html: string | undefined,
  rewriteRefs: (value: string) => string,
): string {
  const fromPlain = plain?.trim();
  if (fromPlain) return stripHtmlForExport(fromPlain);
  if (!html?.trim()) return "";
  return stripHtmlForExport(rewriteRefs(html));
}
