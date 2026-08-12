/**
 * Preserves authored option order unless the individual question explicitly
 * requests randomization. The copy prevents mutating stored question content.
 */
export function orderQuestionOptions<T>(
  options: readonly T[],
  shuffleAnswerOptions: boolean,
  random: () => number = Math.random,
): T[] {
  if (!shuffleAnswerOptions) return [...options];

  const ordered = [...options];
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return ordered;
}

/** Resolve a quiz-wide shuffle default with an explicit question-level authored-order override. */
export function shouldShuffleQuestionOptions({
  quizDefault,
  questionSetting,
  lockAnswerOrder,
}: {
  quizDefault: boolean;
  questionSetting?: boolean | null;
  lockAnswerOrder?: boolean | null;
}): boolean {
  if (lockAnswerOrder) return false;
  return questionSetting ?? quizDefault;
}

/** Build the non-builder learner option payload while honoring quiz defaults and preserve-order overrides. */
export function buildStandaloneLearnerOptions<T>({
  options,
  quizShuffleAnswers,
  questionShuffleAnswerOptions,
  lockAnswerOrder,
  random,
}: {
  options: readonly T[];
  quizShuffleAnswers: boolean;
  questionShuffleAnswerOptions?: boolean | null;
  lockAnswerOrder?: boolean | null;
  random?: () => number;
}): T[] {
  return orderQuestionOptions(
    options,
    shouldShuffleQuestionOptions({
      quizDefault: quizShuffleAnswers,
      questionSetting: questionShuffleAnswerOptions,
      lockAnswerOrder,
    }),
    random,
  );
}
