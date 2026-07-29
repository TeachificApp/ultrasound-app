/**
 * Quiz Excel Import/Export
 * Matches the exact iSpring Template sheet format:
 * Cols: Question Type | Question Text | Image | Video | Audio | Answer 1-10 | Correct Feedback | Incorrect Feedback | Points
 *
 * Question Type Codes:
 *   TF   = True/False (Graded)         → true_false
 *   MC   = Multiple Choice (Graded)    → multiple_choice
 *   MR   = Multiple Response (Graded)  → multiple_select
 *   TI   = Short Answer (Graded)       → short_answer
 *   MG   = Matching (Graded)           → matching
 *   SEQ  = Sequence (Graded)           → sequence
 *   NUMG = Numeric (Graded)            → numeric
 *   IS   = Info Slide                  → info_slide
 *   YN   = Yes/No Survey               → survey_yn
 *   PO   = Poll MC Survey              → survey_mc
 *   PM   = Poll MR Survey              → survey_mr
 *   SA   = Short Answer Survey         → survey_sa
 *   ESS  = Essay                       → essay
 *
 * Correct answers are marked with * prefix (e.g. "*True", "*Alternative 1")
 * Matching pairs use pipe delimiter: "Premise|Response"
 */

import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionTypeCode =
  | "TF" | "MC" | "MR" | "TI" | "MG" | "SEQ" | "NUMG" | "IS"
  | "YN" | "PO" | "PM" | "SA" | "ESS" | "NUMS" | "RNK" | "MS";

export type InternalQuestionType =
  | "multiple_choice" | "true_false" | "short_answer"
  | "matching" | "multiple_select" | "sequence"
  | "numeric" | "info_slide" | "essay" | "survey";

export interface ParsedChoice {
  choiceText: string;
  isCorrect: boolean;
  matchTarget?: string; // for matching questions
  sortOrder: number;
}

export interface ParsedQuestion {
  rowIndex: number;
  typeCode: QuestionTypeCode;
  questionType: InternalQuestionType;
  questionText: string;
  imagePath?: string;
  videoPath?: string;
  audioPath?: string;
  choices: ParsedChoice[];
  correctFeedback?: string;
  incorrectFeedback?: string;
  points: number;
  isGraded: boolean;
  validationErrors: string[];
}

export interface ImportResult {
  questions: ParsedQuestion[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warnings: string[];
}

// ─── Code → Internal Type Map ─────────────────────────────────────────────────

const TYPE_MAP: Record<QuestionTypeCode, InternalQuestionType> = {
  TF: "true_false",
  MC: "multiple_choice",
  MR: "multiple_select",
  TI: "short_answer",
  MG: "matching",
  SEQ: "sequence",
  NUMG: "numeric",
  IS: "info_slide",
  YN: "survey",
  PO: "survey",
  PM: "survey",
  SA: "survey",
  ESS: "essay",
  NUMS: "survey",
  RNK: "sequence",
  MS: "matching",
};

const GRADED_TYPES = new Set<QuestionTypeCode>(["TF", "MC", "MR", "TI", "MG", "SEQ", "NUMG"]);

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Parse an XLS/XLSX buffer using the Template sheet format.
 * Tries "Template" sheet first, then "Questions", then sheet index 0.
 */
export function parseQuizExcel(buffer: Buffer): ImportResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });

  // Prefer the sheet named "Template" (the reference sheet), but if the user
  // fills in the "Questions" sheet (sample data sheet), use that.
  // Strategy: use "Questions" if it has data rows, else "Template".
  let sheetName = wb.SheetNames[0];
  if (wb.SheetNames.includes("Questions")) sheetName = "Questions";
  // If the user uploaded a file with only a Template sheet, use that
  if (wb.SheetNames.includes("Template") && !wb.SheetNames.includes("Questions")) {
    sheetName = "Template";
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { questions: [], totalRows: 0, validCount: 0, errorCount: 0, warnings: ["No usable sheet found in file"] };
  }

  // Convert to array of arrays (raw values)
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  if (rows.length === 0) {
    return { questions: [], totalRows: 0, validCount: 0, errorCount: 0, warnings: ["Sheet is empty"] };
  }

  // Detect header row — look for "Question Type" in first column
  let dataStartRow = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const firstCell = String(rows[i][0] ?? "").trim().toLowerCase();
    if (firstCell === "question type") {
      dataStartRow = i + 1; // data starts after header
      break;
    }
  }

  const questions: ParsedQuestion[] = [];
  const warnings: string[] = [];
  let errorCount = 0;

  for (let ri = dataStartRow; ri < rows.length; ri++) {
    const row = rows[ri];
    const typeCode = String(row[0] ?? "").trim().toUpperCase() as QuestionTypeCode;

    // Skip empty rows or placeholder rows like "[path]"
    if (!typeCode || (typeCode as string) === "" || typeCode.startsWith("[")) continue;

    const questionText = String(row[1] ?? "").trim();
    const imagePath = String(row[2] ?? "").trim() || undefined;
    const videoPath = String(row[3] ?? "").trim() || undefined;
    const audioPath = String(row[4] ?? "").trim() || undefined;

    // Answers are columns 5–14 (Answer 1 through Answer 10)
    const rawAnswers: string[] = [];
    for (let c = 5; c <= 14; c++) {
      const val = String(row[c] ?? "").trim();
      if (val && !val.startsWith("[")) rawAnswers.push(val);
    }

    const correctFeedback = String(row[15] ?? "").trim() || undefined;
    const incorrectFeedback = String(row[16] ?? "").trim() || undefined;
    const pointsRaw = String(row[17] ?? "").trim();
    const points = pointsRaw && !pointsRaw.startsWith("[") ? parseFloat(pointsRaw) || 1 : 1;

    const internalType: InternalQuestionType = TYPE_MAP[typeCode] ?? "multiple_choice";
    const isGraded = GRADED_TYPES.has(typeCode);
    const validationErrors: string[] = [];

    if (!questionText) validationErrors.push("Question text is empty");
    if (!TYPE_MAP[typeCode]) validationErrors.push(`Unknown question type: ${typeCode}`);

    // Parse choices based on question type
    const choices: ParsedChoice[] = parseChoices(typeCode, rawAnswers, validationErrors);

    if (validationErrors.length > 0) errorCount++;

    questions.push({
      rowIndex: ri,
      typeCode,
      questionType: internalType,
      questionText,
      imagePath: sanitizeMediaPath(imagePath),
      videoPath: sanitizeMediaPath(videoPath),
      audioPath: sanitizeMediaPath(audioPath),
      choices,
      correctFeedback,
      incorrectFeedback,
      points,
      isGraded,
      validationErrors,
    });
  }

  return {
    questions,
    totalRows: rows.length - dataStartRow,
    validCount: questions.filter((q) => q.validationErrors.length === 0).length,
    errorCount,
    warnings,
  };
}

function sanitizeMediaPath(path: string | undefined): string | undefined {
  if (!path || path === "[path]" || path.startsWith("[")) return undefined;
  // Normalize backslashes to forward slashes
  return path.replace(/\\/g, "/");
}

function parseChoices(
  typeCode: QuestionTypeCode,
  rawAnswers: string[],
  errors: string[]
): ParsedChoice[] {
  const choices: ParsedChoice[] = [];

  if (typeCode === "IS") {
    // Info slide: Answer 1 is the description body text
    if (rawAnswers[0]) {
      choices.push({ choiceText: rawAnswers[0], isCorrect: false, sortOrder: 0 });
    }
    return choices;
  }

  if (typeCode === "MG" || typeCode === "MS") {
    // Matching: "Premise|Response" pipe-delimited pairs
    rawAnswers.forEach((ans, i) => {
      const parts = ans.split("|");
      if (parts.length >= 2) {
        choices.push({
          choiceText: parts[0].trim(),
          matchTarget: parts[1].trim(),
          isCorrect: true, // matching pairs are always "correct" by definition
          sortOrder: i,
        });
      } else if (ans) {
        errors.push(`Matching row ${i + 1}: expected "Premise|Response" format, got: "${ans}"`);
      }
    });
    return choices;
  }

  if (typeCode === "SEQ" || typeCode === "RNK") {
    // Sequence: items are listed in correct order
    rawAnswers.forEach((ans, i) => {
      choices.push({ choiceText: ans, isCorrect: true, sortOrder: i });
    });
    return choices;
  }

  if (typeCode === "TI") {
    // Short answer: all provided answers are accepted correct values
    rawAnswers.forEach((ans, i) => {
      choices.push({ choiceText: ans, isCorrect: true, sortOrder: i });
    });
    return choices;
  }

  if (typeCode === "NUMG") {
    // Numeric: answer is an expression like =5, 3..7, >3, <10
    rawAnswers.forEach((ans, i) => {
      choices.push({ choiceText: ans, isCorrect: true, sortOrder: i });
    });
    return choices;
  }

  // TF, MC, MR, YN, PO, PM — standard choice parsing with * prefix for correct
  let hasCorrect = false;
  rawAnswers.forEach((ans, i) => {
    const isCorrect = ans.startsWith("*");
    const choiceText = isCorrect ? ans.slice(1).trim() : ans.trim();
    if (isCorrect) hasCorrect = true;
    choices.push({ choiceText, isCorrect, sortOrder: i });
  });

  // Validation: graded types need at least one correct answer
  if (GRADED_TYPES.has(typeCode) && !hasCorrect && (typeCode as string) !== "TI" && (typeCode as string) !== "NUMG") {
    errors.push("No correct answer marked (use * prefix to mark correct answers)");
  }

  if (choices.length === 0 && typeCode !== "ESS" && typeCode !== "SA") {
    errors.push("No answer choices provided");
  }

  return choices;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportQuestion {
  questionType: InternalQuestionType;
  questionText: string;
  imagePath?: string;
  videoPath?: string;
  audioPath?: string;
  choices: Array<{
    choiceText: string;
    isCorrect: boolean;
    matchTarget?: string;
    sortOrder: number;
  }>;
  correctFeedback?: string;
  incorrectFeedback?: string;
  points: number;
  explanation?: string;
}

const INTERNAL_TO_CODE: Record<InternalQuestionType, QuestionTypeCode> = {
  true_false: "TF",
  multiple_choice: "MC",
  multiple_select: "MR",
  short_answer: "TI",
  matching: "MG",
  sequence: "SEQ",
  numeric: "NUMG",
  info_slide: "IS",
  essay: "ESS",
  survey: "SA",
};

/**
 * Export questions to an XLS buffer in the exact iSpring Template format.
 * Produces two sheets: "Questions" (the data) and "Template" (the reference guide).
 */
export function exportQuizToExcel(quizTitle: string, questions: ExportQuestion[]): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Questions sheet ──────────────────────────────────────────────────────
  const HEADER = [
    "Question Type", "Question Text", "Image", "Video", "Audio",
    "Answer 1", "Answer 2", "Answer 3", "Answer 4", "Answer 5",
    "Answer 6", "Answer 7", "Answer 8", "Answer 9", "Answer 10",
    "Correct Feedback", "Incorrect Feedback", "Points",
  ];

  const dataRows: (string | number)[][] = [HEADER];

  for (const q of questions) {
    const typeCode = INTERNAL_TO_CODE[q.questionType] ?? "MC";
    const answers: string[] = Array(10).fill("");

    if (q.questionType === "matching") {
      q.choices.sort((a, b) => a.sortOrder - b.sortOrder).forEach((c, i) => {
        if (i < 10) answers[i] = `${c.choiceText}|${c.matchTarget ?? ""}`;
      });
    } else if (q.questionType === "sequence") {
      q.choices.sort((a, b) => a.sortOrder - b.sortOrder).forEach((c, i) => {
        if (i < 10) answers[i] = c.choiceText;
      });
    } else if (q.questionType === "short_answer" || q.questionType === "numeric") {
      q.choices.sort((a, b) => a.sortOrder - b.sortOrder).forEach((c, i) => {
        if (i < 10) answers[i] = c.choiceText;
      });
    } else if (q.questionType === "info_slide") {
      answers[0] = q.choices[0]?.choiceText ?? "";
    } else {
      // TF, MC, MR, survey types — prefix correct answers with *
      q.choices.sort((a, b) => a.sortOrder - b.sortOrder).forEach((c, i) => {
        if (i < 10) answers[i] = c.isCorrect ? `*${c.choiceText}` : c.choiceText;
      });
    }

    dataRows.push([
      typeCode,
      q.questionText,
      q.imagePath ?? "",
      q.videoPath ?? "",
      q.audioPath ?? "",
      ...answers,
      q.correctFeedback ?? "",
      q.incorrectFeedback ?? "",
      q.points,
    ]);
  }

  const wsQuestions = XLSX.utils.aoa_to_sheet(dataRows);

  // Style the header row (bold, background)
  const headerRange = XLSX.utils.decode_range(wsQuestions["!ref"] ?? "A1");
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
    if (wsQuestions[cellAddr]) {
      wsQuestions[cellAddr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2563EB" } },
        alignment: { horizontal: "center" },
      };
    }
  }

  // Set column widths
  wsQuestions["!cols"] = [
    { wch: 14 }, // Question Type
    { wch: 60 }, // Question Text
    { wch: 30 }, // Image
    { wch: 20 }, // Video
    { wch: 20 }, // Audio
    ...Array(10).fill({ wch: 30 }), // Answers 1-10
    { wch: 30 }, // Correct Feedback
    { wch: 30 }, // Incorrect Feedback
    { wch: 8 },  // Points
  ];

  XLSX.utils.book_append_sheet(wb, wsQuestions, "Questions");

  // ── Template reference sheet ─────────────────────────────────────────────
  const templateRows: (string | number)[][] = [
    HEADER,
    ["TF", "True/False question (Graded)", "[path]", "[path]", "[path]", "*True", "False", "", "", "", "", "", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["MC", "Multiple Choice question (Graded)", "[path]", "[path]", "[path]", "*Alternative 1", "Alternative 2", "[Alternative N]", "", "", "", "", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["MR", "Multiple Response question (Graded)", "[path]", "[path]", "[path]", "*Alternative 1", "[*]Alternative 2", "[Alternative N]", "", "", "", "", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["TI", "Short Answer question (Graded)", "[path]", "[path]", "[path]", "Answer 1", "[Answer N]", "", "", "", "", "", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["MG", "Matching question (Graded)", "[path]", "[path]", "[path]", "Premise 1|Response 1", "Premise 2|Response 2", "[Premise N|Response N]", "", "", "", "", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["SEQ", "Sequence question (Graded)", "[path]", "[path]", "[path]", "Item 1", "Item 2", "Item 3", "[Item N]", "", "", "", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["NUMG", "Numeric question (Graded)", "[path]", "[path]", "[path]", "[=X]", "[X..Y]", "[>X]", "[<X]", "[>=X]", "[<=X]", "[!=X]", "", "", "", "[Correct]", "[Incorrect]", "[Num]"],
    ["IS", "Info Slide", "[path]", "[path]", "[path]", "Description text", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["YN", "Yes/No question (Survey)", "[path]", "[path]", "[path]", "Yes", "No", "", "", "", "", "", "", "", "", "[Feedback]", "", ""],
    ["PO", "Multiple Choice question (Survey)", "[path]", "[path]", "[path]", "Alternative 1", "Alternative 2", "[Alternative N]", "", "", "", "", "", "", "", "[Feedback]", "", ""],
    ["PM", "Multiple Response question (Survey)", "[path]", "[path]", "[path]", "Alternative 1", "Alternative 2", "[Alternative N]", "", "", "", "", "", "", "", "[Feedback]", "", ""],
    ["SA", "Short Answer question (Survey)", "[path]", "[path]", "[path]", "", "", "", "", "", "", "", "", "", "", "[Feedback]", "", ""],
    ["ESS", "Essay question", "[path]", "[path]", "[path]", "", "", "", "", "", "", "", "", "", "", "[Feedback]", "", ""],
    [],
    ["NOTES:", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["* prefix marks correct answers (e.g. *True, *Option A)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["MG/MS matching: use Premise|Response format (pipe-separated)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["SEQ sequence: list items in correct order top to bottom", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["NUMG numeric: =5 (exact), 3..7 (range), >3, <10, >=5, <=10, !=0", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Media paths are relative to the ZIP root (e.g. media/image.jpg)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];

  const wsTemplate = XLSX.utils.aoa_to_sheet(templateRows);
  wsTemplate["!cols"] = wsQuestions["!cols"];
  XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");

  // Write to buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", bookSST: false });
  return Buffer.from(buf);
}

// ─── Convert parsed questions to DB insert format ─────────────────────────────

export function parsedToDbQuestions(parsed: ParsedQuestion[]): Array<{
  sortOrder: number;
  questionType: string;
  questionText: string;
  questionHtml?: string;
  imageUrl?: string;
  explanation?: string;
  points: number;
  choices: Array<{
    sortOrder: number;
    choiceText: string;
    isCorrect: boolean;
    matchTarget?: string;
  }>;
  correctFeedback?: string;
  incorrectFeedback?: string;
}> {
  return parsed
    .filter((q) => q.validationErrors.length === 0 || q.questionType === "info_slide")
    .map((q, idx) => ({
      sortOrder: idx,
      questionType: q.questionType,
      questionText: q.questionText,
      imageUrl: q.imagePath,
      explanation: q.correctFeedback
        ? `✓ ${q.correctFeedback}${q.incorrectFeedback ? `\n✗ ${q.incorrectFeedback}` : ""}`
        : undefined,
      points: q.points,
      choices: q.choices.map((c) => ({
        sortOrder: c.sortOrder,
        choiceText: c.choiceText,
        isCorrect: c.isCorrect,
        matchTarget: c.matchTarget,
      })),
      correctFeedback: q.correctFeedback,
      incorrectFeedback: q.incorrectFeedback,
    }));
}
