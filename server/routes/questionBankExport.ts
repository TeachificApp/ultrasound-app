/**
 * REST routes for exporting the platform question_bank table.
 * Mounted at /api/quiz/question-bank in server/_core/index.ts
 */
import express, { Request, Response } from "express";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { authenticateRequest } from "../authHelper";
import { getDb } from "../db";
import {
  questionBank,
  questionBankTagMap,
  users,
} from "../../drizzle/schema";
import {
  buildLocalizedExportQuestions,
  buildQuestionBankExportZip,
  exportQuestionsToCsv,
  type QuestionBankExportRow,
} from "../lib/questionBankExport";
import { exportQuizToExcel } from "../quizExcel";

const router = express.Router();

async function assertAdmin(req: Request): Promise<boolean> {
  const user = await authenticateRequest(req);
  if (!user) return false;
  if (user.role === "admin") return true;
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
  return row?.role === "admin";
}

function parseIds(raw: unknown): number[] {
  return String(raw ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parseTagIds(raw: unknown): number[] {
  return parseIds(raw);
}

async function loadQuestionBankRows(req: Request): Promise<QuestionBankExportRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const ids = parseIds(req.query.ids);
  const tagIds = parseTagIds(req.query.tagIds);
  const folderIdParam = req.query.folderId === undefined ? undefined : String(req.query.folderId);
  const search = String(req.query.search ?? "").trim();

  const conditions: any[] = [];
  if (search) conditions.push(like(questionBank.question, `%${search}%`));
  if (folderIdParam !== undefined) {
    if (folderIdParam === "none") {
      conditions.push(sql`${questionBank.folderId} IS NULL`);
    } else if (folderIdParam !== "all") {
      const folderId = Number(folderIdParam);
      if (Number.isFinite(folderId)) conditions.push(eq(questionBank.folderId, folderId));
    }
  }

  if (tagIds.length > 0) {
    const tagRows = await db
      .select({ questionId: questionBankTagMap.questionId })
      .from(questionBankTagMap)
      .where(inArray(questionBankTagMap.tagId, tagIds));
    const idCounts = new Map<number, number>();
    for (const row of tagRows) idCounts.set(row.questionId, (idCounts.get(row.questionId) ?? 0) + 1);
    const filteredIds = [...idCounts.entries()]
      .filter(([, count]) => count >= tagIds.length)
      .map(([id]) => id);
    if (filteredIds.length === 0) return [];
    conditions.push(inArray(questionBank.id, filteredIds));
  }

  if (ids.length > 0) conditions.push(inArray(questionBank.id, ids));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(questionBank)
    .where(where)
    .orderBy(desc(questionBank.createdAt))
    .limit(10000);

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    type: row.type,
    options: row.options ? JSON.parse(row.options) : [],
    correctAnswer: row.correctAnswer,
    correctAnswers: row.correctAnswers ? JSON.parse(row.correctAnswers) : [],
    explanation: row.explanation,
    questionImageUrl: row.questionImageUrl,
    questionVideoUrl: row.questionVideoUrl,
    feedbackImageUrl: row.feedbackImageUrl,
    feedbackVideoUrl: row.feedbackVideoUrl,
    matchingPairs: row.matchingPairs ? JSON.parse(row.matchingPairs) : [],
  }));
}

router.get("/export", async (req: Request, res: Response) => {
  try {
    if (!(await assertAdmin(req))) return res.status(401).json({ error: "Unauthorized" });

    const format = String(req.query.format ?? "zip").toLowerCase();
    const title = String(req.query.title ?? "Question Bank Export");
    const rows = await loadQuestionBankRows(req);
    if (rows.length === 0) return res.status(404).json({ error: "No questions matched the export filters" });

    const date = new Date().toISOString().slice(0, 10);
    const safeTitle = title.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "question-bank";

    if (format === "zip") {
      const zipBuffer = await buildQuestionBankExportZip(rows, title);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_${date}.zip"`);
      return res.send(zipBuffer);
    }

    const { questions } = await buildLocalizedExportQuestions(rows);

    if (format === "csv") {
      const csv = exportQuestionsToCsv(questions);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_${date}.csv"`);
      return res.send(csv);
    }

    const xlsx = exportQuizToExcel(title, questions);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_${date}.xlsx"`);
    return res.send(xlsx);
  } catch (err: unknown) {
    console.error("[QuestionBankExport] Error:", err);
    return res.status(500).json({ error: "Failed to export question bank", detail: String(err) });
  }
});

export default router;
