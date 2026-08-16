export function buildAiQuestionBankInsertValues(question: any, folderId: number | null, createdByAdminId: number) {
  const options = Array.isArray(question.options)
    ? question.options.map((text: string, index: number) => ({ text, feedback: question.optionFeedback?.[index] ?? "" }))
    : [];
  return {
    question: question.question,
    type: question.type === "truefalse" ? "truefalse" : question.type === "multiselect" ? "multiselect" : question.type === "matching" ? "matching" : question.type === "hotspot" ? "hotspot" : "mcq",
    options: options.length > 0 ? JSON.stringify(options) : null,
    correctAnswer: question.correctAnswer,
    correctAnswers: question.type === "multiselect" ? JSON.stringify(question.correctAnswers ?? []) : null,
    matchingPairs: question.type === "matching" ? JSON.stringify(question.matchingPairs ?? []) : null,
    explanation: question.explanation ?? null,
    correctFeedback: question.correctFeedback ?? question.explanation ?? null,
    incorrectFeedback: question.incorrectFeedback ?? question.explanation ?? null,
    folderId,
    createdByAdminId,
  };
}
