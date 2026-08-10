/**
 * Export question_bank rows to iSpring-compatible Excel/CSV/ZIP packages.
 * ZIP layout:
 *   Import Template/Ispring Quiz Import Template.xlsx
 *   Import Template/media/<files>
 */
import archiver from "archiver";
import crypto from "crypto";
import https from "https";
import http from "http";
import path from "path";
import { PassThrough } from "stream";
import { exportQuizToExcel, type ExportQuestion, type InternalQuestionType } from "../quizExcel";

export const IMPORT_TEMPLATE_DIR = "Import Template";
export const IMPORT_TEMPLATE_XLSX = "Ispring Quiz Import Template.xlsx";
export const IMPORT_TEMPLATE_CSV = "Ispring Quiz Import Template.csv";

export type QuestionBankExportRow = {
  id?: number;
  question: string;
  type: "mcq" | "truefalse" | "multiselect" | "hotspot" | "matching";
  options?: Array<{ text?: string; imageUrl?: string; videoUrl?: string }>;
  correctAnswer?: string | null;
  correctAnswers?: number[];
  explanation?: string | null;
  questionImageUrl?: string | null;
  questionVideoUrl?: string | null;
  feedbackImageUrl?: string | null;
  feedbackVideoUrl?: string | null;
  matchingPairs?: Array<{ left?: string; right?: string; premise?: string; response?: string }>;
};

export function stripHtmlForExport(value: string): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapQuestionType(type: QuestionBankExportRow["type"]): InternalQuestionType {
  switch (type) {
    case "truefalse": return "true_false";
    case "multiselect": return "multiple_select";
    case "matching": return "matching";
    case "hotspot": return "multiple_choice";
    default: return "multiple_choice";
  }
}

function letterToIndex(letter: string): number | null {
  const normalized = letter.trim().toUpperCase();
  if (/^[A-J]$/.test(normalized)) return normalized.charCodeAt(0) - 65;
  return null;
}

function isChoiceCorrect(
  index: number,
  choiceText: string,
  row: QuestionBankExportRow,
): boolean {
  if (row.type === "multiselect" && row.correctAnswers?.length) {
    return row.correctAnswers.includes(index);
  }
  const answer = (row.correctAnswer ?? "").trim();
  if (!answer) return false;
  const letterIndex = letterToIndex(answer);
  if (letterIndex !== null) return letterIndex === index;
  return stripHtmlForExport(choiceText).toLowerCase() === stripHtmlForExport(answer).toLowerCase();
}

export function questionBankRowToExportQuestion(row: QuestionBankExportRow): ExportQuestion {
  const questionText = stripHtmlForExport(row.question);
  const options = Array.isArray(row.options) ? row.options : [];

  let choices: ExportQuestion["choices"] = [];

  if (row.type === "matching" && row.matchingPairs?.length) {
    choices = row.matchingPairs.map((pair, index) => ({
      choiceText: stripHtmlForExport(pair.left ?? pair.premise ?? ""),
      matchTarget: stripHtmlForExport(pair.right ?? pair.response ?? ""),
      isCorrect: true,
      sortOrder: index,
    }));
  } else if (row.type === "truefalse") {
    const tfOptions = options.length >= 2
      ? options
      : [{ text: "True" }, { text: "False" }];
    choices = tfOptions.slice(0, 2).map((opt, index) => ({
      choiceText: stripHtmlForExport(opt.text ?? (index === 0 ? "True" : "False")),
      isCorrect: isChoiceCorrect(index, opt.text ?? "", row),
      sortOrder: index,
    }));
  } else {
    choices = options.map((opt, index) => ({
      choiceText: stripHtmlForExport(opt.text ?? ""),
      isCorrect: isChoiceCorrect(index, opt.text ?? "", row),
      sortOrder: index,
    }));
  }

  return {
    questionType: mapQuestionType(row.type),
    questionText,
    imagePath: row.questionImageUrl ?? undefined,
    videoPath: row.questionVideoUrl ?? undefined,
    audioPath: undefined,
    choices,
    correctFeedback: stripHtmlForExport(row.explanation ?? "") || undefined,
    incorrectFeedback: undefined,
    points: 1,
    explanation: stripHtmlForExport(row.explanation ?? "") || undefined,
  };
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function guessExtension(url: string, contentType?: string): string {
  const fromPath = path.extname(new URL(url).pathname).replace(/^\./, "").toLowerCase();
  if (fromPath && fromPath.length <= 5) return fromPath;
  const mime = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };
  return map[mime] ?? "bin";
}

async function fetchUrlBuffer(targetUrl: string): Promise<{ buffer: Buffer; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const follow = (url: string, redirects = 0): void => {
      if (redirects > 10) {
        reject(new Error("Too many redirects while downloading media"));
        return;
      }
      const proto = url.startsWith("https") ? https : http;
      proto.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({
          buffer: Buffer.concat(chunks),
          contentType: res.headers["content-type"],
        }));
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(targetUrl);
  });
}

export class MediaExportResolver {
  private readonly urlToPath = new Map<string, string>();
  private readonly files = new Map<string, Buffer>();
  private counter = 0;

  async resolve(original?: string | null): Promise<string | undefined> {
    const value = (original ?? "").trim();
    if (!value) return undefined;
    if (value.startsWith("media/")) return value;
    if (!isHttpUrl(value)) return undefined;
    const cached = this.urlToPath.get(value);
    if (cached) return cached;

    try {
      const { buffer, contentType } = await fetchUrlBuffer(value);
      if (!buffer.length) return undefined;
      const hash = crypto.createHash("md5").update(value).digest("hex").slice(0, 10);
      const ext = guessExtension(value, contentType);
      const fileName = `asset-${++this.counter}-${hash}.${ext}`;
      const zipPath = `media/${fileName}`;
      this.urlToPath.set(value, zipPath);
      this.files.set(zipPath, buffer);
      return zipPath;
    } catch {
      return undefined;
    }
  }

  getMediaFiles(): Map<string, Buffer> {
    return this.files;
  }
}

export async function localizeExportQuestionMedia(
  question: ExportQuestion,
  resolver: MediaExportResolver,
): Promise<ExportQuestion> {
  const localizedChoices = await Promise.all(
    question.choices.map(async (choice) => ({
      ...choice,
      choiceText: choice.choiceText,
    })),
  );

  return {
    ...question,
    imagePath: await resolver.resolve(question.imagePath),
    videoPath: await resolver.resolve(question.videoPath),
    audioPath: await resolver.resolve(question.audioPath),
    choices: localizedChoices,
  };
}

export async function buildLocalizedExportQuestions(
  rows: QuestionBankExportRow[],
): Promise<{ questions: ExportQuestion[]; mediaFiles: Map<string, Buffer> }> {
  const resolver = new MediaExportResolver();
  const questions: ExportQuestion[] = [];

  for (const row of rows) {
    const base = questionBankRowToExportQuestion(row);
    const localized = await localizeExportQuestionMedia(base, resolver);
    questions.push(localized);
  }

  return { questions, mediaFiles: resolver.getMediaFiles() };
}

export function exportQuestionsToCsv(questions: ExportQuestion[]): string {
  const header = [
    "Question Type",
    "Question Text",
    "Image",
    "Video",
    "Audio",
    "Answer 1 - CORRECT ANSWER",
    "Answer 2",
    "Answer 3",
    "Answer 4",
    "Answer 5",
    "Answer 6",
    "Answer 7",
    "Answer 8",
    "Answer 9",
    "Answer 10",
    "Correct Feedback",
    "Incorrect Feedback",
    "Points",
  ];

  const typeCodeMap: Record<InternalQuestionType, string> = {
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

  const rows = [header];
  for (const q of questions) {
    const typeCode = typeCodeMap[q.questionType] ?? "MC";
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
      q.choices.sort((a, b) => a.sortOrder - b.sortOrder).forEach((c, i) => {
        if (i < 10) answers[i] = c.isCorrect ? `*${c.choiceText}` : c.choiceText;
      });
    }

    rows.push([
      typeCode,
      q.questionText,
      q.imagePath ?? "",
      q.videoPath ?? "",
      q.audioPath ?? "",
      ...answers,
      q.correctFeedback ?? "",
      q.incorrectFeedback ?? "",
      String(q.points ?? 1),
    ]);
  }

  return rows.map((row) => row.map((cell) => {
    const text = cell === null || cell === undefined ? "" : String(cell);
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }).join(",")).join("\n");
}

export async function localizeExportQuestions(
  questions: ExportQuestion[],
): Promise<{ questions: ExportQuestion[]; mediaFiles: Map<string, Buffer> }> {
  const resolver = new MediaExportResolver();
  const localized: ExportQuestion[] = [];
  for (const question of questions) {
    localized.push(await localizeExportQuestionMedia(question, resolver));
  }
  return { questions: localized, mediaFiles: resolver.getMediaFiles() };
}

export async function buildExportZipFromQuestions(
  questions: ExportQuestion[],
  title = "Question Bank Export",
): Promise<Buffer> {
  const { questions: localized, mediaFiles } = await localizeExportQuestions(questions);
  const xlsxBuffer = exportQuizToExcel(title, localized);
  const csvContent = exportQuestionsToCsv(localized);

  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk) => chunks.push(chunk as Buffer));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
    archive.on("error", reject);

    archive.pipe(passThrough);
    archive.append(xlsxBuffer, { name: `${IMPORT_TEMPLATE_DIR}/${IMPORT_TEMPLATE_XLSX}` });
    archive.append(csvContent, { name: `${IMPORT_TEMPLATE_DIR}/${IMPORT_TEMPLATE_CSV}` });
    for (const [relativePath, buffer] of mediaFiles) {
      archive.append(buffer, { name: `${IMPORT_TEMPLATE_DIR}/${relativePath}` });
    }
    archive.finalize();
  });
}

export async function buildQuestionBankExportZip(
  rows: QuestionBankExportRow[],
  title = "Question Bank Export",
): Promise<Buffer> {
  const { questions } = await buildLocalizedExportQuestions(rows);
  return buildExportZipFromQuestions(questions, title);
}
