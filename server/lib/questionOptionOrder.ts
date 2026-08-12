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
