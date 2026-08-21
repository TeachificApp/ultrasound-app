import * as XLSX from "xlsx";

export type KahootImportedQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  correctIndexes: number[];
  timeLimitSeconds: number;
};

export type KahootSpreadsheetImport = {
  questions: KahootImportedQuestion[];
  warnings: string[];
};

const ALLOWED_TIMES = new Set([5, 10, 20, 30, 60, 120]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function textCell(value: unknown): string {
  return String(value ?? "").trim();
}

function parseCorrectIndexes(value: unknown): number[] {
  return textCell(value)
    .split(/[,;\s]+/)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 6)
    .map((item) => item - 1);
}

/**
 * Reads a teacher-provided workbook shaped like Kahoot's published quiz template.
 * It never connects to a Kahoot account or parses a private Kahoot URL.
 */
export function parseKahootSpreadsheet(buffer: Buffer): KahootSpreadsheetImport {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];
  const headerRowIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell).includes("question")));
  if (headerRowIndex < 0) {
    throw new Error("This spreadsheet does not contain a Kahoot-style question header row.");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const questionIndex = headers.findIndex((header) => header.includes("question"));
  const answerIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => /^answer[1-6]/.test(header))
    .map(({ index }) => index);
  const correctIndex = headers.findIndex((header) => header.includes("correctanswer"));
  const timeIndex = headers.findIndex((header) => header.includes("timelimit"));

  if (questionIndex < 0 || answerIndexes.length < 2 || correctIndex < 0) {
    throw new Error("The spreadsheet needs question, answer, and correct-answer columns from the Kahoot quiz template.");
  }

  const questions: KahootImportedQuestion[] = [];
  const warnings: string[] = [];
  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const question = textCell(row[questionIndex]);
    if (!question) return;
    const options = answerIndexes.map((index) => textCell(row[index])).filter(Boolean);
    const correctIndexes = parseCorrectIndexes(row[correctIndex]).filter((index) => index < options.length);
    if (options.length < 2 || correctIndexes.length === 0) {
      warnings.push(`Row ${headerRowIndex + offset + 2} was skipped because it needs at least two answers and one correct-answer index.`);
      return;
    }
    const requestedTime = Number.parseInt(textCell(row[timeIndex]), 10);
    const timeLimitSeconds = ALLOWED_TIMES.has(requestedTime) ? requestedTime : 20;
    if (correctIndexes.length > 1) {
      warnings.push(`Row ${headerRowIndex + offset + 2} has multiple correct answers; its first correct answer is used for live scoring.`);
    }
    questions.push({
      question,
      options,
      correctAnswer: correctIndexes[0],
      correctIndexes,
      timeLimitSeconds,
    });
  });

  if (questions.length === 0) throw new Error("No valid Kahoot quiz rows were found in this spreadsheet.");
  return { questions, warnings };
}
