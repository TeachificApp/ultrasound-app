export type InlineQuizQuestion = {
  id?: unknown;
  question?: unknown;
  type?: unknown;
};

export type SubmittedInlineQuizResponse = {
  questionKey: string;
  answerValue?: string | number | null;
};

export type PersistedInlineQuizResponse = {
  questionKey: string;
  questionText: string;
  questionType: string;
  answerValue: string | null;
};

const MAX_RESPONSE_LENGTH = 10_000;

/**
 * Match learner-submitted values to question definitions stored on the lesson.
 * This prevents clients from supplying arbitrary report labels or question text.
 */
export function prepareInlineQuizResponses(
  questions: unknown,
  submitted: SubmittedInlineQuizResponse[],
): PersistedInlineQuizResponse[] {
  if (!Array.isArray(questions) || !Array.isArray(submitted)) return [];

  const knownQuestions = new Map<string, { questionText: string; questionType: string }>();
  questions.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return;
    const question = candidate as InlineQuizQuestion;
    const questionText = typeof question.question === "string" ? question.question.trim() : "";
    if (!questionText) return;
    const questionKey = String(question.id ?? index);
    knownQuestions.set(questionKey, {
      questionText,
      questionType: typeof question.type === "string" && question.type.trim() ? question.type : "mcq",
    });
  });

  const submittedByKey = new Map<string, SubmittedInlineQuizResponse>();
  submitted.forEach(response => {
    if (!response?.questionKey || submittedByKey.has(response.questionKey)) return;
    submittedByKey.set(response.questionKey, response);
  });

  return [...knownQuestions.entries()].flatMap(([questionKey, question]) => {
    const response = submittedByKey.get(questionKey);
    if (!response) return [];
    const rawValue = response.answerValue;
    const answerValue = rawValue === undefined || rawValue === null
      ? null
      : String(rawValue).slice(0, MAX_RESPONSE_LENGTH);
    return [{ questionKey, ...question, answerValue }];
  });
}
