export type QuizQuestionDependency = {
  parentQuestionId: string;
  expectedAnswer: string;
};

/**
 * Returns whether an answer matches an exact author-configured dependency.
 * Choice questions can submit either a raw value or an array of selected values.
 */
export function matchesQuestionDependency(
  dependency: QuizQuestionDependency | undefined | null,
  rawParentAnswer: string | undefined,
): boolean {
  if (!dependency) return true;
  if (!rawParentAnswer || !dependency.parentQuestionId || !dependency.expectedAnswer) return false;

  try {
    const parsed = JSON.parse(rawParentAnswer) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).includes(dependency.expectedAnswer);
    return String(parsed) === dependency.expectedAnswer;
  } catch {
    return rawParentAnswer === dependency.expectedAnswer;
  }
}

export function filterVisibleDependentQuestions<T extends { id: string; showWhen?: QuizQuestionDependency | null }>(
  questions: T[],
  answerForQuestionId: (questionId: string) => string | undefined,
): T[] {
  return questions.filter((question) => matchesQuestionDependency(question.showWhen, answerForQuestionId(question.showWhen?.parentQuestionId ?? "")));
}
