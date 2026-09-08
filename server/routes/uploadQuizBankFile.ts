/**
 * POST /api/upload-quiz-bank-file
 *
 * Accepts a .quiz (iSpring SCORM ZIP) or .csv/.xlsx file directly from the browser
 * without requiring it to be stored in the media library first.
 *
 * For SCORM .quiz files: parses the ZIP, stages the package in storage, and returns
 * a preview plus importStorageKey for confirmScormImport (avoids base64 tRPC limits).
 * For CSV/XLSX files: returns the raw base64 content for the client to pass to importCsvToBank.
 *
 * Returns:
 *   { type: "scorm", importStorageKey, preview: { quizTitle, groups, totalQuestions } }
 *   { type: "csv", data: "base64:...", rowCount: number, columns: string[] }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { sdk } from "../_core/sdk";
import { parseISpringQuizFromBuffer } from "../lib/iSpringQuizParser";
import { storagePut } from "../storage";
import * as XLSX from "xlsx";

const router = Router();

const SCORM_MAX_BYTES = 200 * 1024 * 1024;
const CSV_MAX_BYTES = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SCORM_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "text/csv",
      "text/tab-separated-values",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const ext = (file.originalname ?? "").split(".").pop()?.toLowerCase();
    if (allowed.includes(file.mimetype) || ["quiz", "zip", "csv", "tsv", "xlsx", "xls"].includes(ext ?? "")) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (.${ext})`));
    }
  },
});

function safeImportFileName(originalname: string): string {
  const ext = originalname.includes(".") ? originalname.slice(originalname.lastIndexOf(".")).toLowerCase() : "";
  const base = originalname
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "quiz-package"}${ext}`;
}

router.post(
  "/api/upload-quiz-bank-file",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      let user: any = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user || user.role !== "admin") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const { originalname, buffer, size } = req.file;
      const ext = (originalname ?? "").split(".").pop()?.toLowerCase() ?? "";

      // ─── SCORM / .quiz ZIP ────────────────────────────────────────────────
      if (ext === "quiz" || ext === "zip") {
        let parsed: Awaited<ReturnType<typeof parseISpringQuizFromBuffer>>;
        try {
          parsed = await parseISpringQuizFromBuffer(buffer);
        } catch (e: any) {
          res.status(400).json({ error: `Not a valid iSpring quiz ZIP: ${e.message}` });
          return;
        }

        const token = randomBytes(12).toString("hex");
        const importStorageKey = `question-bank-imports/${user.id}/${token}/${safeImportFileName(originalname)}`;
        await storagePut(importStorageKey, buffer, "application/zip");

        res.json({
          type: "scorm",
          importStorageKey,
          fileSize: size,
          preview: {
            quizTitle: parsed.title,
            groups: parsed.groups.map(g => ({
              id: g.id,
              name: g.name,
              questionCount: g.questions.length,
              questions: g.questions.slice(0, 5).map(q => ({
                id: q.id,
                type: q.type,
                ispringType: q.ispringType,
                questionText: q.questionText,
                questionHtml: q.questionHtml,
                answers: q.answers.map(a => ({ text: a.text, html: a.html, isCorrect: a.isCorrect })),
              })),
            })),
            totalQuestions: parsed.groups.reduce((sum, g) => sum + g.questions.length, 0),
          },
        });
        return;
      }

      if (size > CSV_MAX_BYTES) {
        res.status(400).json({ error: `CSV/Excel uploads must be ${CSV_MAX_BYTES / (1024 * 1024)} MB or smaller.` });
        return;
      }

      // ─── CSV / TSV ────────────────────────────────────────────────────────
      if (ext === "csv" || ext === "tsv") {
        const text = buffer.toString("utf-8");
        const wb = XLSX.read(text, { type: "string" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        res.json({
          type: "csv",
          data: `base64:${buffer.toString("base64")}`,
          rowCount: rows.length,
          columns,
          preview: rows.slice(0, 5),
        });
        return;
      }

      // ─── XLSX / XLS ───────────────────────────────────────────────────────
      if (ext === "xlsx" || ext === "xls") {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        res.json({
          type: "csv",
          data: `base64:${buffer.toString("base64")}`,
          rowCount: rows.length,
          columns,
          preview: rows.slice(0, 5),
        });
        return;
      }

      res.status(400).json({ error: `Unsupported file extension: .${ext}` });
    } catch (err: any) {
      console.error("[upload-quiz-bank-file]", err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  }
);

export function registerUploadQuizBankFileRoute(app: import("express").Application) {
  app.use(router);
}
