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
