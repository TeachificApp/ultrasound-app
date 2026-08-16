export type StoredQuestionBankFeedbackRow = {
  id: number;
  options: string | null;
  explanation?: string | null;
};

export type GeneratedDualFeedback = {
  id: number;
  correctFeedback?: string;
  incorrectFeedback?: string;
  optionFeedback?: string[];
};

export function parseQuestionBankOptions(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasCompleteDualFeedback(row: StoredQuestionBankFeedbackRow, generated?: GeneratedDualFeedback) {
  const optionCount = parseQuestionBankOptions(row.options).length;
  return Boolean(
    generated?.correctFeedback?.trim()
      && generated?.incorrectFeedback?.trim()
      && (generated.optionFeedback?.length ?? 0) >= optionCount,
  );
}

export async function resolveDualFeedbackForExistingQuestion(
  row: StoredQuestionBankFeedbackRow,
  generated: GeneratedDualFeedback | undefined,
  regenerateSingle: () => Promise<GeneratedDualFeedback | undefined>,
) {
  const resolved = hasCompleteDualFeedback(row, generated) ? generated : await regenerateSingle();
  if (!hasCompleteDualFeedback(row, resolved)) {
    throw new Error(`Incomplete dual feedback returned for Question Bank item ${row.id}.`);
  }
  return resolved;
}

export function buildExistingQuestionFeedbackUpdate(row: StoredQuestionBankFeedbackRow, generated: GeneratedDualFeedback) {
  const options = parseQuestionBankOptions(row.options);
  if (!hasCompleteDualFeedback(row, generated)) {
    throw new Error(`Incomplete dual feedback returned for Question Bank item ${row.id}.`);
  }
  return {
    correctFeedback: generated.correctFeedback!,
    incorrectFeedback: generated.incorrectFeedback!,
    explanation: row.explanation?.trim() ? row.explanation : generated.correctFeedback!,
    options: JSON.stringify(options.map((option, index) => ({ ...option, feedback: generated.optionFeedback![index] }))),
  };
}
