/**
 * lmsQuizLandingRouter.ts
 * All About Ultrasound™ LMS — Quiz Builder + Landing Pages (admin)
 * Auto-extracted from lmsRouter.ts to reduce file size and fix TypeScript OOM.
 */

/**
 * lmsRouter.ts
 * All About Ultrasound™ LMS — LMS Management
 *
 * Sub-routers:
 *   lmsPublic   — public course catalog, landing pages, instructor profiles
 *   lmsLearner  — enrollment, progress, quiz submission (protected)
 *   lmsAdmin    — full course/quiz/section/lesson CRUD, enrollment mgmt (admin only)
 *   lmsGroup    — group manager seat assignment (group_manager role)
 *   lmsAffiliate — affiliate tracking
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql, asc, isNotNull, max, inArray, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb, getOrCreateAccessToken } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { sendCertificateEmail } from "../lib/certificateEmail";
import { sendEnrollmentEmail } from "../lib/enrollmentEmail";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
import {
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsQuizzes,
  lmsQuizQuestions,
  lmsEnrollments,
  lmsLessonProgress,
  lmsGroups,
  lmsGroupSeats,
  lmsInstructors,
  lmsCourseInstructors,
  lmsAffiliates,
  lmsAffiliateConversions,
  lmsLandingPages,
  lmsPageTemplates,
  lmsOrders,
  lmsCertificates,
  lmsLessonNotes,
  lmsLessonBookmarks,
  lmsCollections,
  lmsCollectionCourses,
  users,
  mediaAssets,
  mediaVersions,
  lmsPricingOptions,
  platformSettings,
  digitalProducts,
  lmsThinkificImports,
  lmsArchive,
  sonoQuizzes,
  physicalProducts,
  lmsCertificateTemplates,
  orderBumps,
  freePreviewEnrollments,
  lmsSectionTemplates,
  lessonTemplates,
  lmsCohortSessions,
  lmsCohortAssignments,
  lmsCohortRecordings,
  lmsCohortSubmissions,
  mediaUploadFolders,
  mediaUploadResponses,
  lmsQuizQuestionGroups,
  lmsQuizGroupQuestions,
  questionBank,
} from "../../drizzle/schema";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled } from "./lmsHelpers";

export const lmsQuizLandingRouter = router({
  // ── Quizzes ──
  getQuiz: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      // Auto-create a quiz record if none exists for this lesson
      if (!quiz) {
        const [lesson] = await db.select({ title: lmsLessons.title }).from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
        const [result] = await db.insert(lmsQuizzes).values({
          lessonId: input.lessonId,
          title: lesson?.title ?? "Quiz",
          passingScore: 70,
          allowRetakes: true,
          showCorrectAnswers: true,
        }).$returningId();
        [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.id, result.id)).limit(1);
      }
      if (!quiz) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create quiz" });
      const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id)).orderBy(asc(lmsQuizQuestions.position));
      return { ...quiz, questions };
    }),

  updateQuiz: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      passingScore: z.number().int().min(0).max(100).optional(),
      allowRetakes: z.boolean().optional(),
      showCorrectAnswers: z.boolean().optional(),
      requirePassingToProgress: z.boolean().optional(),
      randomizeQuestions: z.boolean().optional(),
      randomizeAnswers: z.boolean().optional(),
      showGroupNames: z.boolean().optional(),
      showPerQuestionResult: z.boolean().optional(),
      showOnlyPercentage: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lessonId, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length > 0) await db.update(lmsQuizzes).set(filtered).where(eq(lmsQuizzes.lessonId, lessonId));
      return { success: true };
    }),

  addQuestion: protectedProcedure
    .input(z.object({
      quizId: z.number(), question: z.string().min(1),
      type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]).default("mcq"),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().optional(),
      correctAnswers: z.array(z.number().int()).optional(),
      hotspotMarkers: z.string().optional(),
      matchingPairs: z.string().optional(),
      explanation: z.string().optional(),
      questionImageUrl: z.string().optional(),
      questionVideoUrl: z.string().optional(),
      feedbackImageUrl: z.string().optional(),
      feedbackVideoUrl: z.string().optional(),
      position: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { options, correctAnswers, ...rest } = input;
      const [result] = await db.insert(lmsQuizQuestions).values({
        ...rest,
        correctAnswer: rest.correctAnswer ?? "",
        options: options ? JSON.stringify(options) : null,
        correctAnswers: correctAnswers ? JSON.stringify(correctAnswers) : null,
        explanation: rest.explanation ?? null,
      } as any).$returningId();
      return { id: result.id };
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.number(), question: z.string().min(1).optional(),
      type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]).optional(),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().nullable().optional(),
      correctAnswers: z.array(z.number().int()).nullable().optional(),
      hotspotMarkers: z.string().nullable().optional(),
      matchingPairs: z.string().nullable().optional(),
      explanation: z.string().nullable().optional(),
      questionImageUrl: z.string().nullable().optional(),
      questionVideoUrl: z.string().nullable().optional(),
      feedbackImageUrl: z.string().nullable().optional(),
      feedbackVideoUrl: z.string().nullable().optional(),
      position: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, options, correctAnswers, ...rest } = input;
      const updates: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (options !== undefined) updates.options = JSON.stringify(options);
      if (correctAnswers !== undefined) updates.correctAnswers = correctAnswers ? JSON.stringify(correctAnswers) : null;
      if (Object.keys(updates).length > 0) await db.update(lmsQuizQuestions).set(updates as any).where(eq(lmsQuizQuestions.id, id));
      return { success: true };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsQuizQuestions).where(eq(lmsQuizQuestions.id, input.id));
      return { success: true };
    }),

  aiGenerateQuizQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      topic: z.string().min(1).max(500),
      count: z.number().int().min(1).max(50).default(10),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
      questionType: z.enum(["mcq", "truefalse", "mixed"]).default("mcq"),
      courseId: z.number().optional(),
      lessonIds: z.array(z.number()).optional(), // specific lesson IDs to extract content from
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Build course/lesson context for AI
      let courseContext = "";
      try {
        if (input.lessonIds && input.lessonIds.length > 0) {
          // Extract content from specific selected lessons
          const selectedLessons = await db
            .select({ title: lmsLessons.title, content: lmsLessons.content, contentBlocks: lmsLessons.contentBlocks })
            .from(lmsLessons)
            .where(inArray(lmsLessons.id, input.lessonIds));
          const lessonTexts = selectedLessons.map(l => {
            let text = `Lesson: ${l.title}`;
            if (l.content) text += `\nContent: ${l.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500)}`;
            if (l.contentBlocks) {
              try {
                const blocks = JSON.parse(l.contentBlocks);
                const blockText = blocks
                  .filter((b: any) => b.type === "rich_text" || b.type === "text")
                  .map((b: any) => (b.data?.content ?? b.data?.text ?? "").replace(/<[^>]+>/g, " ").trim())
                  .join(" ");
                if (blockText) text += `\nBlock content: ${blockText.slice(0, 1500)}`;
              } catch { /* ignore */ }
            }
            return text;
          });
          courseContext = `\n\nLesson content to base questions on:\n${lessonTexts.join("\n---\n")}\n\nGenerate questions that test understanding of the specific content above.`;
        } else if (input.courseId) {
          const [course] = await db
            .select({ title: lmsCourses.title, description: lmsCourses.description })
            .from(lmsCourses)
            .where(eq(lmsCourses.id, input.courseId))
            .limit(1);
          if (course) {
            const sections = await db
              .select({ title: lmsSections.title })
              .from(lmsSections)
              .where(eq(lmsSections.courseId, input.courseId))
              .orderBy(asc(lmsSections.position));
            const lessons = await db
              .select({ title: lmsLessons.title })
              .from(lmsLessons)
              .where(eq(lmsLessons.courseId, input.courseId))
              .orderBy(asc(lmsLessons.position));
            courseContext = `\n\nCourse context for question generation:\nCourse: "${course.title}"\nDescription: ${course.description ?? "N/A"}\nModules: ${sections.map(s => s.title).join(", ") || "N/A"}\nLessons: ${lessons.map(l => l.title).join(", ") || "N/A"}\n\nUse this course content to make questions directly relevant to what students are learning.`;
          }
        }
      } catch {
        // Ignore context fetch errors — proceed without course context
      }

      const typeInstruction =
        input.questionType === "mcq"
          ? "All questions must be multiple-choice with exactly 4 options."
          : input.questionType === "truefalse"
          ? 'All questions must be true/false. Options must be exactly ["True", "False"].'
          : 'Mix of multiple-choice (4 options each) and true/false questions (["True", "False"] options).';

      const systemPrompt = `You are a medical education expert specializing in ultrasound and sonography. Generate high-quality quiz questions for healthcare professionals and students. Always use United States English spelling. Return ONLY valid JSON — no markdown, no code fences, no extra text.`;

      const userPrompt = `Generate exactly ${input.count} quiz questions about: "${input.topic}".
Difficulty: ${input.difficulty}.
${typeInstruction}${courseContext}

Return a JSON array of objects with this exact shape:
[
  {
    "question": "string — the question text",
    "type": "mcq" | "truefalse",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "string — must exactly match one of the options",
    "explanation": "string — brief explanation of why the answer is correct (1-2 sentences)"
  }
]

Rules:
- Questions must be clinically accurate and relevant to ultrasound/sonography practice
- Each question must be distinct and test a different concept
- correctAnswer must exactly match one of the options (case-sensitive)
- For truefalse, options must be exactly ["True", "False"]
- For mcq, provide exactly 4 options
- Explanations should cite relevant anatomy, physics, or clinical guidelines where appropriate`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "quiz_questions",
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
        },
      });

      let questions: Array<{ question: string; type: string; options: string[]; correctAnswer: string; explanation: string }>;
      try {
        const raw = response.choices[0].message.content as string;
        const parsed = extractJson(raw);
        questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions)) throw new Error("Not an array");
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON. Please try again." });
      }

      return { questions };
    }),

  bulkInsertQuizQuestions: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      questions: z.array(z.object({
        question: z.string().min(1),
        type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]),
        options: z.array(z.string()).optional(),
        correctAnswer: z.string().optional(),
        correctAnswers: z.array(z.number().int()).optional(),
        hotspotMarkers: z.string().optional(),
        matchingPairs: z.string().optional(),
        explanation: z.string().optional(),
        questionImageUrl: z.string().optional(),
        questionVideoUrl: z.string().optional(),
        feedbackImageUrl: z.string().optional(),
        feedbackVideoUrl: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get current max position
      const existing = await db.select({ pos: lmsQuizQuestions.position })
        .from(lmsQuizQuestions)
        .where(eq(lmsQuizQuestions.quizId, input.quizId))
        .orderBy(desc(lmsQuizQuestions.position))
        .limit(1);
      let nextPos = existing.length > 0 ? (existing[0].pos ?? 0) + 1 : 0;

      for (const q of input.questions) {
        const { options, correctAnswers, ...rest } = q;
        await db.insert(lmsQuizQuestions).values({
          quizId: input.quizId,
          ...rest,
          correctAnswer: rest.correctAnswer ?? "",
          options: options ? JSON.stringify(options) : null,
          correctAnswers: correctAnswers ? JSON.stringify(correctAnswers) : null,
          explanation: rest.explanation ?? null,
          position: nextPos++,
        } as any);
      }

      return { inserted: input.questions.length };
    }),

  // ── Landing Pages ──
  updateLandingPage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      heroTitle: z.string().optional(), heroSubtitle: z.string().optional(),
      heroImageUrl: z.string().optional(), bodyContent: z.string().optional(),
      ctaText: z.string().optional(), whatYouLearn: z.string().optional(),
      requirements: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...updates } = input;
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      const [existing] = await db.select({ id: lmsLandingPages.id }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages).set({ ...filtered, isCustom: true }).where(eq(lmsLandingPages.courseId, courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId, ...filtered, isCustom: true });
      }
      return { success: true };
    }),

  // ── Landing Page Blocks (page builder) ──
  getLandingPageBlocks: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lp] = await db.select({
        blocks: lmsLandingPages.blocks,
        heroTitle: lmsLandingPages.heroTitle,
        heroSubtitle: lmsLandingPages.heroSubtitle,
        heroImageUrl: lmsLandingPages.heroImageUrl,
        ctaText: lmsLandingPages.ctaText,
        seoTitle: lmsLandingPages.seoTitle,
        seoDescription: lmsLandingPages.seoDescription,
        seoImage: lmsLandingPages.seoImage,
      }).from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      const [course] = await db.select({
        title: lmsCourses.title,
        slug: lmsCourses.slug,
        coverImageUrl: lmsCourses.coverImageUrl,
        subtitle: lmsCourses.subtitle,
        price: lmsCourses.price,
        metaTitle: lmsCourses.metaTitle,
        metaDescription: lmsCourses.metaDescription,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      const parsedBlocks = lp?.blocks ? (() => { try { return JSON.parse(lp.blocks); } catch(e) { console.error('[getLandingPageBlocks] JSON parse error:', e); return null; } })() : null;

      return {
        blocks: parsedBlocks,
        heroTitle: lp?.heroTitle ?? course?.title ?? "",
        heroSubtitle: lp?.heroSubtitle ?? course?.subtitle ?? "",
        heroImageUrl: lp?.heroImageUrl ?? course?.coverImageUrl ?? "",
        ctaText: lp?.ctaText ?? "Enroll Now",
        courseTitle: course?.title ?? "",
        courseSlug: course?.slug ?? "",
        coursePrice: course?.price ?? 0,
        // Per-page SEO overrides (null = no override set)
        seoTitle: lp?.seoTitle ?? null,
        seoDescription: lp?.seoDescription ?? null,
        seoImage: lp?.seoImage ?? null,
        // Course settings-page SEO defaults (auto-populate when no override)
        defaultSeoTitle: course?.metaTitle ?? course?.title ?? "",
        defaultSeoDescription: course?.metaDescription ?? course?.subtitle ?? "",
        defaultSeoImage: course?.coverImageUrl ?? "",
      };
    }),
  saveLandingPageBlocks: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      blocks: z.array(z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const blocksJson = JSON.stringify(input.blocks);
      const [existing] = await db.select({ id: lmsLandingPages.id })
        .from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages)
          .set({ blocks: blocksJson, isCustom: true })
          .where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, blocks: blocksJson, isCustom: true });
      }
      // Auto-enable group purchase on courses linked via group_purchase CTA action
      const courseIdsToEnableGroup = new Set<number>();
      const collectGroupCourseIds = (blocks: any[]) => {
        for (const block of blocks) {
          const checkBehavior = (behavior: string | undefined, productType: string | undefined, productId: number | undefined) => {
            if (behavior === "group_purchase" && productType === "course" && productId) {
              courseIdsToEnableGroup.add(productId);
            }
          };
          checkBehavior(block.heroBehavior, block.heroCheckoutProductType, block.heroCheckoutProductId);
          checkBehavior(block.ctaBehavior, block.checkoutProductType, block.checkoutProductId);
          checkBehavior(block.linkBehavior, block.linkCheckoutProductType, block.linkCheckoutProductId);
          if (Array.isArray(block.buttons)) {
            for (const btn of block.buttons) {
              checkBehavior(btn.behavior, btn.checkoutProductType, btn.checkoutProductId);
            }
          }
          if (Array.isArray(block.products)) {
            for (const p of block.products) {
              checkBehavior(p.ctaBehavior, p.checkoutProductType, p.checkoutProductId);
            }
          }
          // Recurse into column blocks
          if (Array.isArray(block.leftBlocks)) collectGroupCourseIds(block.leftBlocks);
          if (Array.isArray(block.rightBlocks)) collectGroupCourseIds(block.rightBlocks);
        }
      };
      collectGroupCourseIds(input.blocks);
      for (const cid of courseIdsToEnableGroup) {
        await db.update(lmsCourses).set({ allowGroupPurchase: true }).where(eq(lmsCourses.id, cid));
      }
      return { success: true };
    }),
  // ── Save Landing Page SEO / Link Preview ──
  saveLandingPageSeo: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      seoTitle: z.string().nullable().optional(),
      seoDescription: z.string().nullable().optional(),
      seoImage: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { courseId, ...seoData } = input;
      const [existing] = await db.select({ id: lmsLandingPages.id })
        .from(lmsLandingPages).where(eq(lmsLandingPages.courseId, courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages)
          .set(seoData)
          .where(eq(lmsLandingPages.courseId, courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId, ...seoData, isCustom: false });
      }
      return { success: true };
    }),

  // ── AI Generate Landing Page ──
  aiGenerateLandingPage: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Gather course data
      const [course] = await db.select({
        id: lmsCourses.id,
        title: lmsCourses.title,
        subtitle: lmsCourses.subtitle,
        description: lmsCourses.description,
        type: lmsCourses.type,
        price: lmsCourses.price,
        coverImageUrl: lmsCourses.coverImageUrl,
        slug: lmsCourses.slug,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      // Get sections and published lessons
      const sections = await db.select({ id: lmsSections.id, title: lmsSections.title })
        .from(lmsSections).where(eq(lmsSections.courseId, input.courseId)).orderBy(asc(lmsSections.position));
      const lessons = await db.select({ title: lmsLessons.title, type: lmsLessons.type, sectionId: lmsLessons.sectionId })
        .from(lmsLessons)
        .where(and(eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.lessonStatus, "published")))
        .orderBy(asc(lmsLessons.position));

      // Get pricing
      const pricing = await db.select({ label: lmsPricingOptions.label, price: lmsPricingOptions.price, pricingType: lmsPricingOptions.pricingType, subscriptionInterval: lmsPricingOptions.subscriptionInterval })
        .from(lmsPricingOptions).where(and(eq(lmsPricingOptions.courseId, input.courseId), eq(lmsPricingOptions.isActive, true))).limit(5);

      const typeLabel = course.type === "download" ? "digital download" : course.type === "quiz" ? "quiz" : "course";
      const curriculumText = sections.length > 0
        ? sections.map(s => {
            const sLessons = lessons.filter(l => l.sectionId === s.id);
            return `Section: ${s.title}\n${sLessons.map(l => `  - ${l.title} (${l.type})`).join("\n")}`;
          }).join("\n")
        : lessons.map(l => `- ${l.title} (${l.type})`).join("\n");
      const pricingText = pricing.length > 0
        ? pricing.map(p => `${p.label ?? "Option"}: $${Number(p.price ?? 0).toFixed(2)}${p.subscriptionInterval ? "/" + p.subscriptionInterval : ""} (${p.pricingType ?? "one_time"})`).join(", ")
        : course.price ? `$${Number(course.price).toFixed(2)}` : "Free";

      const systemPrompt = `You are an expert landing page designer for online ${typeLabel}s. Generate a complete, compelling landing page block structure as JSON. The blocks should be professional, conversion-focused, and specific to the content provided. Return ONLY valid JSON, no markdown.`;
      const userPrompt = `Generate a landing page for this ${typeLabel}:

Title: ${course.title}
Subtitle: ${course.subtitle ?? ""}
Description: ${course.description ?? ""}
Pricing: ${pricingText}
Cover Image: ${course.coverImageUrl ?? ""}

Curriculum:
${curriculumText}

Generate a JSON array of 6-8 content blocks. Each block MUST have:
- id: unique string like "block_1", "block_2", etc.
- type: MUST be one of these exact strings: hero, text, curriculum_auto, pricing_options_auto, reviews, faq, cta_standalone
- data: object with the fields described below

Block data schemas:

1. hero block — data fields:
   headline: string (main title, use course title)
   subheadline: string (subtitle/hook)
   bgType: "gradient"
   gradientFrom: "#179ca3"
   gradientTo: "#0e4a50"
   textColor: "#ffffff"
   align: "center"
   inlineMediaUrl: "${course.coverImageUrl ?? ""}"
   inlineMediaType: "image"
   inlineMediaPlacement: "right"
   buttons: [{text: "Enroll Now", color: "#ffffff", textColor: "#179ca3", link: "", style: "filled"}]

2. text block — data fields:
   html: string (HTML with h2, p, ul/li tags — write compelling content about what students will learn, benefits, who it's for)
   bgColor: "#ffffff"

3. curriculum_auto block — data fields:
   headline: "What You'll Learn"
   bgColor: "#f9fafb"

4. pricing_options_auto block — data fields:
   headline: "Enroll Today"
   bgColor: "#f0fafa"

5. reviews block — data fields:
   headline: "What Students Are Saying"
   bgColor: "#ffffff"
   reviews: array of 3 objects each with: name (string), text (string — realistic review), rating (number 4 or 5)

6. faq block — data fields:
   headline: "Frequently Asked Questions"
   bgColor: "#f9fafb"
   items: array of 5-6 objects each with: q (string — question), a (string — answer)

7. cta_standalone block — data fields:
   headline: string (urgent call to action)
   subtext: string (reassurance text)
   ctaText: "Enroll Now"
   ctaColor: "#179ca3"
   ctaTextColor: "#ffffff"
   bgColor: "#f0fafa"
   align: "center"

Create blocks in this order: hero, text (what you'll learn + benefits), curriculum_auto, text (about the instructor/course), pricing_options_auto, reviews, faq, cta_standalone.
Make ALL content specific and compelling based on the course title, description, and curriculum above. Do NOT use generic placeholder text.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      let blocks: any[];
      try {
        const raw = response.choices[0].message.content as string;
        blocks = parseLandingBlocks(raw);
      } catch (err: any) {
        console.error("[aiGenerateLandingPage] parse error:", err?.message, "raw:", (response.choices[0]?.message?.content as string)?.slice(0, 400));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI returned invalid JSON: ${err?.message ?? "unknown error"}. Please try again.` });
      }
      // Save the generated blocks
      const blocksJson = JSON.stringify(blocks);
      const [existing] = await db.select({ id: lmsLandingPages.id })
        .from(lmsLandingPages).where(eq(lmsLandingPages.courseId, input.courseId)).limit(1);
      if (existing) {
        await db.update(lmsLandingPages).set({ blocks: blocksJson, isCustom: true }).where(eq(lmsLandingPages.courseId, input.courseId));
      } else {
        await db.insert(lmsLandingPages).values({ courseId: input.courseId, blocks: blocksJson, isCustom: true });
      }

      return { success: true, blockCount: blocks.length };
    }),

  // ── Page Templates ──
  listPageTemplates: protectedProcedure
    .input(z.object({ templateType: z.enum(["page", "block"]).optional() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(lmsPageTemplates)
        .where(input.templateType ? eq(lmsPageTemplates.templateType, input.templateType) : undefined)
        .orderBy(lmsPageTemplates.updatedAt);
      return rows.map(r => ({
        ...r,
        blocks: typeof r.blocks === "string" ? JSON.parse(r.blocks) : r.blocks,
      }));
    }),

  savePageTemplate: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      templateType: z.enum(["page", "block"]).default("page"),
      blockType: z.string().optional(),
      blocks: z.array(z.any()),
      thumbnailUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      const blocksJson = JSON.stringify(input.blocks);
      if (input.id) {
        await db.update(lmsPageTemplates)
          .set({ name: input.name, description: input.description ?? null, templateType: input.templateType, blockType: input.blockType ?? null, blocks: blocksJson, thumbnailUrl: input.thumbnailUrl ?? null, updatedAt: now })
          .where(eq(lmsPageTemplates.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(lmsPageTemplates).values({
          name: input.name,
          description: input.description ?? null,
          templateType: input.templateType,
          blockType: input.blockType ?? null,
          blocks: blocksJson,
          thumbnailUrl: input.thumbnailUrl ?? null,
          createdBy: ctx.user.id,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as any).insertId };
      }
    }),

  deletePageTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsPageTemplates).where(eq(lmsPageTemplates.id, input.id));
      return { success: true };
    }),

  // ── Question Groups ──────────────────────────────────────────────────────────
  /** Enable/disable question groups mode on a quiz */
  setQuizGroupMode: protectedProcedure
    .input(z.object({ quizId: z.number(), useQuestionGroups: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsQuizzes).set({ useQuestionGroups: input.useQuestionGroups }).where(eq(lmsQuizzes.id, input.quizId));
      return { success: true };
    }),
  /** Get all question groups for a quiz */
  getQuizGroups: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const groups = await db.select().from(lmsQuizQuestionGroups)
        .where(eq(lmsQuizQuestionGroups.quizId, input.quizId))
        .orderBy(asc(lmsQuizQuestionGroups.sortOrder));
      const groupsWithCounts = await Promise.all(groups.map(async (g) => {
        const [{ count }] = await db.select({ count: sql<number>`count(*)` })
          .from(lmsQuizGroupQuestions).where(eq(lmsQuizGroupQuestions.groupId, g.id));
        return { ...g, questionCount: Number(count) };
      }));
      return groupsWithCounts;
    }),
  /** Create a question group */
  createQuizGroup: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      displayCount: z.number().int().min(1).default(1),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(lmsQuizQuestionGroups).values({
        quizId: input.quizId,
        name: input.name,
        description: input.description ?? null,
        displayCount: input.displayCount,
        sortOrder: input.sortOrder,
      });
      return { id: (result as any).insertId };
    }),
  /** Update a question group */
  updateQuizGroup: protectedProcedure
    .input(z.object({
      groupId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      displayCount: z.number().int().min(1).optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { groupId, ...updates } = input;
      await db.update(lmsQuizQuestionGroups).set(updates).where(eq(lmsQuizQuestionGroups.id, groupId));
      return { success: true };
    }),
  /** Delete a question group (also removes all group-question mappings) */
  deleteQuizGroup: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsQuizGroupQuestions).where(eq(lmsQuizGroupQuestions.groupId, input.groupId));
      await db.delete(lmsQuizQuestionGroups).where(eq(lmsQuizQuestionGroups.id, input.groupId));
      return { success: true };
    }),
  /** Get questions in a group */
  getGroupQuestions: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id: questionBank.id,
        question: questionBank.question,
        type: questionBank.type,
        correctAnswer: questionBank.correctAnswer,
        explanation: questionBank.explanation,
        questionImageUrl: questionBank.questionImageUrl,
        sortOrder: lmsQuizGroupQuestions.sortOrder,
        mappingId: lmsQuizGroupQuestions.id,
      })
        .from(lmsQuizGroupQuestions)
        .innerJoin(questionBank, eq(lmsQuizGroupQuestions.questionBankId, questionBank.id))
        .where(eq(lmsQuizGroupQuestions.groupId, input.groupId))
        .orderBy(asc(lmsQuizGroupQuestions.sortOrder));
    }),
  /** Add question bank items to a group */
  addQuestionsToGroup: protectedProcedure
    .input(z.object({ groupId: z.number(), questionBankIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.questionBankIds.length === 0) return { added: 0 };
      const existing = await db.select({ questionBankId: lmsQuizGroupQuestions.questionBankId })
        .from(lmsQuizGroupQuestions).where(eq(lmsQuizGroupQuestions.groupId, input.groupId));
      const existingIds = new Set(existing.map(e => e.questionBankId));
      const toAdd = input.questionBankIds.filter(id => !existingIds.has(id));
      if (toAdd.length === 0) return { added: 0 };
      const [{ maxOrder }] = await db.select({ maxOrder: max(lmsQuizGroupQuestions.sortOrder) })
        .from(lmsQuizGroupQuestions).where(eq(lmsQuizGroupQuestions.groupId, input.groupId));
      let nextOrder = (maxOrder ?? 0) + 1;
      await db.insert(lmsQuizGroupQuestions).values(toAdd.map(qbId => ({
        groupId: input.groupId,
        questionBankId: qbId,
        sortOrder: nextOrder++,
      })));
      return { added: toAdd.length };
    }),
  /** Remove a question from a group */
  removeQuestionFromGroup: protectedProcedure
    .input(z.object({ mappingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsQuizGroupQuestions).where(eq(lmsQuizGroupQuestions.id, input.mappingId));
      return { success: true };
    }),
  // ── Enrollments ──
});
