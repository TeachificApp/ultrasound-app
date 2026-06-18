/**
 * POST /api/upload-quiz-bank-file
 *
 * Accepts a .quiz (iSpring SCORM ZIP) or .csv/.xlsx file directly from the browser
 * without requiring it to be stored in the media library first.
 *
 * For SCORM .quiz files: parses the ZIP and returns a preview (groups + question counts).
 * For CSV/XLSX files: returns the raw base64 content for the client to pass to importCsvToBank.
 *
 * Returns:
 *   { type: "scorm", preview: { quizTitle, groups, totalQuestions } }
 *   { type: "csv", data: "base64:...", rowCount: number, columns: string[] }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { sdk } from "../_core/sdk";
import { parseISpringQuizFromBuffer } from "../lib/iSpringQuizParser";
import * as XLSX from "xlsx";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
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

      const { originalname, buffer } = req.file;
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
        res.json({
          type: "scorm",
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
