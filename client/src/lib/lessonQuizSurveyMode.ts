export type SurveyQuestionWithAnswerKeys = {
  correctAnswer?: number;
  correctAnswers?: number[];
  hotspotMarkers?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

/**
 * Survey questions collect responses only. Remove every answer-key marker so
 * saved lesson blocks cannot carry a hidden correct or incorrect answer.
 */
export function clearSurveyAnswerKeys<T extends SurveyQuestionWithAnswerKeys>(question: T): T {
  const { correctAnswer: _correctAnswer, correctAnswers: _correctAnswers, ...withoutAnswerKeys } = question;
  return {
    ...withoutAnswerKeys,
    ...(question.hotspotMarkers
      ? { hotspotMarkers: question.hotspotMarkers.map(marker => ({ ...marker, isCorrect: false })) }
      : {}),
  } as T;
}

export function clearSurveyAnswerKeysFromQuestions<T extends SurveyQuestionWithAnswerKeys>(questions: T[]): T[] {
  return questions.map(clearSurveyAnswerKeys);
}

export function nonEmptySurveyChoices(choices: unknown[]): string[] {
  return choices.map(choice => String(choice ?? "").trim()).filter(Boolean);
}
