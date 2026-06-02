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
  questionBankTags,
  questionBankTagMap,
  lmsQuizQuestions,
  users,
  mediaAssets,
  mediaVersions,
} from "../../drizzle/schema";
import { parseISpringQuizFromBuffer } from "../lib/iSpringQuizParser";
import { storagePut } from "../storage";
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
  type: z.enum(["mcq", "truefalse"]).default("mcq"),
  options: z.array(z.object({
    text: z.string(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
  })).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  questionImageUrl: z.string().optional(),
  questionVideoUrl: z.string().optional(),
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
      type: z.enum(["mcq", "truefalse"]).optional(),
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
      return { ...q, options: q.options ? JSON.parse(q.options) : [], tags: tagRows.map(r => r.tag) };
    }),

  createQuestion: protectedProcedure
    .input(questionInput)
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { tagIds, options, ...rest } = input;
      const [result] = await db.insert(questionBank).values({
        ...rest,
        options: options ? JSON.stringify(options) : null,
        createdByAdminId: ctx.user.id,
      }).$returningId();
      if (tagIds && tagIds.length > 0) {
        await db.insert(questionBankTagMap).values(tagIds.map(tagId => ({ questionId: result.id, tagId })));
      }
      return { id: result.id };
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.number(),
      question: z.string().min(1).optional(),
      type: z.enum(["mcq", "truefalse"]).optional(),
      options: z.array(z.object({ text: z.string(), imageUrl: z.string().optional(), videoUrl: z.string().optional() })).optional(),
      correctAnswer: z.string().optional(),
      explanation: z.string().optional(),
      questionImageUrl: z.string().nullable().optional(),
      questionVideoUrl: z.string().nullable().optional(),
      tagIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, tagIds, options, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (options !== undefined) updates.options = JSON.stringify(options);
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

      const inserted: number[] = [];
      for (const q of questions) {
        const opts = Array.isArray(q.options) ? q.options.map((o: string) => ({ text: o })) : [];
        const [result] = await db.insert(questionBank).values({
          question: q.question,
          type: q.type === "truefalse" ? "truefalse" : "mcq",
          options: opts.length > 0 ? JSON.stringify(opts) : null,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? null,
          createdByAdminId: ctx.user.id,
        }).$returningId();
        inserted.push(result.id);
        if (input.tagIds && input.tagIds.length > 0) {
          await db.insert(questionBankTagMap).values(input.tagIds.map(tagId => ({ questionId: result.id, tagId })));
        }
      }

      return { inserted: inserted.length, ids: inserted };
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
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? null,
          position: pos++,
        });
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
        correctAnswer: qq.correctAnswer,
        explanation: qq.explanation ?? null,
        sourceQuizId: qq.quizId,
        sourceQuizQuestionId: qq.id,
        createdByAdminId: ctx.user.id,
      }).$returningId();

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
      mediaAssetId: z.number().int(),
      /** Optional: override which groups to import (all if omitted) */
      groupIds: z.array(z.string()).optional(),
      /** Optional: additional tag IDs to attach to all imported questions */
      extraTagIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the latest version URL
      const [version] = await db
        .select({ s3Url: mediaVersions.s3Url })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, input.mediaAssetId))
        .orderBy(sql`${mediaVersions.versionNumber} DESC`)
        .limit(1);
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "No version found for this asset" });

      const zipBuffer = await downloadToBuffer(version.s3Url);
      let parsed;
      try {
        parsed = await parseISpringQuizFromBuffer(zipBuffer);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Not a valid iSpring quiz: ${e.message}` });
      }

      // Filter groups if requested
      const groups = input.groupIds && input.groupIds.length > 0
        ? parsed.groups.filter(g => input.groupIds!.includes(g.id))
        : parsed.groups;

      const results: { groupName: string; inserted: number; tagId: number }[] = [];

      for (const group of groups) {
        // Find or create a tag for this group
        const tagName = group.name.trim();
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

        // All tag IDs for this group's questions
        const allTagIds = [tagId, ...(input.extraTagIds ?? [])];

        let inserted = 0;
        for (const q of group.questions) {
          // Use HTML for question text to preserve iSpring formatting
          const questionText = q.questionHtml || q.questionText;

          // Build options array — use HTML for rich rendering
          const options = q.answers.map(a => ({
            text: a.html || a.text,
            ...(a.imageRef ? { imageUrl: a.imageRef } : {}),
          }));

          // correctAnswer: use plain text for matching
          const correctAnswer = q.correctAnswer;

          const [result] = await db.insert(questionBank).values({
            question: questionText,
            type: q.type,
            options: JSON.stringify(options),
            correctAnswer,
            explanation: q.explanationHtml || q.explanationText || null,
            createdByAdminId: ctx.user.id,
          }).$returningId();

          // Attach all tags
          await db.insert(questionBankTagMap).values(
            allTagIds.map(tid => ({ questionId: result.id, tagId: tid }))
          );

          inserted++;
        }

        results.push({ groupName: tagName, inserted, tagId });
      }

      const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
      return { results, totalInserted };
    }),
});

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadToBuffer(url: string): Promise<Buffer> {
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
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    };
    try {
      const u = new URL(url);
      u.pathname = u.pathname.split("/").map(p => encodeURIComponent(decodeURIComponent(p))).join("/");
      follow(u.toString());
    } catch {
      follow(url);
    }
  });
}
