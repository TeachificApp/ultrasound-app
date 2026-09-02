export interface InlineQuizAttemptInput {
  userId: number;
  courseId: number;
  lessonId: number;
  quizBlockId: string;
  score: number;
  passed: boolean;
  accountFieldValues: string | null;
}

/**
 * `account_field_values` was added after the original inline-quiz table.
 * Omitting the optional field when no creator-selected fields exist keeps the
 * generated insert compatible with both table revisions.
 */
export function buildInlineQuizAttemptValues(input: InlineQuizAttemptInput) {
  const { accountFieldValues, ...base } = input;
  return accountFieldValues === null ? base : { ...base, accountFieldValues };
}

/** Return true only for the known optional reporting-column compatibility gap. */
export function isMissingInlineQuizAccountFieldsColumn(error: unknown): boolean {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  return /unknown column\s+['`]?account_field_values['`]?/i.test(message);
}
