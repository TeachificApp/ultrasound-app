export const MIN_FULL_LESSON_WORDS = 1_500;
export const TARGET_FULL_LESSON_WORDS = 1_800;
export const MAX_FULL_LESSON_GENERATION_ATTEMPTS = 3;

/** Counts readable words in an HTML fragment without counting markup or entities. */
export function countRenderedWords(html: string): number {
  const plainText = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, " ");
  return (plainText.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

export function isCompleteFullLesson(html: string): boolean {
  return countRenderedWords(html) >= MIN_FULL_LESSON_WORDS;
}

export function appendFullLessonHtml(existing: string, continuation: string): string {
  return [existing.trim(), continuation.trim()].filter(Boolean).join("\n");
}

export function fullLessonWordsRemaining(html: string): number {
  return Math.max(0, TARGET_FULL_LESSON_WORDS - countRenderedWords(html));
}

export function wordsRemainingToTarget(html: string, targetWords: number): number {
  return Math.max(0, targetWords - countRenderedWords(html));
}

/** Removes trailing HTML blocks until word count is at or below maxWords. */
export function trimHtmlToWordCount(html: string, maxWords: number): string {
  if (countRenderedWords(html) <= maxWords) return html.trim();
  const blocks = html.match(/<(h[1-6]|p|ul|ol|blockquote|div)[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  if (blocks.length === 0) {
    const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean);
    return `<p>${words.slice(0, maxWords).join(" ")}</p>`;
  }
  let trimmed = html.trim();
  while (countRenderedWords(trimmed) > maxWords && blocks.length > 1) {
    blocks.pop();
    trimmed = blocks.join("\n");
  }
  if (countRenderedWords(trimmed) > maxWords) {
    const words = trimmed.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean);
    trimmed = `<p>${words.slice(0, maxWords).join(" ")}</p>`;
  }
  return trimmed.trim();
}

export function isWithinTargetWordRange(html: string, targetWords: number, tolerance = 0.1): boolean {
  const count = countRenderedWords(html);
  const minWords = Math.floor(targetWords * (1 - tolerance));
  const maxWords = Math.ceil(targetWords * (1 + tolerance));
  return count >= minWords && count <= maxWords;
}

/** Trims over-long output and optionally extends short output toward targetWordCount. */
export async function enforceTargetWordCount(
  html: string,
  targetWordCount: number,
  generateContinuation?: (currentDraft: string, wordsNeeded: number) => Promise<string>,
): Promise<string> {
  const maxWords = Math.ceil(targetWordCount * 1.1);
  const minWords = Math.floor(targetWordCount * 0.9);
  let draft = html.trim();
  if (countRenderedWords(draft) > maxWords) draft = trimHtmlToWordCount(draft, maxWords);
  if (generateContinuation) {
    for (let attempt = 0; countRenderedWords(draft) < minWords && attempt < MAX_FULL_LESSON_GENERATION_ATTEMPTS; attempt += 1) {
      const wordsNeeded = minWords - countRenderedWords(draft);
      const continuation = await generateContinuation(draft, wordsNeeded);
      if (!continuation.trim()) break;
      draft = appendFullLessonHtml(draft, continuation);
      if (countRenderedWords(draft) > maxWords) draft = trimHtmlToWordCount(draft, maxWords);
    }
  }
  if (countRenderedWords(draft) > maxWords) draft = trimHtmlToWordCount(draft, maxWords);
  return draft;
}

/** Extends a short draft at most twice, leaving final minimum-length enforcement to the caller. */
export async function extendFullLessonDraft(
  initialDraft: string,
  generateContinuation: (currentDraft: string) => Promise<string>,
): Promise<string> {
  let draft = initialDraft;
  for (let attempt = 1; !isCompleteFullLesson(draft) && attempt < MAX_FULL_LESSON_GENERATION_ATTEMPTS; attempt += 1) {
    const continuation = await generateContinuation(draft);
    if (!continuation.trim()) break;
    draft = appendFullLessonHtml(draft, continuation);
  }
  return draft;
}
