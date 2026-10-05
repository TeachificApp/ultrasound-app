export function buildAiQuestionBankInsertValues(question: any, folderId: number | null, createdByAdminId: number) {
  const isFlashcard = question.type === "flashcard";
  const options = Array.isArray(question.options)
    ? question.options.map((text: string, index: number) => ({ text, feedback: question.optionFeedback?.[index] ?? "" }))
    : [];
  return {
    question: isFlashcard ? question.flashcardFront ?? question.question : question.question,
    type: isFlashcard ? "flashcard" : question.type === "truefalse" ? "truefalse" : question.type === "multiselect" ? "multiselect" : question.type === "matching" ? "matching" : question.type === "hotspot" ? "hotspot" : "mcq",
    options: !isFlashcard && options.length > 0 ? JSON.stringify(options) : null,
    correctAnswer: isFlashcard ? "" : question.correctAnswer,
    correctAnswers: question.type === "multiselect" ? JSON.stringify(question.correctAnswers ?? []) : null,
    matchingPairs: question.type === "matching" ? JSON.stringify(question.matchingPairs ?? []) : null,
    explanation: question.explanation ?? null,
    correctFeedback: question.correctFeedback ?? question.explanation ?? null,
    incorrectFeedback: question.incorrectFeedback ?? question.explanation ?? null,
    flashcardFront: isFlashcard ? question.flashcardFront ?? question.question : null,
    flashcardBack: isFlashcard ? question.flashcardBack ?? question.correctAnswer : null,
    folderId,
    createdByAdminId,
  };
}
