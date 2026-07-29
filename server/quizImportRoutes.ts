/**
 * REST routes for quiz Excel import/export.
 * Mounted at /api/quiz in server/_core/index.ts
 *
 * Supports:
 *  - POST /api/quiz/import/preview  — accepts .xlsx, .xls, or .zip (with media/ folder)
 *  - GET  /api/quiz/export/:quizId  — export quiz to XLSX
 *  - GET  /api/quiz/template        — download Teachific ZIP import template (redirects to CDN)
 *  - GET  /api/quiz/template/xlsx   — download XLSX-only template
 */
import express, { Request, Response } from "express";
import multer from "multer";
import unzipper from "unzipper";
import { Readable } from "stream";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { storagePut } from "./storage";
import { parseQuizExcel, exportQuizToExcel, parsedToDbQuestions } from "./quizExcel";
import { getQuizById, getQuestionsByQuiz, getChoicesByQuestion } from "./quizDb";
import { getQuestionsByOrg, getQuestionsByIds } from "./questionBankDb";
import { sdk } from "./_core/sdk";
import { authenticateRequest } from "./authHelper";
import { parseISpringQuizFromBuffer, type ParsedQuiz } from "./lib/iSpringQuizParser";
import { uploadISpringImagesFromZip, rewriteStorageRefs } from "./lib/iSpringImageImporter";

// CDN URLs for the pre-built Teachific templates
const TEMPLATE_ZIP_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/TeachificQuizImportTemplate_a611ae1e.zip";
const TEMPLATE_XLSX_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/QuizImportTemplate_ad09d65c.xlsx";

const router = express.Router();
// Accept up to 3 GB for ZIP files with media
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 * 1024 } });

/**
 * Extract a ZIP buffer into:
 *   - xlsxBuffer: the first .xlsx/.xls file found
 *   - mediaMap: Map<relativePath, Buffer>  e.g. "media/image.jpg" → Buffer
 */
async function extractZip(
  zipBuffer: Buffer
): Promise<{ xlsxBuffer: Buffer | null; mediaMap: Map<string, Buffer> }> {
  const mediaMap = new Map<string, Buffer>();
  let xlsxBuffer: Buffer | null = null;

  const readable = Readable.from(zipBuffer);
  const directory = readable.pipe(unzipper.Parse({ forceStream: true }));

  for await (const entry of directory) {
    const entryPath: string = (entry as any).path as string;
    const type: string = (entry as any).type as string;

    if (type === "Directory") {
      await (entry as any).autodrain();
      continue;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of entry) {
      chunks.push(chunk as Buffer);
    }
    const buf = Buffer.concat(chunks);
    const lower = entryPath.toLowerCase();

    if (!xlsxBuffer && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) {
      xlsxBuffer = buf;
      continue;
    }

    if (
      lower.includes("media/") &&
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|avi|mp3|wav|ogg|m4a|aac)$/i.test(lower)
    ) {
      const normalized = entryPath.replace(/^.*?(media\/.+)$/, "$1");
      mediaMap.set(normalized, buf);
    }
  }

  return { xlsxBuffer, mediaMap };
}

/**
 * Upload all media files in the map to S3 and return a path→URL map.
 */
async function uploadMediaToS3(
  mediaMap: Map<string, Buffer>,
  orgId: string
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    avi: "video/x-msvideo", mp3: "audio/mpeg", wav: "audio/wav",
    ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac",
  };

  await Promise.all(
    Array.from(mediaMap.entries()).map(async ([relPath, buf]) => {
      const ext = relPath.split(".").pop()?.toLowerCase() ?? "bin";
      const mime = mimeTypes[ext] ?? "application/octet-stream";
      const fileName = relPath.split("/").pop() ?? "file";
      const key = `quiz-imports/${orgId}/${Date.now()}-${fileName}`;
      try {
        const { url } = await storagePut(key, buf, mime);
        urlMap.set(relPath, url);
        urlMap.set(relPath.replace(/\//g, "\\\\"), url);
        urlMap.set(fileName, url);
      } catch (e) {
        console.error(`[Quiz Import] Failed to upload media ${relPath}:`, e);
      }
    })
  );

  return urlMap;
}

function safeStorageName(filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${base || "quiz-package"}-${Date.now()}${ext}`;
}

async function hostUploadedPackage(file: Express.Multer.File, orgId: string): Promise<{ key: string; url: string } | null> {
  const lower = file.originalname.toLowerCase();
  if (!lower.endsWith(".zip") && !lower.endsWith(".quiz")) return null;
  const key = `question-bank-imports/${orgId}/${safeStorageName(file.originalname)}`;
  return storagePut(key, file.buffer, file.mimetype || "application/octet-stream");
}

// ── POST /api/quiz/import/preview ─────────────────────────────────────────────
// Parse an XLS/XLSX or ZIP file and return parsed questions for preview (no DB write)
router.post("/import/preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const orgId = (authUser as any).orgId?.toString() ?? "unknown";
    const originalName = req.file.originalname.toLowerCase();
    let xlsxBuffer = req.file.buffer;
    let mediaUrlMap = new Map<string, string>();

    // Handle ZIP upload
    if (originalName.endsWith(".zip")) {
      const { xlsxBuffer: extracted, mediaMap } = await extractZip(req.file.buffer);
      if (!extracted) {
        return res.status(400).json({ error: "No Excel file (.xlsx or .xls) found inside the ZIP." });
      }
      xlsxBuffer = extracted;
      if (mediaMap.size > 0) {
        mediaUrlMap = await uploadMediaToS3(mediaMap, orgId);
      }
    }

    const result = parseQuizExcel(xlsxBuffer);

    // Replace local media paths with S3 URLs
    if (mediaUrlMap.size > 0) {
      for (const q of result.questions) {
        if (q.imagePath) {
          const url = mediaUrlMap.get(q.imagePath) ?? mediaUrlMap.get(q.imagePath.replace(/\\/g, "/"));
          if (url) q.imagePath = url;
        }
        if (q.videoPath) {
          const url = mediaUrlMap.get(q.videoPath) ?? mediaUrlMap.get(q.videoPath.replace(/\\/g, "/"));
          if (url) q.videoPath = url;
        }
        if (q.audioPath) {
          const url = mediaUrlMap.get(q.audioPath) ?? mediaUrlMap.get(q.audioPath.replace(/\\/g, "/"));
          if (url) q.audioPath = url;
        }
      }
    }

    return res.json({ ...result, mediaUploaded: mediaUrlMap.size });
  } catch (err: unknown) {
    console.error("[Quiz Import] Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file", detail: String(err) });
  }
});

// ── GET /api/quiz/export/:quizId ──────────────────────────────────────────────
// Export a quiz to XLSX in the Teachific Template format
router.get("/export/:quizId", async (req: Request, res: Response) => {
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    const quizId = parseInt(req.params.quizId, 10);
    if (isNaN(quizId)) return res.status(400).json({ error: "Invalid quiz ID" });

    const quiz = await getQuizById(quizId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    const questions = await getQuestionsByQuiz(quizId);
    const questionsWithChoices = await Promise.all(
      questions.map(async (q) => ({
        questionType: q.questionType as any,
        questionText: q.questionText,
        imagePath: q.imageUrl ?? undefined,
        explanation: q.explanation ?? undefined,
        points: q.points,
        correctFeedback: undefined as string | undefined,
        incorrectFeedback: undefined as string | undefined,
        choices: (await getChoicesByQuestion(q.id)).map((c) => ({
          sortOrder: c.sortOrder,
          choiceText: c.choiceText ?? "",
          isCorrect: c.isCorrect,
          matchTarget: (c as any).matchTarget ?? undefined,
        })),
      }))
    );

    const buf = exportQuizToExcel(quiz.title, questionsWithChoices);

    const filename = `${quiz.title.replace(/[^a-z0-9]/gi, "_")}_quiz.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (err: unknown) {
    console.error("[Quiz Export] Error:", err);
    return res.status(500).json({ error: "Failed to export quiz", detail: String(err) });
  }
});

// ── POST /api/quiz/bank-import/preview ───────────────────────────────────────
// Parse a CSV, SCORM ZIP/XML, iSpring/Teachific .quiz, or XLSX file and return questions for preview.
// ZIP/.quiz uploads are also hosted so admins can keep the original package while optionally extracting questions.
router.post("/bank-import/preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const originalName = req.file.originalname.toLowerCase();
    const source = req.body.source as string ?? "auto";
    const orgId = (user as any)?.orgId?.toString() ?? "unknown";
    const hostedPackage = await hostUploadedPackage(req.file, orgId);
    const withHostedPackage = (payload: Record<string, unknown>) => res.json({
      ...payload,
      hostedPackageUrl: hostedPackage?.url ?? null,
      hostedPackageKey: hostedPackage?.key ?? null,
      hostedPackageName: hostedPackage ? req.file!.originalname : null,
    });

    // ── CSV ─────────────────────────────────────────────────────────────────
    if (originalName.endsWith(".csv") || source === "csv") {
      const text = req.file.buffer.toString("utf-8");
      const questions = parseCSVToBank(text);
      return withHostedPackage({ source: "csv", questions, totalRows: questions.length, validCount: questions.length, errorCount: 0, warnings: [] });
    }
    // ── SCORM XML ────────────────────────────────────────────────────────────
    if (originalName.endsWith(".xml") || source === "scorm_xml") {
      const text = req.file.buffer.toString("utf-8");
      const questions = parseSCORMQTIToBank(text);
      return withHostedPackage({ source: "scorm", questions, totalRows: questions.length, validCount: questions.length, errorCount: 0, warnings: [] });
    }
    // ── SCORM ZIP / iSpring .quiz ───────────────────────────────────────────
    if (originalName.endsWith(".zip") || originalName.endsWith(".quiz")) {
      if (originalName.endsWith(".quiz") && !isZipBuffer(req.file.buffer)) {
        const questions = parseTeachificQuizFileToBank(req.file.buffer.toString("utf-8"));
        return withHostedPackage({
          source: "quiz",
          questions,
          totalRows: questions.length,
          validCount: questions.length,
          errorCount: 0,
          warnings: [],
        });
      }

      const { xlsxBuffer, xmlBuffers, mediaMap, quizDocumentBuffer } = await extractBankZip(req.file.buffer);
      let mediaUrlMap = new Map<string, string>();
      if (mediaMap.size > 0) mediaUrlMap = await uploadMediaToS3(mediaMap, orgId);

      if (quizDocumentBuffer) {
        try {
          const questions = parseISpringQuizToBank(quizDocumentBuffer.toString("utf-8"), mediaUrlMap);
          if (questions.length > 0 || originalName.endsWith(".quiz")) {
            return withHostedPackage({
              source: "quiz",
              questions,
              totalRows: questions.length,
              validCount: questions.length,
              errorCount: 0,
              warnings: [],
              mediaUploaded: mediaUrlMap.size,
            });
          }
        } catch (err) {
          if (originalName.endsWith(".quiz")) throw err;
        }
      }
      // ── iSpring SCORM (index.html base64 format) ─────────────────────────
      // Standard iSpring SCORM .zip embeds quiz data in index.html as base64.
      // extractBankZip won't find a document.json, so we fall back here.
      if (!quizDocumentBuffer) {
        try {
          const AdmZip = (await import("adm-zip")).default;
          const zip = new AdmZip(req.file!.buffer);
          const parsed = await parseISpringQuizFromBuffer(req.file!.buffer);
          if (parsed.groups.length > 0) {
            // Upload storage:// image refs from the ZIP
            const zipEntries = zip.getEntries();
            const allRefs = parsed.allImageRefs;
            const storageUrlMap = allRefs.length > 0
              ? await uploadISpringImagesFromZip(zipEntries, allRefs)
              : new Map<string, string>();
            // Merge with mediaUrlMap (relative path media)
            for (const [k, v] of mediaUrlMap) storageUrlMap.set(k, v);
            const questions = parsedQuizToBankQuestions(parsed, storageUrlMap);
            return withHostedPackage({
              source: "quiz",
              questions,
              totalRows: questions.length,
              validCount: questions.length,
              errorCount: 0,
              warnings: [],
              mediaUploaded: storageUrlMap.size,
            });
          }
        } catch (ispringErr) {
          // Not an iSpring SCORM package — continue to XLSX/XML fallback
          console.log("[Bank Import] Not an iSpring SCORM package:", String(ispringErr));
        }
      }

      // If it contains an XLSX, treat as Teachific Excel import
      if (xlsxBuffer) {
        const result = parseQuizExcel(xlsxBuffer);
        if (mediaUrlMap.size > 0) {
          for (const q of result.questions) {
            if (q.imagePath) { const u = mediaUrlMap.get(q.imagePath); if (u) q.imagePath = u; }
            if (q.videoPath) { const u = mediaUrlMap.get(q.videoPath); if (u) q.videoPath = u; }
            if (q.audioPath) { const u = mediaUrlMap.get(q.audioPath); if (u) q.audioPath = u; }
          }
        }
        const bankQuestions = result.questions.map(q => excelParsedToBankQuestion(q));
        return withHostedPackage({ source: "xlsx", questions: bankQuestions, totalRows: result.totalRows, validCount: result.validCount, errorCount: result.errorCount, warnings: result.warnings, mediaUploaded: mediaUrlMap.size });
      }
      // Otherwise look for QTI XML files (SCORM package)
      if (xmlBuffers.length > 0) {
        const allQuestions: BankQuestion[] = [];
        for (const xmlBuf of xmlBuffers) {
          const text = xmlBuf.toString("utf-8");
          allQuestions.push(...parseSCORMQTIToBank(text, mediaUrlMap));
        }
        return withHostedPackage({ source: "scorm", questions: allQuestions, totalRows: allQuestions.length, validCount: allQuestions.length, errorCount: 0, warnings: [], mediaUploaded: mediaUrlMap.size });
      }
      return res.status(400).json({ error: "No supported file found inside the archive. Expected document.json, .xlsx/.xls, or QTI .xml files.", hostedPackageUrl: hostedPackage?.url ?? null });
    }
    // ── XLSX/XLS (direct) ────────────────────────────────────────────────────
    if (originalName.endsWith(".xlsx") || originalName.endsWith(".xls")) {
      const result = parseQuizExcel(req.file.buffer);
      const bankQuestions = result.questions.map(q => excelParsedToBankQuestion(q));
      return withHostedPackage({ source: "xlsx", questions: bankQuestions, totalRows: result.totalRows, validCount: result.validCount, errorCount: result.errorCount, warnings: result.warnings });
    }
    return res.status(400).json({ error: "Unsupported file type. Supported: .csv, .xml, .zip, .quiz, .xlsx, .xls" });
  } catch (err: unknown) {
    console.error("[Bank Import] Parse error:", err);
    return res.status(500).json({ error: "Failed to parse file", detail: String(err) });
  }
});

// ─── Bank Question type ───────────────────────────────────────────────────────
interface BankQuestion {
  questionType: string;
  stem: string;
  dataJson: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  tags?: string;
}

// ─── CSV → Bank Questions ─────────────────────────────────────────────────────
function parseCSVToBank(csvText: string): BankQuestion[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/["']/g, ""));
  const questions: BankQuestion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });
    const stem = row["question"] || row["question_text"] || row["stem"] || row["text"];
    if (!stem) continue;
    const typeRaw = (row["type"] || row["question_type"] || "").toLowerCase();
    const questionType = detectBankType(typeRaw);
    const choices: Array<{ text: string; isCorrect: boolean; feedback?: string }> = [];
    ["a","b","c","d","e","f"].forEach(letter => {
      const text = row[letter] || row[`choice_${letter}`] || row[`option_${letter}`];
      if (text) {
        const correctAnswer = (row["correct_answer"] || row["answer"] || "").toLowerCase();
        choices.push({
          text,
          isCorrect: correctAnswer === letter || correctAnswer.split(/[,;]/).map(s => s.trim()).includes(letter),
          feedback: row[`feedback_${letter}`],
        });
      }
    });
    const dataJson = JSON.stringify({ choices, imageUrl: row["image_url"] || row["media_url"] || undefined });
    questions.push({
      questionType,
      stem,
      dataJson,
      points: parseFloat(row["points"] || row["point_value"] || "1") || 1,
      difficulty: normalizeDifficulty(row["difficulty"]),
      explanation: row["explanation"] || row["feedback"] || row["rationale"] || undefined,
      tags: row["tags"] || row["category"] || undefined,
    });
  }
  return questions;
}
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += char; }
  }
  result.push(current);
  return result;
}
function detectBankType(raw: string): string {
  if (raw.includes("true") || raw === "tf" || raw === "boolean") return "tf";
  if (raw.includes("multi") && raw.includes("select")) return "multiple_select";
  if (raw.includes("match")) return "matching";
  if (raw.includes("order") || raw.includes("sequence")) return "ordering";
  if (raw.includes("numeric") || raw.includes("number")) return "numeric";
  if (raw.includes("short") || raw.includes("text") || raw === "sa") return "short_answer";
  if (raw.includes("long") || raw.includes("essay")) return "long_answer";
  if (raw.includes("fill") || raw.includes("blank")) return "fill_blank";
  return "mcq";
}
function normalizeDifficulty(raw?: string): "easy" | "medium" | "hard" {
  const v = (raw ?? "").toLowerCase();
  if (v === "easy" || v === "1" || v === "low") return "easy";
  if (v === "hard" || v === "3" || v === "high" || v === "difficult") return "hard";
  return "medium";
}

// ─── SCORM QTI XML → Bank Questions ──────────────────────────────────────────
function parseSCORMQTIToBank(xmlText: string, mediaUrlMap: Map<string, string> = new Map()): BankQuestion[] {
  const questions: BankQuestion[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemXml = itemMatch[1];
    // Extract question text from mattext or first <p>
    const matTextMatch = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/i)
      || itemXml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!matTextMatch) continue;
    const stem = stripHtmlEntities(matTextMatch[1]).trim();
    if (!stem) continue;
    // Determine cardinality
    const rtMatch = itemXml.match(/rcardinality="([^"]+)"/i);
    const cardinality = rtMatch ? rtMatch[1].toLowerCase() : "single";
    const questionType = cardinality === "multiple" ? "multiple_select" : "mcq";
    // Extract choices
    const choices: Array<{ text: string; isCorrect: boolean }> = [];
    const choiceRegex = /<response_label[^>]*ident="([^"]+)"[^>]*>([\s\S]*?)<\/response_label>/gi;
    let choiceMatch;
    while ((choiceMatch = choiceRegex.exec(itemXml)) !== null) {
      const choiceId = choiceMatch[1];
      const choiceText = stripHtmlEntities(choiceMatch[2]).trim();
      if (choiceText) choices.push({ text: choiceText, isCorrect: false, id: choiceId } as any);
    }
    // Mark correct answers
    const correctRegex = /<varequal[^>]*>(.*?)<\/varequal>/gi;
    let correctMatch;
    while ((correctMatch = correctRegex.exec(itemXml)) !== null) {
      const correctId = correctMatch[1].trim();
      const choice = (choices as any[]).find(c => c.id === correctId);
      if (choice) choice.isCorrect = true;
    }
    // Extract explanation from feedback
    const feedbackMatches = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/gi);
    const explanation = feedbackMatches && feedbackMatches.length > 1
      ? stripHtmlEntities(feedbackMatches[feedbackMatches.length - 1]).trim()
      : undefined;
    const imageMatch = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i) || itemXml.match(/uri=["']([^"']+\.(?:png|jpe?g|gif|webp|svg))["']/i);
    const imageUrl = imageMatch ? resolvePackageMedia(imageMatch[1], mediaUrlMap) : undefined;
    questions.push({
      questionType,
      stem,
      dataJson: JSON.stringify({ choices: choices.map(c => ({ text: (c as any).text, isCorrect: c.isCorrect })), imageUrl }),
      points: 1,
      difficulty: "medium",
      explanation,
    });
  }
  return questions;
}
function stripHtmlEntities(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function isZipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function resolvePackageMedia(path: string | undefined, mediaUrlMap: Map<string, string>): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/").replace(/^\.?\//, "");
  const fileName = normalized.split("/").pop() ?? normalized;
  return mediaUrlMap.get(normalized) || mediaUrlMap.get(path) || mediaUrlMap.get(fileName) || path;
}

/**
 * Rewrite storage:// refs AND relative media paths inside an HTML string to S3 URLs.
 * Falls back to the original ref if no mapping is found.
 */
function rewriteStorageRefsInHtml(html: string, mediaUrlMap: Map<string, string>): string {
  if (!html || mediaUrlMap.size === 0) return html;
  // Replace storage:// refs
  let out = html.replace(/storage:\/\/[^\s"'<>)]+/g, (ref) => mediaUrlMap.get(ref) ?? ref);
  // Replace relative src/href paths (e.g. src="media/image.png")
  out = out.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, val) => {
    const resolved = resolvePackageMedia(val, mediaUrlMap);
    return resolved && resolved !== val ? `${attr}="${resolved}"` : match;
  });
  return out;
}

// ─── Excel ParsedQuestion → BankQuestion ─────────────────────────────────────
function excelParsedToBankQuestion(q: any): BankQuestion {
  // Map InternalQuestionType to questionBankItems enum
  const typeMap: Record<string, string> = {
    multiple_choice: "mcq", true_false: "tf", short_answer: "short_answer",
    matching: "matching", multiple_select: "multiple_select", sequence: "ordering",
    numeric: "numeric", info_slide: "mcq", essay: "long_answer", survey: "mcq",
  };
  const questionType = typeMap[q.questionType] ?? "mcq";
  const choices = (q.choices ?? []).map((c: any) => ({ text: c.choiceText, isCorrect: c.isCorrect, matchTarget: c.matchTarget }));
  const dataJson = JSON.stringify({ choices, imageUrl: q.imagePath, videoUrl: q.videoPath, audioUrl: q.audioPath });
  return {
    questionType,
    stem: q.questionText,
    dataJson,
    points: q.points ?? 1,
    difficulty: "medium",
    explanation: q.correctFeedback ? `✓ ${q.correctFeedback}${q.incorrectFeedback ? `\n✗ ${q.incorrectFeedback}` : ""}` : undefined,
  };
}

function parseTeachificQuizFileToBank(fileText: string): BankQuestion[] {
  const trimmed = fileText.trim();
  let quizData: any;
  if (trimmed.startsWith("TEACHIFIC_QUIZ_V1")) {
    const payload = trimmed.split("\n")[1];
    if (!payload) throw new Error("Invalid .quiz file: missing payload.");
    try {
      quizData = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    } catch {
      throw new Error("Encrypted .quiz files cannot be extracted server-side. Save without encryption and try again.");
    }
  } else {
    quizData = JSON.parse(trimmed);
  }

  const questions = Array.isArray(quizData?.questions) ? quizData.questions : [];
  return questions.map((q: any) => quizCreatorQuestionToBank(q, quizData?.meta?.tags ?? []));
}

function parseISpringQuizToBank(documentText: string, mediaUrlMap: Map<string, string>): BankQuestion[] {
  const doc = JSON.parse(documentText);
  // Handle the full iSpring JSON wrapper { d: { sl: { g: [...] } } } or direct { sl: { g: [...] } }
  const root = doc.d ?? doc;
  const rawQuestions: any[] = [];

  if (root.sl?.g) {
    for (const group of root.sl.g) {
      if (Array.isArray(group.S)) rawQuestions.push(...group.S);
    }
  } else if (Array.isArray(doc.questions)) {
    rawQuestions.push(...doc.questions);
  } else if (Array.isArray(doc.quiz?.questions)) {
    rawQuestions.push(...doc.quiz.questions);
  } else if (Array.isArray(doc.slides)) {
    rawQuestions.push(...doc.slides.filter((s: any) => s.tp || s.type));
  } else if (Array.isArray(doc)) {
    rawQuestions.push(...doc);
  }

  const docTags = Array.isArray((doc.d ?? doc).tags ?? doc.tags) ? ((doc.d ?? doc).tags ?? doc.tags) : [];
  return rawQuestions.map((q, index) => {
    const questionType = mapQuizCreatorTypeToBank(q.tp || q.type || "mc");
    // Prefer the HTML version of the question text (q.D.h) to preserve embedded images.
    // Then rewrite any storage:// refs in that HTML to real S3 URLs.
    const rawStemHtml = q.D?.h || extractQuizText(q.D || q.question || q.stem || q.text || `Question ${index + 1}`);
    const stem = rewriteStorageRefsInHtml(rawStemHtml, mediaUrlMap);
    const imageUrl = resolvePackageMedia(q.img || q.image || q.imageUrl, mediaUrlMap);
    const videoUrl = resolvePackageMedia(typeof q.video === "string" ? q.video : q.video?.src, mediaUrlMap);
    const audioUrl = resolvePackageMedia(typeof q.audio === "string" ? q.audio : q.audio?.src, mediaUrlMap);
    const data = buildBankDataFromQuizLikeQuestion(q, questionType, mediaUrlMap);
    const tags = [...docTags, ...(Array.isArray(q.tags) ? q.tags : [])].filter(Boolean);

    return {
      questionType,
      stem,
      dataJson: JSON.stringify({ ...data, imageUrl, videoUrl, audioUrl }),
      points: Number(q.points ?? q.score ?? 1) || 1,
      difficulty: normalizeDifficulty(q.difficulty ?? q.level),
      explanation: extractQuizText(q.explanation || q.exp || q.feedback?.correct || q.fb?.correct || "") || undefined,
      tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
    };
  });
}

function quizCreatorQuestionToBank(q: any, inheritedTags: string[] = []): BankQuestion {
  const questionType = mapQuizCreatorTypeToBank(q.type || q.questionType || "mcq");
  const data = q.data ?? {};
  const imageUrl = q.image?.url || data.imageUrl;
  const videoUrl = q.video?.url || data.videoUrl;
  const audioUrl = q.audio?.url || data.audioUrl;
  const tags = [...inheritedTags, ...(Array.isArray(q.tags) ? q.tags : [])].filter(Boolean);
  return {
    questionType,
    stem: q.stem || q.questionText || "Imported question",
    dataJson: JSON.stringify({ ...data, imageUrl, videoUrl, audioUrl }),
    points: Number(q.points ?? 1) || 1,
    difficulty: normalizeDifficulty(q.difficulty),
    explanation: q.explanation || q.feedback?.correct || undefined,
    tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
  };
}

function mapQuizCreatorTypeToBank(rawType: string): string {
  const raw = String(rawType || "").toLowerCase();
  const map: Record<string, string> = {
    mc: "mcq",
    mcq: "mcq",
    multiple_choice: "mcq",
    // iSpring PascalCase type names
    multiplechoice: "mcq",
    multipleresponse: "multiple_select",
    truefalse: "tf",
    fillintheblank: "fill_blank",
    wordbank: "fill_blank",
    shortanswer: "short_answer",
    // end iSpring types
    mr: "multiple_select",
    multiple_select: "multiple_select",
    multiple_response: "multiple_select",
    tf: "tf",
    true_false: "tf",
    sa: "short_answer",
    short_answer: "short_answer",
    essay: "long_answer",
    long_answer: "long_answer",
    match: "matching",
    matching: "matching",
    seq: "ordering",
    sequence: "ordering",
    ordering: "ordering",
    fill_blank: "fill_blank",
    fill_in_blank: "fill_blank",
    fib: "fill_blank",
    hotspot: "hotspot",
    hs: "hotspot",
    image_choice: "image_choice",
    numeric: "numeric",
    num: "numeric",
    likert: "rating_scale",
    rating_scale: "rating_scale",
  };
  return map[raw] ?? detectBankType(raw);
}

function buildBankDataFromQuizLikeQuestion(q: any, questionType: string, mediaUrlMap: Map<string, string>): Record<string, unknown> {
  const config = q.C || q.data || {};
  if (questionType === "matching") {
    const pairs = (config.pairs || q.pairs || []).map((p: any) => ({
      left: extractQuizText(p.l || p.left || p.premise),
      right: extractQuizText(p.r || p.right || p.response),
      leftImageUrl: resolvePackageMedia(p.lImg || p.leftImage, mediaUrlMap),
      rightImageUrl: resolvePackageMedia(p.rImg || p.rightImage, mediaUrlMap),
    }));
    return { pairs };
  }
  if (questionType === "ordering") {
    const items = (config.items || q.items || []).map((item: any) => ({
      text: extractQuizText(item.t || item.text || item),
      imageUrl: resolvePackageMedia(item.img || item.image, mediaUrlMap),
    }));
    return { items };
  }
  if (questionType === "numeric") {
    return { answer: config.answer ?? q.answer ?? q.correct, tolerance: config.tolerance ?? q.tolerance };
  }
  if (questionType === "fill_blank") {
    return { template: extractQuizText(config.template || q.template || q.D), blanks: config.blanks || q.blanks || [] };
  }
  if (questionType === "short_answer" || questionType === "long_answer") {
    return { acceptedAnswers: config.variants || config.keywords || q.variants || q.keywords || [] };
  }
  const choices = (config.chs || config.choices || q.choices || []).map((choice: any) => {
    // iSpring stores answer text in choice.t (a D-block), images in choice.t.r[0] (imageRef)
    const textHtml = choice.t?.h || extractQuizText(choice.t || choice.text || choice);
    const resolvedText = rewriteStorageRefsInHtml(textHtml, mediaUrlMap);
    const imageRef = choice.t?.r?.[0] ?? choice.imageRef;
    const imageUrl = imageRef
      ? (mediaUrlMap.get(imageRef) ?? resolvePackageMedia(imageRef, mediaUrlMap))
      : resolvePackageMedia(choice.img || choice.image, mediaUrlMap);
    return {
      text: resolvedText,
      isCorrect: Boolean(choice.c ?? choice.correct),
      ...(imageUrl ? { imageUrl } : {}),
    };
  });
  if (questionType === "tf" && choices.length === 0) {
    const correct = Boolean(config.correct ?? q.correct ?? true);
    return { choices: [{ text: "True", isCorrect: correct }, { text: "False", isCorrect: !correct }] };
  }
  return { choices };
}

function extractQuizText(node: any): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractQuizText).filter(Boolean).join(" ");
  if (node.d && Array.isArray(node.d)) {
    return node.d.map((para: any) => extractQuizText(para.c ?? para)).filter(Boolean).join("\n");
  }
  if (node.c && Array.isArray(node.c)) {
    return node.c.map((segment: any) => segment.t || segment.text || extractQuizText(segment)).join("");
  }
  return node.t || node.text || node.value || "";
}

function bankQuestionTypeToExportType(questionType: string): any {
  const map: Record<string, string> = {
    mcq: "multiple_choice",
    tf: "true_false",
    multiple_select: "multiple_select",
    short_answer: "short_answer",
    long_answer: "essay",
    matching: "matching",
    ordering: "sequence",
    numeric: "numeric",
    fill_blank: "short_answer",
    image_choice: "multiple_choice",
    hotspot: "multiple_choice",
    rating_scale: "survey",
  };
  return map[questionType] ?? "multiple_choice";
}

function parseJsonObject(value: string | null | undefined): Record<string, any> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseTags(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((tag) => String(tag)).filter(Boolean);
  } catch {
    // Fall through to comma-delimited tags.
  }
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function bankItemToExportQuestion(q: any) {
  const data = parseJsonObject(q.dataJson);
  const choicesSource = Array.isArray(data.choices) ? data.choices : [];
  const pairsSource = Array.isArray(data.pairs) ? data.pairs : [];
  const itemsSource = Array.isArray(data.items) ? data.items : [];
  const questionType = bankQuestionTypeToExportType(q.questionType);
  let choices: Array<{ choiceText: string; isCorrect: boolean; matchTarget?: string; sortOrder: number }> = choicesSource.map((choice: any, index: number) => ({
    choiceText: String(choice.text ?? choice.choiceText ?? ""),
    isCorrect: Boolean(choice.isCorrect ?? choice.correct),
    matchTarget: choice.matchTarget ? String(choice.matchTarget) : undefined,
    sortOrder: Number(choice.sortOrder ?? index),
  }));

  if (questionType === "matching" && choices.length === 0) {
    choices = pairsSource.map((pair: any, index: number) => ({
      choiceText: String(pair.left ?? pair.premise ?? ""),
      matchTarget: String(pair.right ?? pair.response ?? ""),
      isCorrect: true,
      sortOrder: index,
    }));
  }
  if (questionType === "sequence" && choices.length === 0) {
    choices = itemsSource.map((item: any, index: number) => ({
      choiceText: String(item.text ?? item),
      isCorrect: true,
      sortOrder: index,
    }));
  }
  if (questionType === "numeric" && choices.length === 0 && data.answer !== undefined) {
    choices = [{ choiceText: `=${data.answer}`, isCorrect: true, sortOrder: 0 }];
  }

  return {
    questionType,
    questionText: q.stem,
    imagePath: data.imageUrl || data.imagePath || undefined,
    videoPath: data.videoUrl || data.videoPath || undefined,
    audioPath: data.audioUrl || data.audioPath || undefined,
    choices,
    correctFeedback: q.explanation ?? undefined,
    incorrectFeedback: undefined,
    points: q.points ?? 1,
    explanation: q.explanation ?? undefined,
    tags: parseTags(q.tags),
    difficulty: q.difficulty ?? "medium",
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportBankQuestionsToCsv(questions: any[]): string {
  const header = [
    "question", "type", "image_url", "video_url", "audio_url",
    "answer_1", "answer_2", "answer_3", "answer_4", "answer_5",
    "answer_6", "answer_7", "answer_8", "answer_9", "answer_10",
    "correct_answer", "explanation", "difficulty", "tags", "points",
  ];
  const rows = [header];
  questions.forEach((q) => {
    const answers = Array(10).fill("");
    q.choices.slice().sort((a: any, b: any) => a.sortOrder - b.sortOrder).slice(0, 10).forEach((choice: any, index: number) => {
      answers[index] = choice.matchTarget ? `${choice.choiceText}|${choice.matchTarget}` : choice.choiceText;
    });
    const correct = q.choices
      .map((choice: any, index: number) => choice.isCorrect ? String(index + 1) : "")
      .filter(Boolean)
      .join(",");
    rows.push([
      q.questionText,
      q.questionType,
      q.imagePath ?? "",
      q.videoPath ?? "",
      q.audioPath ?? "",
      ...answers,
      correct,
      q.explanation ?? "",
      q.difficulty ?? "medium",
      q.tags.join(","),
      q.points,
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

// ─── ZIP extractor for bank imports ──────────────────────────────────────────
async function extractBankZip(zipBuffer: Buffer): Promise<{ xlsxBuffer: Buffer | null; xmlBuffers: Buffer[]; mediaMap: Map<string, Buffer>; quizDocumentBuffer: Buffer | null; indexHtmlBuffers: Buffer[] }> {
  const mediaMap = new Map<string, Buffer>();
  const xmlBuffers: Buffer[] = [];
  let xlsxBuffer: Buffer | null = null;
  let quizDocumentBuffer: Buffer | null = null;
  const indexHtmlBuffers: Buffer[] = [];
  const readable = Readable.from(zipBuffer);
  const directory = readable.pipe(unzipper.Parse({ forceStream: true }));
  for await (const entry of directory) {
    const entryPath: string = (entry as any).path as string;
    const type: string = (entry as any).type as string;
    if (type === "Directory") { await (entry as any).autodrain(); continue; }
    const chunks: Buffer[] = [];
    for await (const chunk of entry) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    const lower = entryPath.toLowerCase();
    if (!quizDocumentBuffer && (lower.endsWith("document.json") || lower.endsWith("data.json"))) {
      quizDocumentBuffer = buf; continue;
    }
    if (lower.endsWith("index.html") && !lower.includes("__macosx")) {
      indexHtmlBuffers.push(buf); continue;
    }
    if (!xlsxBuffer && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) { xlsxBuffer = buf; continue; }
    if (lower.endsWith(".xml") && (lower.includes("assessment") || lower.includes("quiz") || lower.includes("question") || lower.includes("qti"))) {
      xmlBuffers.push(buf); continue;
    }
    if (lower.endsWith(".xml") && !lower.includes("imsmanifest") && !lower.includes("metadata")) {
      xmlBuffers.push(buf); continue;
    }
    if (/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|mp3|wav|ogg|m4a|aac)$/i.test(lower)) {
      const normalized = lower.includes("media/") ? entryPath.replace(/^.*?(media\/.+)$/, "$1") : entryPath;
      mediaMap.set(normalized, buf);
    }
  }
  return { xlsxBuffer, xmlBuffers, mediaMap, quizDocumentBuffer, indexHtmlBuffers };
}

/** Convert a ParsedQuiz (from iSpringQuizParser) into BankQuestion[] for the bank-import flow. */
function parsedQuizToBankQuestions(parsed: ParsedQuiz, storageUrlMap: Map<string, string>): BankQuestion[] {
  const questions: BankQuestion[] = [];
  for (const group of parsed.groups) {
    for (const q of group.questions) {
      const stemHtml = rewriteStorageRefs(q.questionHtml || q.questionText, storageUrlMap);
      const explanation = rewriteStorageRefs(q.explanationHtml || q.explanationText || "", storageUrlMap) || undefined;
      const choices = q.answers.map((a) => ({
        text: rewriteStorageRefs(a.html || a.text, storageUrlMap),
        isCorrect: a.isCorrect,
        ...(a.imageRef ? { imageUrl: storageUrlMap.get(a.imageRef) ?? a.imageRef } : {}),
      }));
      questions.push({
        questionType: q.type === "truefalse" ? "tf" : "mcq",
        stem: stemHtml,
        dataJson: JSON.stringify({ choices }),
        points: 1,
        difficulty: "medium",
        explanation,
        tags: group.name ? JSON.stringify([group.name]) : undefined,
      });
    }
  }
  return questions;
}

// ── GET /api/quiz/bank-export ─────────────────────────────────────────────────
// Export org-scoped question bank items as iSpring-style XLSX or CSV.
router.get("/bank-export", async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const orgId = Number(req.query.orgId);
    if (!Number.isFinite(orgId)) return res.status(400).json({ error: "orgId is required" });
    const role = String((user as any).role ?? "");
    if (!["site_owner", "site_admin", "org_super_admin", "org_admin"].includes(role)) {
      return res.status(403).json({ error: "Organization admin access required" });
    }

    const format = String(req.query.format ?? "xlsx").toLowerCase();
    const ids = String(req.query.ids ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));
    const folderIdParam = req.query.folderId === undefined ? undefined : String(req.query.folderId);
    const folderId = folderIdParam === undefined || folderIdParam === "all"
      ? undefined
      : folderIdParam === "none"
        ? null
        : Number(folderIdParam);

    const sourceQuestions = ids.length > 0
      ? await getQuestionsByIds(orgId, ids)
      : await getQuestionsByOrg(orgId, {
          folderId: folderId as number | null | undefined,
          limit: 10000,
          offset: 0,
        });
    const exportQuestions = sourceQuestions.map(bankItemToExportQuestion);
    const filenameBase = `question-bank-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = exportBankQuestionsToCsv(exportQuestions);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
      return res.send(csv);
    }

    const buf = exportQuizToExcel("Question Bank Export", exportQuestions);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
    return res.send(buf);
  } catch (err: unknown) {
    console.error("[Bank Export] Error:", err);
    return res.status(500).json({ error: "Failed to export question bank", detail: String(err) });
  }
});

// ── POST /api/quiz/bank-import/extract-from-package ──────────────────────────
// Download an already-hosted content package by its S3 key, parse questions,
// and return a preview identical to bank-import/preview (no DB write).
// Used by FileDetailPage to extract questions from an existing hosted package.
router.post("/bank-import/extract-from-package", async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { packageKey, orgId: orgIdStr } = req.body as { packageKey: string; orgId: string };
    if (!packageKey || !orgIdStr) return res.status(400).json({ error: "packageKey and orgId are required" });
    const orgId = parseInt(orgIdStr, 10);
    if (!Number.isFinite(orgId)) return res.status(400).json({ error: "Invalid orgId" });
    // Download the ZIP from S3
    const { storageGet } = await import("./storage");
    const { url: downloadUrl } = await storageGet(packageKey);
    const fetchRes = await fetch(downloadUrl);
    if (!fetchRes.ok) throw new Error(`Failed to fetch package: ${fetchRes.status}`);
    const arrayBuf = await fetchRes.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuf);
    // Run the same extraction pipeline as bank-import/preview
    const { xlsxBuffer, xmlBuffers, mediaMap, quizDocumentBuffer } = await extractBankZip(zipBuffer);
    let mediaUrlMap = new Map<string, string>();
    if (mediaMap.size > 0) mediaUrlMap = await uploadMediaToS3(mediaMap, orgId.toString());
    // Try iSpring document.json
    if (quizDocumentBuffer) {
      try {
        const questions = parseISpringQuizToBank(quizDocumentBuffer.toString("utf-8"), mediaUrlMap);
        if (questions.length > 0) {
          return res.json({ source: "quiz", questions, totalRows: questions.length, validCount: questions.length, errorCount: 0, warnings: [], mediaUploaded: mediaUrlMap.size });
        }
      } catch { /* fall through */ }
    }
    // Try iSpring SCORM (index.html base64)
    if (!quizDocumentBuffer) {
      try {
        const AdmZip = (await import("adm-zip")).default;
        const zip = new AdmZip(zipBuffer);
        const parsed = await parseISpringQuizFromBuffer(zipBuffer);
        if (parsed.groups.length > 0) {
          const zipEntries = zip.getEntries();
          const storageUrlMap = parsed.allImageRefs.length > 0
            ? await uploadISpringImagesFromZip(zipEntries, parsed.allImageRefs)
            : new Map<string, string>();
          for (const [k, v] of mediaUrlMap) storageUrlMap.set(k, v);
          const questions = parsedQuizToBankQuestions(parsed, storageUrlMap);
          return res.json({ source: "quiz", questions, totalRows: questions.length, validCount: questions.length, errorCount: 0, warnings: [], mediaUploaded: storageUrlMap.size });
        }
      } catch { /* not iSpring */ }
    }
    // Try XLSX
    if (xlsxBuffer) {
      const result = parseQuizExcel(xlsxBuffer);
      const bankQuestions = result.questions.map(q => excelParsedToBankQuestion(q));
      return res.json({ source: "xlsx", questions: bankQuestions, totalRows: result.totalRows, validCount: result.validCount, errorCount: result.errorCount, warnings: result.warnings, mediaUploaded: mediaUrlMap.size });
    }
    // Try QTI XML
    if (xmlBuffers.length > 0) {
      const allQuestions: BankQuestion[] = [];
      for (const xmlBuf of xmlBuffers) allQuestions.push(...parseSCORMQTIToBank(xmlBuf.toString("utf-8"), mediaUrlMap));
      return res.json({ source: "scorm", questions: allQuestions, totalRows: allQuestions.length, validCount: allQuestions.length, errorCount: 0, warnings: [], mediaUploaded: mediaUrlMap.size });
    }
    return res.status(400).json({ error: "No supported quiz content found in this package. Expected iSpring/Teachific quiz data, XLSX, or QTI XML." });
  } catch (err: unknown) {
    console.error("[ExtractFromPackage] Error:", err);
    return res.status(500).json({ error: "Failed to extract questions", detail: String(err) });
  }
});

// ── POST /api/quiz/bank-import/confirm-native ───────────────────────────────
// Create a content_packages record and trigger ZIP processing for a previously
// uploaded .zip/.quiz file (identified by its S3 key from the preview step).
// This is the "Host Natively" path in the dual-path import wizard.
router.post("/bank-import/confirm-native", async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { hostedPackageKey, hostedPackageUrl, title, description, orgId: orgIdStr } = req.body as {
      hostedPackageKey: string;
      hostedPackageUrl: string;
      title: string;
      description?: string;
      orgId: string;
    };
    if (!hostedPackageKey || !hostedPackageUrl || !title || !orgIdStr) {
      return res.status(400).json({ error: "hostedPackageKey, hostedPackageUrl, title, and orgId are required" });
    }
    const orgId = parseInt(orgIdStr, 10);
    if (!Number.isFinite(orgId)) return res.status(400).json({ error: "Invalid orgId" });
    const userId = (user as any).id;
    // Import createPackage and processZip lazily to avoid circular deps
    const { createPackage } = await import("./db");
    const { processZip } = await import("./scormUploadRoutes");
    // Download the already-hosted ZIP from S3 so processZip can read it from disk
    const { storageGet } = await import("./storage");
    const { url: downloadUrl } = await storageGet(hostedPackageKey);
    const fetchRes = await fetch(downloadUrl);
    if (!fetchRes.ok) throw new Error(`Failed to fetch hosted package: ${fetchRes.status}`);
    const arrayBuf = await fetchRes.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuf);
    const zipSize = zipBuffer.length;
    // Write to a temp file (processZip needs a file path, not a buffer)
    const suffix = Date.now().toString(36);
    const tmpPath = join(tmpdir(), `native-import-${suffix}.zip`);
    writeFileSync(tmpPath, zipBuffer);
    // Create the content_packages record
    const pkg = await createPackage({
      orgId,
      uploadedBy: userId,
      title: title.trim(),
      description: description?.trim() ?? null,
      originalZipKey: hostedPackageKey,
      originalZipUrl: hostedPackageUrl,
      originalZipSize: zipSize,
      contentType: "unknown",
      scormVersion: "none",
      displayMode: "native",
      status: "processing",
    });
    // Fetch the newly created package ID
    const { getDb } = await import("./db");
    const { contentPackages } = await import("../drizzle/schema");
    const { desc, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(500).json({ error: "DB unavailable" });
    }
    const pkgs = await db.select().from(contentPackages)
      .where(eq(contentPackages.orgId, orgId))
      .orderBy(desc(contentPackages.createdAt))
      .limit(1);
    const newPkg = pkgs[0];
    if (!newPkg) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return res.status(500).json({ error: "Package creation failed" });
    }
    // Kick off async ZIP processing (extraction + S3 upload + manifest parse)
    processZip(tmpPath, zipSize, newPkg.id, orgId, suffix).catch((err: unknown) => {
      console.error(`[NativeImport] Package ${newPkg.id} processing failed:`, err);
    });
    return res.json({
      packageId: newPkg.id,
      message: "Package created and processing started.",
    });
  } catch (err: unknown) {
    console.error("[NativeImport] Error:", err);
    return res.status(500).json({ error: "Failed to create native package", detail: String(err) });
  }
});

// ── GET /api/quiz/bank-import/csv-template ──────────────────────────────────
// Return a sample CSV template for question bank imports
router.get("/bank-import/csv-template", (_req: Request, res: Response) => {
  const csvContent = [
    "question,type,a,b,c,d,correct_answer,explanation,difficulty,tags,points",
    '"What is the capital of France?",mcq,Paris,London,Berlin,Madrid,a,"Paris is the capital of France.",easy,"geography,europe",1',
    '"The Earth orbits the Sun.",tf,True,False,,,a,"The Earth does orbit the Sun.",easy,science,1',
    '"Which of the following are prime numbers? (select all)",multiple_select,2,4,7,9,"a,c","2 and 7 are prime numbers.",medium,math,2',
    '"What is 15 * 4?",numeric,,,,,,"The answer is 60.",medium,math,1',
  ].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="question-bank-template.csv"');
  res.send(csvContent);
});

// ── GET /api/quiz/template ────────────────────────────────────────────────────
// Redirect to the pre-built Teachific ZIP import template (includes sample media)
router.get("/template", (_req: Request, res: Response) => {
  res.redirect(302, TEMPLATE_ZIP_URL);
});

// ── GET /api/quiz/template/xlsx ───────────────────────────────────────────────
// Redirect to the XLSX-only template (no media, for simple imports)
router.get("/template/xlsx", (_req: Request, res: Response) => {
  res.redirect(302, TEMPLATE_XLSX_URL);
});

export default router;
