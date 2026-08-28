type BuilderQuestion = Record<string, any>;

const SUPPORTED_BANK_TYPES = new Set(["mcq", "truefalse", "multiselect", "hotspot", "matching"]);

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function questionBankIdFromBuilderId(id: unknown): number | null {
  const match = /^bank-(\d+)$/.exec(String(id ?? ""));
  return match ? Number(match[1]) : null;
}

function asBankType(question: BuilderQuestion): "mcq" | "truefalse" | "multiselect" | "hotspot" | "matching" {
  if (question.type === "tf") return "truefalse";
  if (question.type === "mcq" && (question.data?.multiple === true || question.data?.multiSelect === true)) return "multiselect";
  return SUPPORTED_BANK_TYPES.has(String(question.type))
    ? question.type as "mcq" | "truefalse" | "multiselect" | "hotspot" | "matching"
    : "mcq";
}

function contentPayload(question: BuilderQuestion) {
  const { order, groupId, points, required, shuffleAnswerOptions, lockAnswerOrder, branchRules, backgroundColor, backgroundImageUrl, ...content } = question;
  return content;
}

/** Convert a Visual Builder question into the canonical fields held by Question Bank. */
export function questionBankValuesFromBuilderQuestion(question: BuilderQuestion) {
  const type = asBankType(question);
  const choices = Array.isArray(question.data?.choices) ? question.data.choices : [];
  const correctIndexes = choices
    .map((choice: { correct?: boolean }, index: number) => choice.correct ? index : -1)
    .filter((index: number) => index >= 0);
  const correctAnswer = type === "truefalse"
    ? (question.data?.correct === true ? "true" : "false")
    : type === "multiselect"
      ? String(correctIndexes[0] ?? "")
      : type === "mcq"
        ? String(correctIndexes[0] ?? "")
        : "";

  return {
    question: String(question.stem ?? "").trim() || "Untitled question",
    type,
    options: choices.length > 0
      ? JSON.stringify(choices.map((choice: Record<string, unknown>) => ({
          text: String(choice.text ?? ""),
          imageUrl: choice.imageUrl,
          videoUrl: choice.videoUrl,
          feedback: choice.feedback ?? choice.feedbackHtml ?? "",
        })))
      : null,
    correctAnswer,
    correctAnswers: type === "multiselect" ? JSON.stringify(correctIndexes) : null,
    explanation: question.explanation ?? question.explanationHtml ?? null,
    correctFeedback: question.feedback?.correct ?? question.explanation ?? null,
    incorrectFeedback: question.feedback?.incorrect ?? question.explanation ?? null,
    questionImageUrl: question.image?.url ?? (type === "hotspot" ? question.data?.imageUrl ?? null : null),
    questionVideoUrl: question.video?.url ?? null,
    hotspotMarkers: type === "hotspot" ? JSON.stringify(question.data?.markers ?? question.data?.regions ?? []) : null,
    matchingPairs: type === "matching" ? JSON.stringify(question.data?.pairs ?? []) : null,
    feedbackImageUrl: question.feedbackImage?.url ?? null,
    feedbackVideoUrl: question.feedbackVideo?.url ?? null,
    builderQuestionPayload: JSON.stringify(contentPayload(question)),
  };
}

/** Keep quiz-specific presentation data while replacing the clinical question content with its canonical bank payload. */
export function mergeCanonicalBuilderQuestion(currentQuestion: BuilderQuestion, canonicalQuestion: BuilderQuestion) {
  if (currentQuestion.questionBankOverride === true) return currentQuestion;
  if (!canonicalQuestion || typeof canonicalQuestion !== "object" || !canonicalQuestion.type) return currentQuestion;
  return {
    ...canonicalQuestion,
    id: currentQuestion.id,
    order: currentQuestion.order,
    points: currentQuestion.points,
    required: currentQuestion.required,
    groupId: currentQuestion.groupId,
    branchRules: currentQuestion.branchRules,
    shuffleAnswerOptions: currentQuestion.shuffleAnswerOptions,
    lockAnswerOrder: currentQuestion.lockAnswerOrder,
    backgroundColor: currentQuestion.backgroundColor,
    backgroundImageUrl: currentQuestion.backgroundImageUrl,
  };
}

/** Build a canonical Visual Builder question from a linked Question Bank row. */
export function builderQuestionFromQuestionBank(row: { sqq: Record<string, any>; qb: Record<string, any> }): BuilderQuestion {
  const { sqq, qb } = row;
  const savedPayload = parseJson<BuilderQuestion | null>(qb.builderQuestionPayload, null);
  const presentation = {
    id: `bank-${qb.id}`,
    order: Number(sqq.sortOrder ?? 0) + 1,
    points: Number(sqq.points ?? 1),
    required: true,
    shuffleAnswerOptions: Boolean(sqq.shuffleAnswerOptions),
    lockAnswerOrder: Boolean(sqq.lockAnswerOrder),
  };
  if (savedPayload?.type) return { ...savedPayload, ...presentation };

  const options = parseJson<Array<{ text?: string; imageUrl?: string; videoUrl?: string; feedback?: string }>>(qb.options, []);
  const answer = String(qb.correctAnswer ?? "0");
  const answerIndexes = parseJson<number[]>(qb.correctAnswers, []);
  const answerIndex = /^\d+$/.test(answer)
    ? Number(answer)
    : options.findIndex((option) => String(option.text ?? "").trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase());
  const base = {
    ...presentation,
    stem: qb.question,
    explanation: qb.explanation ?? "",
    feedback: { correct: qb.correctFeedback ?? qb.explanation ?? "", incorrect: qb.incorrectFeedback ?? qb.explanation ?? "" },
    image: qb.questionImageUrl ? { url: qb.questionImageUrl, alt: "Question media" } : null,
    video: qb.questionVideoUrl ? { url: qb.questionVideoUrl, type: "file" } : null,
    feedbackImage: qb.feedbackImageUrl ? { url: qb.feedbackImageUrl, alt: "Feedback media" } : null,
    feedbackVideo: qb.feedbackVideoUrl ? { url: qb.feedbackVideoUrl, type: "file" } : null,
    branchRules: [],
  };
  if (qb.type === "truefalse") return { ...base, type: "tf", data: { correct: answer === "true" || answer === "0" } };
  if (qb.type === "matching") return { ...base, type: "matching", data: { pairs: parseJson(qb.matchingPairs, []) } };
  if (qb.type === "hotspot") return { ...base, type: "hotspot", data: { markers: parseJson(qb.hotspotMarkers, []) } };
  return {
    ...base,
    type: "mcq",
    data: {
      multiple: qb.type === "multiselect",
      choices: options.map((option, index) => ({
        id: String(index), text: option.text ?? "", imageUrl: option.imageUrl, videoUrl: option.videoUrl, feedback: option.feedback ?? "",
        correct: qb.type === "multiselect" ? answerIndexes.includes(index) : index === answerIndex,
      })),
    },
  };
}

/** Reflect a direct Question Bank editor update in the canonical Visual Builder payload. */
export function applyQuestionBankUpdateToBuilderPayload(
  builderQuestionPayload: string | null,
  input: Record<string, unknown>,
) {
  if (!builderQuestionPayload) return null;
  try {
    const question = JSON.parse(builderQuestionPayload) as BuilderQuestion;
    if (!question || typeof question !== "object") return null;
    if (input.question !== undefined) question.stem = input.question;
    if (input.explanation !== undefined) question.explanation = input.explanation;
    if (input.questionImageUrl !== undefined) question.image = input.questionImageUrl ? { url: input.questionImageUrl, alt: "Question media" } : null;
    if (input.questionVideoUrl !== undefined) question.video = input.questionVideoUrl ? { url: input.questionVideoUrl, type: "file" } : null;
    if (input.feedbackImageUrl !== undefined) question.feedbackImage = input.feedbackImageUrl ? { url: input.feedbackImageUrl, alt: "Feedback media" } : null;
    if (input.feedbackVideoUrl !== undefined) question.feedbackVideo = input.feedbackVideoUrl ? { url: input.feedbackVideoUrl, type: "file" } : null;
    if (Array.isArray(input.options) && Array.isArray(question.data?.choices)) {
      question.data.choices = input.options.map((option: any, index: number) => ({
        ...question.data.choices[index],
        id: question.data.choices[index]?.id ?? String(index),
        text: option.text ?? "",
        imageUrl: option.imageUrl,
        videoUrl: option.videoUrl,
      }));
    }
    if (input.correctAnswer !== undefined && Array.isArray(question.data?.choices)) {
      const selectedIndex = Number(input.correctAnswer);
      question.data.choices = question.data.choices.map((choice: any, index: number) => ({ ...choice, correct: index === selectedIndex }));
    }
    if (Array.isArray(input.correctAnswers) && Array.isArray(question.data?.choices)) {
      const selected = new Set(input.correctAnswers.map(Number));
      question.data.choices = question.data.choices.map((choice: any, index: number) => ({ ...choice, correct: selected.has(index) }));
    }
    if (input.hotspotMarkers !== undefined && question.data) question.data.markers = JSON.parse(String(input.hotspotMarkers ?? "[]"));
    if (input.matchingPairs !== undefined && question.data) question.data.pairs = JSON.parse(String(input.matchingPairs ?? "[]"));
    return JSON.stringify(question);
  } catch {
    return null;
  }
}
