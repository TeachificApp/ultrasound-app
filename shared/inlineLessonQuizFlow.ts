export type InlineLessonQuizCondition = {
  parentQuestionKey?: unknown;
  expectedAnswer?: unknown;
};

export type InlineLessonQuizFlowQuestion = {
  id?: unknown;
  type?: unknown;
  required?: unknown;
  surveyRequired?: unknown;
  showWhen?: InlineLessonQuizCondition | null;
};

export type InlineLessonQuizFlowResponse = {
  questionKey?: unknown;
  answerValue?: unknown;
};

export const INLINE_SURVEY_QUESTION_TYPES = new Set([
  "likert",
  "star_rating",
  "open_text",
  "survey_choice",
]);

export function inlineLessonQuizQuestionKey(question: InlineLessonQuizFlowQuestion, index: number) {
  return String(question.id ?? index);
}

function hasResponseValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

/**
 * A dependent question remains hidden until its declared earlier question has
 * the exact configured answer. Invalid or missing conditions fail closed.
 */
export function isInlineLessonQuizQuestionVisible(
  questions: InlineLessonQuizFlowQuestion[],
  questionIndex: number,
  answerByQuestionKey: Record<string, unknown>,
) {
  const question = questions[questionIndex];
  const condition = question?.showWhen;
  if (!condition) return true;
  if (condition.parentQuestionKey === undefined || condition.expectedAnswer === undefined) return false;
  const parentIndex = questions.findIndex((candidate, index) =>
    inlineLessonQuizQuestionKey(candidate, index) === String(condition.parentQuestionKey),
  );
  if (parentIndex < 0 || parentIndex >= questionIndex) return false;
  const actualAnswer = answerByQuestionKey[String(condition.parentQuestionKey)];
  return hasResponseValue(actualAnswer) && String(actualAnswer) === String(condition.expectedAnswer);
}

export function getVisibleInlineLessonQuizQuestionIndexes(
  questions: InlineLessonQuizFlowQuestion[],
  answerByQuestionKey: Record<string, unknown>,
) {
  return questions.flatMap((question, index) =>
    isInlineLessonQuizQuestionVisible(questions, index, answerByQuestionKey) ? [index] : [],
  );
}

/**
 * Required unscored surveys are complete only when each visible survey item has
 * a recorded response. Hidden dependent questions are deliberately excluded.
 */
export function hasCompletedRequiredInlineSurvey(
  questions: InlineLessonQuizFlowQuestion[],
  responses: InlineLessonQuizFlowResponse[],
  requireSurveyCompletion: boolean,
) {
  if (!requireSurveyCompletion) return true;
  const answerByQuestionKey = Object.fromEntries(
    responses
      .filter((response) => response?.questionKey !== undefined)
      .map((response) => [String(response.questionKey), response.answerValue]),
  );
  const visibleIndexes = getVisibleInlineLessonQuizQuestionIndexes(questions, answerByQuestionKey);
  const visibleSurveyQuestions = visibleIndexes
    .map((index) => ({ question: questions[index], index }))
    .filter(({ question }) => INLINE_SURVEY_QUESTION_TYPES.has(String(question?.type ?? "mcq")));

  return visibleSurveyQuestions.length > 0 && visibleSurveyQuestions.every(({ question, index }) =>
    hasResponseValue(answerByQuestionKey[inlineLessonQuizQuestionKey(question, index)]),
  );
}

export function isSurveyOnlyInlineLessonQuiz(questions: InlineLessonQuizFlowQuestion[]) {
  return questions.length > 0 && questions.every((question) =>
    INLINE_SURVEY_QUESTION_TYPES.has(String(question?.type ?? "mcq")),
  );
}

export function evaluateInlineLessonQuizCompletion(input: {
  questions: InlineLessonQuizFlowQuestion[];
  responses: InlineLessonQuizFlowResponse[];
  scorePassed: boolean;
  requireSurveyCompletion?: boolean;
}) {
  const requiresSurveyCompletion = input.requireSurveyCompletion === true
    && isSurveyOnlyInlineLessonQuiz(input.questions);
  const surveyCompleted = hasCompletedRequiredInlineSurvey(
    input.questions,
    input.responses,
    requiresSurveyCompletion,
  );
  return {
    requiresSurveyCompletion,
    surveyCompleted,
    passed: requiresSurveyCompletion ? surveyCompleted : input.scorePassed,
  };
}
