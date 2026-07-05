/**
 * questionBankRouter.ts
 * Manages the shared question bank — create, read, update, delete questions,
 * manage tags, AI-generate questions, and import questions into quizzes.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import {
  questionBank,
  questionBankFolders,
  questionBankTags,
  questionBankTagMap,
  lmsQuizQuestions,
  users,
  mediaAssets,
  mediaVersions,
} from "../../drizzle/schema";
import { parseISpringQuizFromBuffer } from "../lib/iSpringQuizParser";
import { rewriteStorageRefs, uploadISpringImagesFromZip } from "../lib/iSpringImageImporter";
import { storagePut, storageGet } from "../storage";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";

async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role !== "admin") {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!u || u.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ─── Shared question input schema ─────────────────────────────────────────────
const questionInput = z.object({
  question: z.string().min(1),
  type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]).default("mcq"),
  options: z.array(z.object({
    text: z.string(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
  })).optional(),
  correctAnswer: z.string().optional(),
  correctAnswers: z.array(z.number().int()).optional(),
  hotspotMarkers: z.string().optional(), // JSON string
  matchingPairs: z.string().optional(),  // JSON string
  explanation: z.string().optional(),
  questionImageUrl: z.string().optional(),
  questionVideoUrl: z.string().optional(),
  feedbackImageUrl: z.string().optional(),
  feedbackVideoUrl: z.string().optional(),
  folderId: z.number().int().optional(),
  tagIds: z.array(z.number().int()).optional(),
});

export const questionBankRouter = router({
  // ─── Tags ──────────────────────────────────────────────────────────────────

  listTags: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(questionBankTags).orderBy(asc(questionBankTags.name));
  }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(questionBankTags).values({
        name: input.name.trim(),
        color: input.color ?? "#179ca3",
      }).$returningId();
      return { id: result.id };
    }),

  updateTag: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(100).optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) {
        await db.update(questionBankTags).set(filtered).where(eq(questionBankTags.id, id));
      }
      return { success: true };
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(questionBankTagMap).where(eq(questionBankTagMap.tagId, input.id));
      await db.delete(questionBankTags).where(eq(questionBankTags.id, input.id));
      return { success: true };
    }),

  // ─── Questions ─────────────────────────────────────────────────────────────

  listQuestions: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      tagIds: z.array(z.number().int()).optional(),
      type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]).optional(),
      folderId: z.number().int().nullable().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions: any[] = [];
      if (input.search) conditions.push(like(questionBank.question, `%${input.search}%`));
      if (input.type) conditions.push(eq(questionBank.type, input.type));
      if (input.folderId !== undefined) {
        if (input.folderId === null) {
          conditions.push(sql`${questionBank.folderId} IS NULL`);
        } else {
          conditions.push(eq(questionBank.folderId, input.folderId));
        }
      }

      // Tag filter: get question IDs that have ALL the requested tags
      let tagFilteredIds: number[] | null = null;
      if (input.tagIds && input.tagIds.length > 0) {
        const tagRows = await db.select({ questionId: questionBankTagMap.questionId })
          .from(questionBankTagMap)
          .where(inArray(questionBankTagMap.tagId, input.tagIds));
        const idCounts = new Map<number, number>();
        for (const r of tagRows) idCounts.set(r.questionId, (idCounts.get(r.questionId) ?? 0) + 1);
        tagFilteredIds = [...idCounts.entries()]
          .filter(([, count]) => count >= input.tagIds!.length)
          .map(([id]) => id);
        if (tagFilteredIds.length === 0) return { questions: [], total: 0, page: input.page, pageSize: input.pageSize };
        conditions.push(inArray(questionBank.id, tagFilteredIds));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;

      const [questions, [{ count }]] = await Promise.all([
        db.select().from(questionBank)
          .where(where)
          .orderBy(desc(questionBank.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(questionBank).where(where),
      ]);

      // Fetch tags for each question
      const qIds = questions.map(q => q.id);
      let tagsByQuestion: Map<number, typeof questionBankTags.$inferSelect[]> = new Map();
      if (qIds.length > 0) {
        const tagRows = await db
          .select({ questionId: questionBankTagMap.questionId, tag: questionBankTags })
          .from(questionBankTagMap)
          .innerJoin(questionBankTags, eq(questionBankTagMap.tagId, questionBankTags.id))
          .where(inArray(questionBankTagMap.questionId, qIds));
        for (const r of tagRows) {
          if (!tagsByQuestion.has(r.questionId)) tagsByQuestion.set(r.questionId, []);
          tagsByQuestion.get(r.questionId)!.push(r.tag);
        }
      }

      return {
        questions: questions.map(q => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : [],
          correctAnswers: (q as any).correctAnswers ? JSON.parse((q as any).correctAnswers) : [],
          hotspotMarkers: (q as any).hotspotMarkers ? JSON.parse((q as any).hotspotMarkers) : [],
          matchingPairs: (q as any).matchingPairs ? JSON.parse((q as any).matchingPairs) : [],
          tags: tagsByQuestion.get(q.id) ?? [],
        })),
        total: Number(count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [q] = await db.select().from(questionBank).where(eq(questionBank.id, input.id)).limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      const tagRows = await db
        .select({ tag: questionBankTags })
        .from(questionBankTagMap)
        .innerJoin(questionBankTags, eq(questionBankTagMap.tagId, questionBankTags.id))
        .where(eq(questionBankTagMap.questionId, input.id));
      return {
        ...q,
        options: q.options ? JSON.parse(q.options) : [],
        correctAnswers: (q as any).correctAnswers ? JSON.parse((q as any).correctAnswers) : [],
        hotspotMarkers: (q as any).hotspotMarkers ? JSON.parse((q as any).hotspotMarkers) : [],
        matchingPairs: (q as any).matchingPairs ? JSON.parse((q as any).matchingPairs) : [],
        tags: tagRows.map(r => r.tag),
      };
    }),

  createQuestion: protectedProcedure
    .input(questionInput)
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { tagIds, options, correctAnswers, hotspotMarkers, matchingPairs, ...rest } = input;
      const [result] = await db.insert(questionBank).values({
        ...rest,
        correctAnswer: rest.correctAnswer ?? "",
        options: options ? JSON.stringify(options) : null,
        correctAnswers: correctAnswers ? JSON.stringify(correctAnswers) : null,
        hotspotMarkers: hotspotMarkers ?? null,
        matchingPairs: matchingPairs ?? null,
        createdByAdminId: ctx.user.id,
      } as any).$returningId();
      if (tagIds && tagIds.length > 0) {
        await db.insert(questionBankTagMap).values(tagIds.map(tagId => ({ questionId: result.id, tagId })));
      }
      return { id: result.id };
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.number(),
      question: z.string().min(1).optional(),
      type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]).optional(),
      options: z.array(z.object({ text: z.string(), imageUrl: z.string().optional(), videoUrl: z.string().optional() })).optional(),
      correctAnswer: z.string().nullable().optional(),
      correctAnswers: z.array(z.number().int()).nullable().optional(),
      hotspotMarkers: z.string().nullable().optional(),
      matchingPairs: z.string().nullable().optional(),
      explanation: z.string().nullable().optional(),
      questionImageUrl: z.string().nullable().optional(),
      questionVideoUrl: z.string().nullable().optional(),
      feedbackImageUrl: z.string().nullable().optional(),
      feedbackVideoUrl: z.string().nullable().optional(),
      folderId: z.number().int().nullable().optional(),
      tagIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, tagIds, options, correctAnswers, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (options !== undefined) updates.options = JSON.stringify(options);
      if (correctAnswers !== undefined) updates.correctAnswers = correctAnswers ? JSON.stringify(correctAnswers) : null;
      if (Object.keys(updates).length > 0) {
        await db.update(questionBank).set(updates).where(eq(questionBank.id, id));
      }
      if (tagIds !== undefined) {
        await db.delete(questionBankTagMap).where(eq(questionBankTagMap.questionId, id));
        if (tagIds.length > 0) {
          await db.insert(questionBankTagMap).values(tagIds.map(tagId => ({ questionId: id, tagId })));
        }
      }
      return { success: true };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(questionBankTagMap).where(eq(questionBankTagMap.questionId, input.id));
      await db.delete(questionBank).where(eq(questionBank.id, input.id));
      return { success: true };
    }),

  bulkDeleteQuestions: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(questionBankTagMap).where(inArray(questionBankTagMap.questionId, input.ids));
      await db.delete(questionBank).where(inArray(questionBank.id, input.ids));
      return { deleted: input.ids.length };
    }),

  // ─── AI Generate into Bank ─────────────────────────────────────────────────

  aiGenerateToBank: protectedProcedure
    .input(z.object({
      topic: z.string().min(1),
      count: z.number().int().min(1).max(50).default(10),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      questionType: z.enum(["mcq", "truefalse", "mixed"]).default("mcq"),
      tagIds: z.array(z.number().int()).optional(),
      folderId: z.number().int().optional(),
      newFolderName: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const typeInstruction = input.questionType === "mixed"
        ? "Mix multiple choice and true/false questions."
        : input.questionType === "truefalse"
          ? "All questions must be true/false."
          : "All questions must be multiple choice with 4 options.";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a medical education question writer specializing in ultrasound and echocardiography. Generate clinically accurate ${input.difficulty} questions. ${typeInstruction} Return JSON only.`,
          },
          {
            role: "user",
            content: `Generate ${input.count} questions about: ${input.topic}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      type: { type: "string", enum: ["mcq", "truefalse"] },
                      options: { type: "array", items: { type: "string" } },
                      correctAnswer: { type: "string" },
                      explanation: { type: "string" },
                    },
                    required: ["question", "type", "options", "correctAnswer", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        } as any,
      });

      const raw = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const questions: any[] = (parsed.questions ?? []).slice(0, input.count);

      // Resolve or create folder
      let resolvedFolderId: number | null = null;
      if (input.newFolderName?.trim()) {
        const [newFolder] = await db.insert(questionBankFolders).values({
          name: input.newFolderName.trim(),
          color: "#179ca3",
          createdByAdminId: ctx.user.id,
        }).$returningId();
        resolvedFolderId = newFolder.id;
      } else if (input.folderId) {
        resolvedFolderId = input.folderId;
      }

      const inserted: number[] = [];
      for (const q of questions) {
        const opts = Array.isArray(q.options) ? q.options.map((o: string) => ({ text: o })) : [];
        const [result] = await db.insert(questionBank).values({
          question: q.question,
          type: q.type === "truefalse" ? "truefalse" : "mcq",
          options: opts.length > 0 ? JSON.stringify(opts) : null,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? null,
          folderId: resolvedFolderId,
          createdByAdminId: ctx.user.id,
        }).$returningId();
        inserted.push(result.id);
        if (input.tagIds && input.tagIds.length > 0) {
          await db.insert(questionBankTagMap).values(input.tagIds.map(tagId => ({ questionId: result.id, tagId })));
        }
      }

      return { inserted: inserted.length, ids: inserted, folderId: resolvedFolderId };
    }),

  // ─── Import CSV/Excel into Bank ────────────────────────────────────────────
  /**
   * importCsvToBank — parse a CSV/TSV/XLSX data string and insert questions.
   * Expected columns (case-insensitive):
   *   question | type (mcq/truefalse) | option_a..option_d | correct_answer | explanation
   * Returns { inserted, folderId }
   */
  importCsvToBank: protectedProcedure
    .input(z.object({
      /** Raw CSV/TSV string OR base64-encoded XLSX bytes prefixed with "base64:" */
      data: z.string().min(1),
      tagIds: z.array(z.number().int()).optional(),
      folderId: z.number().int().optional(),
      newFolderName: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Resolve or create folder
      let resolvedFolderId: number | null = null;
      if (input.newFolderName?.trim()) {
        const [newFolder] = await db.insert(questionBankFolders).values({
          name: input.newFolderName.trim(),
          color: "#179ca3",
          createdByAdminId: ctx.user.id,
        }).$returningId();
        resolvedFolderId = newFolder.id;
      } else if (input.folderId) {
        resolvedFolderId = input.folderId;
      }

      // Parse the data into rows
      let rows: Record<string, string>[] = [];
      if (input.data.startsWith("base64:")) {
        const buf = Buffer.from(input.data.slice(7), "base64");
        const wb = XLSX.read(buf, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
      } else {
        // CSV/TSV — use XLSX to parse
        const wb = XLSX.read(input.data, { type: "string" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
      }

      // Normalize column names to lowercase with underscores
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const normalizedRows = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), String(v ?? "").trim()])));

      const inserted: number[] = [];
      for (const row of normalizedRows) {
        const questionText = row["question"] || row["question_text"] || row["stem"] || "";
        if (!questionText) continue;

        const rawType = (row["type"] || row["question_type"] || "mcq").toLowerCase();
        const qType: "mcq" | "truefalse" = rawType.includes("true") || rawType.includes("tf") ? "truefalse" : "mcq";

        // Build options array from option_a..option_d or a..d columns
        const optKeys = ["option_a","option_b","option_c","option_d","a","b","c","d","choice_1","choice_2","choice_3","choice_4"];
        const optPairs = [
          ["option_a","a","choice_1"], ["option_b","b","choice_2"],
          ["option_c","c","choice_3"], ["option_d","d","choice_4"],
        ];
        const opts: { text: string }[] = [];
        for (const keys of optPairs) {
          const val = keys.map(k => row[k]).find(v => v);
          if (val) opts.push({ text: val });
        }

        const correctAnswer = row["correct_answer"] || row["answer"] || row["correct"] || "";
        const explanation = row["explanation"] || row["rationale"] || row["feedback"] || "";

        const [result] = await db.insert(questionBank).values({
          question: questionText,
          type: qType,
          options: opts.length > 0 ? JSON.stringify(opts) : null,
          correctAnswer,
          explanation: explanation || null,
          folderId: resolvedFolderId,
          createdByAdminId: ctx.user.id,
        }).$returningId();
        inserted.push(result.id);

        if (input.tagIds && input.tagIds.length > 0) {
          await db.insert(questionBankTagMap).values(input.tagIds.map(tagId => ({ questionId: result.id, tagId })));
        }
      }

      return { inserted: inserted.length, ids: inserted, folderId: resolvedFolderId };
    }),

  // ─── Import bank questions into a quiz ────────────────────────────────────

  importToQuiz: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      questionIds: z.array(z.number().int()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const questions = await db.select().from(questionBank)
        .where(inArray(questionBank.id, input.questionIds));

      // Get current max position in quiz
      const [maxPos] = await db.select({ maxPos: sql<number>`COALESCE(MAX(position), -1)` })
        .from(lmsQuizQuestions)
        .where(eq(lmsQuizQuestions.quizId, input.quizId));
      let pos = Number(maxPos?.maxPos ?? -1) + 1;

      for (const q of questions) {
        // Parse options from bank format [{text,imageUrl?,videoUrl?}] → string array for quiz
        let opts: string[] | null = null;
        if (q.options) {
          try {
            const parsed = JSON.parse(q.options);
            opts = Array.isArray(parsed) ? parsed.map((o: any) => (typeof o === "string" ? o : o.text ?? "")) : null;
          } catch { opts = null; }
        }
        await db.insert(lmsQuizQuestions).values({
          quizId: input.quizId,
          question: q.question,
          type: q.type,
          options: opts ? JSON.stringify(opts) : null,
          correctAnswer: (q as any).correctAnswer ?? "",
          correctAnswers: (q as any).correctAnswers ?? null,
          hotspotMarkers: (q as any).hotspotMarkers ?? null,
          matchingPairs: (q as any).matchingPairs ?? null,
          explanation: (q as any).explanation ?? null,
          questionImageUrl: (q as any).questionImageUrl ?? null,
          questionVideoUrl: (q as any).questionVideoUrl ?? null,
          feedbackImageUrl: (q as any).feedbackImageUrl ?? null,
          feedbackVideoUrl: (q as any).feedbackVideoUrl ?? null,
          position: pos++,
        } as any);
      }

      return { imported: questions.length };
    }),

  // ─── Sync: save a quiz question to the bank ───────────────────────────────

  syncQuizQuestionToBank: protectedProcedure
    .input(z.object({
      quizQuestionId: z.number(),
      tagIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [qq] = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.id, input.quizQuestionId)).limit(1);
      if (!qq) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if already synced
      const [existing] = await db.select({ id: questionBank.id })
        .from(questionBank)
        .where(eq(questionBank.sourceQuizQuestionId, qq.id))
        .limit(1);
      if (existing) return { id: existing.id, alreadyExisted: true };

      // Parse options from string[] to [{text}] format
      let opts: string | null = null;
      if (qq.options) {
        try {
          const parsed = JSON.parse(qq.options);
          opts = JSON.stringify(Array.isArray(parsed) ? parsed.map((o: string) => ({ text: o })) : []);
        } catch { opts = null; }
      }

      const [result] = await db.insert(questionBank).values({
        question: qq.question,
        type: qq.type,
        options: opts,
        correctAnswer: qq.correctAnswer ?? "",
        correctAnswers: (qq as any).correctAnswers ?? null,
        hotspotMarkers: (qq as any).hotspotMarkers ?? null,
        matchingPairs: (qq as any).matchingPairs ?? null,
        explanation: qq.explanation ?? null,
        questionImageUrl: (qq as any).questionImageUrl ?? null,
        questionVideoUrl: (qq as any).questionVideoUrl ?? null,
        feedbackImageUrl: (qq as any).feedbackImageUrl ?? null,
        feedbackVideoUrl: (qq as any).feedbackVideoUrl ?? null,
        sourceQuizId: qq.quizId,
        sourceQuizQuestionId: qq.id,
        createdByAdminId: ctx.user.id,
      } as any).$returningId();

      if (input.tagIds && input.tagIds.length > 0) {
        await db.insert(questionBankTagMap).values(input.tagIds.map(tagId => ({ questionId: result.id, tagId })));
      }

      return { id: result.id, alreadyExisted: false };
    }),

  // ─── iSpring SCORM Quiz Import ────────────────────────────────────────────

  /**
   * previewScormImport — download and parse a SCORM ZIP from the media library,
   * return a preview of groups + questions WITHOUT writing to the DB.
   * The admin can review and then call confirmScormImport to commit.
   */
  previewScormImport: protectedProcedure
    .input(z.object({ mediaAssetId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the asset + latest version
      const [asset] = await db
        .select({ id: mediaAssets.id, title: mediaAssets.title, slug: mediaAssets.slug, mediaType: mediaAssets.mediaType })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, input.mediaAssetId))
        .limit(1);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Media asset not found" });

      const [version] = await db
        .select({ s3Url: mediaVersions.s3Url })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.mediaAssetId))
        .orderBy(sql`${mediaVersions.versionNumber} DESC`)
        .limit(1);
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "No version found for this asset" });

      // Download the ZIP to a temp buffer
      const zipBuffer = await downloadToBuffer(version.s3Url);

      // Parse the iSpring quiz
      let parsed;
      try {
        parsed = await parseISpringQuizFromBuffer(zipBuffer);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Not a valid iSpring quiz: ${e.message}` });
      }

      return {
        assetTitle: asset.title,
        quizTitle: parsed.title,
        groups: parsed.groups.map(g => ({
          id: g.id,
          name: g.name,
          questionCount: g.questions.length,
          questions: g.questions.map(q => ({
            id: q.id,
            type: q.type,
            ispringType: q.ispringType,
            questionText: q.questionText,
            questionHtml: q.questionHtml,
            answers: q.answers.map(a => ({ text: a.text, html: a.html, isCorrect: a.isCorrect })),
            correctAnswer: q.correctAnswer,
            explanationText: q.explanationText,
            explanationHtml: q.explanationHtml,
          })),
        })),
        totalQuestions: parsed.groups.reduce((sum, g) => sum + g.questions.length, 0),
      };
    }),

  /**
   * confirmScormImport — commit the parsed quiz to the question bank.
   * Creates one tag per iSpring group (or reuses existing tag with same name).
   * Each question is inserted with its group tag attached.
   * Returns counts of inserted questions per group.
   */
  confirmScormImport: protectedProcedure
    .input(z.object({
      mediaAssetId: z.number().int().optional(),
      /** Direct upload from Quiz Creator — base64-encoded .quiz/.zip bytes */
      bufferBase64: z.string().optional(),
      groupIds: z.array(z.string()).optional(),
      extraTagIds: z.array(z.number().int()).optional(),
      groupPrefix: z.string().optional(),
      folderId: z.number().int().optional(),
      newFolderName: z.string().max(200).optional(),
    }).refine(
      (v) => (v.mediaAssetId != null && v.mediaAssetId > 0) || !!v.bufferBase64?.length,
      { message: "Provide mediaAssetId or bufferBase64 for SCORM import" }
    ))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const zipBuffer = await resolveScormZipBuffer(input);
      let parsed;
      try {
        parsed = await parseISpringQuizFromBuffer(zipBuffer);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Not a valid iSpring quiz: ${e.message}` });
      }

      const AdmZip = (await import("adm-zip")).default;
      const zipEntries = new AdmZip(zipBuffer).getEntries();
      const imageMap = await uploadISpringImagesFromZip(zipEntries, parsed.allImageRefs);

      let resolvedFolderId: number | null = null;
      if (input.newFolderName?.trim()) {
        const [newFolder] = await db.insert(questionBankFolders).values({
          name: input.newFolderName.trim(),
          color: "#179ca3",
          createdByAdminId: ctx.user.id,
        }).$returningId();
        resolvedFolderId = newFolder.id;
      } else if (input.folderId) {
        resolvedFolderId = input.folderId;
      }

      const groups = input.groupIds && input.groupIds.length > 0
        ? parsed.groups.filter(g => input.groupIds!.includes(g.id))
        : parsed.groups;

      const results: { groupName: string; inserted: number; tagId: number }[] = [];
      const questionBankIds: number[] = [];

      for (const group of groups) {
        const rawName = group.name.trim();
        const tagName = input.groupPrefix ? `${input.groupPrefix.trim()}_${rawName}` : rawName;
        let tagId: number;
        const [existingTag] = await db
          .select({ id: questionBankTags.id })
          .from(questionBankTags)
          .where(eq(questionBankTags.name, tagName))
          .limit(1);
        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const [newTag] = await db.insert(questionBankTags).values({
            name: tagName,
            color: "#179ca3",
          }).$returningId();
          tagId = newTag.id;
        }

        const allTagIds = [tagId, ...(input.extraTagIds ?? [])];
        let inserted = 0;

        for (const q of group.questions) {
          const questionText = rewriteStorageRefs(q.questionHtml || q.questionText, imageMap);
          const options = q.answers.map(a => ({
            text: rewriteStorageRefs(a.html || a.text, imageMap),
            ...(a.imageRef ? { imageUrl: imageMap.get(a.imageRef) ?? a.imageRef } : {}),
          }));
          const explanation = rewriteStorageRefs(q.explanationHtml || q.explanationText || "", imageMap) || null;

          const [result] = await db.insert(questionBank).values({
            question: questionText,
            type: q.type,
            options: JSON.stringify(options),
            correctAnswer: q.correctAnswer,
            explanation,
            folderId: resolvedFolderId,
            createdByAdminId: ctx.user.id,
          }).$returningId();

          await db.insert(questionBankTagMap).values(
            allTagIds.map(tid => ({ questionId: result.id, tagId: tid }))
          );

          questionBankIds.push(result.id);
          inserted++;
        }

        results.push({ groupName: tagName, inserted, tagId });
      }

      const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
      return { results, totalInserted, questionBankIds };
    }),

  // ─── Folder CRUD ─────────────────────────────────────────────────────────────

  listFolders: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const folders = await db.select().from(questionBankFolders).orderBy(asc(questionBankFolders.name));
      // Get question count per folder
      const counts = await db
        .select({ folderId: questionBank.folderId, count: sql<number>`COUNT(*)` })
        .from(questionBank)
        .where(sql`${questionBank.folderId} IS NOT NULL`)
        .groupBy(questionBank.folderId);
      const countMap = Object.fromEntries(counts.map(c => [c.folderId, Number(c.count)]));
      return folders.map(f => ({ ...f, questionCount: countMap[f.id] ?? 0 }));
    }),

  createFolder: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      parentId: z.number().int().optional(),
      color: z.string().max(32).default("#179ca3"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(questionBankFolders).values({
        name: input.name,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        color: input.color,
        createdByAdminId: ctx.user.id,
      }).$returningId();
      return { id: result.id };
    }),

  updateFolder: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(500).optional(),
      color: z.string().max(32).optional(),
      parentId: z.number().int().nullable().optional(),
      sharedInSonoQuiz: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(questionBankFolders).set(rest).where(eq(questionBankFolders.id, id));
      return { ok: true };
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Unset folder_id on questions in this folder
      await db.update(questionBank).set({ folderId: null }).where(eq(questionBank.folderId, input.id));
      await db.delete(questionBankFolders).where(eq(questionBankFolders.id, input.id));
      return { ok: true };
    }),

  /** List folders shared into SonoQuiz (for SonoQuizCreator to use as quiz sources) */
  listSonoQuizSharedFolders: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const folders = await db
        .select()
        .from(questionBankFolders)
        .where(eq(questionBankFolders.sharedInSonoQuiz, true))
        .orderBy(asc(questionBankFolders.name));
      // For each folder, count questions
      const counts = await Promise.all(folders.map(async (f) => {
        const [{ cnt }] = await db
          .select({ cnt: sql<number>`COUNT(*)` })
          .from(questionBank)
          .where(eq(questionBank.folderId, f.id));
        return { ...f, questionCount: Number(cnt) };
      }));
      return counts;
    }),
  moveToFolder: protectedProcedure
    .input(z.object({
      questionIds: z.array(z.number().int()).min(1),
      folderId: z.number().int().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(questionBank)
        .set({ folderId: input.folderId })
        .where(inArray(questionBank.id, input.questionIds));
      return { moved: input.questionIds.length };
    }),

  /**
   * listMediaLibraryQuizFiles — browse media library assets that are SCORM/ZIP files
   * so admins can import questions directly from already-uploaded packages.
   */
  listMediaLibraryQuizFiles: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const searchFilter = input.search?.trim()
        ? or(
            like(mediaAssets.title, `%${input.search.trim()}%`),
            like(mediaAssets.folder, `%${input.search.trim()}%`),
          )
        : undefined;
      const typeFilter = or(
        eq(mediaAssets.mediaType, "scorm"),
        eq(mediaAssets.mediaType, "zip"),
        eq(mediaAssets.mediaType, "lms"),
      );
      const whereClause = searchFilter
        ? and(typeFilter, searchFilter, sql`${mediaAssets.deletedAt} IS NULL`)
        : and(typeFilter, sql`${mediaAssets.deletedAt} IS NULL`);
      const assets = await db
        .select({
          id: mediaAssets.id,
          slug: mediaAssets.slug,
          title: mediaAssets.title,
          mediaType: mediaAssets.mediaType,
          folder: mediaAssets.folder,
          thumbnailUrl: mediaAssets.thumbnailUrl,
          createdAt: mediaAssets.createdAt,
        })
        .from(mediaAssets)
        .where(whereClause)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      // Enrich each asset with its latest version's file metadata
      const enriched = await Promise.all(assets.map(async (asset) => {
        const [version] = await db
          .select({
            fileName: mediaVersions.fileName,
            fileSize: mediaVersions.fileSize,
            mimeType: mediaVersions.mimeType,
          })
          .from(mediaVersions)
          .where(eq(mediaVersions.assetId, asset.id))
          .orderBy(desc(mediaVersions.versionNumber))
          .limit(1);
        const fileName = version?.fileName ?? null;
        const isQuizFile =
          fileName?.toLowerCase().endsWith(".quiz") ||
          version?.mimeType?.includes("quiz") ||
          false;
        return {
          ...asset,
          fileName,
          fileSize: version?.fileSize ?? null,
          mimeType: version?.mimeType ?? null,
          isQuizFile,
        };
      }));
      return enriched;
    }),
});

// ─── Download helper ──────────────────────────────────────────────────────────

async function resolveScormZipBuffer(input: {
  mediaAssetId?: number;
  bufferBase64?: string;
}): Promise<Buffer> {
  if (input.bufferBase64) {
    const buf = Buffer.from(input.bufferBase64, "base64");
    if (!buf.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "SCORM file data is empty" });
    }
    return buf;
  }

  if (!input.mediaAssetId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No SCORM source provided" });
  }

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  const [version] = await db
    .select({ s3Url: mediaVersions.s3Url })
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, input.mediaAssetId))
    .orderBy(sql`${mediaVersions.versionNumber} DESC`)
    .limit(1);
  if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "No version found for this asset" });

  return downloadToBuffer(version.s3Url);
}

async function downloadToBuffer(storedUrl: string): Promise<Buffer> {
  // storedUrl may be a storage-proxy URL that requires auth.
  // Extract the relative key from the URL and get a fresh presigned download URL.
  let downloadUrl = storedUrl;
  try {
    const u = new URL(storedUrl);
    // If this is a storage proxy URL, use storageGet to get a fresh presigned URL
    const pathParam = u.searchParams.get("path");
    const relKey = pathParam ?? u.pathname.replace(/^\/+/, "");
    if (relKey) {
      const { url } = await storageGet(relKey);
      downloadUrl = url;
    }
  } catch {
    // If URL parsing fails, try the original URL directly
  }

  return new Promise((resolve, reject) => {
    const follow = (targetUrl: string, redirects = 0): void => {
      if (redirects > 10) { reject(new Error("Too many redirects")); return; }
      const proto = targetUrl.startsWith("https") ? https : http;
      proto.get(targetUrl, (res) => {
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
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (buf.length === 0) {
            reject(new Error("Downloaded file is empty — the file may not be accessible"));
            return;
          }
          resolve(buf);
        });
        res.on("error", reject);
      }).on("error", reject);
    };
    try {
      const u = new URL(downloadUrl);
      u.pathname = u.pathname.split("/").map(p => encodeURIComponent(decodeURIComponent(p))).join("/");
      follow(u.toString());
    } catch {
      follow(downloadUrl);
    }
  });
}
