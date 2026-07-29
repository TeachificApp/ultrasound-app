import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
let _db: Db | undefined;
async function db(): Promise<Db> {
  if (_db) return _db;
  const connection = await getDb();
  if (!connection) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }
  _db = connection;
  return connection;
}
import {
  quizBanks,
  quizBankQuestions,
  quizBankTags,
  quizBankFolders,
  quizQuestionTags,
  quizAnswerChoices,
  quizImportJobs,
} from "../../drizzle/schema";
import { and, eq, inArray, like, sql, desc, asc } from "drizzle-orm";

// ─── Question type enum ───────────────────────────────────────────────────────
const QUESTION_TYPES = ["mc","tf","ms","hotspot","puzzle","matching","sequence","numeric","short_answer","info_slide"] as const;
type QuestionType = typeof QUESTION_TYPES[number];

// ─── Answer choice schema ─────────────────────────────────────────────────────
const answerChoiceSchema = z.object({
  id: z.number().optional(),
  choiceText: z.string().optional(),
  choiceHtml: z.string().optional(),
  mediaType: z.enum(["none","image","video"]).default("none"),
  mediaUrl: z.string().optional(),
  mediaAlt: z.string().optional(),
  isCorrect: z.boolean().default(false),
  sortOrder: z.number().default(0),
  matchPairId: z.string().optional(),
  matchSide: z.enum(["left","right"]).optional(),
  feedbackText: z.string().optional(),
  feedbackMediaUrl: z.string().optional(),
});

// ─── Question upsert schema ───────────────────────────────────────────────────
const questionUpsertSchema = z.object({
  id: z.number().optional(),
  bankId: z.number(),
  questionType: z.enum(QUESTION_TYPES).default("mc"),
  questionText: z.string().min(1),
  questionHtml: z.string().optional(),
  mediaType: z.enum(["none","image","video"]).default("none"),
  mediaUrl: z.string().optional(),
  mediaAlt: z.string().optional(),
  hotspotZones: z.any().optional(),
  puzzleConfig: z.any().optional(),
  numericMin: z.number().optional(),
  numericMax: z.number().optional(),
  points: z.number().default(1),
  partialCredit: z.boolean().default(false),
  penaltyPoints: z.number().default(0),
  difficulty: z.enum(["easy","medium","hard"]).default("medium"),
  explanationText: z.string().optional(),
  explanationHtml: z.string().optional(),
  explanationMediaType: z.enum(["none","image","video"]).default("none"),
  explanationMediaUrl: z.string().optional(),
  tagIds: z.array(z.number()).default([]),
  choices: z.array(answerChoiceSchema).default([]),
});

function toDecimalString(value: number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

export const quizBankRouter = router({
  // ─── Folders ──────────────────────────────────────────────────────────────────────────────────────
  listFolders: protectedProcedure
    .query(async () => {
      return (await db()).select().from(quizBankFolders)
        .orderBy(asc(quizBankFolders.sortOrder), asc(quizBankFolders.name));
    }),

  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), parentId: z.number().nullable().optional(), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [result] = await (await db()).insert(quizBankFolders).values({
        name: input.name,
        description: input.description,
        parentId: input.parentId ?? null,
        color: input.color ?? "#6366f1",
      });
      return { id: (result as any).insertId };
    }),

  updateFolder: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1), description: z.string().nullable().optional(), parentId: z.number().nullable().optional(), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBankFolders).set({
        name: input.name,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        color: input.color,
      }).where(eq(quizBankFolders.id, input.id));
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Move questions in this folder to no folder
      await (await db()).update(quizBankQuestions).set({ folderId: null }).where(eq(quizBankQuestions.folderId, input.id));
      // Move child folders to root
      await (await db()).update(quizBankFolders).set({ parentId: null }).where(eq(quizBankFolders.parentId, input.id));
      await (await db()).delete(quizBankFolders).where(eq(quizBankFolders.id, input.id));
    }),

  // ─── Banks ──────────────────────────────────────────────────────────────────────────────────────
  listBanks: protectedProcedure
    .query(async () => {
      return (await db()).select().from(quizBanks)
        .orderBy(asc(quizBanks.name));
    }),

  createBank: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [result] = await (await db()).insert(quizBanks).values({
        name: input.name,
        description: input.description,
      });
      return { id: (result as any).insertId };
    }),

  updateBank: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBanks).set({ name: input.name, description: input.description }).where(eq(quizBanks.id, input.id));
    }),

  deleteBank: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const questions = await (await db()).select({ id: quizBankQuestions.id })
        .from(quizBankQuestions).where(eq(quizBankQuestions.bankId, input.id));
      if (questions.length > 0) {
        const qIds = questions.map(q => q.id);
        await (await db()).delete(quizQuestionTags).where(inArray(quizQuestionTags.questionId, qIds));
        await (await db()).delete(quizAnswerChoices).where(inArray(quizAnswerChoices.questionId, qIds));
        await (await db()).delete(quizBankQuestions).where(eq(quizBankQuestions.bankId, input.id));
      }
      await (await db()).delete(quizBanks).where(eq(quizBanks.id, input.id));
    }),

  // ─── Tags ─────────────────────────────────────────────────────────────────
  listTags: protectedProcedure
    .query(async () => {
      return (await db()).select().from(quizBankTags)
        .orderBy(asc(quizBankTags.name));
    }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [result] = await (await db()).insert(quizBankTags).values({
        name: input.name,
        color: input.color ?? "#24abbc",
      });
      return { id: (result as any).insertId };
    }),

  updateTag: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBankTags).set({ name: input.name, color: input.color }).where(eq(quizBankTags.id, input.id));
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await (await db()).delete(quizQuestionTags).where(eq(quizQuestionTags.tagId, input.id));
      await (await db()).delete(quizBankTags).where(eq(quizBankTags.id, input.id));
    }),

  // ─── Questions ────────────────────────────────────────────────────────────
  listQuestions: protectedProcedure
    .input(z.object({
      bankId: z.number().optional(),
      folderId: z.number().nullable().optional(),
      tagIds: z.array(z.number()).optional(),
      questionType: z.string().optional(),
      search: z.string().optional(),
      difficulty: z.string().optional(),
      includeArchived: z.boolean().default(false),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const conditions: any[] = [];
      if (input.bankId) conditions.push(eq(quizBankQuestions.bankId, input.bankId));
      if (input.folderId !== undefined) {
        if (input.folderId === null) conditions.push(sql`${quizBankQuestions.folderId} IS NULL`);
        else conditions.push(eq(quizBankQuestions.folderId, input.folderId));
      }
      if (!input.includeArchived) conditions.push(eq(quizBankQuestions.isArchived, false));
      if (input.questionType) conditions.push(eq(quizBankQuestions.questionType, input.questionType as QuestionType));
      if (input.difficulty) conditions.push(eq(quizBankQuestions.difficulty, input.difficulty as "easy"|"medium"|"hard"));
      if (input.search) conditions.push(like(quizBankQuestions.questionText, `%${input.search}%`));

      const questions = await (await db()).select().from(quizBankQuestions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(quizBankQuestions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      if (questions.length === 0) return { questions: [], total: 0 };

      const qIds = questions.map(q => q.id);
      const choices = await (await db()).select().from(quizAnswerChoices)
        .where(inArray(quizAnswerChoices.questionId, qIds))
        .orderBy(asc(quizAnswerChoices.sortOrder));
      const tags = await (await db()).select().from(quizQuestionTags)
        .where(inArray(quizQuestionTags.questionId, qIds));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ count }] = await (await db()).select({ count: sql<number>`count(*)` })
        .from(quizBankQuestions).where(whereClause);

      return {
        questions: questions.map(q => ({
          ...q,
          choices: choices.filter(c => c.questionId === q.id),
          tagIds: tags.filter(t => t.questionId === q.id).map(t => t.tagId),
        })),
        total: count,
      };
    }),

  getQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [question] = await (await db()).select().from(quizBankQuestions).where(eq(quizBankQuestions.id, input.id));
      if (!question) throw new TRPCError({ code: "NOT_FOUND" });
      const choices = await (await db()).select().from(quizAnswerChoices)
        .where(eq(quizAnswerChoices.questionId, input.id))
        .orderBy(asc(quizAnswerChoices.sortOrder));
      const tags = await (await db()).select().from(quizQuestionTags)
        .where(eq(quizQuestionTags.questionId, input.id));
      return { ...question, choices, tagIds: tags.map(t => t.tagId) };
    }),

  bulkImport: protectedProcedure
    .input(z.object({
      folderId: z.number().nullable().optional(),
      bankId: z.number().optional(),
      questions: z.array(z.object({
        questionType: z.string(),
        stem: z.string(),
        dataJson: z.string().optional(),
        points: z.number().default(1),
        difficulty: z.enum(["easy","medium","hard"]).default("medium"),
        explanation: z.string().optional(),
        tags: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      // Find or create default bank
      let bankId = input.bankId;
      if (!bankId) {
        const banks = await (await db()).select().from(quizBanks).where(eq(quizBanks.isDefault, true)).limit(1);
        if (banks.length > 0) {
          bankId = banks[0].id;
        } else {
          const allBanks = await (await db()).select().from(quizBanks).limit(1);
          if (allBanks.length > 0) {
            bankId = allBanks[0].id;
          } else {
            const [r] = await (await db()).insert(quizBanks).values({ name: "Default Bank", isDefault: true, questionCount: 0 });
            bankId = (r as any).insertId;
          }
        }
      }
      let imported = 0;
      let skipped = 0;
      for (const q of input.questions) {
        try {
          let choices: any[] = [];
          if (q.dataJson) {
            try { choices = JSON.parse(q.dataJson)?.choices ?? []; } catch {}
          }
          const [qResult] = await (await db()).insert(quizBankQuestions).values({
            bankId: bankId!,
            folderId: input.folderId ?? null,
            questionType: (q.questionType === "mcq" ? "mc" : q.questionType === "multiple_select" ? "ms" : q.questionType) as any,
            questionText: q.stem,
            points: q.points ?? 1,
            difficulty: q.difficulty ?? "medium",
            explanationText: q.explanation,
            importSource: "csv",
          });
          const qId = (qResult as any).insertId;
          if (choices.length > 0) {
            await (await db()).insert(quizAnswerChoices).values(
              choices.map((c: any, i: number) => ({
                questionId: qId,
                choiceText: c.text ?? c.choiceText ?? "",
                isCorrect: c.isCorrect ?? c.correct ?? false,
                sortOrder: i,
              }))
            );
          }
          // Handle tags
          if (q.tags) {
            const tagNames = q.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
            for (const tagName of tagNames) {
              let tag = (await (await db()).select().from(quizBankTags).where(eq(quizBankTags.name, tagName)).limit(1))[0];
              if (!tag) {
                const [tr] = await (await db()).insert(quizBankTags).values({ name: tagName });
                const tagId = (tr as any).insertId;
                await (await db()).insert(quizQuestionTags).values({ questionId: qId, tagId });
              } else {
                await (await db()).insert(quizQuestionTags).values({ questionId: qId, tagId: tag.id });
              }
            }
          }
          imported++;
        } catch {
          skipped++;
        }
      }
      if (bankId) {
        await (await db()).update(quizBanks).set({ questionCount: sql`question_count + ${imported}` }).where(eq(quizBanks.id, bankId!));
      }
      return { imported, skipped };
    }),

  moveToFolder: protectedProcedure
    .input(z.object({ ids: z.array(z.number()), folderId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      if (input.ids.length === 0) return;
      await (await db()).update(quizBankQuestions).set({ folderId: input.folderId }).where(inArray(quizBankQuestions.id, input.ids));
    }),

  upsertQuestion: protectedProcedure
    .input(questionUpsertSchema)
    .mutation(async ({ input }) => {
      const { id, tagIds, choices, ...questionData } = input;
      const normalizedQuestionData = {
        ...questionData,
        numericMin: toDecimalString(questionData.numericMin),
        numericMax: toDecimalString(questionData.numericMax),
      };

      let questionId: number;
      if (id) {
        await (await db()).update(quizBankQuestions).set({
          ...normalizedQuestionData,
          hotspotZones: questionData.hotspotZones ?? null,
          puzzleConfig: questionData.puzzleConfig ?? null,
        }).where(eq(quizBankQuestions.id, id));
        questionId = id;
      } else {
        const [result] = await (await db()).insert(quizBankQuestions).values({
          ...normalizedQuestionData,
        });
        questionId = (result as any).insertId;
        await (await db()).update(quizBanks).set({ questionCount: sql`question_count + 1` }).where(eq(quizBanks.id, questionData.bankId));
      }

      // Sync tags
      await (await db()).delete(quizQuestionTags).where(eq(quizQuestionTags.questionId, questionId));
      if (tagIds.length > 0) {
        await (await db()).insert(quizQuestionTags).values(tagIds.map(tagId => ({ questionId, tagId })));
      }

      // Sync choices
      await (await db()).delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, questionId));
      if (choices.length > 0) {
        await (await db()).insert(quizAnswerChoices).values(
          choices.map((c, i) => ({
            questionId,
            choiceText: c.choiceText,
            choiceHtml: c.choiceHtml,
            mediaType: c.mediaType,
            mediaUrl: c.mediaUrl,
            mediaAlt: c.mediaAlt,
            isCorrect: c.isCorrect,
            sortOrder: c.sortOrder ?? i,
            matchPairId: c.matchPairId,
            matchSide: c.matchSide,
            feedbackText: c.feedbackText,
            feedbackMediaUrl: c.feedbackMediaUrl,
          }))
        );
      }

      return { id: questionId };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [q] = await (await db()).select({ bankId: quizBankQuestions.bankId }).from(quizBankQuestions).where(eq(quizBankQuestions.id, input.id));
      await (await db()).delete(quizQuestionTags).where(eq(quizQuestionTags.questionId, input.id));
      await (await db()).delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, input.id));
      await (await db()).delete(quizBankQuestions).where(eq(quizBankQuestions.id, input.id));
      if (q) {
        await (await db()).update(quizBanks).set({ questionCount: sql`GREATEST(question_count - 1, 0)` }).where(eq(quizBanks.id, q.bankId));
      }
    }),

  archiveQuestion: protectedProcedure
    .input(z.object({ id: z.number(), archived: z.boolean() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBankQuestions).set({ isArchived: input.archived }).where(eq(quizBankQuestions.id, input.id));
    }),

  // ─── Bulk operations ──────────────────────────────────────────────────────
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      if (input.ids.length === 0) return;
      await (await db()).delete(quizQuestionTags).where(inArray(quizQuestionTags.questionId, input.ids));
      await (await db()).delete(quizAnswerChoices).where(inArray(quizAnswerChoices.questionId, input.ids));
      await (await db()).delete(quizBankQuestions).where(inArray(quizBankQuestions.id, input.ids));
    }),

  // ─── Import ───────────────────────────────────────────────────────────────
  createImportJob: protectedProcedure
    .input(z.object({
      bankId: z.number().optional(),
      source: z.enum(["scorm","csv","xls"]),
      filename: z.string(),
      fileUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [result] = await (await db()).insert(quizImportJobs).values({
        bankId: input.bankId,
        importedById: ctx.user.id,
        source: input.source,
        filename: input.filename,
        fileUrl: input.fileUrl,
        status: "pending",
      });
      return { id: (result as any).insertId };
    }),

  getImportJob: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [job] = await (await db()).select().from(quizImportJobs).where(eq(quizImportJobs.id, input.id));
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  listImportJobs: protectedProcedure
    .query(async () => {
      return (await db()).select().from(quizImportJobs)
        .orderBy(desc(quizImportJobs.createdAt))
        .limit(20);
    }),

  parseImportFile: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      fileUrl: z.string(),
      source: z.enum(["scorm","csv","xls"]),
    }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizImportJobs).set({ status: "parsing" }).where(eq(quizImportJobs.id, input.jobId));

      try {
        let parsedQuestions: any[] = [];

        if (input.source === "csv") {
          const response = await fetch(input.fileUrl);
          const text = await response.text();
          parsedQuestions = parseCSVQuestions(text);
        } else if (input.source === "scorm") {
          const response = await fetch(input.fileUrl);
          const text = await response.text();
          parsedQuestions = parseSCORMQuestions(text);
        }

        await (await db()).update(quizImportJobs).set({
          status: "preview_ready",
          parsedQuestions: parsedQuestions,
        }).where(eq(quizImportJobs.id, input.jobId));

        return { count: parsedQuestions.length, questions: parsedQuestions.slice(0, 5) };
      } catch (err: any) {
        await (await db()).update(quizImportJobs).set({
          status: "failed",
          errorLog: [{ message: err.message }],
        }).where(eq(quizImportJobs.id, input.jobId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  confirmImport: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      bankId: z.number(),
      selectedIndices: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const [job] = await (await db()).select().from(quizImportJobs).where(eq(quizImportJobs.id, input.jobId));
      if (!job || !job.parsedQuestions) throw new TRPCError({ code: "NOT_FOUND" });

      await (await db()).update(quizImportJobs).set({ status: "importing", bankId: input.bankId }).where(eq(quizImportJobs.id, input.jobId));

      const allQuestions = job.parsedQuestions as any[];
      const toImport = input.selectedIndices
        ? allQuestions.filter((_, i) => input.selectedIndices!.includes(i))
        : allQuestions;

      let importedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];

      for (const q of toImport) {
        try {
          const [qResult] = await (await db()).insert(quizBankQuestions).values({
            bankId: input.bankId,
            questionType: q.questionType ?? "mc",
            questionText: q.questionText ?? "Imported question",
            questionHtml: q.questionHtml,
            mediaType: q.mediaType ?? "none",
            mediaUrl: q.mediaUrl,
            points: q.points ?? 1,
            difficulty: q.difficulty ?? "medium",
            explanationText: q.explanationText,
            importSource: job.source,
            importJobId: input.jobId,
          });

          if (q.choices && q.choices.length > 0) {
            await (await db()).insert(quizAnswerChoices).values(
              q.choices.map((c: any, i: number) => ({
                questionId: (qResult as any).insertId,
                choiceText: c.text ?? c.choiceText,
                isCorrect: c.isCorrect ?? false,
                sortOrder: i,
                feedbackText: c.feedback,
              }))
            );
          }

          importedCount++;
        } catch (err: any) {
          skippedCount++;
          errors.push({ question: q.questionText, error: err.message });
        }
      }

      await (await db()).update(quizBanks).set({ questionCount: sql`question_count + ${importedCount}` }).where(eq(quizBanks.id, input.bankId));

      await (await db()).update(quizImportJobs).set({
        status: "completed",
        importedCount,
        skippedCount,
        errorLog: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      }).where(eq(quizImportJobs.id, input.jobId));

      return { importedCount, skippedCount, errors };
    }),
});

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVQuestions(csvText: string): any[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  const questions: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });

    if (!row["question"] && !row["question_text"]) continue;

    const questionText = row["question"] || row["question_text"];
    const questionType = detectQuestionType(row);
    const choices: any[] = [];

    ["a","b","c","d","e","f"].forEach(letter => {
      const text = row[letter] || row[`choice_${letter}`] || row[`option_${letter}`];
      if (text) {
        const correctAnswer = (row["correct_answer"] || row["answer"] || "").toLowerCase();
        choices.push({
          text,
          isCorrect: correctAnswer === letter || correctAnswer === text.toLowerCase(),
          feedback: row[`feedback_${letter}`],
        });
      }
    });

    questions.push({
      questionType,
      questionText,
      choices,
      points: parseFloat(row["points"] || row["point_value"] || "1") || 1,
      difficulty: (row["difficulty"] || "medium").toLowerCase(),
      explanationText: row["explanation"] || row["feedback"] || row["rationale"],
      mediaUrl: row["image_url"] || row["media_url"],
      mediaType: (row["image_url"] || row["media_url"]) ? "image" : "none",
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

function detectQuestionType(row: Record<string, string>): string {
  const type = (row["type"] || row["question_type"] || "").toLowerCase();
  if (type.includes("true") || type.includes("tf") || type.includes("boolean")) return "tf";
  if (type.includes("multi") && type.includes("select")) return "ms";
  if (type.includes("hotspot")) return "hotspot";
  if (type.includes("match")) return "matching";
  if (type.includes("order") || type.includes("sequence")) return "sequence";
  if (type.includes("numeric") || type.includes("number")) return "numeric";
  if (type.includes("short") || type.includes("text")) return "short_answer";
  return "mc";
}

// ─── SCORM QTI XML Parser ─────────────────────────────────────────────────────
function parseSCORMQuestions(xmlText: string): any[] {
  const questions: any[] = [];

  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemXml = itemMatch[1];

    const matTextMatch = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/i)
      || itemXml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!matTextMatch) continue;

    const questionText = stripHtml(matTextMatch[1]).trim();
    if (!questionText) continue;

    const rtMatch = itemXml.match(/rcardinality="([^"]+)"/i);
    const cardinality = rtMatch ? rtMatch[1].toLowerCase() : "single";
    const questionType = cardinality === "multiple" ? "ms" : "mc";

    const choices: any[] = [];
    const responseChoiceRegex = /<response_label[^>]*ident="([^"]+)"[^>]*>([\s\S]*?)<\/response_label>/gi;
    let choiceMatch;
    while ((choiceMatch = responseChoiceRegex.exec(itemXml)) !== null) {
      const choiceId = choiceMatch[1];
      const choiceText = stripHtml(choiceMatch[2]).trim();
      if (choiceText) {
        choices.push({ id: choiceId, text: choiceText, isCorrect: false });
      }
    }

    const correctRegex = /<varequal[^>]*>(.*?)<\/varequal>/gi;
    let correctMatch;
    while ((correctMatch = correctRegex.exec(itemXml)) !== null) {
      const correctId = correctMatch[1].trim();
      const choice = choices.find(c => c.id === correctId);
      if (choice) choice.isCorrect = true;
    }

    const feedbackMatch = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/gi);
    const explanationText = feedbackMatch && feedbackMatch.length > 1
      ? stripHtml(feedbackMatch[feedbackMatch.length - 1]).trim()
      : undefined;

    questions.push({
      questionType,
      questionText,
      choices,
      explanationText,
      points: 1,
      difficulty: "medium",
    });
  }

  return questions;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
