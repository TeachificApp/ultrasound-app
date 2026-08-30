export const MIN_FULL_LESSON_WORDS = 1_500;

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
