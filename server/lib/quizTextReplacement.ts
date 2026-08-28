type PlainRecord = Record<string, unknown>;

export type QuizTextReplacementResult<T> = {
  value: T;
  replacements: number;
};

function isRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function replaceString(value: unknown, find: string, replacement: string): QuizTextReplacementResult<unknown> {
  if (typeof value !== "string" || !find) return { value, replacements: 0 };
  const occurrences = value.split(find).length - 1;
  return { value: occurrences ? value.split(find).join(replacement) : value, replacements: occurrences };
}

function replaceStringList(value: unknown, find: string, replacement: string): QuizTextReplacementResult<unknown> {
  if (!Array.isArray(value)) return { value, replacements: 0 };
  let replacements = 0;
  const next = value.map((item) => {
    const result = replaceString(item, find, replacement);
    replacements += result.replacements;
    return result.value;
  });
  return { value: next, replacements };
}

function replaceRecordFields(record: PlainRecord, fields: string[], find: string, replacement: string): QuizTextReplacementResult<PlainRecord> {
  let replacements = 0;
  const next: PlainRecord = { ...record };
  for (const field of fields) {
    const result = Array.isArray(next[field])
      ? replaceStringList(next[field], find, replacement)
      : replaceString(next[field], find, replacement);
    next[field] = result.value;
    replacements += result.replacements;
  }
  return { value: next, replacements };
}

function replaceQuestionData(value: unknown, find: string, replacement: string): QuizTextReplacementResult<unknown> {
  if (!isRecord(value)) return { value, replacements: 0 };
  let replacements = 0;
  const next: PlainRecord = { ...value };
  const textLists = ["acceptedAnswers", "keywords", "acceptedVariants", "distractorWords", "options", "scaleLabels"];
  for (const field of textLists) {
    if (Array.isArray(next[field])) {
      const result = replaceStringList(next[field], find, replacement);
      next[field] = result.value;
      replacements += result.replacements;
    }
  }
  for (const field of ["template", "correctWord", "placeholder", "rubric", "unit"]) {
    const result = replaceString(next[field], find, replacement);
    next[field] = result.value;
    replacements += result.replacements;
  }
  const recordLists: Array<[string, string[]]> = [
    ["choices", ["text", "label", "feedback"]],
    ["pairs", ["premise", "response"]],
    ["items", ["text", "label"]],
    ["targets", ["label"]],
    ["blanks", ["label", "correctWord", "acceptedAnswers", "options"]],
    ["statements", ["text"]],
  ];
  for (const [field, editableFields] of recordLists) {
    if (!Array.isArray(next[field])) continue;
    next[field] = next[field].map((item) => {
      if (!isRecord(item)) return item;
      const result = replaceRecordFields(item, editableFields, find, replacement);
      replacements += result.replacements;
      return result.value;
    });
  }
  return { value: next, replacements };
}

/** Replaces only learner-visible authored text and never technical IDs, URLs, colors, or media metadata. */
export function replaceQuizQuestionText<T extends PlainRecord>(question: T, find: string, replacement: string): QuizTextReplacementResult<T> {
  let replacements = 0;
  const next = { ...question } as PlainRecord;
  for (const field of ["stem", "stemHtml", "explanation", "explanationHtml"]) {
    const result = replaceString(next[field], find, replacement);
    next[field] = result.value;
    replacements += result.replacements;
  }
  if (isRecord(next.feedback)) {
    const result = replaceRecordFields(next.feedback, ["correct", "incorrect"], find, replacement);
    next.feedback = result.value;
    replacements += result.replacements;
  }
  const dataResult = replaceQuestionData(next.data, find, replacement);
  next.data = dataResult.value;
  replacements += dataResult.replacements;
  return { value: next as T, replacements };
}
