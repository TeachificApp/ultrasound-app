/**
 * quizResultsRouter.ts
 * Admin procedures for viewing and exporting quiz/survey results.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray, asc, count, avg, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storagePut } from "../storage";
import {
  lmsQuizAttempts,
  lmsQuizAttemptAnswers,
  lmsLessons,
  lmsCourses,
  users,
  lmsQuizzes,
} from "../../drizzle/schema";
import { assertAdmin } from "./lmsHelpers";

const SURVEY_TYPES = ["likert", "star_rating", "open_text"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSurveyType(t: string) {
  return SURVEY_TYPES.includes(t);
}

function formatAnswer(answerValue: string | null, questionType: string): string {
  if (!answerValue) return "";
  try {
    if (questionType === "multiselect" || questionType === "matching") {
      const parsed = JSON.parse(answerValue);
      if (Array.isArray(parsed)) return parsed.join(", ");
      if (typeof parsed === "object") return Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join("; ");
    }
  } catch {}
  return answerValue;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const quizResultsRouter = router({

  /** List all quizzes/surveys that have at least one attempt, grouped by lesson */
  listQuizzesWithResults: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          lessonId: lmsQuizAttempts.lessonId,
          courseId: lmsQuizAttempts.courseId,
          attemptCount: count(lmsQuizAttempts.id),
          avgScore: avg(lmsQuizAttempts.score),
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
          quizTitle: lmsQuizzes.title,
          passingScore: lmsQuizzes.passingScore,
        })
        .from(lmsQuizAttempts)
        .leftJoin(lmsLessons, eq(lmsLessons.id, lmsQuizAttempts.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsQuizAttempts.courseId))
        .leftJoin(lmsQuizzes, eq(lmsQuizzes.lessonId, lmsQuizAttempts.lessonId))
        .groupBy(lmsQuizAttempts.lessonId, lmsQuizAttempts.courseId, lmsLessons.title, lmsCourses.title, lmsQuizzes.title, lmsQuizzes.passingScore)
        .orderBy(desc(sql`count(${lmsQuizAttempts.id})`));

      return rows.map(r => ({
        lessonId: r.lessonId,
        courseId: r.courseId,
        lessonTitle: r.lessonTitle ?? `Lesson #${r.lessonId}`,
        courseTitle: r.courseTitle ?? `Course #${r.courseId}`,
        quizTitle: r.quizTitle ?? "Quiz",
        attemptCount: Number(r.attemptCount),
        avgScore: r.avgScore != null ? Math.round(Number(r.avgScore)) : null,
        passingScore: r.passingScore ?? 70,
      }));
    }),

  /** Get all attempts for a specific quiz/lesson, with per-user summary */
  getQuizAttempts: protectedProcedure
    .input(z.object({
      lessonId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.pageSize;
      const attempts = await db
        .select({
          id: lmsQuizAttempts.id,
          userId: lmsQuizAttempts.userId,
          score: lmsQuizAttempts.score,
          passed: lmsQuizAttempts.passed,
          totalQuestions: lmsQuizAttempts.totalQuestions,
          correctAnswers: lmsQuizAttempts.correctAnswers,
          timeTakenSec: lmsQuizAttempts.timeTakenSec,
          createdAt: lmsQuizAttempts.createdAt,
          userName: users.name,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
        })
        .from(lmsQuizAttempts)
        .leftJoin(users, eq(users.id, lmsQuizAttempts.userId))
        .where(eq(lmsQuizAttempts.lessonId, input.lessonId))
        .orderBy(desc(lmsQuizAttempts.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count(lmsQuizAttempts.id) })
        .from(lmsQuizAttempts)
        .where(eq(lmsQuizAttempts.lessonId, input.lessonId));

      return { attempts, total: Number(total) };
    }),

  /** Get per-question answers for a specific attempt */
  getAttemptAnswers: protectedProcedure
    .input(z.object({ attemptId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const answers = await db
        .select()
        .from(lmsQuizAttemptAnswers)
        .where(eq(lmsQuizAttemptAnswers.attemptId, input.attemptId))
        .orderBy(asc(lmsQuizAttemptAnswers.id));

      return answers;
    }),

  /** Get all attempts by a specific user across all quizzes */
  getUserAttempts: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const attempts = await db
        .select({
          id: lmsQuizAttempts.id,
          lessonId: lmsQuizAttempts.lessonId,
          courseId: lmsQuizAttempts.courseId,
          score: lmsQuizAttempts.score,
          passed: lmsQuizAttempts.passed,
          totalQuestions: lmsQuizAttempts.totalQuestions,
          correctAnswers: lmsQuizAttempts.correctAnswers,
          timeTakenSec: lmsQuizAttempts.timeTakenSec,
          createdAt: lmsQuizAttempts.createdAt,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
          quizTitle: lmsQuizzes.title,
        })
        .from(lmsQuizAttempts)
        .leftJoin(lmsLessons, eq(lmsLessons.id, lmsQuizAttempts.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsQuizAttempts.courseId))
        .leftJoin(lmsQuizzes, eq(lmsQuizzes.lessonId, lmsQuizAttempts.lessonId))
        .where(eq(lmsQuizAttempts.userId, input.userId))
        .orderBy(desc(lmsQuizAttempts.createdAt));

      return attempts;
    }),

  /** Export all attempts for a quiz as CSV (returns base64 CSV string) */
  exportQuizCsv: protectedProcedure
    .input(z.object({ lessonId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get all attempts
      const attempts = await db
        .select({
          id: lmsQuizAttempts.id,
          userId: lmsQuizAttempts.userId,
          score: lmsQuizAttempts.score,
          passed: lmsQuizAttempts.passed,
          totalQuestions: lmsQuizAttempts.totalQuestions,
          correctAnswers: lmsQuizAttempts.correctAnswers,
          timeTakenSec: lmsQuizAttempts.timeTakenSec,
          createdAt: lmsQuizAttempts.createdAt,
          userName: users.name,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
        })
        .from(lmsQuizAttempts)
        .leftJoin(users, eq(users.id, lmsQuizAttempts.userId))
        .leftJoin(lmsLessons, eq(lmsLessons.id, lmsQuizAttempts.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsQuizAttempts.courseId))
        .where(eq(lmsQuizAttempts.lessonId, input.lessonId))
        .orderBy(desc(lmsQuizAttempts.createdAt));

      if (attempts.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No attempts found for this quiz" });
      }

      // Get all per-question answers for these attempts
      const attemptIds = attempts.map(a => a.id);
      const answers = await db
        .select()
        .from(lmsQuizAttemptAnswers)
        .where(inArray(lmsQuizAttemptAnswers.attemptId, attemptIds))
        .orderBy(asc(lmsQuizAttemptAnswers.attemptId), asc(lmsQuizAttemptAnswers.id));

      // Group answers by attemptId
      const answersByAttempt = new Map<number, typeof answers>();
      for (const a of answers) {
        if (!answersByAttempt.has(a.attemptId)) answersByAttempt.set(a.attemptId, []);
        answersByAttempt.get(a.attemptId)!.push(a);
      }

      // Collect all unique question texts (for column headers)
      const questionCols: string[] = [];
      const questionColSet = new Set<string>();
      for (const ans of answers) {
        const col = `Q: ${ans.questionText.substring(0, 60)}`;
        if (!questionColSet.has(col)) { questionColSet.add(col); questionCols.push(col); }
      }

      // Build CSV
      const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["Date", "Name", "Email", "Course", "Quiz/Lesson", "Score (%)", "Passed", "Correct", "Total", "Time (sec)", ...questionCols];
      const rows = [headers.map(escape).join(",")];

      for (const attempt of attempts) {
        const attemptAnswers = answersByAttempt.get(attempt.id) ?? [];
        const answerMap = new Map(attemptAnswers.map(a => [`Q: ${a.questionText.substring(0, 60)}`, formatAnswer(a.answerValue, a.questionType)]));
        const row = [
          new Date(attempt.createdAt).toISOString(),
          attempt.userName ?? `${attempt.userFirstName ?? ""} ${attempt.userLastName ?? ""}`.trim(),
          attempt.userEmail ?? "",
          attempt.courseTitle ?? "",
          attempt.lessonTitle ?? "",
          attempt.score,
          attempt.passed ? "Yes" : "No",
          attempt.correctAnswers,
          attempt.totalQuestions,
          attempt.timeTakenSec ?? "",
          ...questionCols.map(col => answerMap.get(col) ?? ""),
        ];
        rows.push(row.map(escape).join(","));
      }

      const csv = rows.join("\n");
      const csvBuffer = Buffer.from(csv, "utf-8");
      const key = `quiz-exports/quiz-${input.lessonId}-${Date.now()}.csv`;
      const { url } = await storagePut(key, csvBuffer, "text/csv");
      return { url, filename: `quiz-results-lesson-${input.lessonId}.csv` };
    }),

  /** Generate a per-user PDF report for a specific attempt */
  generateUserPdf: protectedProcedure
    .input(z.object({ attemptId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get attempt + user + quiz info
      const [attempt] = await db
        .select({
          id: lmsQuizAttempts.id,
          userId: lmsQuizAttempts.userId,
          score: lmsQuizAttempts.score,
          passed: lmsQuizAttempts.passed,
          totalQuestions: lmsQuizAttempts.totalQuestions,
          correctAnswers: lmsQuizAttempts.correctAnswers,
          timeTakenSec: lmsQuizAttempts.timeTakenSec,
          createdAt: lmsQuizAttempts.createdAt,
          userName: users.name,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
          quizTitle: lmsQuizzes.title,
          passingScore: lmsQuizzes.passingScore,
        })
        .from(lmsQuizAttempts)
        .leftJoin(users, eq(users.id, lmsQuizAttempts.userId))
        .leftJoin(lmsLessons, eq(lmsLessons.id, lmsQuizAttempts.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsQuizAttempts.courseId))
        .leftJoin(lmsQuizzes, eq(lmsQuizzes.lessonId, lmsQuizAttempts.lessonId))
        .where(eq(lmsQuizAttempts.id, input.attemptId))
        .limit(1);

      if (!attempt) throw new TRPCError({ code: "NOT_FOUND" });

      const answers = await db
        .select()
        .from(lmsQuizAttemptAnswers)
        .where(eq(lmsQuizAttemptAnswers.attemptId, input.attemptId))
        .orderBy(asc(lmsQuizAttemptAnswers.id));

      // Build HTML for PDF
      const _rawName = attempt.userName ?? `${attempt.userFirstName ?? ""} ${attempt.userLastName ?? ""}`.trim();
      const displayName = _rawName || attempt.userEmail || `User #${attempt.userId}`;
      const _quizTitle = attempt.quizTitle || attempt.lessonTitle || "Quiz";
      const _courseTitle = attempt.courseTitle || "—";
      const _userEmail = attempt.userEmail || "";

      const answersHtml = answers.map((a, i) => {
        const isSurvey = isSurveyType(a.questionType);
        const displayAnswer = formatAnswer(a.answerValue, a.questionType);
        const correctBadge = isSurvey
          ? `<span style="color:#6b7280;font-size:11px">Survey response</span>`
          : a.isCorrect
            ? `<span style="color:#059669;font-weight:bold">✓ Correct</span>`
            : `<span style="color:#dc2626;font-weight:bold">✗ Incorrect</span>`;
        const correctAnswerRow = (!isSurvey && !a.isCorrect && a.correctAnswer)
          ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">Correct answer: <strong>${a.correctAnswer}</strong></div>`
          : "";
        return `
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:10px;background:${isSurvey ? "#fafafa" : (a.isCorrect ? "#f0fdf4" : "#fff7f7")}">
            <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px">${i + 1}. ${a.questionText}</div>
            <div style="font-size:12px;color:#374151;margin-bottom:4px">Answer: <strong>${displayAnswer || "(no answer)"}</strong></div>
            <div>${correctBadge}</div>
            ${correctAnswerRow}
          </div>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
  h1 { font-size: 20px; color: #189aa1; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
  .score-box { display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 22px; font-weight: bold; margin-bottom: 20px; }
  .passed { background: #d1fae5; color: #065f46; }
  .failed { background: #fee2e2; color: #991b1b; }
  .section-title { font-size: 14px; font-weight: 700; color: #374151; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
</style>
</head>
<body>
  <h1>Quiz Results Report</h1>
  <div class="meta">
    <strong>${displayName}</strong> &nbsp;·&nbsp; ${_userEmail}<br>
    Course: ${_courseTitle} &nbsp;·&nbsp; Quiz: ${_quizTitle}<br>
    Completed: ${new Date(attempt.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
    ${attempt.timeTakenSec ? ` &nbsp;·&nbsp; Time: ${Math.floor(attempt.timeTakenSec / 60)}m ${attempt.timeTakenSec % 60}s` : ""}
  </div>
  <div class="score-box ${attempt.passed ? "passed" : "failed"}">
    ${attempt.score}% &nbsp; ${attempt.passed ? "PASSED" : "NOT PASSED"}
  </div>
  <div style="font-size:13px;color:#6b7280;margin-bottom:20px">
    ${attempt.correctAnswers} of ${attempt.totalQuestions} correct &nbsp;·&nbsp; Passing score: ${attempt.passingScore ?? 70}%
  </div>
  ${answers.length > 0 ? `<div class="section-title">Question-by-Question Breakdown</div>${answersHtml}` : "<p style='color:#6b7280;font-size:13px'>No per-question detail available for this attempt.</p>"}
  <div style="margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px">
    Generated by All About Ultrasound™ · ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
  </div>
</body>
</html>`;

      // Use invokeLLM is not needed — generate PDF via puppeteer-compatible approach
      // We'll return the HTML as a data URI and let the frontend render it, OR upload as HTML
      // For a real PDF we'd use a headless browser — here we upload HTML and return the URL
      const htmlBuffer = Buffer.from(html, "utf-8");
      const key = `quiz-reports/attempt-${input.attemptId}-${Date.now()}.html`;
      const { url } = await storagePut(key, htmlBuffer, "text/html");
      return { url, html, filename: `quiz-report-${displayName.replace(/\s+/g, "-")}-attempt-${input.attemptId}.html` };
    }),

  /** Bulk export: all attempts across all quizzes as a single CSV */
  exportAllCsv: protectedProcedure
    .input(z.object({
      courseId: z.number().int().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions: any[] = [];
      if (input.courseId) conditions.push(eq(lmsQuizAttempts.courseId, input.courseId));
      if (input.fromDate) conditions.push(sql`${lmsQuizAttempts.createdAt} >= ${new Date(input.fromDate)}`);
      if (input.toDate) conditions.push(sql`${lmsQuizAttempts.createdAt} <= ${new Date(input.toDate)}`);

      const attempts = await db
        .select({
          id: lmsQuizAttempts.id,
          userId: lmsQuizAttempts.userId,
          lessonId: lmsQuizAttempts.lessonId,
          courseId: lmsQuizAttempts.courseId,
          score: lmsQuizAttempts.score,
          passed: lmsQuizAttempts.passed,
          totalQuestions: lmsQuizAttempts.totalQuestions,
          correctAnswers: lmsQuizAttempts.correctAnswers,
          timeTakenSec: lmsQuizAttempts.timeTakenSec,
          createdAt: lmsQuizAttempts.createdAt,
          userName: users.name,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
          quizTitle: lmsQuizzes.title,
        })
        .from(lmsQuizAttempts)
        .leftJoin(users, eq(users.id, lmsQuizAttempts.userId))
        .leftJoin(lmsLessons, eq(lmsLessons.id, lmsQuizAttempts.lessonId))
        .leftJoin(lmsCourses, eq(lmsCourses.id, lmsQuizAttempts.courseId))
        .leftJoin(lmsQuizzes, eq(lmsQuizzes.lessonId, lmsQuizAttempts.lessonId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lmsQuizAttempts.createdAt))
        .limit(5000);

      if (attempts.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No attempts found" });
      }

      const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["Date", "Name", "Email", "Course", "Quiz/Lesson", "Score (%)", "Passed", "Correct", "Total", "Time (sec)"];
      const rows = [headers.map(escape).join(",")];
      for (const attempt of attempts) {
        const row = [
          new Date(attempt.createdAt).toISOString(),
          attempt.userName ?? `${attempt.userFirstName ?? ""} ${attempt.userLastName ?? ""}`.trim(),
          attempt.userEmail ?? "",
          attempt.courseTitle ?? "",
          attempt.quizTitle ?? attempt.lessonTitle ?? "",
          attempt.score,
          attempt.passed ? "Yes" : "No",
          attempt.correctAnswers,
          attempt.totalQuestions,
          attempt.timeTakenSec ?? "",
        ];
        rows.push(row.map(escape).join(","));
      }

      const csv = rows.join("\n");
      const csvBuffer = Buffer.from(csv, "utf-8");
      const key = `quiz-exports/bulk-export-${Date.now()}.csv`;
      const { url } = await storagePut(key, csvBuffer, "text/csv");
      return { url, count: attempts.length, filename: `quiz-results-bulk-${new Date().toISOString().slice(0, 10)}.csv` };
    }),
});
// touched
