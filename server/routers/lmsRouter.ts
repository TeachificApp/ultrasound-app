import { getStripeClient } from "../lib/stripeClient";
/**
 * lmsRouter.ts
 * All About Ultrasound™ LMS — Router Aggregator
 *
 * The lmsAdminRouter procedures are split across focused sub-routers:
 *   lmsCourseBuilderRouter    — course/section/lesson CRUD (~970 lines)
 *   lmsQuizLandingRouter      — quiz builder + landing pages (~620 lines)
 *   lmsEnrollmentAdminRouter  — enrollments, groups, analytics, orders (~1,690 lines)
 *   lmsCohortAdminRouter      — cohort sessions, assignments, recordings (~515 lines)
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
import { and, desc, eq, isNull, sql, asc, isNotNull, max, inArray, or, gte } from "drizzle-orm";
import { randomBytes } from "crypto";
import { evaluateInlineLessonQuizScore } from "../../shared/inlineLessonQuizCompletion";
import { evaluateInlineLessonQuizCompletion } from "../../shared/inlineLessonQuizFlow";
import { lessonHasAssessmentContent } from "../../shared/lessonAccessGating";
import { resolvePresaleWelcome } from "../../shared/contentAvailability";
import { isScheduledDeadlineOpen } from "../../shared/platformTime";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb, getOrCreateAccessToken } from "../db";
import { invokeLLM } from "../_core/llm";
import { generateCertificatePdf } from "../lib/certificateGenerator";
import { buildCmeCertificateFileKey } from "../lib/cmeCertificateFilename";
import { sendEnrollmentEmail, sendEnrollmentEmailForUser } from "../lib/enrollmentEmail";
import { buildOrderBumpCheckoutLine } from "../lib/orderBumpCheckout";
import { resolveCheckoutTerms } from "./checkoutTermsHelper";
import { enrichCohortResources } from "../lib/cohortResources";
import { loadLinkedLessonMediaAsset } from "../lib/mediaAssetCourseAccess";
import { loadPublishedCourseLessonTree } from "../lib/courseLessonTree";
import { extractJson, parseLandingBlocks } from "../lib/extractJson";
import { countRenderedWords, extendFullLessonDraft, fullLessonWordsRemaining, isCompleteFullLesson, MIN_FULL_LESSON_WORDS, TARGET_FULL_LESSON_WORDS } from "../lib/lessonContentGeneration";
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
  lmsGroupCourses,
  lmsGroupManagers,
  lmsInstructors,
  lmsCourseInstructors,
  lmsLessonInstructors,
  lmsAffiliates,
  lmsAffiliateConversions,
  lmsLandingPages,
  testimonialPresets,
  lmsPageTemplates,
  lmsOrders,
  lmsCertificates,
  lmsLessonNotes,
  lmsLessonBookmarks,
  lmsCollections,
  lmsCollectionCourses,
  lmsCollectionItems,
  webinars,
  bundles,
  membershipPlans,
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
  lmsCohortResources,
  lmsCohortSubmissions,
  mediaUploadFolders,
  mediaUploadResponses,
  funnelLeads,
  lmsCohortGroups,
  lmsCohortGroupEnrollments,
  lmsCohortStaff,
  lmsCohortMessages,
  instructorCoursePermissions,
  instructorPublishRequests,
  userRoles,
  userActivityLogs,
  lmsDefaultTeamTiers,
  lmsCohortRecordingProgress,
  cohortWaitlistEntries,
  workshops,
  workshopInstances,
  lmsQuizAttempts,
  lmsQuizAttemptAnswers,
  lmsInlineQuizAttempts,
  lmsInlineQuizResponses,
  lmsQuizQuestionGroups,
  lmsQuizGroupQuestions,
  questionBank,
  draftNotifyEntries,
} from "../../drizzle/schema";
import { sendEmail, buildFreePreviewConfirmationEmail, emailWrapper } from "../_core/email";
import { generateDisclosurePdf } from "../lib/disclosurePdf";
import { notifyOwner } from "../_core/notification";
import { getPlatformAdminRecipient } from "../lib/platformAdminNotification";

// ─── Helpers ──────────────────────────────────────────────────────────────────
import { assertAdmin, generateSlug, uniqueSlug, recalcProgress, issueCertificateIfEnabled, restoreMissingCourseCertificate } from "./lmsHelpers";
import { cmeActivityFormRouter } from "./cmeActivityFormRouter";
import { cmeManagementRouter } from "./cmeManagementRouter";
import { lmsCourseBuilderRouter } from "./lmsCourseBuilderRouter";
import { lmsQuizLandingRouter } from "./lmsQuizLandingRouter";
import { lmsEnrollmentAdminRouter } from "./lmsEnrollmentAdminRouter";
import { lmsCohortAdminRouter } from "./lmsCohortAdminRouter";
import { generateImage } from "../_core/imageGeneration";
import { getCourseLessonAccessDecision } from "../lib/lessonAccess";
import { courseDollarsToStripeCents } from "../lib/courseCheckoutPricing";
import { dollarsToStripeCents } from "../lib/stripePriceUnits";
import { formatWorkshopDollars } from "../../shared/workshopPricing";
import { prepareInlineQuizResponses } from "../lib/inlineLessonQuizResponses";
import { normalizeQuizAccountFieldKeys, resolveQuizAccountFields } from "../../shared/quizAccountFields";
import { isPromotionCodeEligibleForTarget } from "../lib/couponCheckoutEligibility";
import { buildInlineQuizAttemptValues, isMissingInlineQuizAccountFieldsColumn } from "../lib/inlineQuizAttemptPersistence";
import { ensureInlineLessonQuizSchema } from "../lib/ensureInlineLessonQuizSchema";

// ─── Admin Router (merged from sub-routers) ───────────────────────────────────
// ─── Certificate Template Router (admin) ─────────────────────────────────────
const lmsCertificateRouter = router({
  listCertificateTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(lmsCertificateTemplates).orderBy(desc(lmsCertificateTemplates.createdAt));
    }),
  createCertificateTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional().nullable(),
      backgroundImageUrl: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      primaryColor: z.string().default("#189aa1"),
      accentColor: z.string().default("#c9a84c"),
      textColor: z.string().default("#0e1e2e"),
      fontFamily: z.string().default("Helvetica"),
      footerText: z.string().optional().nullable(),
      organizationName: z.string().default("All About Ultrasound"),
      layout: z.enum(["classic", "modern", "minimal"]).default("classic"),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.isDefault) {
        await db.update(lmsCertificateTemplates).set({ isDefault: false });
      }
      const [result] = await db.insert(lmsCertificateTemplates).values({ ...input, isActive: true });
      return { id: (result as any).insertId };
    }),
  updateCertificateTemplate: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional().nullable(),
      backgroundImageUrl: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      textColor: z.string().optional(),
      fontFamily: z.string().optional(),
      footerText: z.string().optional().nullable(),
      organizationName: z.string().optional(),
      layout: z.enum(["classic", "modern", "minimal"]).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
      pdfTemplateUrl: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      if (fields.isDefault) {
        await db.update(lmsCertificateTemplates).set({ isDefault: false });
      }
      await db.update(lmsCertificateTemplates).set(fields as any).where(eq(lmsCertificateTemplates.id, id));
      return { success: true };
    }),
  deleteCertificateTemplate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCourses).set({ certificateTemplateId: null }).where(eq(lmsCourses.certificateTemplateId, input.id));
      await db.delete(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, input.id));
      return { success: true };
    }),
  listIssuedCertificates: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive().optional(),
      userId: z.number().int().positive().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(30),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.courseId) conditions.push(eq(lmsCertificates.courseId, input.courseId));
      if (input.userId) conditions.push(eq(lmsCertificates.userId, input.userId));
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select({
          id: lmsCertificates.id,
          userId: lmsCertificates.userId,
          courseId: lmsCertificates.courseId,
          certificateUrl: lmsCertificates.certificateUrl,
          issuedAt: lmsCertificates.issuedAt,
          templateId: lmsCertificates.templateId,
          userName: users.name,
          userEmail: users.email,
          courseTitle: lmsCourses.title,
          courseType: lmsCourses.type,
        })
        .from(lmsCertificates)
        .leftJoin(users, eq(lmsCertificates.userId, users.id))
        .leftJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lmsCertificates.issuedAt))
        .limit(input.pageSize)
        .offset(offset);
      return rows;
    }),
  /** Generate a sample certificate PDF — works with or without an existing template */
  generateSampleCertificatePdf: protectedProcedure
    .input(z.object({ templateId: z.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Resolve template: use provided id, or fall back to default, or any active template
      let tmpl: typeof lmsCertificateTemplates.$inferSelect | null = null;
      if (input.templateId && input.templateId > 0) {
        const [row] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, input.templateId)).limit(1);
        tmpl = row ?? null;
      }
      if (!tmpl) {
        const rows = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.isActive, true)).limit(10);
        tmpl = rows.find(r => r.isDefault) ?? rows[0] ?? null;
      }
      // If a custom PDF already exists on the resolved template, return it directly
      if (tmpl?.pdfTemplateUrl) {
        return { url: tmpl.pdfTemplateUrl, isCustom: true };
      }
      // Build a fallback template config using brand defaults when no DB template exists
      const effectiveTemplate = tmpl ?? {
        id: 0, name: "Default",
        primaryColor: "#189aa1", accentColor: "#c9a84c", textColor: "#0e1e2e",
        fontFamily: "Helvetica",
        footerText: "www.allaboutultrasound.com  \u00b7  \u00a9 All About Ultrasound\u2122",
        organizationName: "All About Ultrasound",
        layout: "classic", isDefault: true, isActive: true,
        pdfTemplateUrl: null, description: null,
        createdAt: new Date(), updatedAt: new Date(),
      };
      // Generate a sample with placeholder AcroForm fields so the admin can
      // see and reposition Learner Name, Course Title, Issued Date, and Credits.
      const pdfBuffer = await generateCertificatePdf({
        learnerName: "",
        courseTitle: "",
        issuedAt: new Date(),
        credentials: null,
        creditHours: "1.0", // sample value so the Credits field appears in the template
        template: effectiveTemplate as any,
        usePlaceholders: true,
      });
      const base64 = pdfBuffer.toString("base64");
      return { dataUri: `data:application/pdf;base64,${base64}`, isCustom: false };
    }),
  /** Generate a sample certificate PDF from inline template settings (no DB save required) */
  generateSampleCertificatePdfInline: protectedProcedure
    .input(z.object({
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      textColor: z.string().optional(),
      fontFamily: z.string().optional(),
      footerText: z.string().nullable().optional(),
      organizationName: z.string().optional(),
      layout: z.enum(["classic", "modern", "minimal"]).optional(),
      logoUrl: z.string().nullable().optional(),
      backgroundImageUrl: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const effectiveTemplate = {
        id: 0, name: "Preview",
        primaryColor: input.primaryColor ?? "#189aa1",
        accentColor: input.accentColor ?? "#c9a84c",
        textColor: input.textColor ?? "#0e1e2e",
        fontFamily: input.fontFamily ?? "Helvetica",
        footerText: input.footerText ?? "www.allaboutultrasound.com  \u00b7  \u00a9 All About Ultrasound\u2122",
        organizationName: input.organizationName ?? "All About Ultrasound",
        layout: input.layout ?? "classic",
        logoUrl: input.logoUrl ?? null,
        backgroundImageUrl: input.backgroundImageUrl ?? null,
        isDefault: false, isActive: true,
        pdfTemplateUrl: null, description: null,
        createdAt: new Date(), updatedAt: new Date(),
      };
      const pdfBuffer = await generateCertificatePdf({
        learnerName: "",
        courseTitle: "",
        issuedAt: new Date(),
        credentials: null,
        creditHours: "1.0",
        template: effectiveTemplate as any,
        usePlaceholders: true,
      });
      const base64 = pdfBuffer.toString("base64");
      return { dataUri: `data:application/pdf;base64,${base64}` };
    }),

  /** Upload a custom PDF template for a certificate template (base64 data URI) */
  uploadCertificatePdf: protectedProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      dataUri: z.string().min(1).max(20_000_000), // ~15 MB PDF
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const b64Marker = ";base64,";
      const b64Idx = input.dataUri.indexOf(b64Marker);
      const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
      const buffer = Buffer.from(base64Data, "base64");
      const suffix = randomBytes(4).toString("hex");
      const fileKey = `certificate-templates/template-${input.templateId}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, buffer, "application/pdf");
      await db.update(lmsCertificateTemplates).set({ pdfTemplateUrl: url }).where(eq(lmsCertificateTemplates.id, input.templateId));
      return { url };
    }),
});


// ─── AI Generation Router ─────────────────────────────────────────────────
export function resolveUpgradeProductCheckoutCents(price: number | string | null | undefined) {
  return dollarsToStripeCents(price);
}

/** Course and cohort offers store authored primary prices as decimal dollars. */
export function resolveCourseOfferCheckoutCents(price: number | string | null | undefined) {
  return courseDollarsToStripeCents(price);
}

/** Builds the actual one-time line item passed to Stripe by LMS course and cohort checkout. */
export function buildCourseOfferStripeLineItem(input: {
  stripePriceId?: string | null;
  price: number | string | null | undefined;
  currency: string;
  productName: string;
  description?: string | null;
  seats: number;
}) {
  if (input.stripePriceId) return { price: input.stripePriceId, quantity: input.seats };
  return {
    price_data: {
      currency: input.currency,
      product_data: { name: input.productName, description: input.description ?? undefined },
      unit_amount: resolveCourseOfferCheckoutCents(input.price),
    },
    quantity: input.seats,
  };
}

export const lmsRouter = router({
  /** AI: Generate quiz questions from lesson content */
  generateQuizFromLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive().optional(),
      courseId: z.number().int().positive().optional(),
      lessonIds: z.array(z.number().int().positive()).optional(),
      /** Free-text topic — used when source is 'topic' */
      topic: z.string().max(500).optional(),
      count: z.number().int().min(1).max(50).default(5),
      questionStyle: z.enum(["understanding", "thinking", "compliance", "thought_provoking", "reflection", "custom"]).default("understanding"),
      customPrompt: z.string().max(500).optional(),
      questionType: z.enum(["mcq", "truefalse", "multiselect", "mixed", "likert", "star_rating", "open_text"]).default("mcq"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let lessonText = "";

      if (input.topic) {
        // Topic-based generation — no lesson content needed
        lessonText = `Topic: ${input.topic}`;
      } else {
        // Determine which lessons to pull content from
        let targetLessonIds: number[] = [];
        if (input.lessonIds && input.lessonIds.length > 0) {
          targetLessonIds = input.lessonIds;
        } else if (input.courseId) {
          const courseLessons = await db.select({ id: lmsLessons.id })
            .from(lmsLessons)
            .where(and(eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.lessonStatus, "published")))
            .orderBy(asc(lmsLessons.position));
          targetLessonIds = courseLessons.map(l => l.id);
        } else if (input.lessonId) {
          targetLessonIds = [input.lessonId];
        }
        if (targetLessonIds.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No lessons specified." });

        const targetLessons = await db.select({
          id: lmsLessons.id,
          title: lmsLessons.title,
          content: lmsLessons.content,
          contentBlocks: lmsLessons.contentBlocks,
        }).from(lmsLessons).where(inArray(lmsLessons.id, targetLessonIds));

        const extractText = (lesson: typeof targetLessons[0]) => {
          let text = lesson.title ?? "";
          if (lesson.content) text += "\n" + lesson.content;
          if (lesson.contentBlocks) {
            try {
              const blocks = typeof lesson.contentBlocks === "string" ? JSON.parse(lesson.contentBlocks as string) : lesson.contentBlocks;
              if (Array.isArray(blocks)) {
                for (const block of blocks) {
                  const d = block.data ?? {};
                  if (d.text) text += "\n" + d.text;
                  if (d.content) text += "\n" + d.content;
                  if (d.title) text += "\n" + d.title;
                  if (d.body) text += "\n" + d.body;
                  if (d.caption) text += "\n" + d.caption;
                }
              }
            } catch { /* ignore */ }
          }
          return text;
        };

        lessonText = targetLessons.map(l => `=== ${l.title} ===\n${extractText(l)}`).join("\n\n");
        if (lessonText.trim().length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Lessons have insufficient text content to generate questions." });
      }

      const isSurveyType = ["likert", "star_rating", "open_text"].includes(input.questionType);
      const typeInstruction = input.questionType === "mixed"
        ? "Mix multiple choice (mcq), true/false, and multi-select questions."
        : input.questionType === "truefalse"
          ? "All questions must be true/false with options [\"True\", \"False\"]."
          : input.questionType === "multiselect"
            ? "All questions must be multi-select (multiple correct answers possible) with 4-5 options."
            : input.questionType === "likert"
              ? "All questions must be Likert-scale survey questions. Each should have likertLabels set to a 5-item array (e.g. ['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree']). options and correctAnswer must be empty."
              : input.questionType === "star_rating"
                ? "All questions must be star-rating survey questions. Set starMax to 5. options and correctAnswer must be empty."
                : input.questionType === "open_text"
                  ? "All questions must be open-text survey questions asking for free-text responses. options and correctAnswer must be empty."
                  : "All questions must be multiple choice with exactly 4 options.";
      const styleMap: Record<string, string> = {
        understanding: "Test factual knowledge: definitions, normal values, anatomical landmarks, imaging characteristics of pathology, and standard protocols.",
        thinking: "Write scenario-based questions: present a clinical finding or patient scenario and ask the learner to interpret, diagnose, or choose the correct next step.",
        compliance: "Focus on protocol adherence, safety requirements, accreditation standards, and correct procedural steps in clinical ultrasound practice.",
        thought_provoking: "Write challenging clinical questions requiring the learner to differentiate between similar conditions, recognize subtle imaging findings, or reason through complex scenarios.",
        reflection: "Write questions that connect clinical content to real-world practice — e.g., interpreting a finding, recognizing an artifact, or choosing between imaging approaches.",
        custom: input.customPrompt ? `Custom style: ${input.customPrompt}` : "Generate well-balanced clinical questions covering the key medical and technical concepts.",
      };
      const styleInstruction = styleMap[input.questionStyle] ?? styleMap.understanding;

      const systemPromptText = [
        "You are a medical ultrasound educator creating assessment questions for sonographers, echocardiographers, and cardiovascular professionals.",
        "Your questions must test clinical knowledge and understanding — NOT the structure, titles, or organization of the course or its modules.",
        "",
        "CRITICAL RULES:",
        "- NEVER ask about what a module or section \"covers\" or what the \"purpose\" of a lesson title is",
        "- NEVER reference module names, lesson titles, section headings, or course structure in questions",
        "- NEVER ask meta-questions like \"What is the purpose of discussing X in this course?\" or \"What is covered in the X section?\"",
        "- ALWAYS test the actual clinical content: anatomy, physiology, pathology, imaging findings, measurements, Doppler principles, protocols, clinical significance, differential diagnosis, or patient management",
        "- Questions must be answerable by a clinician who has the knowledge — not by someone who simply read the table of contents",
        "- Use precise medical and sonographic terminology",
        "",
        typeInstruction,
        "",
        `Question style: ${styleInstruction}`,
        "",
        "Return only valid JSON.",
      ].join("\n");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPromptText },
          { role: "user", content: `Using the following course content as your knowledge source, generate ${input.count} quiz questions that test clinical understanding of the medical concepts covered. Do NOT ask about the course structure, module names, or lesson titles — ask about the actual clinical knowledge contained in the content.\n\nContent:\n${lessonText.slice(0, 6000)}` },
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
                      question: { type: "string", description: "The question text" },
                      type: { type: "string", description: "Question type: mcq, truefalse, multiselect, likert, star_rating, or open_text" },
                      options: { type: "array", items: { type: "string" }, description: "Answer options (2 for truefalse, 4-5 for mcq/multiselect, empty for survey types)" },
                      correctAnswer: { type: "integer", description: "Index of the correct option (for mcq/truefalse), 0 for survey types" },
                      correctAnswers: { type: "array", items: { type: "integer" }, description: "Indices of all correct options (for multiselect), empty for others" },
                      explanation: { type: "string", description: "Brief explanation (empty string for survey types)" },
                      likertLabels: { type: "array", items: { type: "string" }, description: "5 labels for likert scale, empty array for other types" },
                      starMax: { type: "integer", description: "Max stars for star_rating (5), 0 for other types" },
                    },
                    required: ["question", "type", "options", "correctAnswer", "correctAnswers", "explanation", "likertLabels", "starMax"],
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
      const questions = (parsed.questions ?? []).slice(0, input.count).map((q: any) => ({
        ...q,
        // Normalize survey fields
        likertLabels: Array.isArray(q.likertLabels) && q.likertLabels.length > 0 ? q.likertLabels : undefined,
        starMax: q.starMax && q.starMax > 0 ? q.starMax : undefined,
      }));
      return { questions };
    }),

  /** AI: Generate flashcards from lesson content */
  generateFlashcardsFromLesson: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive().optional(),
      courseId: z.number().int().positive().optional(),
      lessonIds: z.array(z.number().int().positive()).optional(),
      /** Free-text topic — used when source is 'topic' */
      topic: z.string().max(500).optional(),
      count: z.number().int().min(1).max(30).default(10),
      cardStyle: z.enum(["understanding", "thinking", "compliance", "thought_provoking", "reflection", "custom"]).default("understanding"),
      customPrompt: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let lessonText = "";
      if (input.topic) {
        // Topic-based generation — no lesson content needed
        lessonText = `Topic: ${input.topic}`;
      } else {
        // Determine which lessons to pull content from
        let targetLessonIds: number[] = [];
        if (input.lessonIds && input.lessonIds.length > 0) {
          targetLessonIds = input.lessonIds;
        } else if (input.courseId) {
          const courseLessons = await db.select({ id: lmsLessons.id })
            .from(lmsLessons)
            .innerJoin(lmsSections, eq(lmsLessons.sectionId, lmsSections.id))
            .where(eq(lmsSections.courseId, input.courseId));
          targetLessonIds = courseLessons.map(l => l.id);
        } else if (input.lessonId) {
          targetLessonIds = [input.lessonId];
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Provide lessonId, courseId, lessonIds, or topic." });
        }
        if (targetLessonIds.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No lessons specified." });
        const targetLessons = await db.select({
          id: lmsLessons.id,
          title: lmsLessons.title,
          content: lmsLessons.content,
          contentBlocks: lmsLessons.contentBlocks,
        }).from(lmsLessons).where(inArray(lmsLessons.id, targetLessonIds));
        const extractText = (lesson: typeof targetLessons[0]) => {
          let text = lesson.title ?? "";
          if (lesson.content) text += "\n" + lesson.content;
          if (lesson.contentBlocks) {
            try {
              const blocks = typeof lesson.contentBlocks === "string" ? JSON.parse(lesson.contentBlocks as string) : lesson.contentBlocks;
              if (Array.isArray(blocks)) {
                for (const block of blocks) {
                  const d = block.data ?? {};
                  if (d.text) text += "\n" + d.text;
                  if (d.content) text += "\n" + d.content;
                  if (d.title) text += "\n" + d.title;
                  if (d.body) text += "\n" + d.body;
                  if (d.caption) text += "\n" + d.caption;
                }
              }
            } catch { /* ignore */ }
          }
          return text;
        };
        lessonText = targetLessons.map(l => `=== ${l.title} ===\n${extractText(l)}`).join("\n\n");
        if (lessonText.trim().length < 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Lessons have insufficient text content to generate flashcards." });
      }
      const flashcardStylePrompts: Record<string, string> = {
        understanding: "Create straightforward recall flashcards: front = term or definition question, back = clear concise answer. Focus on key concepts, anatomy, measurements, and definitions.",
        thinking: "Create application-based flashcards that require the learner to reason or apply knowledge: front = scenario or 'why/how' question, back = reasoned explanation.",
        compliance: "Create protocol- and safety-focused flashcards: front = procedure, checklist item, or safety question, back = correct protocol step or rationale.",
        thought_provoking: "Create critical-thinking flashcards with nuanced or differential-based fronts: front = complex clinical scenario or 'what would you do' question, back = nuanced answer with key differentiators.",
        reflection: "Create introspective flashcards that prompt the learner to connect lesson content to their own clinical practice or professional development: front = reflective prompt (e.g. 'How has your scanning approach changed after learning…?'), back = suggested reflection points or self-assessment criteria.",
        custom: input.customPrompt ?? "Create helpful flashcards based on the lesson content.",
      };
      const styleInstruction = flashcardStylePrompts[input.cardStyle] ?? flashcardStylePrompts.understanding;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `You are a medical ultrasound educator. Create flashcards (question/answer pairs) based on the provided lesson content. ${styleInstruction} Each card should have a concise front and a clear back. Optionally include a hint. Return only valid JSON.` },
          { role: "user", content: `Generate ${input.count} flashcards based on this lesson content:\n\n${lessonText.slice(0, 6000)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "flashcards",
            strict: true,
            schema: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      front: { type: "string", description: "Term or question on the front of the card" },
                      back: { type: "string", description: "Definition or answer on the back of the card" },
                      hint: { type: "string", description: "Optional hint to help recall the answer" },
                    },
                    required: ["front", "back", "hint"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["cards"],
              additionalProperties: false,
            },
          },
        } as any,
      });
      const raw = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { cards: (parsed.cards ?? []).slice(0, input.count) };
    }),

  // ── AI Lesson Content Generator ──────────────────────────────────────────
  generateLessonContent: protectedProcedure
    .input(z.object({
      lessonTitle: z.string().min(1),
      courseTitle: z.string().optional(),
      format: z.enum(["full_lesson", "text", "outline", "summary", "quiz_questions"]).default("text"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const formatInstructions: Record<string, string> = {
        full_lesson: `Write a complete, publication-ready lesson of at least ${MIN_FULL_LESSON_WORDS.toLocaleString("en-US")} readable words, excluding HTML markup. Target approximately ${TARGET_FULL_LESSON_WORDS.toLocaleString("en-US")} readable words so the minimum is met. Use a meaningful clinical introduction; clearly labeled sections for anatomy or physiology where relevant, scanning technique, interpretation, common pitfalls, and clinical pearls; and a concise conclusion. Use <h2>, <h3>, <p>, and <ul>/<li> tags. Do not include <html>, <head>, or <body> tags.`,
        text: "Write comprehensive, well-structured lesson content in HTML format. Use <h2>, <h3>, <p>, and <ul>/<li> tags where appropriate. Do not include <html>, <head>, or <body> tags.",
        outline: "Create a detailed lesson outline in HTML format with main sections as <h2> headings, sub-points as <h3> headings, and key learning objectives as a <ul> list at the top.",
        summary: "Write a concise summary of the key concepts for this lesson in HTML format. Use <p> for intro and <ul><li> bullet points for the main takeaways.",
        quiz_questions: "Generate 5 quiz questions with answers for this lesson in HTML format. Format as <ol> with each <li> containing the question in <strong> and the answer in a <p> below it.",
      };
      const instruction = formatInstructions[input.format];
      const generate = async (revisionInstruction?: string) => {
        const response = await invokeLLM({
          // Prefer Forge when it is configured, but use the Railway-held Manus API
          // key through the constrained non-interactive fallback when it is not.
          transport: "auto",
          maxTokens: input.format === "full_lesson" ? 6000 : 4000,
          messages: [
            {
              role: "system",
              content: `You are an expert medical ultrasound educator creating content for All About Ultrasound™ and iHeartEcho™ online learning platforms. Generate high-quality, clinically accurate lesson content for ultrasound and echocardiography education. ${instruction} Return only the HTML fragment — no markdown code fences, no surrounding tags.`,
            },
            {
              role: "user",
              content: `Generate lesson content for the lesson titled: "${input.lessonTitle}"${input.courseTitle ? ` (part of the course "${input.courseTitle}")` : ""}.${revisionInstruction ? `\n\n${revisionInstruction}` : ""}`,
            },
          ],
        });
        const content = (response.choices?.[0]?.message?.content ?? "") as string;
        return content.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
      };

      const initialDraft = await generate();
      const cleaned = input.format === "full_lesson"
        ? await extendFullLessonDraft(initialDraft, draft => generate(`The draft below is only ${countRenderedWords(draft).toLocaleString("en-US")} readable words and needs ${fullLessonWordsRemaining(draft).toLocaleString("en-US")} additional words to reach the full-lesson target. Write ONLY new, non-duplicative HTML sections that continue this exact lesson. Do not restart, summarize, mention the prior draft, or include markdown fences. Preserve the lesson topic and add clinically useful depth through scanning technique, interpretation, pitfalls, and practical clinical pearls.\n\nCURRENT DRAFT:\n${draft}`))
        : initialDraft;
      if (input.format === "full_lesson" && !isCompleteFullLesson(cleaned)) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI returned an incomplete full lesson. Full lessons require at least ${MIN_FULL_LESSON_WORDS.toLocaleString("en-US")} words; please generate again.` });
      }
      return { content: cleaned, wordCount: countRenderedWords(cleaned) };
    }),
  generatePromoContent: protectedProcedure
    .input(z.object({
      productType: z.enum(["course", "cohort", "quiz", "webinar", "workshop", "download", "bundle", "community"]),
      productId: z.number().int().positive(),
      productName: z.string().min(1),
      productUrl: z.string().optional(),
      prompt: z.string().optional(),
      format: z.enum(["promo_block", "announcement", "feature_list"]).default("promo_block"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let productDetails = `Product: "${input.productName}" (${input.productType})`;
      let landingPageUrl = input.productUrl ?? "";
      try {
        if (input.productType === "course" || input.productType === "cohort" || input.productType === "quiz") {
          const [course] = await db.select({ title: lmsCourses.title, subtitle: lmsCourses.subtitle, slug: lmsCourses.slug, price: lmsCourses.price, isFree: lmsCourses.isFree, type: lmsCourses.type }).from(lmsCourses).where(eq(lmsCourses.id, input.productId)).limit(1);
          if (course) {
            const priceStr = course.isFree ? "Free" : course.price ? `$${Number(course.price).toFixed(2)}` : "Paid";
            const typeLabel = input.productType === "cohort" ? "Cohort" : input.productType === "quiz" ? "Quiz" : "Course";
            productDetails = `Product: "${course.title}" (${typeLabel})\nDescription: ${course.subtitle ?? ""}\nPrice: ${priceStr}`;
            if (!landingPageUrl && course.slug) landingPageUrl = `https://learn.allaboutultrasound.com/courses/${course.slug}`;
          }
        } else if (input.productType === "webinar") {
          const [webinar] = await db.select({ title: webinars.title, slug: webinars.slug, price: webinars.price, accessType: webinars.accessType }).from(webinars).where(eq(webinars.id, input.productId)).limit(1);
          if (webinar) {
            const priceStr = webinar.accessType === "free" ? "Free" : webinar.price ? `$${Number(webinar.price).toFixed(2)}` : "Paid";
            productDetails = `Product: "${webinar.title}" (Webinar)\nPrice: ${priceStr}`;
            if (!landingPageUrl && webinar.slug) landingPageUrl = `https://learn.allaboutultrasound.com/webinars/${webinar.slug}`;
          }
        } else if (input.productType === "workshop") {
          const [workshop] = await db.select({ title: workshops.title, slug: workshops.slug, price: workshops.price, isFree: workshops.isFree }).from(workshops).where(eq(workshops.id, input.productId)).limit(1);
          if (workshop) {
            const priceStr = workshop.isFree ? "Free" : workshop.price ? formatWorkshopDollars(workshop.price, workshop.currency) : "Paid";
            productDetails = `Product: "${workshop.title}" (Workshop)\nPrice: ${priceStr}`;
            if (!landingPageUrl && workshop.slug) landingPageUrl = `https://learn.allaboutultrasound.com/workshops/${workshop.slug}`;
          }
        } else if (input.productType === "download") {
          const [dl] = await db.select({ title: digitalProducts.title, price: digitalProducts.price, description: digitalProducts.description }).from(digitalProducts).where(eq(digitalProducts.id, input.productId)).limit(1);
          if (dl) {
            const priceStr = dl.price ? `$${Number(dl.price).toFixed(2)}` : "Free";
            productDetails = `Product: "${dl.title}" (Download)\nDescription: ${dl.description ?? ""}\nPrice: ${priceStr}`;
          }
        }
      } catch (_) {}
      const urlSection = landingPageUrl ? `\nLanding Page URL: ${landingPageUrl}` : "";
      const promptSection = input.prompt ? `\nAdditional instructions: ${input.prompt}` : "";
      const formatInstructions: Record<string, string> = {
        promo_block: "Write a compelling promotional content block in HTML format. Include an engaging headline (<h2>), 2-3 benefit-focused paragraphs (<p>), and a clear call-to-action sentence with a hyperlink to the landing page URL. Use <strong> for emphasis. No markdown, no surrounding tags.",
        announcement: "Write a brief announcement paragraph in HTML format (1-2 <p> tags) suitable for a newsletter or social post. Include the product name, key benefit, and a hyperlink to the landing page URL. No markdown, no surrounding tags.",
        feature_list: "Write a feature/benefit list in HTML format. Use a short intro <p>, then a <ul> with 4-6 <li> items highlighting key features and benefits. Include a call-to-action hyperlink to the landing page URL at the end. No markdown, no surrounding tags.",
      };
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert marketing copywriter for All About Ultrasound™ and iHeartEcho™, medical ultrasound education platforms. Write compelling, professional promotional content for healthcare professionals (sonographers, physicians, nurses). Use US English spelling. Return only the HTML fragment. CRITICAL: Always use the EXACT price provided in the product details — never modify, round, or reformat it. If the price is $2297.00, write $2297.00 exactly." },
          { role: "user", content: `Write promotional content for this product:\n${productDetails}${urlSection}${promptSection}\n\nIMPORTANT: Use the exact price shown above. Do not modify or reformat the price.\n\nFormat: ${formatInstructions[input.format]}` },
        ],
      });
      const rawContent = (response.choices?.[0]?.message?.content ?? "") as string;
      const cleanedContent = rawContent.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
      return { content: cleanedContent, landingPageUrl };
    }),
  // ─── AI Image Generator ──────────────────────────────────────────────────
  generateAiImage: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(1000),
      style: z.enum(["realistic", "illustration", "diagram", "infographic", "medical", "professional"]).default("professional"),
      aspectRatio: z.enum(["landscape", "portrait", "square"]).default("landscape"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const styleGuide: Record<string, string> = {
        realistic: "photorealistic, high quality photography",
        illustration: "clean vector illustration, modern flat design",
        diagram: "clean educational diagram, labeled, medical textbook style",
        infographic: "modern infographic, data visualization, clean layout",
        medical: "medical illustration, anatomical accuracy, clinical style",
        professional: "professional medical education, clean modern design, teal and white color palette",
      };
      const aspectGuide: Record<string, string> = {
        landscape: "wide landscape format 16:9",
        portrait: "portrait format 3:4",
        square: "square format 1:1",
      };
      const fullPrompt = `${input.prompt}. Style: ${styleGuide[input.style] ?? styleGuide.professional}. Format: ${aspectGuide[input.aspectRatio] ?? aspectGuide.landscape}. No text overlay unless specifically requested. High quality, suitable for medical education content.`;
      const { url } = await generateImage({ prompt: fullPrompt });
      return { url };
    }),

  // ─── Testimonial Presets ──────────────────────────────────────────────────
  saveTestimonialPreset: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      credentials: z.string().optional(),
      quote: z.string().min(1),
      rating: z.number().int().min(1).max(5).default(5),
      avatarUrl: z.string().optional(),
      category: z.string().optional(),
      sourceCourseId: z.number().int().positive().optional(),
      sourceCourseName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const [result] = await db.insert(testimonialPresets).values({
        name: input.name,
        credentials: input.credentials ?? null,
        quote: input.quote,
        rating: input.rating,
        avatarUrl: input.avatarUrl ?? null,
        category: input.category ?? null,
        sourceCourseId: input.sourceCourseId ?? null,
        sourceCourseName: input.sourceCourseName ?? null,
        createdBy: ctx.user.id,
      });
      return { id: (result as any).insertId as number };
    }),

  listTestimonialPresets: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const rows = await db.select().from(testimonialPresets)
        .where(input?.category ? eq(testimonialPresets.category, input.category) : undefined)
        .orderBy(desc(testimonialPresets.createdAt));
      return rows;
    }),

  deleteTestimonialPreset: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      await db.delete(testimonialPresets).where(eq(testimonialPresets.id, input.id));
      return { ok: true };
    }),

});

export const lmsAdminRouter = router({
  ...lmsRouter._def.procedures,
  ...lmsCourseBuilderRouter._def.procedures,
  ...lmsQuizLandingRouter._def.procedures,
  ...lmsEnrollmentAdminRouter._def.procedures,
  ...lmsCohortAdminRouter._def.procedures,
  ...lmsCertificateRouter._def.procedures,
  ...cmeActivityFormRouter._def.procedures,
  ...cmeManagementRouter._def.procedures,
});

// ─── Public Router ────────────────────────────────────────────────────────────

export const lmsPublicRouter = router({
  /** List all publicly visible courses */
  listCourses: publicProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho"]).optional(),
      type: z.enum(["course", "quiz", "download", "cohort"]).optional(),
      isFree: z.boolean().optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // If type is explicitly "quiz", merge lmsCourses quizzes + sonoQuizzes
      if (input.type === "quiz") {
        const lmsConditions = [eq(lmsCourses.status, "public"), eq(lmsCourses.showInLibrary, true), eq(lmsCourses.type, "quiz")];
        if (input.brand) lmsConditions.push(eq(lmsCourses.brand, input.brand));
        const offset = (input.page - 1) * input.pageSize;
        const [lmsQuizRows, sqRows] = await Promise.all([
          db.select().from(lmsCourses).where(and(...lmsConditions)).orderBy(desc(lmsCourses.createdAt)),
          db.select().from(sonoQuizzes).where(eq(sonoQuizzes.status, "published")).orderBy(desc(sonoQuizzes.createdAt)),
        ]);
        const lmsMapped = lmsQuizRows.map(c => ({ ...c, instructor: null, _source: "lms_course" as const }));
        const sqMapped = sqRows.map(q => ({
          id: q.id,
          slug: `quiz-${q.id}`,
          title: q.title,
          subtitle: q.description ?? null,
          description: q.description ?? null,
          coverImageUrl: q.coverImageUrl ?? null,
          status: "public" as const,
          type: "quiz" as const,
          brand: "aaus" as const,
          price: 0,
          isFree: true,
          isFeatured: false,
          showInLibrary: true,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          instructor: null,
          _source: "sono_quiz" as const,
        }));
        const combined = [...lmsMapped, ...sqMapped].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const paginated = combined.slice(offset, offset + input.pageSize);
        return { courses: paginated, total: combined.length, page: input.page, pageSize: input.pageSize };
      }

      // If type is explicitly "download", pull from digitalProducts table and return in same shape
      if (input.type === "download") {
        const dpConditions = [eq(digitalProducts.status, "published"), eq(digitalProducts.showInLibrary, true)];
        if (input.isFree !== undefined) dpConditions.push(eq(digitalProducts.isFree, input.isFree));
        const offset = (input.page - 1) * input.pageSize;
        const [dpRows, dpCount] = await Promise.all([
          db.select().from(digitalProducts).where(and(...dpConditions)).orderBy(desc(digitalProducts.createdAt)).limit(input.pageSize).offset(offset),
          db.select({ count: sql<number>`count(*)` }).from(digitalProducts).where(and(...dpConditions)),
        ]);
        // Map digitalProducts to same shape as lmsCourses for the frontend
        const mapped = dpRows.map(p => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle ?? null,
          description: p.description ?? null,
          coverImageUrl: p.thumbnailUrl ?? null,
          status: "public" as const,
          type: "download" as const,
          brand: "aaus" as const,
          price: p.price,
          isFree: p.isFree,
          isFeatured: false,
          showInLibrary: p.showInLibrary,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          instructor: null,
          _source: "digital_product" as const,
        }));
        return { courses: mapped, total: Number(dpCount[0]?.count ?? 0), page: input.page, pageSize: input.pageSize };
      }

      const conditions = [eq(lmsCourses.status, "public"), eq(lmsCourses.showInLibrary, true)];
      if (input.brand) conditions.push(eq(lmsCourses.brand, input.brand));
      if (input.type) conditions.push(eq(lmsCourses.type, input.type));
      if (input.isFree !== undefined) conditions.push(eq(lmsCourses.isFree, input.isFree));

      const offset = (input.page - 1) * input.pageSize;

      // Helper: enrich courses with instructor data
      const enrichWithInstructors = async (courseList: (typeof lmsCourses.$inferSelect)[]) => {
        let enriched: any[] = courseList.map(c => ({ ...c, instructor: null, _source: "lms_course" as const }));
        const ids = courseList.map(c => c.id);
        if (ids.length === 0) return enriched;
        const ciRows = await db.select().from(lmsCourseInstructors)
          .where(and(
            sql`${lmsCourseInstructors.courseId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
            eq(lmsCourseInstructors.isPrimary, true)
          ));
        const instructorIds = Array.from(new Set(ciRows.map(ci => ci.instructorId)));
        if (instructorIds.length > 0) {
          const insRows = await db.select().from(lmsInstructors)
            .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
          const insMap = new Map(insRows.map(i => [i.id, i]));
          const ciMap = new Map(ciRows.map(ci => [ci.courseId, ci]));
          enriched = courseList.map(c => {
            const ci = ciMap.get(c.id);
            return { ...c, instructor: ci ? (insMap.get(ci.instructorId) ?? null) : null, _source: "lms_course" as const };
          });
        }
        return enriched;
      };

      // When no type filter (All Types): fetch ALL items across all content types, then sort+paginate globally.
      // This ensures admin-set libraryOrder is respected across courses, downloads, and quizzes.
      if (!input.type) {
        const allCourses = await db.select().from(lmsCourses).where(and(...conditions));
        const allEnriched = await enrichWithInstructors(allCourses);

        const dpConditions: any[] = [eq(digitalProducts.status, "published"), eq(digitalProducts.showInLibrary, true)];
        if (input.isFree !== undefined) dpConditions.push(eq(digitalProducts.isFree, input.isFree));
        if (input.brand) dpConditions.push(eq(digitalProducts.brand, input.brand as any));
        const dpRows = await db.select().from(digitalProducts).where(and(...dpConditions));
        const dpMapped = dpRows.map(p => ({
          id: p.id, slug: p.slug, title: p.title, subtitle: p.subtitle ?? null,
          description: p.description ?? null, coverImageUrl: p.thumbnailUrl ?? null,
          status: "public" as const, type: "download" as const, brand: (p.brand ?? "aaus") as any,
          price: p.price, isFree: p.isFree, isFeatured: false, showInLibrary: p.showInLibrary,
          createdAt: p.createdAt, updatedAt: p.updatedAt,
          libraryOrder: (p.libraryOrder && p.libraryOrder > 0) ? p.libraryOrder : 9999,
          instructor: null, _source: "digital_product" as const,
        }));

        const sqRows = await db.select().from(sonoQuizzes).where(eq(sonoQuizzes.status, "published"));
        const sqMapped = sqRows.map(q => ({
          id: q.id, slug: `quiz-${q.id}`, title: q.title, subtitle: q.description ?? null,
          description: q.description ?? null, coverImageUrl: q.coverImageUrl ?? null,
          status: "public" as const, type: "quiz" as const, brand: "aaus" as any,
          price: 0, isFree: true, isFeatured: false, showInLibrary: true,
          createdAt: q.createdAt, updatedAt: q.updatedAt, libraryOrder: 9999,
          instructor: null, _source: "sono_quiz" as const,
        }));

        // Global sort: libraryOrder asc (0 = unset → treated as 9999), then createdAt desc
        const combined = [...allEnriched, ...dpMapped, ...sqMapped].sort((a, b) => {
          const aOrder = ((a as any).libraryOrder === 0 ? 9999 : ((a as any).libraryOrder ?? 9999));
          const bOrder = ((b as any).libraryOrder === 0 ? 9999 : ((b as any).libraryOrder ?? 9999));
          if (aOrder !== bOrder) return aOrder - bOrder;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        const paginated = combined.slice(offset, offset + input.pageSize);
        return { courses: paginated, total: combined.length, page: input.page, pageSize: input.pageSize };
      }

      // Type-filtered path: single content type, limit/offset applied at DB level
      const courses = await db.select().from(lmsCourses).where(and(...conditions)).orderBy(asc(lmsCourses.libraryOrder), desc(lmsCourses.createdAt)).limit(input.pageSize).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lmsCourses).where(and(...conditions));
      const enriched = await enrichWithInstructors(courses);
      return { courses: enriched, total: Number(count), page: input.page, pageSize: input.pageSize };
    }),

  /** List featured courses for LMS home page */
  listFeatured: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Select only listing/card columns so partial Railway mirror schemas still work.
    const courses = await db.select({
      id: lmsCourses.id,
      slug: lmsCourses.slug,
      title: lmsCourses.title,
      subtitle: lmsCourses.subtitle,
      coverImageUrl: lmsCourses.coverImageUrl,
      status: lmsCourses.status,
      type: lmsCourses.type,
      brand: lmsCourses.brand,
      price: lmsCourses.price,
      isFree: lmsCourses.isFree,
      isFeatured: lmsCourses.isFeatured,
      updatedAt: lmsCourses.updatedAt,
    }).from(lmsCourses)
      .where(and(eq(lmsCourses.status, "public"), eq(lmsCourses.isFeatured, true)))
      .orderBy(desc(lmsCourses.updatedAt))
      .limit(8);
    // Batch-fetch primary instructors (avoids N+1)
    const courseIds = courses.map(c => c.id);
    let enriched: any[] = courses.map(c => ({ ...c, instructor: null }));
    if (courseIds.length > 0) {
      const ciRows = await db.select().from(lmsCourseInstructors)
        .where(and(
          sql`${lmsCourseInstructors.courseId} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`,
          eq(lmsCourseInstructors.isPrimary, true)
        ));
      const instructorIds = Array.from(new Set(ciRows.map(ci => ci.instructorId)));
      if (instructorIds.length > 0) {
        const insRows = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);

        const insMap = new Map(insRows.map(i => [i.id, i]));
        const ciMap = new Map(ciRows.map(ci => [ci.courseId, ci]));
        enriched = courses.map(c => {
          const ci = ciMap.get(c.id);
          return { ...c, instructor: ci ? (insMap.get(ci.instructorId) ?? null) : null };
        });
      }
    }
    return enriched;
  }),

  /** Get a single course by slug (public or preview) */
  getCourse: publicProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // draft is viewable via direct URL but CTAs are disabled ("Not Available For Purchase")
      // archived and private are not publicly accessible; hidden is accessible by direct URL
      // Admins can always see any course regardless of status
      const isAdmin = ctx.user?.role === "admin";
      if (!isAdmin) {
        if (course.status === "archived" || course.status === "private") throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Sections + preview lessons
      // Batch all sub-queries in parallel to avoid sequential round-trips
      const [sections, allLessonsRaw, cis, landingPageRow, pricingOptions, cohortSessions, cohortGroupsRaw] = await Promise.all([
        db.select().from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position)),
        db.select({
          id: lmsLessons.id, title: lmsLessons.title, type: lmsLessons.type,
          position: lmsLessons.position, isPreview: lmsLessons.isPreview, previewMode: lmsLessons.previewMode,
          durationMinutes: lmsLessons.durationMinutes, sectionId: lmsLessons.sectionId,
          lessonStatus: lmsLessons.lessonStatus,
        }).from(lmsLessons)
          .innerJoin(lmsSections, eq(lmsLessons.sectionId, lmsSections.id))
          .where(and(eq(lmsSections.courseId, course.id), eq(lmsLessons.lessonStatus, "published")))
          .orderBy(asc(lmsLessons.position)),
        db.select().from(lmsCourseInstructors).where(eq(lmsCourseInstructors.courseId, course.id)),
        db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, course.id)).limit(1),
        db.select().from(lmsPricingOptions)
          .where(and(eq(lmsPricingOptions.courseId, course.id), eq(lmsPricingOptions.isActive, true)))
          .orderBy(asc(lmsPricingOptions.sortOrder)),
        // Cohort sessions — only published, ordered by date (for cohort_sessions_auto landing block)
        db.select({
          id: lmsCohortSessions.id,
          title: lmsCohortSessions.title,
          description: lmsCohortSessions.description,
          sessionDate: lmsCohortSessions.sessionDate,
          durationMinutes: lmsCohortSessions.durationMinutes,
          timezone: lmsCohortSessions.timezone,
          meetingUrl: lmsCohortSessions.meetingUrl,
          status: lmsCohortSessions.status,
        }).from(lmsCohortSessions)
          .where(and(eq(lmsCohortSessions.courseId, course.id), eq(lmsCohortSessions.status, "published")))
          .orderBy(asc(lmsCohortSessions.sessionDate)),
        // Cohort groups — for waitlist mode detection on the landing page
        db.select({
          id: lmsCohortGroups.id,
          name: lmsCohortGroups.name,
          description: lmsCohortGroups.description,
          startDate: lmsCohortGroups.startDate,
          endDate: lmsCohortGroups.endDate,
          status: lmsCohortGroups.status,
          maxStudents: lmsCohortGroups.maxStudents,
          location: lmsCohortGroups.location,
          durationHours: lmsCohortGroups.durationHours,
          isFeaturedOnLanding: lmsCohortGroups.isFeaturedOnLanding,
          enrollmentCloseDate: lmsCohortGroups.enrollmentCloseDate,
          waitlistEnabled: lmsCohortGroups.waitlistEnabled,
          waitlistHeading: lmsCohortGroups.waitlistHeading,
          waitlistBody: lmsCohortGroups.waitlistBody,
          waitlistCtaLabel: lmsCohortGroups.waitlistCtaLabel,
          waitlistCtaUrl: lmsCohortGroups.waitlistCtaUrl,
          waitlistRedirectUrl: lmsCohortGroups.waitlistRedirectUrl,
          waitlistSuccessMessage: lmsCohortGroups.waitlistSuccessMessage,
          // Live enrollment count for available-seats calculation
          enrollmentCount: sql<number>`(SELECT COUNT(*) FROM lms_cohort_group_enrollments WHERE cohort_group_id = ${lmsCohortGroups.id})`,
        }).from(lmsCohortGroups)
          .where(and(eq(lmsCohortGroups.courseId, course.id), sql`${lmsCohortGroups.status} NOT IN ('archived', 'draft')`)),
      ]);

      // Group lessons by sectionId
      const lessonsBySectionId = new Map<number, typeof allLessonsRaw>();
      for (const lesson of allLessonsRaw) {
        const sid = lesson.sectionId ?? 0;
        const arr = lessonsBySectionId.get(sid) ?? [];
        arr.push(lesson);
        lessonsBySectionId.set(sid, arr);
      }
      // Filter out sections that have no published lessons
      const sectionsWithLessons = sections
        .map(s => ({ ...s, lessons: lessonsBySectionId.get(s.id) ?? [] }))
        .filter(s => s.lessons.length > 0);

      // Instructors — batch fetch
      let instructors: any[] = [];
      if (cis.length > 0) {
        const instructorIds = cis.map(ci => ci.instructorId);
        const insRows = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
        const insMap = new Map(insRows.map(i => [i.id, i]));
        instructors = cis.map(ci => {
          const ins = insMap.get(ci.instructorId);
          return ins ? { ...ins, revenueSharePct: ci.revenueSharePct, isPrimary: ci.isPrimary } : null;
        }).filter(Boolean);
      }

      const landingPage = landingPageRow[0] ?? null;

      // ── Capacity / sold-out helpers for cohort groups ──────────────────────────
      const now = new Date();
      // Closed groups that have ended remain in staff history, but are archived
      // from the public enrollment chooser. Waitlist presentation therefore
      // reflects whether another current or future group is actually available.
      const visibleCohortGroups = cohortGroupsRaw.filter((g) => {
        const end = g.endDate ?? g.startDate;
        return !end || new Date(end) >= now;
      });
      const isCohortGroupOnSale = (g: typeof cohortGroupsRaw[0]) => {
        if (g.status !== "open") return false;
        if (g.enrollmentCloseDate && !isScheduledDeadlineOpen(g.enrollmentCloseDate, "America/New_York", now)) return false;
        // Capacity check — if capacity is set and fully enrolled, not on sale
        if (g.maxStudents != null && Number(g.enrollmentCount ?? 0) >= g.maxStudents) return false;
        return true;
      };
      const isCohortGroupSoldOut = (g: typeof cohortGroupsRaw[0]) => {
        if (g.status !== "open") return false;
        if (g.enrollmentCloseDate && !isScheduledDeadlineOpen(g.enrollmentCloseDate, "America/New_York", now)) return false;
        // Must have capacity set and be at/over it
        return g.maxStudents != null && Number(g.enrollmentCount ?? 0) >= g.maxStudents;
      };

      // Determine featured cohort group and waitlist mode for the landing page.
      // Priority: (1) admin-pinned isFeaturedOnLanding group, (2) next upcoming open group
      // whose startDate is still in the future (not in-progress), (3) first non-archived group.
      // "active" (in-progress) groups are intentionally skipped for the hero/single display.
      const nextUpcomingOpen = visibleCohortGroups
        .filter(g => g.status === "open" && g.startDate && new Date(g.startDate) > now)
        .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())[0] ?? null;
      const featuredGroup =
        visibleCohortGroups.find(g => g.isFeaturedOnLanding) ??
        nextUpcomingOpen ??
        visibleCohortGroups[0] ?? null;
      // hasOpenGroup: true only if at least one group is on sale (date-valid AND not at capacity)
      const hasOpenGroup = visibleCohortGroups.some(isCohortGroupOnSale);
      // soldOutGroups: date-valid but at capacity
      const soldOutGroups = visibleCohortGroups.filter(isCohortGroupSoldOut);
      // Include all non-archived cohort groups so the Live Sessions Auto block can show them
      const cohortGroups = visibleCohortGroups;
      return { ...course, sections: sectionsWithLessons, instructors: instructors.filter(Boolean), landingPage, pricingOptions, cohortSessions, featuredGroup, hasOpenGroup, soldOutGroups, cohortGroups };
    }),

  /** Get instructor public profile */
  getInstructor: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [instructor] = await db.select().from(lmsInstructors).where(and(eq(lmsInstructors.id, input.id), eq(lmsInstructors.isActive, true))).limit(1);
      if (!instructor) throw new TRPCError({ code: "NOT_FOUND" });
      // Courses taught
      const cis = await db.select({ courseId: lmsCourseInstructors.courseId }).from(lmsCourseInstructors).where(eq(lmsCourseInstructors.instructorId, input.id));
      const courseIds = cis.map(c => c.courseId);
      const courses = courseIds.length > 0
        ? await db.select({ id: lmsCourses.id, slug: lmsCourses.slug, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, status: lmsCourses.status })
            .from(lmsCourses).where(and(eq(lmsCourses.status, "public"), sql`${lmsCourses.id} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`))
        : [];
      return { ...instructor, courses };
    }),

  /** List all active instructors */
  listInstructors: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(lmsInstructors).where(eq(lmsInstructors.isActive, true)).orderBy(asc(lmsInstructors.name));
  }),

  /** List all published collections (with course count) */
  listCollections: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const collections = await db.select().from(lmsCollections)
      .where(eq(lmsCollections.isPublished, true))
      .orderBy(asc(lmsCollections.position));
    return Promise.all(collections.map(async (col) => {
      // Count from new lmsCollectionItems table: only items whose underlying content is published/public
      const newItems = await db.select({ itemType: lmsCollectionItems.itemType, itemId: lmsCollectionItems.itemId })
        .from(lmsCollectionItems).where(eq(lmsCollectionItems.collectionId, col.id));
      let publishedCount = 0;
      if (newItems.length > 0) {
        // Check each item's published status
        for (const item of newItems) {
          if (item.itemType === "course" || item.itemType === "quiz") {
            const [r] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
              .where(and(eq(lmsCourses.id, item.itemId), eq(lmsCourses.status, "public"))).limit(1);
            if (r) publishedCount++;
          } else if (item.itemType === "download") {
            const [r] = await db.select({ id: digitalProducts.id }).from(digitalProducts)
              .where(and(eq(digitalProducts.id, item.itemId), eq(digitalProducts.status, "published"))).limit(1);
            if (r) publishedCount++;
          } else if (item.itemType === "workshop") {
            const [r] = await db.select({ id: workshops.id }).from(workshops)
              .where(and(eq(workshops.id, item.itemId), eq(workshops.status, "public"))).limit(1);
            if (r) publishedCount++;
          } else {
            // For other types (webinar, bundle, membership, physical) count as published if in the table
            publishedCount++;
          }
        }
      } else {
        // Legacy: count only public courses from lmsCollectionCourses
        const legacyItems = await db.select({ courseId: lmsCollectionCourses.courseId })
          .from(lmsCollectionCourses).where(eq(lmsCollectionCourses.collectionId, col.id));
        for (const item of legacyItems) {
          const [r] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
            .where(and(eq(lmsCourses.id, item.courseId), eq(lmsCourses.status, "public"))).limit(1);
          if (r) publishedCount++;
        }
      }
      return { ...col, courseCount: publishedCount };
    }));
  }),

  /** Get a single collection with its courses */
  getCollection: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [col] = await db.select().from(lmsCollections)
        .where(and(eq(lmsCollections.id, input.id), eq(lmsCollections.isPublished, true))).limit(1);
      if (!col) throw new TRPCError({ code: "NOT_FOUND" });

      // Fetch from new lmsCollectionItems table (supports all content types)
      const newItems = await db.select().from(lmsCollectionItems)
        .where(eq(lmsCollectionItems.collectionId, col.id)).orderBy(asc(lmsCollectionItems.position));

      // Fetch from legacy lmsCollectionCourses table (backward compat)
      const legacyCourses = await db.select().from(lmsCollectionCourses)
        .where(eq(lmsCollectionCourses.collectionId, col.id)).orderBy(asc(lmsCollectionCourses.position));

      // Resolve new items
      const resolvedNewItems = await Promise.all(newItems.map(async (item) => {
        if (item.itemType === "course" || item.itemType === "quiz") {
          const [c] = await db.select().from(lmsCourses)
            .where(and(eq(lmsCourses.id, item.itemId), eq(lmsCourses.status, "public"))).limit(1);
          if (!c) return null;
          // For cohorts, attach the primary open/active group
          let primaryCohortGroup: { name: string; startDate: Date | null; endDate: Date | null } | null = null;
          if (c.type === "cohort") {
            const [grp] = await db.select({ name: lmsCohortGroups.name, startDate: lmsCohortGroups.startDate, endDate: lmsCohortGroups.endDate })
              .from(lmsCohortGroups)
              .where(and(eq(lmsCohortGroups.courseId, c.id), sql`${lmsCohortGroups.status} IN ('open','active')`))
              .orderBy(asc(lmsCohortGroups.sortOrder), asc(lmsCohortGroups.startDate))
              .limit(1);
            primaryCohortGroup = grp ?? null;
          }
          return { ...c, _source: "lms_course" as const, _itemType: item.itemType, primaryCohortGroup };
        } else if (item.itemType === "download") {
          const [p] = await db.select().from(digitalProducts)
            .where(and(eq(digitalProducts.id, item.itemId), eq(digitalProducts.status, "published"))).limit(1);
          return p ? { id: p.id, slug: p.slug, title: p.title, subtitle: p.subtitle ?? null, coverImageUrl: p.thumbnailUrl ?? null, price: p.price, isFree: p.isFree, type: "download" as const, _source: "digital_product" as const, _itemType: "download" } : null;
        } else if (item.itemType === "physical") {
          const [p] = await db.select().from(physicalProducts)
            .where(and(eq(physicalProducts.id, item.itemId), eq(physicalProducts.status, "published"))).limit(1);
          return p ? { id: p.id, slug: p.slug, title: p.title, subtitle: null as null, coverImageUrl: p.imageUrl ?? null, price: p.price, isFree: false, type: "physical" as const, _source: "physical_product" as const, _itemType: "physical" } : null;
        } else if (item.itemType === "webinar") {
          const [w] = await db.select().from(webinars)
            .where(and(eq(webinars.id, item.itemId), eq(webinars.status, "published"))).limit(1);
          if (!w) return null;
          const wPricing = (() => { try { const opts = JSON.parse((w as any).pricingOptions ?? "[]"); return Array.isArray(opts) && opts.length > 0 ? Math.min(...opts.map((o: any) => Number(o.price || 0))) : 0; } catch { return 0; } })();
          return { id: w.id, slug: w.slug, title: w.title, subtitle: null as null, coverImageUrl: (w as any).thumbnailUrl ?? (w as any).coverImage ?? null, price: wPricing, isFree: w.accessType === "free", type: "webinar" as const, _source: "webinar" as const, _itemType: "webinar" };
        } else if (item.itemType === "bundle") {
          const [b] = await db.select().from(bundles)
            .where(and(eq(bundles.id, item.itemId), eq(bundles.status, "published"))).limit(1);
          if (!b) return null;
          const bPricing = (() => { try { const opts = JSON.parse((b as any).pricingOptions ?? "[]"); return Array.isArray(opts) && opts.length > 0 ? Math.min(...opts.map((o: any) => Number(o.price || 0))) : 0; } catch { return 0; } })();
          return { id: b.id, slug: b.slug, title: b.title, subtitle: null as null, coverImageUrl: (b as any).coverImage ?? null, price: bPricing, isFree: bPricing === 0, type: "bundle" as const, _source: "bundle" as const, _itemType: "bundle" };
        } else if (item.itemType === "membership") {
          const [m] = await db.select().from(membershipPlans)
            .where(and(eq(membershipPlans.id, item.itemId), eq(membershipPlans.status, "published"))).limit(1);
          return m ? { id: m.id, slug: m.slug, title: m.title, subtitle: null as null, coverImageUrl: (m as any).coverImage ?? null, price: m.price ?? 0, isFree: false, type: "membership" as const, _source: "membership" as const, _itemType: "membership" } : null;
        } else if (item.itemType === "workshop") {
          const [w] = await db.select().from(workshops)
            .where(and(eq(workshops.id, item.itemId), eq(workshops.status, "public"))).limit(1);
          if (!w) return null;
          const now = new Date();
          const [nextInst] = await db.select({
            startDate: workshopInstances.startDate,
            endDate: workshopInstances.endDate,
            locationType: workshopInstances.locationType,
            venueName: workshopInstances.venueName,
            venueCity: workshopInstances.venueCity,
            venueState: workshopInstances.venueState,
          }).from(workshopInstances)
            .where(and(eq(workshopInstances.workshopId, w.id), eq(workshopInstances.status, "published"), gte(workshopInstances.startDate, now)))
            .orderBy(asc(workshopInstances.startDate)).limit(1);
          return { id: w.id, slug: w.slug, title: w.title, subtitle: w.subtitle ?? null, coverImageUrl: w.coverImageUrl ?? w.thumbnailUrl ?? null, price: w.price, isFree: w.isFree, type: "workshop" as const, _source: "workshop" as const, _itemType: "workshop", nextInstance: nextInst ?? null };
        }
        return null;
      }));

      // Resolve legacy course items
      const resolvedLegacy = await Promise.all(legacyCourses.map(async ({ courseId }) => {
        const [c] = await db.select().from(lmsCourses)
          .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.status, "public"))).limit(1);
        if (!c) return null;
        let primaryCohortGroup: { name: string; startDate: Date | null; endDate: Date | null } | null = null;
        if (c.type === "cohort") {
          const [grp] = await db.select({ name: lmsCohortGroups.name, startDate: lmsCohortGroups.startDate, endDate: lmsCohortGroups.endDate })
            .from(lmsCohortGroups)
            .where(and(eq(lmsCohortGroups.courseId, c.id), sql`${lmsCohortGroups.status} IN ('open','active')`))
            .orderBy(asc(lmsCohortGroups.sortOrder), asc(lmsCohortGroups.startDate))
            .limit(1);
          primaryCohortGroup = grp ?? null;
        }
        return { ...c, _source: "lms_course" as const, _itemType: c.type, primaryCohortGroup };
      }));

      // Merge: prefer new items if any exist, otherwise use legacy
      const allItems = newItems.length > 0 ? resolvedNewItems.filter(Boolean) : resolvedLegacy.filter(Boolean);

      return { ...col, courses: allItems };
    }),

  /** Fetch course title + sections + lessons by course ID — used by curriculum_auto block on funnel pages */
  getCurriculumById: publicProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [course] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, status: lmsCourses.status })
        .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) return null;
      const sections = await db.select().from(lmsSections)
        .where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));
      const sectionsWithLessons = await Promise.all(sections.map(async (s) => {
        const lessons = await db.select({
          id: lmsLessons.id, title: lmsLessons.title, type: lmsLessons.type,
          position: lmsLessons.position, isPreview: lmsLessons.isPreview,
          previewMode: lmsLessons.previewMode, durationMinutes: lmsLessons.durationMinutes,
        }).from(lmsLessons).where(
          and(eq(lmsLessons.sectionId, s.id), eq(lmsLessons.lessonStatus, "published"))
        ).orderBy(asc(lmsLessons.position));
        return { ...s, lessons };
      }));
      // Filter out sections that have no published lessons
      const publishedSections = sectionsWithLessons.filter(s => s.lessons.length > 0);
      return { id: course.id, title: course.title, slug: course.slug, sections: publishedSections };
    }),

  /** Resolve a course/download ID to its slug (used for opt-out link redirect) */
  getSlugById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [c] = await db.select({ slug: lmsCourses.slug }).from(lmsCourses)
        .where(eq(lmsCourses.id, input.id)).limit(1);
      return c?.slug ?? null;
    }),

  /**
   * Guest free-preview enrollment — no login required.
   * Captures name + email, creates a free_preview_enrollments row, returns an access token.
   */
  registerFreePreview: publicProcedure
    .input(z.object({
      courseId: z.number(),
      email: z.string().email(),
      firstName: z.string().min(1).max(100),
      lastName: z.string().max(100).optional(),
      source: z.string().max(128).optional(),
      utmSource: z.string().max(128).optional(),
      utmMedium: z.string().max(128).optional(),
      utmCampaign: z.string().max(128).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if already registered for this course+email
      const [existing] = await db
        .select({ id: freePreviewEnrollments.id, accessToken: freePreviewEnrollments.accessToken, accessExpiresAt: freePreviewEnrollments.accessExpiresAt })
        .from(freePreviewEnrollments)
        .where(and(eq(freePreviewEnrollments.courseId, input.courseId), eq(freePreviewEnrollments.email, input.email.toLowerCase())))
        .limit(1);
      if (existing) {
        // Already registered — return existing token (refresh expiry)
        const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.update(freePreviewEnrollments)
          .set({ accessExpiresAt: newExpiry, updatedAt: new Date() })
          .where(eq(freePreviewEnrollments.id, existing.id));
        return { accessToken: existing.accessToken, isNew: false };
      }
      const accessToken = randomBytes(32).toString("hex");
      const accessExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(freePreviewEnrollments).values({
        courseId: input.courseId,
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        source: input.source ?? "course_landing",
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        accessToken,
        accessExpiresAt,
      });
      // Fetch course title for confirmation email
      const [course] = await db
        .select({ title: lmsCourses.title, slug: lmsCourses.slug })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (course) {
        try {
          const previewUrl = `https://app.allaboutultrasound.com/courses/${course.slug}?preview_token=${accessToken}`;
          const emailData = buildFreePreviewConfirmationEmail({
            firstName: input.firstName,
            courseTitle: course.title,
            previewUrl,
            accessExpiresAt,
          });
          await sendEmail({
            to: { name: input.firstName + (input.lastName ? ` ${input.lastName}` : ""), email: input.email.toLowerCase() },
            subject: emailData.subject,
            htmlBody: emailData.htmlBody,
            previewText: emailData.previewText,
          });
        } catch (emailErr) {
          // Non-fatal — log but don't fail the registration
          console.error("[FreePreview] Failed to send confirmation email:", emailErr);
        }
      }
      return { accessToken, isNew: true };
    }),

  /** Check if an access token is valid for a given course (used by player to gate preview lessons). */
  checkFreePreviewToken: publicProcedure
    .input(z.object({ courseId: z.number(), accessToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { valid: false };
      const [row] = await db
        .select({ id: freePreviewEnrollments.id, accessExpiresAt: freePreviewEnrollments.accessExpiresAt })
        .from(freePreviewEnrollments)
        .where(and(
          eq(freePreviewEnrollments.courseId, input.courseId),
          eq(freePreviewEnrollments.accessToken, input.accessToken),
        ))
        .limit(1);
      if (!row) return { valid: false };
      if (row.accessExpiresAt < new Date()) return { valid: false, expired: true };
      return { valid: true };
    }),

  /** Join the waitlist for a cohort group */
  joinCohortWaitlist: publicProcedure
    .input(z.object({
      cohortGroupId: z.number(),
      courseId: z.number(),
      name: z.string().min(1).max(255),
      email: z.string().email(),
      phone: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check for duplicate
      const [existing] = await db.select({ id: cohortWaitlistEntries.id })
        .from(cohortWaitlistEntries)
        .where(and(
          eq(cohortWaitlistEntries.cohortGroupId, input.cohortGroupId),
          eq(cohortWaitlistEntries.email, input.email),
        ))
        .limit(1);
      if (existing) return { success: true, alreadyRegistered: true };
      await db.insert(cohortWaitlistEntries).values({
        cohortGroupId: input.cohortGroupId,
        courseId: input.courseId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        message: input.message ?? null,
      });
      // Notify admin of new waitlist signup
      try {
        await sendEmail({
          to: getPlatformAdminRecipient(),
          subject: `New Waitlist Signup — Course Cohort Group #${input.cohortGroupId}`,
          htmlBody: `<h2>New Cohort Waitlist Lead</h2><p><strong>Name:</strong> ${input.name}</p><p><strong>Email:</strong> ${input.email}</p>${input.phone ? `<p><strong>Phone:</strong> ${input.phone}</p>` : ""}<p><strong>Course ID:</strong> ${input.courseId}</p><p><strong>Cohort Group ID:</strong> ${input.cohortGroupId}</p>${input.message ? `<p><strong>Message:</strong> ${input.message}</p>` : ""}<p><em>Signed up at ${new Date().toUTCString()}</em></p>`,
        });
      } catch (e) {
        console.error("[waitlist] Failed to send admin notification:", e);
      }
      return { success: true, alreadyRegistered: false };
    }),

  /** Public: get landing blocks + basic info for a specific cohort group */
  getCohortGroupPage: publicProcedure
    .input(z.object({ cohortGroupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { getCohortGroupById, getCohortGroupLandingBlocks } = await import("../lib/cohortGroupQuery");
      const row = await getCohortGroupById(db, input.cohortGroupId);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const landingBlocks = row.landingBlocks
        ? (JSON.parse(row.landingBlocks) as unknown[])
        : await getCohortGroupLandingBlocks(db, input.cohortGroupId);
      // Count current enrollments for sold-out detection
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(lmsCohortGroupEnrollments)
        .where(eq(lmsCohortGroupEnrollments.cohortGroupId, input.cohortGroupId));
      const enrollmentCount = Number(countRow?.count ?? 0);
      const isSoldOut = row.maxStudents != null && enrollmentCount >= row.maxStudents;
      return {
        id: row.id,
        courseId: row.courseId,
        name: row.name,
        description: row.description,
        startDate: row.startDate,
        endDate: row.endDate,
        enrollmentCloseDate: row.enrollmentCloseDate,
        isSoldOut,
        status: row.status,
        landingBlocks,
      };
    }),

  /** Public: get live seat availability for a cohort group (no cache — real-time) */
  getCohortSeatAvailability: publicProcedure
    .input(z.object({ cohortGroupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db
        .select({ id: lmsCohortGroups.id, name: lmsCohortGroups.name, maxStudents: lmsCohortGroups.maxStudents, status: lmsCohortGroups.status, endDate: lmsCohortGroups.endDate })
        .from(lmsCohortGroups)
        .where(eq(lmsCohortGroups.id, input.cohortGroupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      // Count active enrollments directly from the enrollments table for accuracy
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(lmsCohortGroupEnrollments)
        .where(eq(lmsCohortGroupEnrollments.cohortGroupId, input.cohortGroupId));
      const isArchived = Boolean(group.endDate && new Date(group.endDate) < new Date() && (group.status === "waitlist" || group.status === "enrollment_closed"));
      return {
        cohortGroupId: group.id,
        name: group.name,
        enrollmentOpen: !isArchived && group.status !== "waitlist" && group.status !== "enrollment_closed",
        hideEnrollmentPresentation: isArchived || group.status === "waitlist" || group.status === "enrollment_closed",
        lifecycleStatus: isArchived ? "archived" : group.status,
      };
    }),

  /** Public: get published live sessions for a specific cohort group (for calendar embed) */
  getCohortGroupSessions: publicProcedure
    .input(z.object({ cohortGroupId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db
        .select({
          id: lmsCohortGroups.id,
          name: lmsCohortGroups.name,
          courseId: lmsCohortGroups.courseId,
          startDate: lmsCohortGroups.startDate,
          endDate: lmsCohortGroups.endDate,
        })
        .from(lmsCohortGroups)
        .where(eq(lmsCohortGroups.id, input.cohortGroupId))
        .limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      // Fetch published sessions for this group OR shared sessions (no group assignment)
      const sessions = await db
        .select({
          id: lmsCohortSessions.id,
          title: lmsCohortSessions.title,
          description: lmsCohortSessions.description,
          sessionDate: lmsCohortSessions.sessionDate,
          durationMinutes: lmsCohortSessions.durationMinutes,
          timezone: lmsCohortSessions.timezone,
          meetingUrl: lmsCohortSessions.meetingUrl,
          recordingUrl: lmsCohortSessions.recordingUrl,
          status: lmsCohortSessions.status,
          cohortGroupId: lmsCohortSessions.cohortGroupId,
        })
        .from(lmsCohortSessions)
        .where(
          and(
            eq(lmsCohortSessions.courseId, group.courseId),
            eq(lmsCohortSessions.status, "published"),
            sql`(${lmsCohortSessions.cohortGroupId} = ${input.cohortGroupId} OR ${lmsCohortSessions.cohortGroupId} IS NULL)`,
          )
        )
        .orderBy(asc(lmsCohortSessions.sessionDate));
      return {
        groupId: group.id,
        groupName: group.name,
        groupStartDate: group.startDate,
        groupEndDate: group.endDate,
        sessions,
      };
    }),

  submitDraftNotify: publicProcedure
    .input(z.object({
      productType: z.string().default("course"),
      productId: z.number().int(),
      productTitle: z.string().optional(),
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const existing = await db.select({ id: draftNotifyEntries.id })
        .from(draftNotifyEntries)
        .where(and(
          eq(draftNotifyEntries.productType, input.productType),
          eq(draftNotifyEntries.productId, input.productId),
          eq(draftNotifyEntries.email, input.email.toLowerCase().trim()),
        ))
        .limit(1);
      if (existing.length > 0) return { success: true, duplicate: true };
      await db.insert(draftNotifyEntries).values({
        productType: input.productType,
        productId: input.productId,
        productTitle: input.productTitle ?? null,
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
      });
      return { success: true, duplicate: false };
    }),
});

// ─── Learner Router ───────────────────────────────────────────────────────────

// ─── Learner Router ───────────────────────────────────────────────────────────



// ─── Public Financial Disclosure Procedures ──────────────────────────────────
export const lmsDisclosurePublicRouter = router({
  getDisclosureByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { cmeFinancialDisclosures, lmsCourses } = await import("../../drizzle/schema").then(m => m);
      const [row] = await db
        .select({
          id: cmeFinancialDisclosures.id,
          token: cmeFinancialDisclosures.token,
          courseId: cmeFinancialDisclosures.courseId,
          facultyName: cmeFinancialDisclosures.facultyName,
          facultyEmail: cmeFinancialDisclosures.facultyEmail,
          status: cmeFinancialDisclosures.status,
          sentAt: cmeFinancialDisclosures.sentAt,
          submittedAt: cmeFinancialDisclosures.submittedAt,
          rolesJson: cmeFinancialDisclosures.rolesJson,
          relationshipsJson: cmeFinancialDisclosures.relationshipsJson,
          courseTitle: lmsCourses.title,
        })
        .from(cmeFinancialDisclosures)
        .leftJoin(lmsCourses, eq(cmeFinancialDisclosures.courseId, lmsCourses.id))
        .where(eq(cmeFinancialDisclosures.token, input.token))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "This disclosure link is invalid or has expired." });
      return row;
    }),

  submitDisclosure: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      responseJson: z.string(), // JSON string of form responses
      attestationName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { cmeFinancialDisclosures, lmsCourses } = await import("../../drizzle/schema").then(m => m);
      const [row] = await db
        .select()
        .from(cmeFinancialDisclosures)
        .where(eq(cmeFinancialDisclosures.token, input.token))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "This disclosure link is invalid." });
      if (row.status === "submitted") throw new TRPCError({ code: "BAD_REQUEST", message: "This disclosure has already been submitted." });

      const now = new Date();
      const parsed = (() => { try { return JSON.parse(input.responseJson); } catch { return {}; } })();
      await db.update(cmeFinancialDisclosures)
        .set({
          status: "submitted",
          submittedAt: now,
          rolesJson: JSON.stringify(parsed.roles ?? []),
          relationshipsJson: JSON.stringify(parsed.relationships ?? []),
          noRelationships: parsed.hasRelationships === "no" ? 1 : 0,
          attestationName: input.attestationName,
          attestationDate: now.toISOString().split("T")[0],
          // Auto-mark as received: electronic submission = form received
          receivedAt: now,
          receivedNotes: "Received electronically via online submission form",
        })
        .where(eq(cmeFinancialDisclosures.token, input.token));

      // Get course title for the notification email
      const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses).where(eq(lmsCourses.id, row.courseId)).limit(1);
      const courseTitle = course?.title ?? "Unknown Course";

      // Send notification emails to admin and CardioServ defaults
      const notifyEmails = [
        getPlatformAdminRecipient(),
        { email: "don@cardioserv.net", name: "Don Gerig" },
        { email: "j.buckland@cardioserv.net", name: "Judith Buckland" },
      ];

      const responseData = (() => { try { return JSON.parse(input.responseJson); } catch { return {}; } })();
      const htmlBody = `
        <h2 style="color:#189aa1;">Financial Disclosure Submitted</h2>
        <p><strong>${row.facultyName}</strong> has completed their Financial Disclosure Form.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Faculty</td><td style="padding:6px 12px;">${row.facultyName}</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Email</td><td style="padding:6px 12px;">${row.facultyEmail}</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Course</td><td style="padding:6px 12px;">${courseTitle}</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Submitted</td><td style="padding:6px 12px;">${now.toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Attestation Name</td><td style="padding:6px 12px;">${input.attestationName}</td></tr>
        </table>
        <p style="font-size:12px;color:#666;">Log in to the admin panel to view the full submission and mark it as received.</p>
      `;

      // Generate PDF of the completed disclosure form and attach to notification emails
      let pdfAttachment: { content: string; type: string; filename: string } | null = null;
      try {
        const pdfBuffer = await generateDisclosurePdf({
          facultyName: row.facultyName,
          facultyEmail: row.facultyEmail,
          courseTitle,
          roles: parsed.roles ?? [],
          hasRelationships: parsed.hasRelationships === "yes" ? "yes" : "no",
          relationships: parsed.relationships ?? [],
          attestationName: input.attestationName,
          attestationDate: now.toISOString().split("T")[0],
          submittedAt: now,
        });
        pdfAttachment = {
          content: pdfBuffer.toString("base64"),
          type: "application/pdf",
          filename: `Financial-Disclosure-${row.facultyName.replace(/[^a-z0-9]/gi, "-")}-${now.toISOString().split("T")[0]}.pdf`,
        };
      } catch (pdfErr) {
        console.error("[disclosure] Failed to generate PDF attachment:", pdfErr);
      }

      for (const recipient of notifyEmails) {
        await sendEmail({
          to: recipient,
          subject: `Financial Disclosure Submitted — ${row.facultyName} (${courseTitle})`,
          htmlBody,
          ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
        }).catch(() => {});
      }

      return { success: true };
    }),

  // ── Generic (no-token) disclosure form submission ─────────────────────────────────
  // Used by the standalone /cme-disclosure/generic page.
  // No token or course link required — faculty enter their own details.
  submitGenericDisclosure: publicProcedure
    .input(z.object({
      facultyName: z.string().min(1),
      facultyEmail: z.string().email(),
      activityTitle: z.string().min(1),
      responseJson: z.string(),
      attestationName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const parsed = (() => { try { return JSON.parse(input.responseJson); } catch { return {}; } })();

      // Save to DB for admin tracking
      try {
        const db = await getDb();
        if (db) {
          const { cmeGenericDisclosures } = await import("../../drizzle/schema").then(m => m);
          await db.insert(cmeGenericDisclosures).values({
            facultyName: input.facultyName,
            facultyEmail: input.facultyEmail,
            activityTitle: input.activityTitle,
            rolesJson: JSON.stringify(parsed.roles ?? []),
            relationshipsJson: JSON.stringify(parsed.relationships ?? []),
            noRelationships: parsed.hasRelationships === "no" ? 1 : 0,
            attestationName: input.attestationName,
            attestationDate: now.toISOString().split("T")[0],
            submittedAt: now,
            createdAt: now,
          });
        }
      } catch (dbErr) {
        console.error("[generic-disclosure] Failed to save to DB:", dbErr);
        // Non-fatal: still send emails
      }

      const notifyEmails = [
        getPlatformAdminRecipient(),
        { email: "don@cardioserv.net", name: "Don Gerig" },
        { email: "j.buckland@cardioserv.net", name: "Judith Buckland" },
      ];

      const htmlBody = `
        <h2 style="color:#189aa1;">Financial Disclosure Submitted (Generic Form)</h2>
        <p><strong>${input.facultyName}</strong> has completed a Financial Disclosure Form.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Faculty</td><td style="padding:6px 12px;">${input.facultyName}</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Email</td><td style="padding:6px 12px;">${input.facultyEmail}</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Activity</td><td style="padding:6px 12px;">${input.activityTitle}</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Submitted</td><td style="padding:6px 12px;">${now.toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
          <tr><td style="padding:6px 12px;background:#f0fafa;font-weight:600;">Attestation Name</td><td style="padding:6px 12px;">${input.attestationName}</td></tr>
        </table>
        <p style="font-size:12px;color:#666;">This was submitted via the generic (standalone) disclosure form.</p>
      `;

      // Generate PDF attachment
      let pdfAttachment: { content: string; type: string; filename: string } | null = null;
      try {
        const pdfBuffer = await generateDisclosurePdf({
          facultyName: input.facultyName,
          facultyEmail: input.facultyEmail,
          courseTitle: input.activityTitle,
          roles: parsed.roles ?? [],
          hasRelationships: parsed.hasRelationships === "yes" ? "yes" : "no",
          relationships: parsed.relationships ?? [],
          attestationName: input.attestationName,
          attestationDate: now.toISOString().split("T")[0],
          submittedAt: now,
        });
        pdfAttachment = {
          content: pdfBuffer.toString("base64"),
          type: "application/pdf",
          filename: `Financial-Disclosure-${input.facultyName.replace(/[^a-z0-9]/gi, "-")}-${now.toISOString().split("T")[0]}.pdf`,
        };
      } catch (pdfErr) {
        console.error("[generic-disclosure] Failed to generate PDF:", pdfErr);
      }

      for (const recipient of notifyEmails) {
        await sendEmail({
          to: recipient,
          subject: `Financial Disclosure Submitted — ${input.facultyName} (${input.activityTitle})`,
          htmlBody,
          ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
        }).catch(() => {});
      }

      return { success: true };
    }),
});

export const lmsLearnerRouter = router({
  /** Get all enrollments for the current user */
  getMyCourses: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const enrollments = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.userId, ctx.user.id)).orderBy(desc(lmsEnrollments.enrolledAt));
    if (enrollments.length === 0) return [];
    const courseIds = [...new Set(enrollments.map(e => e.courseId))];
    const coursesRaw = await db.select({ id: lmsCourses.id, slug: lmsCourses.slug, title: lmsCourses.title, coverImageUrl: lmsCourses.coverImageUrl, type: lmsCourses.type })
      .from(lmsCourses)
      .where(sql`${lmsCourses.id} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`);
    const courseMap = new Map(coursesRaw.map(c => [c.id, c]));
    return enrollments.map(e => ({ ...e, course: courseMap.get(e.courseId) ?? null }));
  }),

  /** Get full course content for enrolled user (or preview lessons) */
  getCoursePlayer: protectedProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Check enrollment first — must happen before isAdminPreview check (expiry-aware)
      const { resolveEnrollmentByCourseSlug } = await import("../lib/enrollmentAccess");
      const enrollmentAccess = await resolveEnrollmentByCourseSlug(db as any, ctx.user.id, input.slug);
      let enrollment: typeof lmsEnrollments.$inferSelect | null = null;
      if (enrollmentAccess) {
        const [fullRow] = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.id, enrollmentAccess.id)).limit(1);
        enrollment = fullRow ?? null;
      }

      // Admin preview mode: only active when admin is NOT enrolled AND explicitly requested preview.
      const isAdminPreview = input.preview && ctx.user.role === "admin" && !enrollment;

      // Paid pre-sale enrollment confirms a seat, but course content stays restricted until opening.
      if (enrollment?.enrollmentType === "presale" && ctx.user.role !== "admin") {
        const [presaleGroup] = await db.select({
          heading: lmsCohortGroups.presaleWelcomeHeading,
          body: lmsCohortGroups.presaleWelcomeBody,
          mediaUrl: lmsCohortGroups.presaleWelcomeMediaUrl,
          ctaLabel: lmsCohortGroups.presaleWelcomeCtaLabel,
          ctaUrl: lmsCohortGroups.presaleWelcomeCtaUrl,
        }).from(lmsCohortGroupEnrollments)
          .innerJoin(lmsCohortGroups, eq(lmsCohortGroups.id, lmsCohortGroupEnrollments.cohortGroupId))
          .where(eq(lmsCohortGroupEnrollments.enrollmentId, enrollment.id))
          .limit(1);
        return {
          course,
          enrollment,
          sections: [],
          topLevelLessons: [],
          progress: [],
          instructors: [],
          lessonInstructorsMap: {},
          isAdminPreview: false,
          isPresale: true,
          presaleWelcome: resolvePresaleWelcome(presaleGroup, {
            heading: course.presaleWelcomeHeading,
            body: course.presaleWelcomeBody,
            mediaUrl: course.presaleWelcomeMediaUrl,
            ctaLabel: course.presaleWelcomeCtaLabel,
            ctaUrl: course.presaleWelcomeCtaUrl,
          }),
        };
      }

      // Fetch sections + lessons via section join (includes section-owned rows with null course_id)
      const lessonTree = await loadPublishedCourseLessonTree(db as any, course.id, {
        hideEmptySections: !isAdminPreview,
      });
      const allCourseLessons = lessonTree.allLessons;
      const toSidebarLesson = (lesson: (typeof allCourseLessons)[number]) => {
        const { contentBlocks, content, embedUrl, videoContent, learningObjectives, ...rest } = lesson as typeof lesson & {
          content?: string | null;
          embedUrl?: string | null;
          videoContent?: string | null;
          learningObjectives?: string | null;
        };
        return {
          ...rest,
          hasAssessmentContent: lessonHasAssessmentContent({ type: lesson.type, contentBlocks }),
        };
      };
      const sectionsWithLessons = lessonTree.sections.map((section) => ({
        ...section,
        lessons: section.lessons.map(toSidebarLesson),
      }));
      const topLevelLessons = lessonTree.topLevelLessons.map(toSidebarLesson);

      // Progress
      let progress: typeof lmsLessonProgress.$inferSelect[] = [];
      if (enrollment) {
        progress = await db.select().from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, enrollment.id));
      }

      // For admin preview, provide a synthetic enrollment so the player renders
      const effectiveEnrollment = enrollment ?? (isAdminPreview ? { id: -1, userId: ctx.user.id, courseId: course.id, enrolledAt: new Date(), progressPct: 0, completedAt: null, lastAccessedAt: new Date(), certificateIssuedAt: null } as any : null);

      // Track IP access for paid content monitoring (non-blocking)
      if (enrollment && !course.isFree && ctx.user.role !== "admin") {
        const { logIpAccess } = await import("../jobs/sharingMonitor");
        const fwd = ctx.req?.headers?.["x-forwarded-for"];
        const ip = typeof fwd === "string" ? fwd.split(",")[0].trim() : ctx.req?.socket?.remoteAddress || "unknown";
        logIpAccess({ userId: ctx.user.id, ipAddress: ip, userAgent: ctx.req?.headers?.["user-agent"] || undefined, contentType: "course", contentId: course.id }).catch(() => {});
      }

      // Fetch course instructors (for right-panel instructor card)
      const courseInstructorLinks = await db.select().from(lmsCourseInstructors)
        .where(eq(lmsCourseInstructors.courseId, course.id));
      const instructorIds = courseInstructorLinks.map(l => l.instructorId);
      let instructors: typeof lmsInstructors.$inferSelect[] = [];
      if (instructorIds.length > 0) {
        instructors = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
      }

      // Fetch lesson-level instructor overrides for all lessons in this course
      const lessonIds = allCourseLessons.map(l => l.id);
      let lessonInstructorLinks: { lessonId: number; instructorId: number; position: number }[] = [];
      if (lessonIds.length > 0) {
        lessonInstructorLinks = await db.select({
          lessonId: lmsLessonInstructors.lessonId,
          instructorId: lmsLessonInstructors.instructorId,
          position: lmsLessonInstructors.position,
        }).from(lmsLessonInstructors)
          .where(sql`${lmsLessonInstructors.lessonId} IN (${sql.join(lessonIds.map(id => sql`${id}`), sql`, `)})`);
      }
      // Build a map of lessonId -> instructor objects (resolved from all instructors)
      let allInstructors: typeof lmsInstructors.$inferSelect[] = instructors;
      const extraIds = lessonInstructorLinks.map(l => l.instructorId).filter(id => !instructorIds.includes(id));
      if (extraIds.length > 0) {
        const extra = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(extraIds.map(id => sql`${id}`), sql`, `)})`);
        allInstructors = [...instructors, ...extra];
      }
      const instructorMap = new Map(allInstructors.map(i => [i.id, i]));
      // Group lesson instructor overrides by lessonId
      const lessonInstructorsMap: Record<number, typeof lmsInstructors.$inferSelect[]> = {};
      for (const link of lessonInstructorLinks.sort((a, b) => a.position - b.position)) {
        const inst = instructorMap.get(link.instructorId);
        if (inst) {
          if (!lessonInstructorsMap[link.lessonId]) lessonInstructorsMap[link.lessonId] = [];
          lessonInstructorsMap[link.lessonId].push(inst);
        }
      }

      return { course, enrollment: effectiveEnrollment, sections: sectionsWithLessons, topLevelLessons, progress, isAdminPreview: !!isAdminPreview && !enrollment, instructors, lessonInstructorsMap };
    }),

  /** Get a single lesson (must be enrolled or lesson is preview) */
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [lesson] = await db.select().from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      // Resolve courseId: from lesson directly, or via section
      let resolvedCourseId: number | null = lesson.courseId ?? null;
      if (!resolvedCourseId && lesson.sectionId) {
        const [section] = await db.select().from(lmsSections).where(eq(lmsSections.id, lesson.sectionId)).limit(1);
        if (section) resolvedCourseId = section.courseId;
      }
            if (!resolvedCourseId) throw new TRPCError({ code: "NOT_FOUND" });
      const isAdmin = ctx.user.role === "admin";
      // Block draft lessons from non-admin learners
      if (!isAdmin && lesson.lessonStatus === "draft") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      }
      // A pre-sale seat has no instructional-content access until the course opens.
      if (!isAdmin) {
        const { getActiveEnrollment: getPresaleEnrollment } = await import("../lib/enrollmentAccess");
        const presaleEnrollment = await getPresaleEnrollment(db as any, ctx.user.id, resolvedCourseId);
        if (presaleEnrollment?.enrollmentType === "presale") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This course is not open yet. Your pre-sale welcome page has the latest access information." });
        }
      }
      const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
      if (pm !== "preview" && !isAdmin) {
        const { resolveEnrollmentForCourse } = await import("../lib/enrollmentAccess");
        const enrollment = await resolveEnrollmentForCourse(db as any, ctx.user.id, resolvedCourseId);
        // Block expired lessons (drip-out): lesson is unavailable after dripOutDays from enrollment
        if ((lesson as any).dripOutDays != null && enrollment?.enrolledAt) {
          const daysSinceEnroll = Math.floor((Date.now() - new Date(enrollment.enrolledAt).getTime()) / 86400000);
          if (daysSinceEnroll >= (lesson as any).dripOutDays) {
            throw new TRPCError({ code: "FORBIDDEN", message: "This lesson is no longer available" });
          }
        }
        const accessDecision = getCourseLessonAccessDecision({
          previewMode: pm,
          hasActiveEnrollment: Boolean(enrollment),
          enrollmentType: enrollment?.enrollmentType,
        });
        if (!accessDecision.allowed) {
          const message = accessDecision.reason === "preview_hidden_after_purchase"
            ? "This preview lesson is no longer available after purchase"
            : accessDecision.reason === "full_enrollment_required"
              ? "Full course enrollment required to access this lesson"
              : "Enrollment required";
          throw new TRPCError({ code: "FORBIDDEN", message });
        }
      }

      // Quiz data if quiz lesson
      let quiz = null;
      if (lesson.type === "quiz") {
        const [q] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, lesson.id)).limit(1);
        if (q) {
          if (q.useQuestionGroups) {
            // Group-based quiz: randomly select displayCount questions per group
            const groups = await db.select().from(lmsQuizQuestionGroups)
              .where(eq(lmsQuizQuestionGroups.quizId, q.id))
              .orderBy(asc(lmsQuizQuestionGroups.sortOrder));
            const selectedQuestions: any[] = [];
            for (const group of groups) {
              const poolRows = await db.select({
                id: questionBank.id,
                question: questionBank.question,
                type: questionBank.type,
                options: questionBank.options,
                correctAnswer: questionBank.correctAnswer,
                explanation: questionBank.explanation,
                questionImageUrl: questionBank.questionImageUrl,
              })
                .from(lmsQuizGroupQuestions)
                .innerJoin(questionBank, eq(lmsQuizGroupQuestions.questionBankId, questionBank.id))
                .where(eq(lmsQuizGroupQuestions.groupId, group.id));
              // Fisher-Yates shuffle then take displayCount
              const pool = [...poolRows];
              for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
              }
              const picked = pool.slice(0, group.displayCount).map(qb => ({
                ...qb,
                groupId: group.id,
                groupName: group.name,
                _source: 'bank' as const,
              }));
              selectedQuestions.push(...picked);
            }
            quiz = { ...q, questions: selectedQuestions, _isGroupBased: true };
          } else {
            const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, q.id)).orderBy(asc(lmsQuizQuestions.position));
            quiz = { ...q, questions };
          }
        }
      }

      return { ...lesson, quiz, linkedMediaAsset: await loadLinkedLessonMediaAsset(db as any, lesson.mediaAssetId) };
    }),

  /** Record that a learner opened a lesson (for prerequisite gates that unlock on view). */
  recordLessonOpened: protectedProcedure
    .input(z.object({ lessonId: z.number(), courseSlug: z.string(), isAdminPreview: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      let [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      if (!enrollment && input.isAdminPreview && ctx.user.role === "admin") {
        await db.insert(lmsEnrollments).values({
          userId: ctx.user.id,
          courseId: course.id,
          enrollmentType: "admin_preview",
          enrolledAt: new Date(),
          progressPct: 0,
        });
        const [newEnrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        enrollment = newEnrollment;
      }
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });

      const [existing] = await db.select({ id: lmsLessonProgress.id })
        .from(lmsLessonProgress)
        .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, input.lessonId)))
        .limit(1);
      if (!existing) {
        await db.insert(lmsLessonProgress).values({
          enrollmentId: enrollment.id,
          lessonId: input.lessonId,
          completedAt: null,
        }).onDuplicateKeyUpdate({
          // A concurrent Mark Complete write may have created the authoritative
          // row first. Keep that row intact rather than failing this open event.
          set: { lessonId: sql`${lmsLessonProgress.lessonId}` },
        });
      }
      return { success: true };
    }),

  /** Mark a lesson complete */
  markLessonComplete: protectedProcedure
    .input(z.object({ lessonId: z.number(), courseSlug: z.string(), isAdminPreview: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      let [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      // Admin preview mode: auto-create a real enrollment so progress and certificate issuance work
      if (!enrollment && input.isAdminPreview && ctx.user.role === "admin") {
        await db.insert(lmsEnrollments).values({
          userId: ctx.user.id,
          courseId: course.id,
          enrollmentType: "admin_preview",
          enrolledAt: new Date(),
          progressPct: 0,
        });
        const [newEnrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        enrollment = newEnrollment;
      }
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });

      const [existing] = await db.select().from(lmsLessonProgress)
        .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, input.lessonId))).limit(1);
      let wasAlreadyComplete = false;
      if (existing) {
        wasAlreadyComplete = !!existing.completedAt;
        if (!existing.completedAt) {
          await db.update(lmsLessonProgress).set({ completedAt: new Date() }).where(eq(lmsLessonProgress.id, existing.id));
        }
      } else {
        await db.insert(lmsLessonProgress).values({ enrollmentId: enrollment.id, lessonId: input.lessonId, completedAt: new Date() })
          .onDuplicateKeyUpdate({
            set: { completedAt: sql`COALESCE(${lmsLessonProgress.completedAt}, VALUES(${lmsLessonProgress.completedAt}))` },
          });
      }
      await recalcProgress(db, enrollment.id);
      // Log lesson completion to unified activity log (fire-and-forget)
      if (!wasAlreadyComplete) {
        const [lesson] = await db.select({ title: lmsLessons.title }).from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
        db.insert(userActivityLogs).values({
          userId: ctx.user.id,
          eventType: 'lesson_complete',
          description: `Completed lesson: ${lesson?.title ?? `Lesson #${input.lessonId}`} in ${course.title}`,
          courseId: course.id,
          lessonId: input.lessonId,
          contentTitle: lesson?.title ?? null,
          metadata: { courseSlug: input.courseSlug, courseTitle: course.title },
        }).catch(() => {});
      }
      return { success: true };
    }),

  /**
   * Record a passed lesson_quiz content block for CME completion and certificate gates.
   * Inline module quizzes are stored in lesson content rather than lms_quizzes, so their
   * pass state must be persisted on the lesson progress row just like a standard quiz.
   */
  submitInlineLessonQuiz: protectedProcedure
    .input(z.object({
      lessonId: z.number().int(),
      courseSlug: z.string(),
      quizBlockId: z.string().min(1).max(128),
      score: z.number().min(0).max(100),
      isAdminPreview: z.boolean().optional(),
      responses: z.array(z.object({
        questionKey: z.string().min(1).max(128),
        answerValue: z.union([z.string().max(10_000), z.number(), z.null()]).optional(),
      })).max(200).optional().default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db.select({
        id: lmsCourses.id,
        creditHours: lmsCourses.creditHours,
      }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      let [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      if (!enrollment && input.isAdminPreview && ctx.user.role === "admin") {
        await db.insert(lmsEnrollments).values({
          userId: ctx.user.id,
          courseId: course.id,
          enrollmentType: "admin_preview",
          enrolledAt: new Date(),
          progressPct: 0,
        });
        const [createdEnrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        enrollment = createdEnrollment;
      }
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });

      const [lesson] = await db.select({
        id: lmsLessons.id,
        courseId: lmsLessons.courseId,
        contentBlocks: lmsLessons.contentBlocks,
      }).from(lmsLessons).where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson || lesson.courseId !== course.id) throw new TRPCError({ code: "NOT_FOUND" });

      let blocks: any[] = [];
      try {
        blocks = Array.isArray(lesson.contentBlocks)
          ? lesson.contentBlocks as any[]
          : JSON.parse(String(lesson.contentBlocks ?? "[]"));
      } catch {
        blocks = [];
      }
      const inlineQuiz = blocks.find((block: any) => block?.type === "lesson_quiz" && String(block.id) === input.quizBlockId);
      if (!inlineQuiz) throw new TRPCError({ code: "BAD_REQUEST", message: "This lesson does not contain the selected built-in lesson quiz" });

      const quizQuestions = Array.isArray(inlineQuiz?.data?.questions) ? inlineQuiz.data.questions : [];
      const selectedAccountFields = normalizeQuizAccountFieldKeys(inlineQuiz?.data?.accountFields);
      const [profile] = selectedAccountFields.length ? await db.select({
        name: users.name, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName,
        email: users.email, credentials: users.credentials, specialty: users.specialty,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1) : [null];
      const accountFieldValues = profile ? JSON.stringify(resolveQuizAccountFields(selectedAccountFields, profile)) : null;
      const nonScoringSurvey = inlineQuiz?.data?.isSurvey === true || inlineQuiz?.data?.requireSurveyCompletion === true;
      const requiresPassingScore = !nonScoringSurvey && inlineQuiz?.data?.requirePassToComplete !== false;
      const { score: calculatedScore, passed: calculatedScorePassed, passingScore } = evaluateInlineLessonQuizScore(
        input.score,
        Number(inlineQuiz?.data?.passingScore ?? 70),
      );
      const score = nonScoringSurvey ? 0 : calculatedScore;
      const scorePassed = requiresPassingScore ? calculatedScorePassed : true;
      const { requiresSurveyCompletion, surveyCompleted, passed } = evaluateInlineLessonQuizCompletion({
        questions: quizQuestions,
        responses: input.responses,
        scorePassed,
        nonScoringSurvey,
        requireSurveyCompletion: inlineQuiz?.data?.requireSurveyCompletion === true,
      });

      // Record ordinary learner submissions for CME activity reporting. Admin
      // previews intentionally do not enter learner-facing completion exports.
      if (!input.isAdminPreview) {
        // Railway deployments may point to an older compatible LMS schema.
        // Ensure the shared reporting tables before every real learner attempt
        // so any course's required quiz can complete and reach its certificate path.
        try {
          await ensureInlineLessonQuizSchema(db);
        } catch {
          // Continue to the insert: an existing usable table must not be
          // blocked by a non-essential schema inspection failure.
          console.error("[inline lesson quiz] schema assurance unavailable");
        }
        const responseRows = prepareInlineQuizResponses(
          inlineQuiz?.data?.questions,
          input.responses,
        );
        const attemptValues = buildInlineQuizAttemptValues({
          userId: ctx.user.id,
          courseId: course.id,
          lessonId: lesson.id,
          quizBlockId: input.quizBlockId,
          score,
          passed,
          accountFieldValues,
        });
        let attempt: { id: number } | undefined;
        try {
          [attempt] = await db.insert(lmsInlineQuizAttempts).values(attemptValues).$returningId();
        } catch (error) {
          // Existing deployments may have the pre-account-fields attempt table. A
          // survey submission must still be recorded so required completion and
          // the existing CME certificate path are not blocked by an optional
          // reporting snapshot.
          if (accountFieldValues !== null && isMissingInlineQuizAccountFieldsColumn(error)) {
            [attempt] = await db.insert(lmsInlineQuizAttempts).values({
              userId: ctx.user.id,
              courseId: course.id,
              lessonId: lesson.id,
              quizBlockId: input.quizBlockId,
              score,
              passed,
            }).$returningId();
          } else {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Your survey response could not be saved. Please try again.",
            });
          }
        }
        if (!attempt) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Your survey response could not be saved. Please try again.",
          });
        }
        if (responseRows.length > 0) {
          await db.insert(lmsInlineQuizResponses).values(responseRows.map(response => ({
            attemptId: attempt.id,
            ...response,
          })));
        }
      }
      const [existing] = await db.select().from(lmsLessonProgress)
        .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, lesson.id))).limit(1);
      if (existing) {
        await db.update(lmsLessonProgress).set({
          quizScore: score,
          quizPassed: passed,
          completedAt: passed ? new Date() : existing.completedAt,
          attempts: (existing.attempts ?? 0) + 1,
        }).where(eq(lmsLessonProgress.id, existing.id));
      } else {
        await db.insert(lmsLessonProgress).values({
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          quizScore: score,
          quizPassed: passed,
          completedAt: passed ? new Date() : null,
          attempts: 1,
        }).onDuplicateKeyUpdate({
          set: {
            quizScore: score,
            quizPassed: passed,
            completedAt: passed
              ? sql`COALESCE(${lmsLessonProgress.completedAt}, VALUES(${lmsLessonProgress.completedAt}))`
              : lmsLessonProgress.completedAt,
            attempts: sql`${lmsLessonProgress.attempts} + 1`,
          },
        });
      }

      if (passed) await recalcProgress(db, enrollment.id);
      return { passed, score, passingScore, requiresSurveyCompletion, surveyCompleted };
    }),

  /** Restore the authenticated learner's most recent saved answers for one inline quiz block. */
  getInlineLessonQuizAttempt: protectedProcedure
    .input(z.object({
      lessonId: z.number().int(),
      courseSlug: z.string(),
      quizBlockId: z.string().min(1).max(128),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
        .where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [enrollment] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments).where(and(
        eq(lmsEnrollments.userId, ctx.user.id),
        eq(lmsEnrollments.courseId, course.id),
      )).limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });
      const [lesson] = await db.select({ id: lmsLessons.id, courseId: lmsLessons.courseId }).from(lmsLessons)
        .where(eq(lmsLessons.id, input.lessonId)).limit(1);
      if (!lesson || lesson.courseId !== course.id) throw new TRPCError({ code: "NOT_FOUND" });
      const [attempt] = await db.select({
        id: lmsInlineQuizAttempts.id,
        passed: lmsInlineQuizAttempts.passed,
        score: lmsInlineQuizAttempts.score,
      }).from(lmsInlineQuizAttempts).where(and(
        eq(lmsInlineQuizAttempts.userId, ctx.user.id),
        eq(lmsInlineQuizAttempts.courseId, course.id),
        eq(lmsInlineQuizAttempts.lessonId, input.lessonId),
        eq(lmsInlineQuizAttempts.quizBlockId, input.quizBlockId),
      )).orderBy(desc(lmsInlineQuizAttempts.submittedAt)).limit(1);
      if (!attempt) return null;
      const responses = await db.select({
        questionKey: lmsInlineQuizResponses.questionKey,
        questionType: lmsInlineQuizResponses.questionType,
        answerValue: lmsInlineQuizResponses.answerValue,
      }).from(lmsInlineQuizResponses).where(eq(lmsInlineQuizResponses.attemptId, attempt.id));
      return { attempt, responses };
    }),

  /** Submit quiz answers */
  submitQuiz: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      courseSlug: z.string(),
      answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])), // questionId -> answer or array of answers
      isAdminPreview: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      let [enrollment] = await db.select().from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      // Admin preview mode: auto-create a real enrollment so quiz progress and certificate issuance work
      if (!enrollment && input.isAdminPreview && ctx.user.role === "admin") {
        await db.insert(lmsEnrollments).values({
          userId: ctx.user.id,
          courseId: course.id,
          enrollmentType: "admin_preview",
          enrolledAt: new Date(),
          progressPct: 0,
        });
        const [newEnrollment] = await db.select().from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        enrollment = newEnrollment;
      }
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN" });

      const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, input.lessonId)).limit(1);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      // Determine question source: group-based (question bank) or standard (lms_quiz_questions)
      let gradeQuestions: Array<{ id: number; correctAnswer: string | null; explanation: string | null; type?: string | null }>;
      let selectedBankIds: number[] | null = null;
      if (quiz.useQuestionGroups) {
        const bankIds = Object.keys(input.answers).map(Number).filter(n => !isNaN(n));
        selectedBankIds = bankIds;
        gradeQuestions = bankIds.length > 0
          ? await db.select({ id: questionBank.id, correctAnswer: questionBank.correctAnswer, explanation: questionBank.explanation, type: questionBank.type })
              .from(questionBank).where(inArray(questionBank.id, bankIds))
          : [];
      } else {
        gradeQuestions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id));
      }

      const questions = gradeQuestions;
      let correct = 0;
      const results = questions.map(q => {
        const given = input.answers[String(q.id)] ?? "";
        let isCorrect = false;
        const qType = (q as any).questionType ?? (q as any).type ?? "mcq";
        if (qType === "multiselect") {
          // given is a JSON array of selected option indices
          try {
            const givenArr: number[] = Array.isArray(given) ? given.map(Number) : JSON.parse(String(given));
            const correctArr: number[] = JSON.parse((q as any).correctAnswers ?? "[]");
            isCorrect = givenArr.length === correctArr.length && givenArr.every((x: number) => correctArr.includes(x));
          } catch { isCorrect = false; }
        } else if (qType === "hotspot") {
          // given is JSON {x, y} — check against correct markers
          try {
            const click = typeof given === "string" ? JSON.parse(given) : given;
            const markers: any[] = JSON.parse((q as any).hotspotMarkers ?? "[]");
            isCorrect = markers.filter((m: any) => m.isCorrect).some((m: any) =>
              Math.abs(m.x - click.x) < 10 && Math.abs(m.y - click.y) < 10
            );
          } catch { isCorrect = false; }
        } else if (qType === "matching") {
          // given is JSON {pairId: rightValue, ...}
          try {
            const answers = typeof given === "string" ? JSON.parse(given) : given;
            const pairs: any[] = JSON.parse((q as any).matchingPairs ?? "[]");
            isCorrect = pairs.length > 0 && pairs.every((p: any) => answers[p.id] === p.right);
          } catch { isCorrect = false; }
        } else {
          // mcq / truefalse — string comparison
          isCorrect = String(given).trim().toLowerCase() === String(q.correctAnswer ?? "").trim().toLowerCase();
        }
        if (isCorrect) correct++;
        return { questionId: q.id, correct: isCorrect, correctAnswer: quiz.showCorrectAnswers ? q.correctAnswer : undefined, explanation: quiz.showCorrectAnswers ? q.explanation : undefined };
      });
      // Survey-only quizzes (likert / star_rating / open_text) have no correct answers,
      // so the normal score calculation always returns 0, which blocks lesson
      // completion and certificate issuance. Auto-pass them as long as the learner
      // submitted at least one answer.
      const SURVEY_Q_TYPES_SCORE = ["likert", "star_rating", "open_text"];
      const allSurveyQuestions = questions.length > 0 && questions.every(q => {
        const qt = (q as any).questionType ?? (q as any).type ?? "mcq";
        return SURVEY_Q_TYPES_SCORE.includes(qt);
      });
      const score = allSurveyQuestions ? 100 : (questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0);
      const passed = allSurveyQuestions ? true : (score >= quiz.passingScore);

      // Upsert progress
      const [existing] = await db.select().from(lmsLessonProgress)
        .where(and(eq(lmsLessonProgress.enrollmentId, enrollment.id), eq(lmsLessonProgress.lessonId, input.lessonId))).limit(1);
      if (existing) {
        await db.update(lmsLessonProgress).set({
          quizScore: score, quizPassed: passed,
          completedAt: passed ? new Date() : existing.completedAt,
          attempts: (existing.attempts ?? 0) + 1,
        }).where(eq(lmsLessonProgress.id, existing.id));
      } else {
        await db.insert(lmsLessonProgress).values({
          enrollmentId: enrollment.id, lessonId: input.lessonId,
          quizScore: score, quizPassed: passed,
          completedAt: passed ? new Date() : null, attempts: 1,
        }).onDuplicateKeyUpdate({
          set: {
            quizScore: score,
            quizPassed: passed,
            completedAt: passed
              ? sql`COALESCE(${lmsLessonProgress.completedAt}, VALUES(${lmsLessonProgress.completedAt}))`
              : lmsLessonProgress.completedAt,
            attempts: sql`${lmsLessonProgress.attempts} + 1`,
          },
        });
      }
      if (passed) await recalcProgress(db, enrollment.id);

      // Store attempt + per-question answers server-side (fire-and-forget — don't block response)
      void (async () => {
        try {
          const SURVEY_TYPES = ["likert", "star_rating", "open_text"];
          const [attemptResult] = await db.insert(lmsQuizAttempts).values({
            userId: ctx.user.id,
            lessonId: input.lessonId,
            courseId: course.id,
            score,
            passed,
            totalQuestions: questions.length,
            correctAnswers: correct,
            answersJson: JSON.stringify(results),
            selectedQuestionIds: selectedBankIds ? JSON.stringify(selectedBankIds) : null,
          }).$returningId();
          const attemptId = attemptResult.id;
          if (attemptId && questions.length > 0) {
            const answerRows = questions.map(q => {
              const qType = (q as any).questionType ?? (q as any).type ?? "mcq";
              const isSurvey = SURVEY_TYPES.includes(qType);
              const given = input.answers[String(q.id)] ?? "";
              const givenStr = Array.isArray(given) ? JSON.stringify(given) : String(given);
              const resultRow = results.find((r: any) => r.questionId === q.id);
              return {
                attemptId,
                questionId: q.id,
                questionText: (q as any).question ?? "",
                questionType: qType,
                answerValue: givenStr,
                isCorrect: isSurvey ? null : (resultRow?.correct ? 1 : 0),
                correctAnswer: isSurvey ? null : (String(q.correctAnswer ?? "")),
              };
            });
            await db.insert(lmsQuizAttemptAnswers).values(answerRows);
          }
        } catch (err) {
          console.error("[submitQuiz] Failed to store attempt answers:", err);
        }
      })();

      return { score, passed, passingScore: quiz.passingScore, results };
    }),

  /** Enroll in a free course */
  enrollFree: protectedProcedure
    .input(z.object({ courseSlug: z.string(), affiliateCode: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (!course.isFree) throw new TRPCError({ code: "BAD_REQUEST", message: "This course requires payment" });
      const isPresale = (course.status as string) === "presale";
      if (course.status !== "public" && !isPresale) throw new TRPCError({ code: "FORBIDDEN" });

      const [existing] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType }).from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
      if (existing) {
        if (existing.enrollmentType === "free_preview") {
          await db.update(lmsEnrollments).set({ enrollmentType: isPresale ? "presale" : "full" }).where(eq(lmsEnrollments.id, existing.id));
          return { enrollmentId: existing.id, alreadyEnrolled: false };
        }
        return { enrollmentId: existing.id, alreadyEnrolled: true };
      }

      const [result] = await db.insert(lmsEnrollments).values({
        userId: ctx.user.id, courseId: course.id,
        affiliateCode: input.affiliateCode ?? null,
        enrollmentType: isPresale ? "presale" : "full",
      }).$returningId();
      // Log free enrollment to unified activity log (fire-and-forget)
      db.insert(userActivityLogs).values({
        userId: ctx.user.id,
        eventType: 'course_enroll',
        description: `Enrolled in free course: ${course.title}`,
        courseId: course.id,
        contentTitle: course.title,
        metadata: { courseSlug: input.courseSlug, enrollmentType: 'free', affiliateCode: input.affiliateCode ?? null },
      }).catch(() => {});
      // Send enrollment email and admin notification (fire-and-forget)
      sendEnrollmentEmailForUser({ userId: ctx.user.id, courseId: course.id, db }).catch(() => {});
      notifyOwner({
        title: `🎓 Free Course Enrollment`,
        content: `User ${ctx.user.id} (${ctx.user.email}) enrolled in free course: ${course.title} (${input.courseSlug}).`,
      }).catch(() => {});
      return { enrollmentId: result.id, alreadyEnrolled: false };
    }),

  /** Create Stripe checkout session for paid course */
  createCheckout: protectedProcedure
    .input(z.object({
      courseSlug: z.string(),
      affiliateCode: z.string().optional(),
      seats: z.number().int().min(1).default(1),
      origin: z.string(),
      orderBumpId: z.number().optional(),
      // Optional: ID of a secondary pricing option (from lms_pricing_options)
      // When provided, the checkout uses that option's price/type instead of the course primary price
      pricingOptionId: z.number().optional(),
      promoCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const isPresale = (course.status as string) === "presale";
      if ((course.status as string) === "waitlist") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This course is currently accepting waitlist signups rather than enrollments." });
      }

      // Block checkout if enrollment close date has passed
      if (course.enrollmentCloseDate && !isScheduledDeadlineOpen(course.enrollmentCloseDate, "America/New_York")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this cohort" });
      }

      // Block checkout if enrollment is explicitly closed
      if ((course.status as string) === "enrollment_closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this course" });
      }

      // DEBUG: log incoming pricingOptionId
      console.log(`[createCheckout] courseSlug=${input.courseSlug} pricingOptionId=${input.pricingOptionId} (type=${typeof input.pricingOptionId})`);
      // Resolve pricing: secondary option overrides primary course pricing
      let pricingType: string = course.pricingType ?? (course.isFree ? "free" : "one_time");
      let effectivePrice = course.price;
      let effectiveDownPayment = course.downPayment ?? 0;
      let effectiveInstallmentAmount = course.installmentAmount ?? 0;
      let effectiveInstallmentCount = course.installmentCount ?? 0;
      let effectiveInstallmentIntervalDays = course.installmentIntervalDays ?? 30;
      let effectiveStripePriceId = course.stripePriceId;
      let effectiveSubscriptionInterval = course.subscriptionInterval ?? "monthly";
      let pricingOptionLabel: string | null = null;

      if (input.pricingOptionId) {
        const [opt] = await db.select().from(lmsPricingOptions)
          .where(and(eq(lmsPricingOptions.id, input.pricingOptionId), eq(lmsPricingOptions.courseId, course.id), eq(lmsPricingOptions.isActive, true)))
          .limit(1);
        if (!opt) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing option not found" });
        pricingType = opt.pricingType;
        effectivePrice = opt.price;
        effectiveDownPayment = opt.downPayment ?? 0;
        effectiveInstallmentAmount = opt.installmentAmount ?? 0;
        effectiveInstallmentCount = opt.installmentCount ?? 0;
        effectiveInstallmentIntervalDays = opt.installmentIntervalDays ?? 30;
        effectiveStripePriceId = opt.stripePriceId ?? null;
        effectiveSubscriptionInterval = opt.subscriptionInterval ?? "monthly";
        pricingOptionLabel = opt.label;
      }

      if (pricingType === "free") throw new TRPCError({ code: "BAD_REQUEST", message: "Use enrollFree for free courses" });

      // ── Already-enrolled guard ─────────────────────────────────────────────────
      // For one_time purchases, block checkout if the user already has an active
      // full enrollment. Subscription renewals are allowed through.
      if (pricingType === "one_time" || pricingType === "payment_plan") {
        const { getActiveEnrollment: checkExistingEnrollment } = await import("../lib/enrollmentAccess");
        const activeEnrollment = await checkExistingEnrollment(db, ctx.user.id, course.id);
        if (activeEnrollment && activeEnrollment.enrollmentType !== "free_preview") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You are already enrolled in this course. Please contact support if you believe this is an error.",
          });
        }
      }

      // ── Zero-price intercept ───────────────────────────────────────────────────
      // If the course/option price is $0, skip Stripe and enroll directly.
      if (pricingType === "one_time" && Number(effectivePrice) === 0) {
        const [existingZero] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
          .from(lmsEnrollments).where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        if (!existingZero) {
          await db.insert(lmsEnrollments).values({ userId: ctx.user.id, courseId: course.id, affiliateCode: input.affiliateCode ?? null, enrollmentType: isPresale ? "presale" : "full" });
          db.insert(userActivityLogs).values({ userId: ctx.user.id, eventType: "course_enroll", description: `Enrolled in zero-price course: ${course.title}`, courseId: course.id, contentTitle: course.title, metadata: { courseSlug: input.courseSlug, enrollmentType: "free_zero_price" } }).catch(() => {});
          // Send enrollment email and admin notification (fire-and-forget)
          sendEnrollmentEmailForUser({ userId: ctx.user.id, courseId: course.id, db }).catch(() => {});
          notifyOwner({
            title: `🎓 Zero-Price Enrollment`,
            content: `User ${ctx.user.id} (${ctx.user.email}) enrolled in zero-price course: ${course.title} (${input.courseSlug}).`,
          }).catch(() => {});
        } else if (existingZero.enrollmentType === "free_preview") {
          await db.update(lmsEnrollments).set({ enrollmentType: isPresale ? "presale" : "full" }).where(eq(lmsEnrollments.id, existingZero.id));
        }
        return { freeEnrollment: true, courseSlug: course.slug, url: null };
      }

      const stripe = getStripeClient();
      // Helper: validate a stored stripe price ID exists in the current Stripe account
      const validatePriceId = async (priceId: string | null | undefined): Promise<string | null> => {
        if (!priceId) return null;
        try { await stripe.prices.retrieve(priceId); return priceId; }
        catch (e: any) { if (e?.code === "resource_missing" || e?.statusCode === 404 || (e?.message && e.message.includes("No such price"))) return null; throw e; }
      };

      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "course",
        triggerProductId: course.id,
        currency: course.currency,
      });
      const shippingOptions = orderBumpCheckout?.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA"] as any } }
        : {};

      // Create order record (use effective pricing — may come from secondary option)
      const orderAmount = (pricingType === "payment_plan"
        ? effectiveDownPayment
        : effectivePrice * input.seats) + (orderBumpCheckout?.amount ?? 0);
      const [orderResult] = await db.insert(lmsOrders).values({
        userId: ctx.user.id, courseId: course.id,
        amount: orderAmount,
        affiliateId: null, seats: input.seats, status: "pending",
      }).$returningId();

      const commonMeta = {
        user_id: ctx.user.id.toString(),
        course_id: course.id.toString(),
        order_id: orderResult.id.toString(),
        affiliate_code: input.affiliateCode ?? "",
        seats: input.seats.toString(),
        pricing_type: pricingType,
        trigger_order_type: "course",
        enrollment_type: isPresale ? "presale" : "full",
        ...orderBumpCheckout?.metadata,
      };
      // ── Post-purchase redirect ────────────────────────────────────────────────
      // Priority: postPurchaseRedirectUrl (admin-set) → customThankYou page → My Dashboard
      const _postPurchasePath = course.postPurchaseRedirectUrl
        ? course.postPurchaseRedirectUrl
        : course.customThankYouEnabled
          ? `/courses/${course.slug}/thank-you`
          : `/my-dashboard?tab=content&enrolled=1`;
      const successUrl = _postPurchasePath.startsWith('http')
        ? `${_postPurchasePath}${_postPurchasePath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
        : `${input.origin}${_postPurchasePath}${_postPurchasePath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${input.origin}/courses/${course.slug}`;

      let session: any;

      // Resolve promo code to a Stripe promotion code ID if provided
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) {
            const pc = promoCodes.data[0];
            const couponContentType = course.type === "quiz" ? "quiz" : "course";
            if (!await isPromotionCodeEligibleForTarget(db, pc, { contentType: couponContentType, productKey: `${couponContentType}:${course.id}` })) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `This discount code is not available for this ${couponContentType}.` });
            }
            discounts = [{ promotion_code: pc.id }];
            // ── 100% promo intercept ───────────────────────────────────────────
            // If the promo makes the price $0 (100% off), skip Stripe entirely.
            const coupon = pc.coupon as any;
            const effectivePriceCents = Math.round(Number(effectivePrice) * 100 * input.seats);
            const discountedCents = coupon.percent_off === 100
              ? 0
              : coupon.amount_off
                ? Math.max(0, effectivePriceCents - coupon.amount_off)
                : effectivePriceCents;
            if (discountedCents === 0 && pricingType === "one_time") {
              const [existingPromo] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
                .from(lmsEnrollments).where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
              if (!existingPromo) {
                await db.insert(lmsEnrollments).values({ userId: ctx.user.id, courseId: course.id, affiliateCode: input.affiliateCode ?? null, enrollmentType: isPresale ? "presale" : "full" });
                db.insert(userActivityLogs).values({ userId: ctx.user.id, eventType: "course_enroll", description: `Enrolled via 100% promo: ${course.title}`, courseId: course.id, contentTitle: course.title, metadata: { courseSlug: input.courseSlug, enrollmentType: "free_promo", promoCode: input.promoCode } }).catch(() => {});
                // Send enrollment email and admin notification (fire-and-forget)
                sendEnrollmentEmailForUser({ userId: ctx.user.id, courseId: course.id, db }).catch(() => {});
                notifyOwner({
                  title: `🎓 100% Promo Enrollment`,
                  content: `User ${ctx.user.id} (${ctx.user.email}) enrolled via 100% promo (${input.promoCode ?? 'unknown'}): ${course.title} (${input.courseSlug}).`,
                }).catch(() => {});
              } else if (existingPromo.enrollmentType === "free_preview") {
                await db.update(lmsEnrollments).set({ enrollmentType: isPresale ? "presale" : "full" }).where(eq(lmsEnrollments.id, existingPromo.id));
              }
              return { freeEnrollment: true, courseSlug: course.slug, url: null };
            }
          }
        } catch { /* ignore — checkout still works without promo */ }
      }
      const promoOpts = discounts ? { discounts } : { allow_promotion_codes: true };

      const productName = pricingOptionLabel ? `${course.title} — ${pricingOptionLabel}` : course.title;

      // ── Idempotency key: prevents duplicate sessions from race conditions (two tabs, double-click) ──
      // Key resets daily so users can legitimately retry the next day.
      const idempotencyDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const idempotencyBase = `checkout-${ctx.user.id}-${course.id}-${input.pricingOptionId ?? 0}-${idempotencyDate}`;

      if (pricingType === "one_time") {
        // If the option has a pre-created Stripe Price ID, use it directly
        const lineItem = buildCourseOfferStripeLineItem({
          stripePriceId: effectiveStripePriceId,
          price: effectivePrice,
          currency: course.currency,
          productName,
          description: course.subtitle,
          seats: input.seats,
        });
        const isUpgradeBump = orderBumpCheckout?.bumpMode === "upgrade";
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: isUpgradeBump
            ? [orderBumpCheckout!.lineItem]
            : [lineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "", ...(isUpgradeBump ? { bump_mode: "upgrade" } : {}) },
          payment_intent_data: { description: `${productName} — One-Time Purchase` },
          ...shippingOptions,
        }, { idempotencyKey: `${idempotencyBase}-one-time` });

      } else if (pricingType === "subscription") {
        // Create or reuse a Stripe Price for this subscription option
        let stripePriceId = await validatePriceId(effectiveStripePriceId);
        if (!stripePriceId) {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = effectiveSubscriptionInterval;
          const stripeProduct = await stripe.products.create({
            name: productName,
            description: course.subtitle ?? undefined,
            metadata: { course_id: course.id.toString() },
          });
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: resolveCourseOfferCheckoutCents(effectivePrice),
            currency: course.currency,
            recurring: { interval: intervalMap[interval], interval_count: intervalCountMap[interval] },
          });
          stripePriceId = stripePrice.id;
          // Cache on the option row (or course if primary)
          if (input.pricingOptionId) {
            await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, input.pricingOptionId));
          } else {
            await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));

          }
        }
        // Upgrade/replace mode is not supported for subscriptions — treat as addon
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: [{ price: stripePriceId, quantity: 1 }, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          subscription_data: {
            description: `${productName} — Subscription — Initial`,
            metadata: { user_id: ctx.user.id.toString(), course_id: course.id.toString(), order_id: orderResult.id.toString() },
          },
          ...shippingOptions,
        }, { idempotencyKey: `${idempotencyBase}-subscription` });

      } else if (pricingType === "payment_plan") {
        // Charge down payment now; installments handled via subscription
        const downPayment = effectiveDownPayment;
        const installmentAmount = effectiveInstallmentAmount;
        const installmentCount = effectiveInstallmentCount;
        const intervalDays = effectiveInstallmentIntervalDays;
        const lineItems: any[] = [];
        if (downPayment > 0) {
          lineItems.push({
            price_data: {
              currency: course.currency,
              product_data: { name: `${productName} — Down Payment` },
              unit_amount: Math.round(Number(downPayment) * 100),
            },
            quantity: 1,
          });
        }
        if (installmentAmount > 0 && installmentCount > 0) {
          let stripePriceId = await validatePriceId(effectiveStripePriceId);
          if (!stripePriceId) {
            const stripeProduct = await stripe.products.create({
              name: `${productName} — Installment`,
              metadata: { course_id: course.id.toString() },
            });
            const intervalMonths = Math.round(intervalDays / 30) || 1;
            const stripePrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: Math.round(Number(installmentAmount) * 100),
              currency: course.currency,
              recurring: { interval: "month", interval_count: intervalMonths },
            });
            stripePriceId = stripePrice.id;
            if (input.pricingOptionId) {
              await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, input.pricingOptionId));
            } else {
              await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
            }
          }
          lineItems.push({ price: stripePriceId, quantity: 1 });
        }
        const hasInstallments = installmentAmount > 0 && installmentCount > 0;
        session = await stripe.checkout.sessions.create({
          mode: hasInstallments ? "subscription" : "payment",
          customer_email: ctx.user.email ?? undefined,
          ...promoOpts,
          line_items: [...lineItems, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: ctx.user.id.toString(),
          metadata: { ...commonMeta, installment_count: installmentCount.toString(), pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          ...(hasInstallments
            ? { subscription_data: { description: `${productName} — Payment Plan — Installments`, metadata: { user_id: ctx.user.id.toString(), course_id: course.id.toString(), order_id: orderResult.id.toString() } } }
            : { payment_intent_data: { description: `${productName} — Payment Plan — Down Payment` } }),
          ...shippingOptions,
        }, { idempotencyKey: `${idempotencyBase}-payment-plan` });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown pricing type" });
      }

      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      await db.update(lmsOrders).set({ stripeSessionId: session.id }).where(eq(lmsOrders.id, orderResult.id));
      return { checkoutUrl: session.url };
    }),

  /**
   * Guest checkout — creates/finds account, signs in via session cookie, saves lead, returns Stripe checkout URL.
   * Used when an unauthenticated user clicks a CTA on a course landing page.
   */
  guestCheckoutRegister: publicProcedure
    .input(z.object({
      courseSlug: z.string(),
      name: z.string().min(1).max(200),
      email: z.string().email(),
      pricingOptionId: z.number().optional(),
      orderBumpId: z.number().optional(),
      promoCode: z.string().optional(),
      origin: z.string(),
      referrer: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1. Create or find user account
      const { getOrCreateUserByEmail } = await import('../db');
      const { user } = await getOrCreateUserByEmail({
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
      });

      // 2. Set session cookie — auto sign-in
      const { sdk } = await import('../_core/sdk');
      const { COOKIE_NAME, ONE_YEAR_MS } = await import('@shared/const');
      const { getSessionCookieOptions } = await import('../_core/cookies');
      const openId = `email:${input.email.trim().toLowerCase()}`;
      // Persist openId on user row if not set
      await db.update(users).set({ openId }).where(and(eq(users.id, user.id), isNull(users.openId)));
      const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // 3. Save as lead in funnel_leads
      try {
        await db.insert(funnelLeads).values({
          funnelId: 0,
          funnelPageId: 0,
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          userId: user.id,
          source: "course_checkout",
          sourcePage: `/courses/${input.courseSlug}`,
          referrer: input.referrer ?? null,
          ipAddress: (ctx.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? null,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
      } catch { /* non-fatal — lead capture failure should not block checkout */ }

      // 4. Create Stripe checkout session (same logic as createCheckout but with user.id)
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.enrollmentCloseDate && !isScheduledDeadlineOpen(course.enrollmentCloseDate, "America/New_York")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this cohort" });
      }
      if ((course.status as string) === "enrollment_closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment is closed for this course" });
      }

      let pricingType: string = course.pricingType ?? (course.isFree ? "free" : "one_time");
      let effectivePrice = course.price;
      let effectiveDownPayment = course.downPayment ?? 0;
      let effectiveInstallmentAmount = course.installmentAmount ?? 0;
      let effectiveInstallmentCount = course.installmentCount ?? 0;
      let effectiveInstallmentIntervalDays = course.installmentIntervalDays ?? 30;
      let effectiveStripePriceId = course.stripePriceId;
      let effectiveSubscriptionInterval = course.subscriptionInterval ?? "monthly";
      let pricingOptionLabel: string | null = null;

      if (input.pricingOptionId) {
        const [opt] = await db.select().from(lmsPricingOptions)
          .where(and(eq(lmsPricingOptions.id, input.pricingOptionId), eq(lmsPricingOptions.courseId, course.id), eq(lmsPricingOptions.isActive, true)))
          .limit(1);
        if (!opt) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing option not found" });
        pricingType = opt.pricingType;
        effectivePrice = opt.price;
        effectiveDownPayment = opt.downPayment ?? 0;
        effectiveInstallmentAmount = opt.installmentAmount ?? 0;
        effectiveInstallmentCount = opt.installmentCount ?? 0;
        effectiveInstallmentIntervalDays = opt.installmentIntervalDays ?? 30;
        effectiveStripePriceId = opt.stripePriceId ?? null;
        effectiveSubscriptionInterval = opt.subscriptionInterval ?? "monthly";
        pricingOptionLabel = opt.label;
      }

      // ── Already-enrolled guard (guest path) ─────────────────────────────────
      if (pricingType === "one_time" || pricingType === "payment_plan") {
        const [existingGuest] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType })
          .from(lmsEnrollments).where(and(eq(lmsEnrollments.userId, user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        if (existingGuest && existingGuest.enrollmentType !== "free_preview") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You are already enrolled in this course. Please contact support if you believe this is an error.",
          });
        }
      }

      if (pricingType === "free") {
        // Free course — just enroll directly
        const [existingFree] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType }).from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        if (!existingFree) {
          await db.insert(lmsEnrollments).values({ userId: user.id, courseId: course.id, status: "active", progressPct: 0, enrollmentType: "full" });
          sendEnrollmentEmailForUser({ userId: user.id, courseId: course.id }).catch(() => {});
          notifyOwner({
            title: `🎓 Free Course Enrollment (Guest)`,
            content: `User ${user.id} (${user.email}) enrolled in free course: ${course.title} (${input.courseSlug}). [Guest checkout path]`,
          }).catch(() => {});
        } else if (existingFree.enrollmentType === "free_preview") {
          await db.update(lmsEnrollments).set({ enrollmentType: "full" }).where(eq(lmsEnrollments.id, existingFree.id));
        }
        return { checkoutUrl: null, enrolled: true };
      }

      const stripe = getStripeClient();

      const orderBumpCheckout = await buildOrderBumpCheckoutLine(db, {
        orderBumpId: input.orderBumpId,
        triggerType: "course",
        triggerProductId: course.id,
        currency: course.currency,
      });
      const shippingOptions = orderBumpCheckout?.requiresShipping
        ? { shipping_address_collection: { allowed_countries: ["US", "CA"] as any } }
        : {};

      const orderAmount = (pricingType === "payment_plan"
        ? effectiveDownPayment
        : effectivePrice * 1) + (orderBumpCheckout?.amount ?? 0);
      const [orderResult] = await db.insert(lmsOrders).values({
        userId: user.id, courseId: course.id,
        amount: orderAmount, affiliateId: null, seats: 1, status: "pending",
      }).$returningId();

      const commonMeta = {
        user_id: user.id.toString(),
        course_id: course.id.toString(),
        order_id: orderResult.id.toString(),
        affiliate_code: "",
        seats: "1",
        pricing_type: pricingType,
        trigger_order_type: "course",
        ...orderBumpCheckout?.metadata,
      };

      // ── Post-purchase redirect (guest checkout) ────────────────────────────────
      const _guestPostPurchasePath = course.postPurchaseRedirectUrl
        ? course.postPurchaseRedirectUrl
        : course.customThankYouEnabled
          ? `/courses/${course.slug}/thank-you`
          : `/my-dashboard?tab=content&enrolled=1`;
      const successUrl = _guestPostPurchasePath.startsWith('http')
        ? `${_guestPostPurchasePath}${_guestPostPurchasePath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
        : `${input.origin}${_guestPostPurchasePath}${_guestPostPurchasePath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${input.origin}/courses/${course.slug}`;

      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const promoCodes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (promoCodes.data[0]) discounts = [{ promotion_code: promoCodes.data[0].id }];
        } catch { /* ignore */ }
      }
      const promoOpts = discounts ? { discounts } : { allow_promotion_codes: true };
      const productName = pricingOptionLabel ? `${course.title} — ${pricingOptionLabel}` : course.title;

      // Idempotency key — prevents duplicate sessions from race conditions
      const guestIdempotencyDate = new Date().toISOString().slice(0, 10);
      const guestIdempotencyBase = `guest-checkout-${user.id}-${course.id}-${input.pricingOptionId ?? 0}-${guestIdempotencyDate}`;

      let session: any;
      if (pricingType === "one_time") {
        const lineItem = effectiveStripePriceId
          ? { price: effectiveStripePriceId, quantity: 1 }
          : { price_data: { currency: course.currency, product_data: { name: productName, description: course.subtitle ?? undefined }, unit_amount: Math.round(Number(effectivePrice) * 100) }, quantity: 1 };
        const isUpgradeBump2 = orderBumpCheckout?.bumpMode === "upgrade";
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: input.email,
          ...promoOpts,
          line_items: isUpgradeBump2
            ? [orderBumpCheckout!.lineItem]
            : [lineItem, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "", ...(isUpgradeBump2 ? { bump_mode: "upgrade" } : {}) },
          payment_intent_data: { description: `${productName} — One-Time Purchase` },
          ...shippingOptions,
        }, { idempotencyKey: `${guestIdempotencyBase}-one-time` });
      } else if (pricingType === "subscription") {
        let stripePriceId = await validatePriceId(effectiveStripePriceId);
        if (!stripePriceId) {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const stripeProduct = await stripe.products.create({ name: productName, description: course.subtitle ?? undefined, metadata: { course_id: course.id.toString() } });
          const stripePrice = await stripe.prices.create({ product: stripeProduct.id, unit_amount: Math.round(Number(effectivePrice) * 100), currency: course.currency, recurring: { interval: intervalMap[effectiveSubscriptionInterval], interval_count: intervalCountMap[effectiveSubscriptionInterval] } });
          stripePriceId = stripePrice.id;
          if (input.pricingOptionId) await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, input.pricingOptionId));
          else await db.update(lmsCourses).set({ stripePriceId }).where(eq(lmsCourses.id, course.id));
        }
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: input.email,
          ...promoOpts,
          line_items: [{ price: stripePriceId, quantity: 1 }, ...(orderBumpCheckout ? [orderBumpCheckout.lineItem] : [])],
          success_url: successUrl, cancel_url: cancelUrl,
          client_reference_id: user.id.toString(),
          metadata: { ...commonMeta, pricing_option_id: input.pricingOptionId?.toString() ?? "" },
          subscription_data: {
            description: `${productName} — Subscription — Initial`,
            metadata: { user_id: user.id.toString(), course_id: course.id.toString(), order_id: orderResult.id.toString() },
          },
          ...shippingOptions,
        }, { idempotencyKey: `${guestIdempotencyBase}-subscription` });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported pricing type for guest checkout" });
      }

      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      await db.update(lmsOrders).set({ stripeSessionId: session.id }).where(eq(lmsOrders.id, orderResult.id));
      return { checkoutUrl: session.url, enrolled: false };
    }),

  /** Upgrade-prompt checkout — supports course / download / physical product with optional promo code */
  upgradePromptCheckout: protectedProcedure
    .input(z.object({
      productType: z.enum(["course", "download", "product"]),
      productSlug: z.string().optional(),
      productId: z.number().optional(),
      promoCode: z.string().optional(),
      origin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const stripe = getStripeClient();
      const origin = input.origin || ctx.req.headers.origin || `https://${ctx.req.headers.host}`;

      // Resolve promo code → Stripe promotion_code ID
      let discounts: Array<{ promotion_code: string }> | undefined;
      if (input.promoCode) {
        try {
          const codes = await stripe.promotionCodes.list({ code: input.promoCode.toUpperCase(), active: true, limit: 1 });
          if (codes.data[0]) discounts = [{ promotion_code: codes.data[0].id }];
        } catch { /* ignore */ }
      }

      if (input.productType === "course") {
        const slug = input.productSlug;
        if (!slug) throw new TRPCError({ code: "BAD_REQUEST", message: "productSlug required for course" });
        const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
        if (!course) throw new TRPCError({ code: "NOT_FOUND" });
        const [existing] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType }).from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id))).limit(1);
        if (existing && existing.enrollmentType !== "free_preview") return { checkoutUrl: null, alreadyEnrolled: true };
        if (course.isFree || !course.price) {
          if (existing?.enrollmentType === "free_preview") {
            await db.update(lmsEnrollments).set({ enrollmentType: "full" }).where(eq(lmsEnrollments.id, existing.id));
          } else {
            await db.insert(lmsEnrollments).values({ userId: ctx.user.id, courseId: course.id, enrollmentType: "full" });
          }
          return { checkoutUrl: null, alreadyEnrolled: false, free: true };
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          ...(discounts ? { discounts } : { allow_promotion_codes: true }),
          line_items: [{ price_data: { currency: course.currency ?? "usd", product_data: { name: course.title, images: course.coverImageUrl ? [course.coverImageUrl] : undefined }, unit_amount: Math.round(Number(course.price) * 100) }, quantity: 1 }],
          metadata: { type: "lms_course", course_id: course.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "", source: "upgrade_prompt" },
          payment_intent_data: { description: `${course.title} — Course Purchase` },
          success_url: `${origin}/courses/${course.slug}?success=1`,
          cancel_url: `${origin}/courses/${course.slug}`,
        });
        return { checkoutUrl: session.url, alreadyEnrolled: false };
      }

      if (input.productType === "download") {
        const id = input.productId;
        const slug = input.productSlug;
        if (!id && !slug) throw new TRPCError({ code: "BAD_REQUEST", message: "productId or productSlug required" });
        const [product] = await db.select().from(digitalProducts)
          .where(id ? eq(digitalProducts.id, id) : eq(digitalProducts.slug, slug!)).limit(1);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        if (product.isFree || !product.price) {
          const { digitalPurchases } = await import("../../drizzle/schema");
          await db.insert(digitalPurchases).values({ userId: ctx.user.id, productId: product.id });
          return { checkoutUrl: null, alreadyEnrolled: false, free: true };
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          ...(discounts ? { discounts } : { allow_promotion_codes: true }),
          line_items: [{ price_data: { currency: product.currency, product_data: { name: product.title, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined }, unit_amount: resolveUpgradeProductCheckoutCents(product.price) }, quantity: 1 }],
          metadata: { type: "digital_download", product_id: product.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "", source: "upgrade_prompt" },
          payment_intent_data: { description: `${product.title} — Digital Download` },
          success_url: `${origin}/downloads/${product.slug}/files?success=1`,
          cancel_url: `${origin}/downloads/${product.slug}`,
        });
        return { checkoutUrl: session.url, alreadyEnrolled: false };
      }

      if (input.productType === "product") {
        const id = input.productId;
        const slug = input.productSlug;
        if (!id && !slug) throw new TRPCError({ code: "BAD_REQUEST", message: "productId or productSlug required" });
        const [product] = await db.select().from(physicalProducts)
          .where(id ? eq(physicalProducts.id, id) : eq(physicalProducts.slug, slug!)).limit(1);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        if (product.isFree || !product.price) return { checkoutUrl: null, alreadyEnrolled: false, free: true };
        const allowedCountries = product.shippingCountries ? (JSON.parse(product.shippingCountries) as string[]) : ["US", "CA", "GB", "AU", "NZ"];
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id.toString(),
          ...(discounts ? { discounts } : { allow_promotion_codes: true }),
          shipping_address_collection: { allowed_countries: allowedCountries as any },
          line_items: [{ price_data: { currency: product.currency, product_data: { name: product.title, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined }, unit_amount: resolveUpgradeProductCheckoutCents(product.price) }, quantity: 1 }],
          metadata: { type: "physical_product", product_id: product.id.toString(), user_id: ctx.user.id.toString(), customer_email: ctx.user.email ?? "", source: "upgrade_prompt" },
          payment_intent_data: { description: `${product.title} — Physical Product` },
          success_url: `${origin}/product/${product.slug}?success=1`,
          cancel_url: `${origin}/product/${product.slug}`,
        });
        return { checkoutUrl: session.url, alreadyEnrolled: false };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown productType" });
    }),

  /** Accept group seat invite */
  acceptGroupInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [seat] = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.inviteToken, input.token)).limit(1);
      if (!seat) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite token" });
      if (seat.acceptedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already accepted" });

      const [group] = await db.select().from(lmsGroups).where(eq(lmsGroups.id, seat.groupId)).limit(1);
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify email matches
      const userEmail = ctx.user.email?.toLowerCase();
      if (userEmail !== seat.email.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invite was sent to a different email address" });
      }

            // Check not already enrolled
      const [existing] = await db.select({ id: lmsEnrollments.id, enrollmentType: lmsEnrollments.enrollmentType }).from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, group.courseId))).limit(1);
      if (existing) {
        if (existing.enrollmentType === "free_preview") {
          // Upgrade free preview to full when accepting a group seat
          await db.update(lmsEnrollments).set({ enrollmentType: "full", groupId: group.id }).where(eq(lmsEnrollments.id, existing.id));
        }
        await db.update(lmsGroupSeats).set({ acceptedAt: new Date(), enrollmentId: existing.id }).where(eq(lmsGroupSeats.id, seat.id));
        return { enrollmentId: existing.id };
      }
      const [result] = await db.insert(lmsEnrollments).values({
        userId: ctx.user.id, courseId: group.courseId, groupId: group.id, enrollmentType: "full",
      }).$returningId();
      await db.update(lmsGroupSeats).set({ acceptedAt: new Date(), enrollmentId: result.id }).where(eq(lmsGroupSeats.id, seat.id));
      return { enrollmentId: result.id };
    }),

  // ── Free Group Enrollment ────────────────────────────────────────────────

  /**
   * Create a free group for a course — no Stripe payment required.
   * The calling user becomes the group manager and can assign seats to members.
   * Members accept their invite via the normal acceptGroupInvite flow and get
   * a free enrollment tracked under this group.
   */
  createFreeGroup: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      seats: z.number().int().min(1).max(500),
      groupName: z.string().min(1).max(255),
      orgName: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify the course exists and is a free/public course
      const [course] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, isFree: lmsCourses.isFree })
        .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      // Create the group
      const [groupResult] = await db.insert(lmsGroups).values({
        name: input.groupName,
        orgName: input.orgName ?? null,
        courseId: input.courseId,
        seats: input.seats,
        teamAdminId: ctx.user.id,
        adminEmail: ctx.user.email ?? null,
        source: "free_enrollment",
      }).$returningId();
      const groupId = groupResult.id;

      // Create the per-course seat allocation
      await db.insert(lmsGroupCourses).values({
        groupId,
        courseId: input.courseId,
        seats: input.seats,
      });

      // Register the creator as an active manager (with a seat so they also get access)
      await db.insert(lmsGroupManagers).values({
        groupId,
        userId: ctx.user.id,
        email: ctx.user.email ?? "",
        managerName: ctx.user.name ?? undefined,
        status: "active",
        hasSeat: true,
        acceptedAt: new Date(),
        addedByUserId: ctx.user.id,
      });

      return { groupId, courseTitle: course.title, courseSlug: course.slug };
    }),

  // ── Certificates ──────────────────────────────────────────────────────────

  /** Get all certificates for the current user */
  getMyCertificates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const certs = await db.select({
      id: lmsCertificates.id,
      courseId: lmsCertificates.courseId,
      certificateUrl: lmsCertificates.certificateUrl,
      issuedAt: lmsCertificates.issuedAt,
      courseTitle: lmsCourses.title,
      courseCoverImageUrl: lmsCourses.coverImageUrl,
    })
      .from(lmsCertificates)
      .innerJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
      .where(eq(lmsCertificates.userId, ctx.user.id))
      .orderBy(desc(lmsCertificates.issuedAt));
    return certs;
  }),

  /** Get certificate for a specific course (if issued) */
  getCourseCertificate: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({
        id: lmsCourses.id,
        hasCertificate: lmsCourses.hasCertificate,
        creditHours: lmsCourses.creditHours,
      }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) return null;
      let [cert] = await db.select().from(lmsCertificates)
        .where(and(eq(lmsCertificates.userId, ctx.user.id), eq(lmsCertificates.courseId, course.id))).limit(1);

      if (!cert && course.hasCertificate) {
        await restoreMissingCourseCertificate(db, ctx.user.id, course.id, course.hasCertificate);
        [cert] = await db.select().from(lmsCertificates)
          .where(and(eq(lmsCertificates.userId, ctx.user.id), eq(lmsCertificates.courseId, course.id))).limit(1);
      }
      return cert ?? null;
    }),

  // ── Quiz Gate ──────────────────────────────────────────────────────────

  /**
   * Regenerate a certificate PDF using the user's CURRENT display name and credentials.
   * Called on every download so the certificate always reflects the latest name on the account,
   * even if the user changed their name after the certificate was originally issued.
   * Re-uploads the new PDF to S3, updates the DB record, and returns the fresh URL.
   */
  refreshCertificate: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Resolve course
      const [course] = await db.select({
        id: lmsCourses.id,
        title: lmsCourses.title,
        hasCertificate: lmsCourses.hasCertificate,
        certificateTemplateId: lmsCourses.certificateTemplateId,
        creditHours: lmsCourses.creditHours,
        certificateTitleOverride: lmsCourses.certificateTitleOverride,
      }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Fetch existing certificate record
      const [cert] = await db.select().from(lmsCertificates)
        .where(and(eq(lmsCertificates.userId, ctx.user.id), eq(lmsCertificates.courseId, course.id))).limit(1);
      if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "No certificate found for this course" });

      // Fetch the user's CURRENT name and credentials
      const [user] = await db.select({
        name: users.name,
        displayName: users.displayName,
        credentials: users.credentials,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      // Prefer legal name (firstName + lastName) so the certificate always shows a real full name
      // even if the account display name is a username or handle.
      const legalName = [user.firstName, user.lastName].filter(Boolean).join(" ");
      const learnerName = legalName || user.displayName || user.name || "Learner";

      // Resolve certificate template
      let template: any = null;
      const templateId = cert.templateId ?? course.certificateTemplateId;
      if (templateId) {
        const [tmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, templateId)).limit(1);
        template = tmpl ?? null;
      }
      if (!template) {
        const [defaultTmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.isDefault, true)).limit(1);
        template = defaultTmpl ?? null;
      }

      // Regenerate PDF with current learner name
      const certTitle = (course.certificateTitleOverride?.trim()) ? course.certificateTitleOverride.trim() : course.title;
      let pdfBuffer: Buffer;
      if (template?.pdfTemplateUrl) {
        const res = await fetch(template.pdfTemplateUrl);
        if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch certificate template" });
        const rawBuffer = Buffer.from(await res.arrayBuffer());
        const { overlayLearnerData } = await import("../lib/certificatePdfOverlay");
        pdfBuffer = await overlayLearnerData(rawBuffer, {
          learnerName,
          courseTitle: certTitle,
          issuedAt: cert.issuedAt,
          creditHours: course.creditHours ?? null,
        });
      } else {
        pdfBuffer = await generateCertificatePdf({
          learnerName,
          courseTitle: certTitle,
          issuedAt: cert.issuedAt,
          credentials: user.credentials,
          creditHours: course.creditHours ?? null,
          template,
        });
      }

      // Upload new PDF to S3
      const suffix = randomBytes(6).toString("hex");
      const fileKey = buildCmeCertificateFileKey(course.title, cert.issuedAt, suffix);
      const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      // Update the certificate record with the new URL
      await db.update(lmsCertificates).set({ certificateUrl }).where(eq(lmsCertificates.id, cert.id));

      return { certificateUrl };
    }),

  /**
   * Returns whether the current user has passed the quiz for a specific lesson.
   * Used by the Certificate Preview block to gate access behind a quiz pass.
   */
  getLessonQuizPassStatus: protectedProcedure
    .input(z.object({ lessonId: z.number().int(), courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) return { passed: false, score: null, attempts: 0 };
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, course.id)))
        .limit(1);
      if (!enrollment) return { passed: false, score: null, attempts: 0 };
      const [progress] = await db.select({
        quizPassed: lmsLessonProgress.quizPassed,
        quizScore: lmsLessonProgress.quizScore,
        attempts: lmsLessonProgress.attempts,
      })
        .from(lmsLessonProgress)
        .where(and(
          eq(lmsLessonProgress.enrollmentId, enrollment.id),
          eq(lmsLessonProgress.lessonId, input.lessonId),
        ))
        .limit(1);
      if (!progress) return { passed: false, score: null, attempts: 0 };
      return {
        passed: progress.quizPassed ?? false,
        score: progress.quizScore ?? null,
        attempts: progress.attempts ?? 0,
      };
    }),

  // ── Lesson Notes ──────────────────────────────────────────────────────────

  /** Get all notes for a course (grouped by lesson) */
  getCourseNotes: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const notes = await db.select({
        id: lmsLessonNotes.id,
        lessonId: lmsLessonNotes.lessonId,
        note: lmsLessonNotes.note,
        createdAt: lmsLessonNotes.createdAt,
        updatedAt: lmsLessonNotes.updatedAt,
        lessonTitle: lmsLessons.title,
      })
        .from(lmsLessonNotes)
        .innerJoin(lmsLessons, eq(lmsLessonNotes.lessonId, lmsLessons.id))
        .where(and(eq(lmsLessonNotes.userId, ctx.user.id), eq(lmsLessonNotes.courseId, course.id)))
        .orderBy(desc(lmsLessonNotes.updatedAt));
      return notes;
    }),

  /** Save (create or update) a note for a lesson */
  saveNote: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      courseSlug: z.string(),
      note: z.string().max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [existing] = await db.select({ id: lmsLessonNotes.id }).from(lmsLessonNotes)
        .where(and(eq(lmsLessonNotes.userId, ctx.user.id), eq(lmsLessonNotes.lessonId, input.lessonId))).limit(1);
      if (existing) {
        await db.update(lmsLessonNotes).set({ note: input.note }).where(eq(lmsLessonNotes.id, existing.id));
        return { id: existing.id };
      }
      const [result] = await db.insert(lmsLessonNotes).values({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        courseId: course.id,
        note: input.note,
      }).$returningId();
      return { id: result.id };
    }),

  /** Delete a note */
  deleteNote: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [note] = await db.select({ userId: lmsLessonNotes.userId }).from(lmsLessonNotes).where(eq(lmsLessonNotes.id, input.noteId)).limit(1);
      if (!note || note.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(lmsLessonNotes).where(eq(lmsLessonNotes.id, input.noteId));
      return { success: true };
    }),

  // ── Bookmarks ─────────────────────────────────────────────────────────────

  /** Get all bookmarks for a course */
  getCourseBookmarks: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const bookmarks = await db.select({
        id: lmsLessonBookmarks.id,
        lessonId: lmsLessonBookmarks.lessonId,
        createdAt: lmsLessonBookmarks.createdAt,
        lessonTitle: lmsLessons.title,
        lessonType: lmsLessons.type,
      })
        .from(lmsLessonBookmarks)
        .innerJoin(lmsLessons, eq(lmsLessonBookmarks.lessonId, lmsLessons.id))
        .where(and(eq(lmsLessonBookmarks.userId, ctx.user.id), eq(lmsLessonBookmarks.courseId, course.id)))
        .orderBy(desc(lmsLessonBookmarks.createdAt));
      return bookmarks;
    }),

  /** Toggle bookmark for a lesson */
  toggleBookmark: protectedProcedure
    .input(z.object({ lessonId: z.number(), courseSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const [existing] = await db.select({ id: lmsLessonBookmarks.id }).from(lmsLessonBookmarks)
        .where(and(eq(lmsLessonBookmarks.userId, ctx.user.id), eq(lmsLessonBookmarks.lessonId, input.lessonId))).limit(1);
      if (existing) {
        await db.delete(lmsLessonBookmarks).where(eq(lmsLessonBookmarks.id, existing.id));
        return { bookmarked: false };
      }
      await db.insert(lmsLessonBookmarks).values({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        courseId: course.id,
      });
      return { bookmarked: true };
    }),

  /** Get course overview page data (enrolled or admin) */
  getCourseOverview: protectedProcedure
    .input(z.object({ slug: z.string(), preview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.slug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      // Resolve enrollment the same way as dashboard My Content (user + course slug join).
      const { resolveEnrollmentByCourseSlug } = await import("../lib/enrollmentAccess");
      const enrollmentAccess = await resolveEnrollmentByCourseSlug(db as any, ctx.user.id, input.slug);

      const isAdminByRole = ctx.user.role === "admin";
      const isAdminPreview = input.preview && isAdminByRole && !enrollmentAccess;
      if (!enrollmentAccess && !isAdminByRole) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Enrollment required" });
      }

      if (enrollmentAccess?.enrollmentType === "presale" && !isAdminByRole) {
        const [presaleGroup] = await db.select({
          heading: lmsCohortGroups.presaleWelcomeHeading,
          body: lmsCohortGroups.presaleWelcomeBody,
          mediaUrl: lmsCohortGroups.presaleWelcomeMediaUrl,
          ctaLabel: lmsCohortGroups.presaleWelcomeCtaLabel,
          ctaUrl: lmsCohortGroups.presaleWelcomeCtaUrl,
        }).from(lmsCohortGroupEnrollments)
          .innerJoin(lmsCohortGroups, eq(lmsCohortGroups.id, lmsCohortGroupEnrollments.cohortGroupId))
          .where(eq(lmsCohortGroupEnrollments.enrollmentId, enrollmentAccess.id))
          .limit(1);
        return {
          course,
          enrollment: enrollmentAccess,
          sections: [],
          topLevelLessons: [],
          progress: [],
          instructors: [],
          isAdminPreview: false,
          isPresale: true,
          presaleWelcome: resolvePresaleWelcome(presaleGroup, {
            heading: course.presaleWelcomeHeading,
            body: course.presaleWelcomeBody,
            mediaUrl: course.presaleWelcomeMediaUrl,
            ctaLabel: course.presaleWelcomeCtaLabel,
            ctaUrl: course.presaleWelcomeCtaUrl,
          }),
        };
      }

      const lessonTree = await loadPublishedCourseLessonTree(db as any, course.id, {
        hideEmptySections: !isAdminPreview,
      });
      const allLessons = lessonTree.allLessons;
      const toOverviewLesson = (lesson: (typeof allLessons)[number]) => {
        const { contentBlocks, content, embedUrl, videoContent, learningObjectives, ...rest } = lesson as typeof lesson & {
          content?: string | null;
          embedUrl?: string | null;
          videoContent?: string | null;
          learningObjectives?: string | null;
        };
        return {
          ...rest,
          hasAssessmentContent: lessonHasAssessmentContent({ type: lesson.type, contentBlocks }),
        };
      };
      const sectionsWithLessons = lessonTree.sections.map((section) => ({
        ...section,
        lessons: section.lessons.map(toOverviewLesson),
      }));
      const topLevelLessons = lessonTree.topLevelLessons.map(toOverviewLesson);

      // Progress
      let progress: typeof lmsLessonProgress.$inferSelect[] = [];
      const effectiveEnrollment = enrollmentAccess ?? (isAdminPreview ? { id: -1, userId: ctx.user.id, courseId: course.id, enrolledAt: new Date(), progressPct: 0, completedAt: null, lastAccessedAt: new Date(), certificateIssuedAt: null } as any : null);
      if (effectiveEnrollment && effectiveEnrollment.id !== -1) {
        progress = await db.select().from(lmsLessonProgress).where(eq(lmsLessonProgress.enrollmentId, effectiveEnrollment.id));
      }

      // Instructors
      const courseInstructorLinks = await db.select().from(lmsCourseInstructors)
        .where(eq(lmsCourseInstructors.courseId, course.id));
      const instructorIds = courseInstructorLinks.map(l => l.instructorId);
      let instructors: typeof lmsInstructors.$inferSelect[] = [];
      if (instructorIds.length > 0) {
        instructors = await db.select().from(lmsInstructors)
          .where(sql`${lmsInstructors.id} IN (${sql.join(instructorIds.map(id => sql`${id}`), sql`, `)})`);
      }

      return { course, enrollment: effectiveEnrollment, sections: sectionsWithLessons, topLevelLessons, progress, instructors, isAdminPreview: !!isAdminPreview && !enrollmentAccess };
    }),

  /** Get cohort schedule (sessions + assignments) for an enrolled student */
  getCohortSchedule: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify the user is enrolled (or is admin)
      const isAdmin = ctx.user.role === "admin";
      if (!isAdmin) {
        const [enrollment] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, input.courseId)))
          .limit(1);
        if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "You are not enrolled in this cohort" });
      }
      const [course] = await db.select({
        id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug,
        description: lmsCourses.description, thumbnailUrl: lmsCourses.thumbnailUrl,
        enrollmentCloseDate: lmsCourses.enrollmentCloseDate,
        multiCohortMode: lmsCourses.multiCohortMode,
        primaryColor: lmsCourses.primaryColor,
        accentColor: lmsCourses.accentColor,
      }).from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Get the user's cohort group assignment first (needed for filtering)
      const [myGroupEnrollment] = await db
        .select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.userId, ctx.user.id), eq(lmsCohortGroupEnrollments.courseId, input.courseId)))
        .limit(1);
      let myGroup = null;
      if (myGroupEnrollment) {
        const { getCohortGroupById } = await import("../lib/cohortGroupQuery");
        myGroup = await getCohortGroupById(db, myGroupEnrollment.cohortGroupId);
      }
      // When multi-cohort mode is on, filter content by the student's group
      const groupId = course.multiCohortMode && myGroup ? myGroup.id : null;
      const { cohortCourseContentWhere } = await import("../lib/cohortGroupQuery");
      const resourceWhere = cohortCourseContentWhere(
        lmsCohortResources.courseId,
        lmsCohortResources.cohortGroupId,
        input.courseId,
        groupId ?? undefined,
        eq(lmsCohortResources.status, "published"),
      );
      const [sessions, assignments, recordings, resourceRows, mySubmissions] = await Promise.all([
        db.select().from(lmsCohortSessions)
          .where(cohortCourseContentWhere(
            lmsCohortSessions.courseId,
            lmsCohortSessions.cohortGroupId,
            input.courseId,
            groupId ?? undefined,
          ))
          .orderBy(asc(lmsCohortSessions.sessionDate)),
        db.select().from(lmsCohortAssignments)
          .where(cohortCourseContentWhere(
            lmsCohortAssignments.courseId,
            lmsCohortAssignments.cohortGroupId,
            input.courseId,
            groupId ?? undefined,
            eq(lmsCohortAssignments.status, "published"),
          ))
          .orderBy(asc(lmsCohortAssignments.position), asc(lmsCohortAssignments.dueDate)),
        (async () => {
          const recs = await db.select().from(lmsCohortRecordings)
            .where(cohortCourseContentWhere(
              lmsCohortRecordings.courseId,
              lmsCohortRecordings.cohortGroupId,
              input.courseId,
              groupId ?? undefined,
              eq(lmsCohortRecordings.status, "published"),
            ))
            .orderBy(asc(lmsCohortRecordings.position), asc(lmsCohortRecordings.createdAt));
          // Enrich recordings that have a sessionId with the linked session's title and date
          const sessionIds = recs.map(r => r.sessionId).filter((id): id is number => id != null);
          const linkedSessions = sessionIds.length > 0
            ? await db.select({ id: lmsCohortSessions.id, title: lmsCohortSessions.title, sessionDate: lmsCohortSessions.sessionDate })
                .from(lmsCohortSessions)
                .where(inArray(lmsCohortSessions.id, sessionIds))
            : [];
          const sessionMap = new Map(linkedSessions.map(s => [s.id, s]));
          return recs.map(r => ({
            ...r,
            linkedSessionTitle: r.sessionId ? (sessionMap.get(r.sessionId)?.title ?? null) : null,
            linkedSessionDate: r.sessionId ? (sessionMap.get(r.sessionId)?.sessionDate ?? null) : null,
          }));
        })(),
        db.select().from(lmsCohortResources)
          .where(resourceWhere)
          .orderBy(asc(lmsCohortResources.position), asc(lmsCohortResources.createdAt)),
        db.select().from(lmsCohortSubmissions)
          .where(eq(lmsCohortSubmissions.userId, ctx.user.id)),
      ]);
      const resources = await enrichCohortResources(db, resourceRows);
      return { course, sessions, assignments, recordings, resources, mySubmissions, myGroup };
    }),

  /** Get the learner's assigned cohort group for a course */
  getMyCohortGroup: protectedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [groupEnrollment] = await db
        .select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(eq(lmsCohortGroupEnrollments.userId, ctx.user.id), eq(lmsCohortGroupEnrollments.courseId, input.courseId)))
        .limit(1);
      if (!groupEnrollment) return null;
      const { getCohortGroupById } = await import("../lib/cohortGroupQuery");
      return getCohortGroupById(db, groupEnrollment.cohortGroupId);
    }),

  submitCohortAssignment: protectedProcedure
    .input(z.object({
      assignmentId: z.number(),
      submissionType: z.enum(["text", "file", "url", "none"]),
      textContent: z.string().optional(),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      urlContent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify assignment exists and is published
      const [assignment] = await db.select().from(lmsCohortAssignments)
        .where(and(eq(lmsCohortAssignments.id, input.assignmentId), eq(lmsCohortAssignments.status, "published")))
        .limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      // Verify user is enrolled
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      // Upsert submission
      const existing = await db.select({ id: lmsCohortSubmissions.id })
        .from(lmsCohortSubmissions)
        .where(and(eq(lmsCohortSubmissions.assignmentId, input.assignmentId), eq(lmsCohortSubmissions.userId, ctx.user.id)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(lmsCohortSubmissions).set({
          submissionType: input.submissionType,
          textContent: input.textContent ?? null,
          fileUrl: input.fileUrl ?? null,
          fileKey: input.fileKey ?? null,
          urlContent: input.urlContent ?? null,
          status: "pending",
        }).where(eq(lmsCohortSubmissions.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }
      const [result] = await db.insert(lmsCohortSubmissions).values({
        assignmentId: input.assignmentId,
        userId: ctx.user.id,
        submissionType: input.submissionType,
        textContent: input.textContent ?? null,
        fileUrl: input.fileUrl ?? null,
        fileKey: input.fileKey ?? null,
        urlContent: input.urlContent ?? null,
        status: "pending",
      }).$returningId();
      return { id: result.id, updated: false };
    }),

  /** Upload a file for an assignment submission (student-facing) */
  uploadSubmissionFile: protectedProcedure
    .input(z.object({
      dataUri: z.string().min(1).max(52_428_800), // 50 MB base64 limit
      mimeType: z.string().min(1),
      fileName: z.string().min(1).max(255),
      assignmentId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify assignment exists and user is enrolled
      const [assignment] = await db.select({ courseId: lmsCohortAssignments.courseId })
        .from(lmsCohortAssignments).where(eq(lmsCohortAssignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      // Decode and upload
      const b64Marker = ";base64,";
      const b64Idx = input.dataUri.indexOf(b64Marker);
      const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.byteLength > 40 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File must be under 40 MB" });
      }
      const suffix = Math.random().toString(36).slice(2, 10);
      const sanitizedName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `cohort-submissions/${ctx.user.id}/${input.assignmentId}/${suffix}-${sanitizedName}`;
            const { url } = await storagePut(fileKey, buffer, input.mimeType);
      return { url, fileKey };
    }),

  getAssignmentDetail: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [assignment] = await db.select().from(lmsCohortAssignments)
        .where(eq(lmsCohortAssignments.id, input.assignmentId)).limit(1);
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
      console.log(`[getAssignmentDetail] id=${input.assignmentId} contentBlocks type=${typeof assignment.contentBlocks} isArray=${Array.isArray(assignment.contentBlocks)} len=${Array.isArray(assignment.contentBlocks) ? assignment.contentBlocks.length : 'N/A'} raw=${JSON.stringify(assignment.contentBlocks)?.substring(0, 200)}`);
      // Verify enrollment
      const [enrollment] = await db.select({ id: lmsEnrollments.id })
        .from(lmsEnrollments)
        .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, assignment.courseId)))
        .limit(1);
      if (!enrollment && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      if (assignment.status !== "published" && ctx.user.role !== "admin") throw new TRPCError({ code: "NOT_FOUND" });
      const [mySubmission] = await db.select().from(lmsCohortSubmissions)
        .where(and(eq(lmsCohortSubmissions.assignmentId, input.assignmentId), eq(lmsCohortSubmissions.userId, ctx.user.id)))
        .limit(1);
      return { assignment, mySubmission: mySubmission ?? null };
    }),

  // ── Student Cohort Discussions ────────────────────────────────────────────────

  /** Get discussion messages for the student's cohort group */
  getCohortDiscussions: protectedProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().default(100), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Find the student's cohort group for this course
      const [groupEnrollment] = await db.select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(
          eq(lmsCohortGroupEnrollments.userId, ctx.user.id),
          eq(lmsCohortGroupEnrollments.courseId, input.courseId),
        ))
        .limit(1);
      if (!groupEnrollment) return { messages: [], cohortGroupId: null };
      const { lmsCohortMessages } = await import("../../drizzle/schema");
      const messages = await db.select({
        id: lmsCohortMessages.id,
        cohortGroupId: lmsCohortMessages.cohortGroupId,
        userId: lmsCohortMessages.userId,
        body: lmsCohortMessages.body,
        mediaUrls: lmsCohortMessages.mediaUrls,
        isAdminPost: lmsCohortMessages.isAdminPost,
        isPinned: lmsCohortMessages.isPinned,
        createdAt: lmsCohortMessages.createdAt,
        userName: users.name,
        userDisplayName: users.displayName,
        userAvatar: users.avatarUrl,
      })
        .from(lmsCohortMessages)
        .innerJoin(users, eq(users.id, lmsCohortMessages.userId))
        .where(and(
          eq(lmsCohortMessages.cohortGroupId, groupEnrollment.cohortGroupId),
          eq(lmsCohortMessages.courseId, input.courseId),
          isNull(lmsCohortMessages.deletedAt),
        ))
        .orderBy(desc(lmsCohortMessages.isPinned), desc(lmsCohortMessages.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return { messages, cohortGroupId: groupEnrollment.cohortGroupId, currentUserId: ctx.user.id };
    }),

  /** Post a message in the student's cohort group discussion */
  postStudentCohortMessage: protectedProcedure
    .input(z.object({
      courseId: z.number(),
      body: z.string().optional(),
      mediaUrls: z.array(z.object({ url: z.string(), mimeType: z.string(), fileName: z.string() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [groupEnrollment] = await db.select({ cohortGroupId: lmsCohortGroupEnrollments.cohortGroupId })
        .from(lmsCohortGroupEnrollments)
        .where(and(
          eq(lmsCohortGroupEnrollments.userId, ctx.user.id),
          eq(lmsCohortGroupEnrollments.courseId, input.courseId),
        ))
        .limit(1);
      if (!groupEnrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not in a cohort group for this course" });
      const [result] = await db.insert(lmsCohortMessages).values({
        cohortGroupId: groupEnrollment.cohortGroupId,
        courseId: input.courseId,
        userId: ctx.user.id,
        body: input.body ?? null,
        mediaUrls: input.mediaUrls ?? null,
        isAdminPost: false,
        isPinned: false,
      }).$returningId();
      // ── Fire-and-forget notifications ──
      (async () => {
        try {
          // Get course + group name for notification context
          const [course] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug })
            .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
          const [group] = await db.select({ name: lmsCohortGroups.name })
            .from(lmsCohortGroups).where(eq(lmsCohortGroups.id, groupEnrollment.cohortGroupId)).limit(1);
          const [poster] = await db.select({ name: users.name, displayName: users.displayName, email: users.email })
            .from(users).where(eq(users.id, ctx.user.id)).limit(1);
          const posterName = poster?.displayName || poster?.name || "A student";
          const courseName = course?.title ?? "your cohort course";
          const groupName = group?.name ?? "";
          const plainBody = input.body ? input.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
          const snippet = plainBody ? (plainBody.length > 200 ? plainBody.slice(0, 200) + "…" : plainBody) : "[media attachment]";
          const discussionUrl = `https://learn.allaboutultrasound.com/courses/${course?.slug ?? input.courseId}?tab=cohort&cohortTab=discussions`;
          // Collect admins + cohort staff (exclude the poster)
          const adminUsers = await db.select({ id: users.id, email: users.email, name: users.name, displayName: users.displayName, notificationPrefs: users.notificationPrefs })
            .from(users).where(eq(users.role, "admin"));
          const staffUsers = await db.select({ id: users.id, email: users.email, name: users.name, displayName: users.displayName, notificationPrefs: users.notificationPrefs })
            .from(users)
            .innerJoin(lmsCohortStaff, eq(lmsCohortStaff.userId, users.id))
            .where(and(
              eq(lmsCohortStaff.cohortGroupId, groupEnrollment.cohortGroupId),
              eq(lmsCohortStaff.courseId, input.courseId),
            ));
          // Merge and deduplicate by user id
          const allRecipients = [...adminUsers, ...staffUsers].filter((u, idx, arr) =>
            u.id !== ctx.user.id && arr.findIndex(x => x.id === u.id) === idx
          );
          // Filter by notification preference (default = enabled)
          const recipients = allRecipients.filter(u => {
            try {
              const prefs = u.notificationPrefs ? JSON.parse(u.notificationPrefs) : {};
              return prefs.cohortDiscussions !== false;
            } catch { return true; }
          });
          // Build email HTML
          const emailHtml = emailWrapper(`
            <h2 style="margin:0 0 8px;font-size:20px;color:#0e4a50;font-family:Georgia,serif;">New Cohort Discussion Post</h2>
            <p style="margin:0 0 16px;font-size:14px;color:#64748b;">${courseName}${groupName ? ` — ${groupName}` : ""}</p>
            <div style="background:#f0fbfc;border-left:4px solid #0d9488;border-radius:4px;padding:12px 16px;margin:0 0 20px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0e4a50;">${posterName}</p>
              <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${snippet}</p>
            </div>
            <a href="${discussionUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">View Discussion →</a>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">You can manage your notification preferences in your account settings.</p>
          `, "aaus");
          // Send emails
          for (const r of recipients) {
            if (r.email) {
              await sendEmail({
                to: r.email,
                subject: `New discussion post in ${courseName}`,
                html: emailHtml,
              }).catch(() => {});
            }
          }
          // Platform notification to owner
          await notifyOwner({
            title: `New cohort discussion: ${courseName}`,
            content: `${posterName} posted in ${groupName || courseName}: "${snippet}"`,
          }).catch(() => {});
        } catch (e) {
          console.warn("[CohortDiscussion] Notification error:", e);
        }
      })();
      return { id: result.id };
    }),

  /** Delete own cohort message */
  deleteStudentCohortMessage: protectedProcedure
    .input(z.object({ id: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { lmsCohortMessages } = await import("../../drizzle/schema");
      const [msg] = await db.select({ userId: lmsCohortMessages.userId })
        .from(lmsCohortMessages)
        .where(eq(lmsCohortMessages.id, input.id))
        .limit(1);
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
            await db.update(lmsCohortMessages).set({ deletedAt: new Date() }).where(eq(lmsCohortMessages.id, input.id));
      return { success: true };
    }),

  /** Get cohort discussion notification preference for current user */
  getCohortNotifPref: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({ notificationPrefs: users.notificationPrefs })
      .from(users).where(eq(users.id, ctx.user.id)).limit(1);
    try {
      const prefs = u?.notificationPrefs ? JSON.parse(u.notificationPrefs) : {};
      return { cohortDiscussions: prefs.cohortDiscussions !== false };
    } catch { return { cohortDiscussions: true }; }
  }),

  /** Toggle cohort discussion notification preference for current user */
  setCohortNotifPref: protectedProcedure
    .input(z.object({ cohortDiscussions: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [u] = await db.select({ notificationPrefs: users.notificationPrefs })
        .from(users).where(eq(users.id, ctx.user.id)).limit(1);
      let prefs: Record<string, unknown> = {};
      try { prefs = u?.notificationPrefs ? JSON.parse(u.notificationPrefs) : {}; } catch {}
      prefs.cohortDiscussions = input.cohortDiscussions;
      await db.update(users).set({ notificationPrefs: JSON.stringify(prefs) }).where(eq(users.id, ctx.user.id));
      return { success: true, cohortDiscussions: input.cohortDiscussions };
    }),

  /** Get a single cohort recording by ID (for the player page) */
  getCohortRecording: protectedProcedure
    .input(z.object({ recordingId: z.number().int().positive(), courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify enrollment (or admin)
      const isAdmin = ctx.user.role === "admin";
      if (!isAdmin) {
        const [enrollment] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(eq(lmsEnrollments.userId, ctx.user.id), eq(lmsEnrollments.courseId, input.courseId)))
          .limit(1);
        if (!enrollment) throw new TRPCError({ code: "FORBIDDEN", message: "Not enrolled in this cohort" });
      }
      const [recording] = await db.select().from(lmsCohortRecordings)
        .where(and(eq(lmsCohortRecordings.id, input.recordingId), eq(lmsCohortRecordings.courseId, input.courseId)))
        .limit(1);
      if (!recording) throw new TRPCError({ code: "NOT_FOUND", message: "Recording not found" });
      // Get the session info if linked
      let session = null;
      if (recording.sessionId) {
        const [s] = await db.select().from(lmsCohortSessions).where(eq(lmsCohortSessions.id, recording.sessionId)).limit(1);
        session = s ?? null;
      }
      // Get user's progress for this recording
      const [progress] = await db.select().from(lmsCohortRecordingProgress)
        .where(and(eq(lmsCohortRecordingProgress.userId, ctx.user.id), eq(lmsCohortRecordingProgress.recordingId, input.recordingId)))
        .limit(1);
      // Fetch course theme colors
      const [courseTheme] = await db.select({ primaryColor: lmsCourses.primaryColor, accentColor: lmsCourses.accentColor })
        .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      const primaryColor = courseTheme?.primaryColor ?? "#179ca3";
      const accentColor = courseTheme?.accentColor ?? "#0d9488";
      // Resolve Thinkific proxy URLs to Wistia embed URLs server-side
      // (Thinkific proxy has x-frame-options: SAMEORIGIN so can't be iframed directly)
      let resolvedEmbedUrl: string | null = null;
      if (recording.videoUrl && recording.videoUrl.includes('platform.thinkific.com/videoproxy')) {
        try {
          const resp = await fetch(recording.videoUrl, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
          const html = await resp.text();
          const wistiaMatch = html.match(/wistia_async_(\w+)/);
          if (wistiaMatch) {
            // Strip '#' from hex color for Wistia playerColor param
            const wistiaColor = primaryColor.replace(/^#/, '');
            resolvedEmbedUrl = `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}?videoFoam=true&autoPlay=false&playerColor=${wistiaColor}`;
          }
        } catch (_) {
          // Ignore resolution errors - fall back to direct URL
        }
      }
      return { recording: { ...recording, resolvedEmbedUrl }, session, progress: progress ?? null, primaryColor, accentColor };
    }),

  /** Get recording progress for all recordings in a course for the current user */
  getCohortRecordingProgress: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(lmsCohortRecordingProgress)
        .where(and(eq(lmsCohortRecordingProgress.userId, ctx.user.id), eq(lmsCohortRecordingProgress.courseId, input.courseId)));
      // Return as a map keyed by recordingId for easy lookup
      const progressMap: Record<number, typeof rows[0]> = {};
      for (const row of rows) progressMap[row.recordingId] = row;
      return progressMap;
    }),

  /** Track/update recording progress for the current user (upsert) */
  trackCohortRecordingProgress: protectedProcedure
    .input(z.object({
      recordingId: z.number().int().positive(),
      courseId: z.number().int().positive(),
      positionSec: z.number().int().min(0),
      durationSec: z.number().int().min(0),
      percentWatched: z.number().int().min(0).max(100),
      eventType: z.enum(["play", "pause", "progress", "complete"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const completed = input.percentWatched >= 90;
      const now = new Date();
      // Check if row exists
      const [existing] = await db.select().from(lmsCohortRecordingProgress)
        .where(and(eq(lmsCohortRecordingProgress.userId, ctx.user.id), eq(lmsCohortRecordingProgress.recordingId, input.recordingId)))
        .limit(1);
      if (existing) {
        const updateData: Record<string, unknown> = {
          positionSec: input.positionSec,
          durationSec: input.durationSec,
          percentWatched: Math.max(existing.percentWatched, input.percentWatched),
          completed: existing.completed || completed,
          lastPlayedAt: now,
        };
        if (input.eventType === "play") updateData.playCount = (existing.playCount ?? 0) + 1;
        if (completed && !existing.completed) updateData.completedAt = now;
        await db.update(lmsCohortRecordingProgress).set(updateData).where(eq(lmsCohortRecordingProgress.id, existing.id));
      } else {
        await db.insert(lmsCohortRecordingProgress).values({
          userId: ctx.user.id,
          recordingId: input.recordingId,
          courseId: input.courseId,
          positionSec: input.positionSec,
          durationSec: input.durationSec,
          percentWatched: input.percentWatched,
          completed,
          playCount: input.eventType === "play" ? 1 : 0,
          firstPlayedAt: input.eventType === "play" ? now : null,
          lastPlayedAt: now,
          completedAt: completed ? now : null,
        });
      }
      // Log to userActivityLogs for analytics
      if (input.eventType === "play" || input.eventType === "complete") {
        await db.insert(userActivityLogs).values({
          userId: ctx.user.id,
          eventType: input.eventType === "complete" ? "video_complete" : "video_play",
          courseId: input.courseId,
          metadata: JSON.stringify({
            recordingId: input.recordingId,
            positionSec: input.positionSec,
            durationSec: input.durationSec,
            percentWatched: input.percentWatched,
          }),
        }).catch(() => {});
      }
      return { success: true, completed };
    }),

  /**
   * Get a direct Stripe checkout URL for upgrading from free preview to full enrollment.
   * Uses the course's primary pricing. Available to any logged-in learner.
   */
  getUpgradeCheckoutUrl: protectedProcedure
    .input(z.object({ courseSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const stripe = getStripeClient();
      // Always use the learn subdomain for Stripe redirects (not the main app domain)
      const learnDomain = "https://learn.allaboutultrasound.com";

      // Return cached payment link if still active
      const cachedLinkId = (course as any).stripePaymentLinkId as string | null;
      if (cachedLinkId) {
        try {
          const existing = await stripe.paymentLinks.retrieve(cachedLinkId);
          if (existing.active) return { url: existing.url };
        } catch { /* fall through */ }
      }

      // Check for first active pricing option first
      const pricingOpts = await db.select().from(lmsPricingOptions)
        .where(eq(lmsPricingOptions.courseId, course.id));
      const firstActive = pricingOpts.find(o => o.isActive !== false);

      const pricingType = firstActive?.pricingType ?? course.pricingType ?? "one_time";
      const currency = course.currency ?? "usd";
      const price = firstActive?.price ?? course.price;
      let stripePriceId = firstActive?.stripePriceId ?? course.stripePriceId ?? null;

      if (!stripePriceId) {
        const product = await stripe.products.create({
          name: course.title,
          description: course.subtitle ?? undefined,
          metadata: { course_id: String(course.id), source: "learner_upgrade" },
        });
        if (pricingType === "one_time" || pricingType === "free") {
          const p = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(price) * 100), currency });
          stripePriceId = p.id;
        } else if (pricingType === "subscription") {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = (firstActive as any)?.subscriptionInterval ?? "monthly";
          const p = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(price) * 100), currency, recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 } });
          stripePriceId = p.id;
        } else if (pricingType === "payment_plan") {
          const installmentAmt = (firstActive?.installmentAmount ?? course.installmentAmount ?? 0) > 0
            ? (firstActive?.installmentAmount ?? course.installmentAmount)
            : price;
          const intervalMonths = Math.round(((firstActive?.installmentIntervalDays ?? course.installmentIntervalDays ?? 30)) / 30) || 1;
          const p = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(installmentAmt) * 100), currency, recurring: { interval: "month", interval_count: intervalMonths } });
          stripePriceId = p.id;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported pricing type: ${pricingType}` });
        }
        // Cache the price ID
        if (firstActive) {
          await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, firstActive.id));
        } else {
          await db.update(lmsCourses).set({ stripePriceId } as any).where(eq(lmsCourses.id, course.id));
        }
      }

      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        customer_email: ctx.user.email ?? undefined,
        metadata: {
          course_id: String(course.id),
          user_id: String(ctx.user.id),
          source: "free_preview_upgrade",
        },
        after_completion: { type: "redirect", redirect: { url: `${learnDomain}/courses/${course.slug}` } },
      });

      // Cache the payment link on the course
      await db.update(lmsCourses).set({ stripePaymentLinkId: paymentLink.id } as any).where(eq(lmsCourses.id, course.id));
      return { url: paymentLink.url };
    }),

  /**
   * Create a Stripe Embedded Checkout Session for the hosted /checkout/:courseSlug page.
   * Supports primary pricing, a specific pricing option, or a team tier.
   * Returns clientSecret + course/pricing metadata for the frontend to display
   * the billing disclosure and terms agreement before Stripe loads.
   */
  createEmbeddedCheckoutSession: publicProcedure
    .input(z.object({
      courseSlug: z.string(),
      pricingOptionId: z.number().int().positive().optional(),
      teamTierId: z.number().int().positive().optional(),
      seatCount: z.number().int().positive().optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.slug, input.courseSlug)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      if (course.status === "draft" || course.status === "archived") throw new TRPCError({ code: "NOT_FOUND" });

      // Fetch org-level legal URLs and checkout terms from platform_settings
      const [orgSettings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);

      const stripe = getStripeClient();

      // Helper: validate a stored stripe price ID exists in the current Stripe account
      const validatePriceId = async (priceId: string | null): Promise<string | null> => {
        if (!priceId) return null;
        try {
          await stripe.prices.retrieve(priceId);
          return priceId;
        } catch (e: any) {
          if (e?.code === 'resource_missing' || e?.statusCode === 404 || (e?.message && e.message.includes('No such price'))) {
            return null; // stale price from a different Stripe account
          }
          throw e; // re-throw unexpected errors
        }
      };

      const learnDomain = "https://learn.allaboutultrasound.com";
      const returnUrl = `${learnDomain}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&slug=${course.slug}`;

      const currency = course.currency ?? "usd";
      let stripePriceId: string | null = null;
      let pricingType: string = "one_time";
      let displayPrice: number = 0;
      let subscriptionInterval: string | null = null;
      let productName: string = course.title;
      let isSubscription = false;
      let billingLabel: string | null = null;

      // ── Create a pending order row so the webhook can link the payment ──────────
      // We create this before the Stripe session so we can embed order_id in metadata.
      // If the user is not logged in (guest), we'll use 0 as a placeholder and update
      // it in the webhook once the user is resolved.
      const pendingUserId = ctx.user?.id ?? 0;
      let pendingOrderId: number | null = null;
      if (pendingUserId > 0) {
        try {
          const [orderRow] = await db.insert(lmsOrders).values({
            userId: pendingUserId,
            courseId: course.id,
            amount: Math.round(Number(course.price ?? 0) * 100),
            currency: course.currency ?? "usd",
            status: "pending",
            seats: 1,
          }).$returningId();
          pendingOrderId = orderRow?.id ?? null;
        } catch { /* non-fatal — webhook will still enroll via fallback */ }
      }

      // ── TEAM TIER MODE ────────────────────────────────────────────────────────
      if (input.teamTierId) {
        const [tier] = await db.select().from(lmsDefaultTeamTiers).where(eq(lmsDefaultTeamTiers.id, input.teamTierId)).limit(1);
        if (!tier || tier.courseId !== course.id) throw new TRPCError({ code: "NOT_FOUND", message: "Team tier not found" });
        const primaryPrice = Number(course.price ?? 0);
        const discountPct = Number(tier.discountPercent ?? 0);
        const perSeatPrice = Math.max(0.5, Math.round(primaryPrice * (1 - discountPct / 100) * 100) / 100);
        displayPrice = perSeatPrice;
        pricingType = "one_time";
        productName = `${course.title} — Team (${tier.minSeats}+ seats, ${discountPct}% off)`;
        billingLabel = `$${perSeatPrice.toFixed(2)}/seat × ${tier.minSeats} seats minimum`;

        // Reuse or create Stripe Price
        stripePriceId = await validatePriceId(tier.stripePriceId ?? null);
        if (!stripePriceId) {
          const product = await stripe.products.create({
            name: productName,
            metadata: { course_id: String(course.id), team_tier_id: String(tier.id) },
          });
          const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(perSeatPrice * 100), currency });
          stripePriceId = price.id;
          await db.update(lmsDefaultTeamTiers).set({ stripePriceId }).where(eq(lmsDefaultTeamTiers.id, tier.id));
        }

        const requestedSeats = input.seatCount && input.seatCount >= tier.minSeats ? input.seatCount : tier.minSeats;
        const session = await stripe.checkout.sessions.create({
          ui_mode: "embedded",
          mode: "payment",
          line_items: [{ price: stripePriceId, quantity: requestedSeats, adjustable_quantity: { enabled: true, minimum: tier.minSeats } }],
          return_url: returnUrl,
          customer_email: ctx.user?.email ?? undefined,
          allow_promotion_codes: true,
          metadata: { course_id: String(course.id), team_tier_id: String(tier.id), source: "hosted_checkout_team_tier", user_id: ctx.user ? String(ctx.user.id) : "", order_id: pendingOrderId ? String(pendingOrderId) : "", seats: String(requestedSeats), ...(ctx.user?.email ? { customer_email: ctx.user.email } : {}) },
          payment_intent_data: { description: `${course.title} — Team License — ${requestedSeats} seats` },
        });
        const terms0 = resolveCheckoutTerms(course, orgSettings);
        return {
          clientSecret: session.client_secret!,
          courseTitle: course.title,
          courseSubtitle: course.subtitle ?? null,
          courseDescription: course.description ?? null,
          courseThumbnail: course.thumbnailUrl ?? null,
          primaryColor: course.primaryColor ?? "#179ca3",
          accentColor: course.accentColor ?? "#0d9488",
          gradientFrom: course.gradientFrom ?? "#179ca3",
          gradientTo: course.gradientTo ?? "#0d9488",
          gradientDirection: course.gradientDirection ?? "135deg",
          playerTheme: course.playerTheme ?? "light",
          ...terms0,
          productName,
          displayPrice,
          pricingType,
          isSubscription: false,
          billingLabel,
          currency,
          minSeats: tier.minSeats,
          discountPercent: Number(tier.discountPercent),
          brand: course.brand ?? "aaus",
        };
      }

      // ── PRICING OPTION MODE ───────────────────────────────────────────────────
      if (input.pricingOptionId) {
        const [opt] = await db.select().from(lmsPricingOptions).where(eq(lmsPricingOptions.id, input.pricingOptionId)).limit(1);
        if (!opt || opt.courseId !== course.id) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing option not found" });
        pricingType = opt.pricingType;
        displayPrice = Number(opt.price ?? 0);
        subscriptionInterval = opt.subscriptionInterval ?? null;
        productName = `${course.title}${opt.label ? ` — ${opt.label}` : ""}`;
        isSubscription = pricingType === "subscription" || pricingType === "payment_plan";
        stripePriceId = await validatePriceId(opt.stripePriceId ?? null);

        if (!stripePriceId) {
          const product = await stripe.products.create({
            name: productName,
            description: course.subtitle ?? undefined,
            metadata: { course_id: String(course.id), pricing_option_id: String(opt.id) },
          });
          if (pricingType === "one_time" || pricingType === "free") {
            const p = await stripe.prices.create({ product: product.id, unit_amount: courseDollarsToStripeCents(displayPrice), currency });
            stripePriceId = p.id;
          } else if (pricingType === "subscription") {
            const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
            const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
            const interval = opt.subscriptionInterval ?? "monthly";
            const p = await stripe.prices.create({ product: product.id, unit_amount: courseDollarsToStripeCents(displayPrice), currency, recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 } });
            stripePriceId = p.id;
          } else if (pricingType === "payment_plan") {
            const installmentAmt = opt.installmentAmount && opt.installmentAmount > 0 ? opt.installmentAmount : displayPrice;
            const intervalMonths = Math.round((opt.installmentIntervalDays ?? 30) / 30) || 1;
            const p = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(installmentAmt) * 100), currency, recurring: { interval: "month", interval_count: intervalMonths } });
            stripePriceId = p.id;
          }
          if (stripePriceId) await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, opt.id));
        }

        const intervalLabels: Record<string, string> = { monthly: "month", quarterly: "3 months", annual: "year" };
        if (pricingType === "subscription" && subscriptionInterval) {
          billingLabel = `$${displayPrice.toFixed(2)} / ${intervalLabels[subscriptionInterval] ?? subscriptionInterval} — recurring, cancel anytime`;
        } else if (pricingType === "payment_plan") {
          billingLabel = `${opt.installmentCount ?? ""} payments of $${Number(opt.installmentAmount ?? displayPrice).toFixed(2)}`;
        }

        const sessionMode = (pricingType === "subscription" || pricingType === "payment_plan") ? "subscription" : "payment";
        const session = await stripe.checkout.sessions.create({
          ui_mode: "embedded",
          mode: sessionMode,
          line_items: [{ price: stripePriceId!, quantity: 1 }],
          return_url: returnUrl,
          customer_email: ctx.user?.email ?? undefined,
          allow_promotion_codes: true,
          metadata: { course_id: String(course.id), pricing_option_id: String(opt.id), source: "hosted_checkout_pricing_option", user_id: ctx.user ? String(ctx.user.id) : "", order_id: pendingOrderId ? String(pendingOrderId) : "", seats: "1", ...(ctx.user?.email ? { customer_email: ctx.user.email } : {}) },
          ...(sessionMode === "payment"
            ? { payment_intent_data: { description: `${course.title} — One-Time Purchase` } }
            : { subscription_data: { description: `${course.title} — Subscription — Initial` } }),
        });
        const terms1 = resolveCheckoutTerms(course, orgSettings);
        return {
          clientSecret: session.client_secret!,
          courseTitle: course.title,
          courseSubtitle: course.subtitle ?? null,
          courseDescription: course.description ?? null,
          courseThumbnail: course.thumbnailUrl ?? null,
          primaryColor: course.primaryColor ?? "#179ca3",
          accentColor: course.accentColor ?? "#0d9488",
          gradientFrom: course.gradientFrom ?? "#179ca3",
          gradientTo: course.gradientTo ?? "#0d9488",
          gradientDirection: course.gradientDirection ?? "135deg",
          playerTheme: course.playerTheme ?? "light",
          ...terms1,
          productName,
          displayPrice,
          pricingType,
          isSubscription,
          billingLabel,
          currency,
          minSeats: null,
          discountPercent: null,
          brand: course.brand ?? "aaus",
        };
      }

      // ── PRIMARY PRICING MODE (default) ────────────────────────────────────────
      pricingType = course.pricingType ?? "one_time";
      displayPrice = Number(course.price ?? 0);
      subscriptionInterval = course.subscriptionInterval ?? null;
      isSubscription = pricingType === "subscription" || pricingType === "payment_plan";
      stripePriceId = await validatePriceId(course.stripePriceId ?? null);

      if (!stripePriceId) {
        const product = await stripe.products.create({
          name: course.title,
          description: course.subtitle ?? undefined,
          metadata: { course_id: String(course.id), source: "hosted_checkout_primary" },
        });
        if (pricingType === "one_time" || pricingType === "free") {
          const p = await stripe.prices.create({ product: product.id, unit_amount: courseDollarsToStripeCents(displayPrice), currency });
          stripePriceId = p.id;
        } else if (pricingType === "subscription") {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = course.subscriptionInterval ?? "monthly";
          const p = await stripe.prices.create({ product: product.id, unit_amount: courseDollarsToStripeCents(displayPrice), currency, recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 } });
          stripePriceId = p.id;
        } else if (pricingType === "payment_plan") {
          const installmentAmt = course.installmentAmount && course.installmentAmount > 0 ? course.installmentAmount : displayPrice;
          const intervalMonths = Math.round((course.installmentIntervalDays ?? 30) / 30) || 1;
          const p = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(installmentAmt) * 100), currency, recurring: { interval: "month", interval_count: intervalMonths } });
          stripePriceId = p.id;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported pricing type: ${pricingType}` });
        }
        if (stripePriceId) {
          await db.update(lmsCourses).set({ stripePriceId } as any).where(eq(lmsCourses.id, course.id));
        }
      }

      const intervalLabels: Record<string, string> = { monthly: "month", quarterly: "3 months", annual: "year" };
      if (pricingType === "subscription" && subscriptionInterval) {
        billingLabel = `$${displayPrice.toFixed(2)} / ${intervalLabels[subscriptionInterval] ?? subscriptionInterval} — recurring, cancel anytime`;
      } else if (pricingType === "payment_plan") {
        billingLabel = `${course.installmentCount ?? ""} payments of $${Number(course.installmentAmount ?? displayPrice).toFixed(2)}`;
      }

      const sessionMode = (pricingType === "subscription" || pricingType === "payment_plan") ? "subscription" : "payment";
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: sessionMode,
        line_items: [{ price: stripePriceId!, quantity: 1 }],
        return_url: returnUrl,
        customer_email: ctx.user?.email ?? undefined,
        allow_promotion_codes: true,
          metadata: { course_id: String(course.id), source: "hosted_checkout_primary", user_id: ctx.user ? String(ctx.user.id) : "", order_id: pendingOrderId ? String(pendingOrderId) : "", seats: "1", ...(ctx.user?.email ? { customer_email: ctx.user.email } : {}) },
          ...(sessionMode === "payment"
            ? { payment_intent_data: { description: `${course.title} — One-Time Purchase` } }
            : { subscription_data: { description: `${course.title} — Subscription — Initial` } }),
      });
      const terms2 = resolveCheckoutTerms(course, orgSettings);
      return {
        clientSecret: session.client_secret!,
        courseTitle: course.title,
        courseSubtitle: course.subtitle ?? null,
        courseDescription: course.description ?? null,
        courseThumbnail: course.thumbnailUrl ?? null,
        primaryColor: course.primaryColor ?? "#179ca3",
        accentColor: course.accentColor ?? "#0d9488",
        gradientFrom: course.gradientFrom ?? "#179ca3",
        gradientTo: course.gradientTo ?? "#0d9488",
        gradientDirection: course.gradientDirection ?? "135deg",
        playerTheme: course.playerTheme ?? "light",
        ...terms2,
        productName: course.title,
        displayPrice,
        pricingType,
        isSubscription,
        billingLabel,
        currency,
        minSeats: null,
        discountPercent: null,
        brand: course.brand ?? "aaus",
      };
    }),

  /**
   * Verify a Stripe Checkout Session after the buyer returns to the completion page.
   * Public procedure — the session_id is in the URL and not sensitive.
   */
  getCheckoutSessionStatus: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
        expand: ["line_items"],
      });
      const meta = (session.metadata ?? {}) as Record<string, string>;

      // Fallback fulfillment: webhook may have missed guest checkouts (no user_id in metadata).
      // IMPORTANT: Only run fulfillment when payment is confirmed — skip delayed-payment methods
      // (ACH, bank debit) where payment_status is 'unpaid' until the bank clears the payment.
      // 'no_payment_required' is valid for free items / 100% discounts and should proceed.
      if (session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required")) {
        const db = await getDb();
        if (db) {
          try {
            const { reconcileLmsCheckoutFromStripeSession } = await import("../lib/lmsCheckoutFulfillment");
            const result = await reconcileLmsCheckoutFromStripeSession(db as any, session as unknown as Record<string, unknown>);
            if (result.success) {
              console.log(`[CheckoutStatus] LMS fallback fulfilled: user ${result.userId}, course ${result.courseId}`);
            }
          } catch (err) {
            console.error("[CheckoutStatus] Fallback fulfillment error:", err);
          }
          if (meta.type === "webinar" && meta.webinar_id && meta.user_id) {
            try {
              const webinarId = parseInt(meta.webinar_id, 10);
              const userId = parseInt(meta.user_id, 10);
              if (webinarId && userId) {
                const { webinarRegistrations, webinars } = await import("../../drizzle/schema");
                const [existing] = await db.select({ id: webinarRegistrations.id }).from(webinarRegistrations)
                  .where(and(eq(webinarRegistrations.webinarId, webinarId), eq(webinarRegistrations.userId, userId))).limit(1);
                if (!existing) {
                  const [webinar] = await db.select({ status: webinars.status }).from(webinars).where(eq(webinars.id, webinarId)).limit(1);
                  if (webinar) await db.insert(webinarRegistrations).values({
                    webinarId,
                    userId,
                    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
                    accessLevel: webinar.status === "presale" ? "presale" : "full",
                  });
                }
              }
            } catch (err) {
              console.error("[CheckoutStatus] Webinar fallback fulfillment error:", err);
            }
          }
        }
      }

      let courseSlug: string | null = meta.course_slug ?? null;
      let contentType: string = meta.trigger_order_type ?? "course";
      if (meta.course_id) {
        const db = await getDb();
        if (db) {
          const [course] = await db
            .select({ slug: lmsCourses.slug, type: lmsCourses.type })
            .from(lmsCourses)
            .where(eq(lmsCourses.id, parseInt(meta.course_id, 10)))
            .limit(1);
          if (!courseSlug) courseSlug = course?.slug ?? null;
          if (course?.type) contentType = course.type;
        }
      }

      return {
        status: session.status, // 'open' | 'complete' | 'expired'
        paymentStatus: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
        customerEmail: session.customer_details?.email ?? null,
        courseSlug,
        contentType, // 'course' | 'quiz' | 'download' | 'cohort' | 'workshop'
      };
    }),

  /**
   * Get the current user's quiz attempts for a given course, grouped by lesson.
   * Returns per-lesson attempt history (score, pass/fail, date) sorted newest-first.
   * Used by CourseOverview to show the learner's quiz performance section.
   */
  getMyQuizAttempts: protectedProcedure
    .input(z.object({ courseId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch all attempts for this user + course, newest first
      const attempts = await db
        .select({
          id: lmsQuizAttempts.id,
          lessonId: lmsQuizAttempts.lessonId,
          score: lmsQuizAttempts.score,
          passed: lmsQuizAttempts.passed,
          totalQuestions: lmsQuizAttempts.totalQuestions,
          correctAnswers: lmsQuizAttempts.correctAnswers,
          timeTakenSec: lmsQuizAttempts.timeTakenSec,
          createdAt: lmsQuizAttempts.createdAt,
        })
        .from(lmsQuizAttempts)
        .where(and(eq(lmsQuizAttempts.userId, ctx.user.id), eq(lmsQuizAttempts.courseId, input.courseId)))
        .orderBy(desc(lmsQuizAttempts.createdAt));

      if (attempts.length === 0) return { byLesson: [] };

      // Get lesson titles + mock-exam flag for lessons that have attempts
      const lessonIds = Array.from(new Set(attempts.map(a => a.lessonId)));
      const lessons = await db
        .select({
          id: lmsLessons.id,
          title: lmsLessons.title,
          lessonType: lmsLessons.lessonType,
          isMockExam: lmsQuizzes.isMockExam,
        })
        .from(lmsLessons)
        .leftJoin(lmsQuizzes, eq(lmsLessons.id, lmsQuizzes.lessonId))
        .where(sql`${lmsLessons.id} IN (${sql.join(lessonIds.map(id => sql`${id}`), sql`, `)})`);
      const lessonMap = new Map(lessons.map(l => [l.id, l]));

      // Group by lessonId
      const grouped = new Map<number, typeof attempts>();
      for (const a of attempts) {
        if (!grouped.has(a.lessonId)) grouped.set(a.lessonId, []);
        grouped.get(a.lessonId)!.push(a);
      }

      const byLesson = Array.from(grouped.entries()).map(([lessonId, lessonAttempts]) => {
        const lesson = lessonMap.get(lessonId);
        const best = lessonAttempts.reduce((b, a) => a.score > b.score ? a : b, lessonAttempts[0]);
        const latest = lessonAttempts[0]; // already sorted newest-first
        return {
          lessonId,
          lessonTitle: lesson?.title ?? `Quiz (Lesson ${lessonId})`,
          lessonType: lesson?.lessonType ?? "quiz",
          isMockExam: Boolean(lesson?.isMockExam),
          attemptCount: lessonAttempts.length,
          bestScore: best.score,
          bestPassed: best.passed,
          latestScore: latest.score,
          latestPassed: latest.passed,
          latestAt: latest.createdAt,
          attempts: lessonAttempts.map(a => ({
            id: a.id,
            score: a.score,
            passed: a.passed,
            totalQuestions: a.totalQuestions,
            correctAnswers: a.correctAnswers,
            timeTakenSec: a.timeTakenSec ?? null,
            createdAt: a.createdAt,
          })),
        };
      });

      // Sort by latestAt descending (most recently attempted quiz first)
      byLesson.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());

      return { byLesson };
    }),
});
// ─── Group Manager Router ─────────────────────────────────────────────────

export const lmsGroupRouter = router({
  /** Get groups managed by the current user */
  getMyGroups: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const groups = await db.select().from(lmsGroups).where(eq(lmsGroups.managerId, ctx.user.id));
    return Promise.all(groups.map(async (g) => {
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, g.id));
      const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug }).from(lmsCourses).where(eq(lmsCourses.id, g.courseId)).limit(1);
      return { ...g, usedSeats: seats.filter(s => s.acceptedAt).length, course: c ?? null, seatList: seats };
    }));
  }),

  /** Group manager assigns a seat by email */
  assignSeat: protectedProcedure
    .input(z.object({ groupId: z.number(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [group] = await db.select().from(lmsGroups).where(and(eq(lmsGroups.id, input.groupId), eq(lmsGroups.managerId, ctx.user.id))).limit(1);
      if (!group) throw new TRPCError({ code: "FORBIDDEN", message: "Not your group" });
      const seats = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.groupId, input.groupId));
      if (seats.length >= group.seats) throw new TRPCError({ code: "BAD_REQUEST", message: "No seats remaining" });
      const existing = seats.find(s => s.email.toLowerCase() === input.email.toLowerCase());
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Email already assigned" });
      const token = randomBytes(32).toString("hex");
      const [result] = await db.insert(lmsGroupSeats).values({ groupId: input.groupId, email: input.email, inviteToken: token }).$returningId();
      return { id: result.id, token };
    }),

  revokeSeat: protectedProcedure
    .input(z.object({ seatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [seat] = await db.select().from(lmsGroupSeats).where(eq(lmsGroupSeats.id, input.seatId)).limit(1);
      if (!seat) throw new TRPCError({ code: "NOT_FOUND" });
      const [group] = await db.select().from(lmsGroups).where(and(eq(lmsGroups.id, seat.groupId), eq(lmsGroups.managerId, ctx.user.id))).limit(1);
      if (!group) throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(lmsGroupSeats).where(eq(lmsGroupSeats.id, input.seatId));
      return { success: true };
    }),

  // ─── Pricing Options CRUD ───────────────────────────────────────────────────

  /** List all pricing options for a course (admin) */
  listPricingOptions: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(lmsPricingOptions)
        .where(eq(lmsPricingOptions.courseId, input.courseId))
        .orderBy(asc(lmsPricingOptions.sortOrder));
    }),

  /** Create a new pricing option */
  createPricingOption: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      label: z.string().min(1).max(255),
      sublabel: z.string().max(500).optional(),
      pricingType: z.enum(["one_time", "subscription", "payment_plan", "free"]),
      price: z.number().min(0),
      stripePriceId: z.string().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).optional(),
      downPayment: z.number().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
      ctaLabel: z.string().max(100).optional(),
      ctaUrl: z.string().url().max(2048).optional(),
      sortOrder: z.number().int().min(0).default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(lmsPricingOptions).values({
        courseId: input.courseId,
        label: input.label,
        sublabel: input.sublabel ?? null,
        pricingType: input.pricingType,
        price: input.price,
        stripePriceId: input.stripePriceId ?? null,
        subscriptionInterval: input.subscriptionInterval ?? null,
        downPayment: input.downPayment ?? 0,
        installmentCount: input.installmentCount ?? 0,
        installmentAmount: input.installmentAmount ?? 0,
        installmentIntervalDays: input.installmentIntervalDays ?? 30,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      }).$returningId();
      return { id: result.id };
    }),

  /** Update an existing pricing option */
  updatePricingOption: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      label: z.string().min(1).max(255).optional(),
      sublabel: z.string().max(500).nullable().optional(),
      pricingType: z.enum(["one_time", "subscription", "payment_plan", "free"]).optional(),
      price: z.number().min(0).optional(),
      stripePriceId: z.string().nullable().optional(),
      subscriptionInterval: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
      downPayment: z.number().min(0).optional(),
      installmentCount: z.number().int().min(0).optional(),
      installmentAmount: z.number().min(0).optional(),
      installmentIntervalDays: z.number().int().min(1).optional(),
      ctaLabel: z.string().max(100).nullable().optional(),
      ctaUrl: z.string().url().max(2048).nullable().optional(),
      sortOrder: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) { if (v !== undefined) updates[k] = v; }
      if (Object.keys(updates).length > 0) {
        await db.update(lmsPricingOptions).set(updates).where(eq(lmsPricingOptions.id, id));
      }
      return { success: true };
    }),

  /** Delete a pricing option */
  deletePricingOption: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsPricingOptions).where(eq(lmsPricingOptions.id, input.id));
      return { success: true };
    }),

  /** Reorder pricing options */
  reorderPricingOptions: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number().int().positive()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all(input.orderedIds.map((id, idx) =>
        db.update(lmsPricingOptions).set({ sortOrder: idx }).where(eq(lmsPricingOptions.id, id))
      ));
      return { success: true };
    }),

  /** Create a Stripe Payment Link for a pricing option — returns a permanent buy.stripe.com URL.
   * Works for all pricing types (one_time, subscription, payment_plan).
   * Auto-creates a Stripe Product+Price if none exists. Caches the result.
   */
  createPaymentLink: protectedProcedure
    .input(z.object({
      pricingOptionId: z.number().int().positive().optional(),
      courseId: z.number().int().positive().optional(),
    }).refine(d => d.pricingOptionId != null || d.courseId != null, { message: "Provide pricingOptionId or courseId" }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const stripe = getStripeClient();
      // Always use the learn subdomain for Stripe redirects (not the main app domain)
      const learnDomain = "https://learn.allaboutultrasound.com";

      // ── MODE A: Pricing Option link ───────────────────────────────────────────
      if (input.pricingOptionId) {
        const [opt] = await db.select().from(lmsPricingOptions).where(eq(lmsPricingOptions.id, input.pricingOptionId)).limit(1);
        if (!opt) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing option not found" });
        const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, opt.courseId)).limit(1);
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

        // Return cached payment link if still active
        const cachedLinkId = (opt as any).stripePaymentLinkId as string | null;
        if (cachedLinkId) {
          try {
            const existing = await stripe.paymentLinks.retrieve(cachedLinkId);
            if (existing.active) return { url: existing.url };
          } catch { /* fall through */ }
        }

        const pricingType = opt.pricingType ?? "one_time";
        const currency = course.currency ?? "usd";
        const productName = `${course.title}${opt.label ? ` — ${opt.label}` : ""}`;
        let stripePriceId = opt.stripePriceId ?? null;

        if (!stripePriceId) {
          const product = await stripe.products.create({
            name: productName,
            description: course.subtitle ?? undefined,
            metadata: { course_id: String(course.id), pricing_option_id: String(opt.id) },
          });
          if (pricingType === "one_time" || pricingType === "free") {
            const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(opt.price) * 100), currency });
            stripePriceId = price.id;
          } else if (pricingType === "subscription") {
            const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
            const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
            const interval = opt.subscriptionInterval ?? "monthly";
            const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(opt.price) * 100), currency, recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 } });
            stripePriceId = price.id;
          } else if (pricingType === "payment_plan") {
            const installmentAmt = opt.installmentAmount && opt.installmentAmount > 0 ? opt.installmentAmount : opt.price;
            const intervalMonths = Math.round((opt.installmentIntervalDays ?? 30) / 30) || 1;
            const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(installmentAmt) * 100), currency, recurring: { interval: "month", interval_count: intervalMonths } });
            stripePriceId = price.id;
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported pricing type: ${pricingType}` });
          }
          await db.update(lmsPricingOptions).set({ stripePriceId }).where(eq(lmsPricingOptions.id, opt.id));
        }

        const paymentLink = await stripe.paymentLinks.create({
          line_items: [{ price: stripePriceId, quantity: 1 }],
          allow_promotion_codes: true,
          metadata: { pricing_option_id: String(opt.id), course_id: String(course.id), source: "lms_admin_payment_link" },
          after_completion: { type: "redirect", redirect: { url: `${learnDomain}/library` } },
        });
        await db.update(lmsPricingOptions).set({ stripePaymentLinkId: paymentLink.id } as any).where(eq(lmsPricingOptions.id, opt.id));
        return { url: paymentLink.url };
      }

      // ── MODE B: Primary pricing link (course-level) ───────────────────────────
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.courseId!)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      // Return cached payment link if still active
      const cachedLinkId = (course as any).stripePaymentLinkId as string | null;
      if (cachedLinkId) {
        try {
          const existing = await stripe.paymentLinks.retrieve(cachedLinkId);
          if (existing.active) return { url: existing.url };
        } catch { /* fall through */ }
      }

      const pricingType = course.pricingType ?? "one_time";
      const currency = course.currency ?? "usd";
      let stripePriceId = course.stripePriceId ?? null;

      if (!stripePriceId) {
        const product = await stripe.products.create({
          name: course.title,
          description: course.subtitle ?? undefined,
          metadata: { course_id: String(course.id), source: "primary_pricing" },
        });
        if (pricingType === "one_time" || pricingType === "free") {
          const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(course.price) * 100), currency });
          stripePriceId = price.id;
        } else if (pricingType === "subscription") {
          const intervalMap: Record<string, "month" | "year"> = { monthly: "month", quarterly: "month", annual: "year" };
          const intervalCountMap: Record<string, number> = { monthly: 1, quarterly: 3, annual: 1 };
          const interval = (course as any).subscriptionInterval ?? "monthly";
          const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(course.price) * 100), currency, recurring: { interval: intervalMap[interval] ?? "month", interval_count: intervalCountMap[interval] ?? 1 } });
          stripePriceId = price.id;
        } else if (pricingType === "payment_plan") {
          const installmentAmt = course.installmentAmount && course.installmentAmount > 0 ? course.installmentAmount : course.price;
          const intervalMonths = Math.round((course.installmentIntervalDays ?? 30) / 30) || 1;
          const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(Number(installmentAmt) * 100), currency, recurring: { interval: "month", interval_count: intervalMonths } });
          stripePriceId = price.id;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported pricing type for primary: ${pricingType}` });
        }
        await db.update(lmsCourses).set({ stripePriceId } as any).where(eq(lmsCourses.id, course.id));
      }

      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        metadata: { course_id: String(course.id), source: "lms_primary_payment_link" },
        after_completion: { type: "redirect", redirect: { url: `${learnDomain}/library` } },
      });
      await db.update(lmsCourses).set({ stripePaymentLinkId: paymentLink.id } as any).where(eq(lmsCourses.id, course.id));
      return { url: paymentLink.url };
    }),

  // ─── Platform Settings ────────────────────────────────────────────────────

  /** Get platform settings (admin) */
  getPlatformSettings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    const raw = settings ?? { id: 1, enrollmentEmailEnabled: true, enrollmentEmailSubject: null, enrollmentEmailIntro: null, customDomains: null, defaultBrand: "aaus" as string | null };
    return {
      ...raw,
      customDomainsList: raw.customDomains ? (JSON.parse(raw.customDomains) as string[]) : [],
    };
  }),

  /** Update platform settings (admin) */
  updatePlatformSettings: protectedProcedure
    .input(z.object({
      enrollmentEmailEnabled: z.boolean().optional(),
      enrollmentEmailSubject: z.string().max(255).nullable().optional(),
      enrollmentEmailIntro: z.string().nullable().optional(),
      funnelPublishDomain: z.string().max(255).nullable().optional(),
      downloadPublishDomain: z.string().max(255).nullable().optional(),
      productPublishDomain: z.string().max(255).nullable().optional(),
      coursePublishDomain: z.string().max(255).nullable().optional(),
      formPublishDomain: z.string().max(255).nullable().optional(),
      termsUrl: z.string().max(2048).nullable().optional(),
      privacyUrl: z.string().max(2048).nullable().optional(),
      defaultBrand: z.enum(["aaus", "iheartecho"]).optional(),
      cmeDriveClientId: z.string().max(500).nullable().optional(),
      cmeDriveClientSecret: z.string().max(500).nullable().optional(),
      cmeDriveFolderId: z.string().max(255).nullable().optional(),
      cmeDriveFolderName: z.string().max(255).nullable().optional(),
      cmeDriveEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }
      if (Object.keys(updates).length > 0) {
        await db.update(platformSettings).set(updates).where(eq(platformSettings.id, 1));
      }
      // Invalidate brand cache if defaultBrand was updated
      if (input.defaultBrand !== undefined) {
        const { invalidateDefaultBrandCache } = await import("../_core/context");
        invalidateDefaultBrandCache();
      }
      return { success: true };
    }),

  /** Get Google Drive CME integration status (admin) */
  getCmeDriveSettings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [s] = await db.select({
      cmeDriveClientId: platformSettings.cmeDriveClientId,
      cmeDriveEnabled: platformSettings.cmeDriveEnabled,
      cmeDriveFolderId: platformSettings.cmeDriveFolderId,
      cmeDriveFolderName: platformSettings.cmeDriveFolderName,
      cmeDriveConnectedEmail: platformSettings.cmeDriveConnectedEmail,
      cmeDriveTokenExpiresAt: platformSettings.cmeDriveTokenExpiresAt,
    }).from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    return s ?? { cmeDriveEnabled: false, cmeDriveClientId: null, cmeDriveFolderId: null, cmeDriveFolderName: null, cmeDriveConnectedEmail: null, cmeDriveTokenExpiresAt: null };
  }),

  /** List CME PDFs saved in Google Drive (admin) */
  listCmeDriveFiles: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const { listCmeDriveFiles } = await import("../lib/googleDriveCme");
    return listCmeDriveFiles();
  }),

  /** Send a test email to verify SendGrid delivery (admin only) */
  sendTestEmail: protectedProcedure
    .input(z.object({
      recipientEmail: z.string().email(),
      brandMode: z.enum(["aaus", "iheartecho"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { emailWrapper } = await import("../_core/email");
      const brandMode = input.brandMode ?? "aaus";
      const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "long" });
      const htmlBody = emailWrapper(`
        <h2 style="margin:0 0 12px;font-size:20px;color:#0e1e2e;font-family:Georgia,serif;">
          ✅ SendGrid Test Email
        </h2>
        <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
          This is a test email sent from the <strong>Platform Admin → Email Settings</strong> panel to verify that your SendGrid integration is working correctly.
        </p>
        <div style="background:#f0fbfc;border-left:3px solid #189aa1;padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;">
          <p style="margin:0 0 6px;font-size:13px;color:#0e4a50;font-weight:600;">Test Details</p>
          <p style="margin:0;font-size:13px;color:#475569;">Sent at: <strong>${now}</strong></p>
          <p style="margin:4px 0 0;font-size:13px;color:#475569;">Recipient: <strong>${input.recipientEmail}</strong></p>
          <p style="margin:4px 0 0;font-size:13px;color:#475569;">Brand: <strong>${brandMode.toUpperCase()}</strong></p>
          <p style="margin:4px 0 0;font-size:13px;color:#475569;">Sent by: <strong>${ctx.user.name ?? ctx.user.email}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#94a3b8;">
          If you received this email, your SendGrid API key and sender configuration are working correctly. No action is needed.
        </p>
      `, brandMode);
      const ok = await sendEmail({
        to: { name: ctx.user.name ?? "Admin", email: input.recipientEmail },
        subject: `[Test] SendGrid delivery check — ${now}`,
        htmlBody,
        brandMode,
      });
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SendGrid rejected the test email. Check the server logs for details (look for [email] SendGrid API error)." });
      return { success: true, sentTo: input.recipientEmail };
    }),

  /** Update course sendEnrollmentEmail toggle */
  updateCourseEnrollmentEmail: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      sendEnrollmentEmail: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCourses).set({ sendEnrollmentEmail: input.sendEnrollmentEmail }).where(eq(lmsCourses.id, input.courseId));
      return { success: true };
    }),

  /** Update course settings (slug, SEO, visibility, enrollment, certificate) */
  updateCourseSettings: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
      metaTitle: z.string().max(255).optional(),
      metaDescription: z.string().max(500).optional(),
      status: z.enum(["draft", "public", "hidden", "private", "archived"]).optional(),
      hasCertificate: z.boolean().optional(),
      certificateTemplateId: z.number().int().positive().nullable().optional(),
      creditHours: z.string().max(20).nullable().optional(),
      isFeatured: z.boolean().optional(),
      isDrip: z.boolean().optional(),
      accessDurationDays: z.number().int().positive().nullable().optional(),
      publishDomain: z.string().max(255).nullable().optional(),
      purchaseTermsText: z.string().max(2000).nullable().optional(),
      purchaseTermsLinkText1: z.string().max(255).nullable().optional(),
      purchaseTermsLinkUrl1: z.string().max(2048).nullable().optional(),
      purchaseTermsLinkText2: z.string().max(255).nullable().optional(),
      purchaseTermsLinkUrl2: z.string().max(2048).nullable().optional(),
      certificateTitleOverride: z.string().max(512).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check slug uniqueness (excluding current course)
      const [existing] = await db.select({ id: lmsCourses.id }).from(lmsCourses)
        .where(and(eq(lmsCourses.slug, input.slug), sql`${lmsCourses.id} != ${input.courseId}`)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A course with this slug already exists" });
      const { courseId, ...fields } = input;
      await db.update(lmsCourses).set(fields).where(eq(lmsCourses.id, courseId));
      return { success: true };
    }),
  // ── Certificate Templates ──────────────────────────────────────────────────
  listCertificateTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(lmsCertificateTemplates).orderBy(desc(lmsCertificateTemplates.createdAt));
    }),
  createCertificateTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional().nullable(),
      backgroundImageUrl: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      primaryColor: z.string().default("#189aa1"),
      accentColor: z.string().default("#c9a84c"),
      textColor: z.string().default("#0e1e2e"),
      fontFamily: z.string().default("Helvetica"),
      signatureName: z.string().optional().nullable(),
      signatureTitle: z.string().optional().nullable(),
      signatureImageUrl: z.string().optional().nullable(),
      footerText: z.string().optional().nullable(),
      organizationName: z.string().default("All About Ultrasound"),
      layout: z.enum(["classic", "modern", "minimal"]).default("classic"),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.isDefault) {
        await db.update(lmsCertificateTemplates).set({ isDefault: false });
      }
      const [result] = await db.insert(lmsCertificateTemplates).values({ ...input, isActive: true });
      return { id: (result as any).insertId };
    }),
  updateCertificateTemplate: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional().nullable(),
      backgroundImageUrl: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      textColor: z.string().optional(),
      fontFamily: z.string().optional(),
      signatureName: z.string().optional().nullable(),
      signatureTitle: z.string().optional().nullable(),
      signatureImageUrl: z.string().optional().nullable(),
      footerText: z.string().optional().nullable(),
      organizationName: z.string().optional(),
      layout: z.enum(["classic", "modern", "minimal"]).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      if (fields.isDefault) {
        await db.update(lmsCertificateTemplates).set({ isDefault: false });
      }
      await db.update(lmsCertificateTemplates).set(fields as any).where(eq(lmsCertificateTemplates.id, id));
      return { success: true };
    }),
  deleteCertificateTemplate: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(lmsCourses).set({ certificateTemplateId: null }).where(eq(lmsCourses.certificateTemplateId, input.id));
      await db.delete(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, input.id));
      return { success: true };
    }),
  listIssuedCertificates: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive().optional(),
      userId: z.number().int().positive().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(30),
    }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.courseId) conditions.push(eq(lmsCertificates.courseId, input.courseId));
      if (input.userId) conditions.push(eq(lmsCertificates.userId, input.userId));
      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select({
          id: lmsCertificates.id,
          userId: lmsCertificates.userId,
          courseId: lmsCertificates.courseId,
          certificateUrl: lmsCertificates.certificateUrl,
          issuedAt: lmsCertificates.issuedAt,
          templateId: lmsCertificates.templateId,
          userName: users.name,
          userEmail: users.email,
          courseTitle: lmsCourses.title,
          courseType: lmsCourses.type,
        })
        .from(lmsCertificates)
        .leftJoin(users, eq(lmsCertificates.userId, users.id))
        .leftJoin(lmsCourses, eq(lmsCertificates.courseId, lmsCourses.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lmsCertificates.issuedAt))
        .limit(input.pageSize)
        .offset(offset);
      return rows;
    }),

  // ─── Instructor Course Permissions ─────────────────────────────────────────

  /** List courses this instructor is assigned to with their publish permission */
  getInstructorCourses: protectedProcedure
    .input(z.object({ instructorUserId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          permId: instructorCoursePermissions.id,
          courseId: instructorCoursePermissions.courseId,
          canSelfPublish: instructorCoursePermissions.canSelfPublish,
          courseTitle: lmsCourses.title,
          courseStatus: lmsCourses.status,
        })
        .from(instructorCoursePermissions)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorCoursePermissions.courseId))
        .where(eq(instructorCoursePermissions.instructorId, input.instructorUserId));
      return rows;
    }),

  /** Assign an instructor to a course (or update their publish permission) */
  setInstructorCoursePermission: protectedProcedure
    .input(z.object({
      instructorUserId: z.number(),
      courseId: z.number(),
      canSelfPublish: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      const existing = await db
        .select({ id: instructorCoursePermissions.id })
        .from(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, input.instructorUserId),
          eq(instructorCoursePermissions.courseId, input.courseId),
        ))
        .then(r => r[0]);
      if (existing) {
        await db.update(instructorCoursePermissions)
          .set({ canSelfPublish: input.canSelfPublish, grantedByAdminId: ctx.user.id })
          .where(eq(instructorCoursePermissions.id, existing.id));
      } else {
        await db.insert(instructorCoursePermissions).values({
          instructorId: input.instructorUserId,
          courseId: input.courseId,
          canSelfPublish: input.canSelfPublish,
          grantedByAdminId: ctx.user.id,
        });
      }
      return { ok: true };
    }),

  /** Remove an instructor from a course */
  removeInstructorFromCourse: protectedProcedure
    .input(z.object({ instructorUserId: z.number(), courseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      await db.delete(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, input.instructorUserId),
          eq(instructorCoursePermissions.courseId, input.courseId),
        ));
      return { ok: true };
    }),

  /** Instructor submits a publish request for a course */
  requestCoursePublish: protectedProcedure
    .input(z.object({ courseId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Check instructor has permission record for this course
      const perm = await db.select().from(instructorCoursePermissions)
        .where(and(
          eq(instructorCoursePermissions.instructorId, ctx.user.id),
          eq(instructorCoursePermissions.courseId, input.courseId),
        ))
        .then(r => r[0]);
      if (!perm) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned as instructor for this course." });
      if (perm.canSelfPublish) throw new TRPCError({ code: "BAD_REQUEST", message: "You can publish this course directly." });
      // Check no pending request already exists
      const existing = await db.select().from(instructorPublishRequests)
        .where(and(
          eq(instructorPublishRequests.courseId, input.courseId),
          eq(instructorPublishRequests.instructorId, ctx.user.id),
          eq(instructorPublishRequests.status, "pending"),
        ))
        .then(r => r[0]);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A publish request is already pending for this course." });
      await db.insert(instructorPublishRequests).values({
        courseId: input.courseId,
        instructorId: ctx.user.id,
        note: input.note ?? null,
      });
      return { ok: true };
    }),

  /** Admin lists pending publish requests */
  listPublishRequests: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      const conditions = input.status ? [eq(instructorPublishRequests.status, input.status)] : [];
      const rows = await db
        .select({
          id: instructorPublishRequests.id,
          courseId: instructorPublishRequests.courseId,
          instructorId: instructorPublishRequests.instructorId,
          status: instructorPublishRequests.status,
          note: instructorPublishRequests.note,
          reviewNote: instructorPublishRequests.reviewNote,
          requestedAt: instructorPublishRequests.requestedAt,
          reviewedAt: instructorPublishRequests.reviewedAt,
          courseTitle: lmsCourses.title,
          instructorName: users.name,
          instructorEmail: users.email,
        })
        .from(instructorPublishRequests)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorPublishRequests.courseId))
        .leftJoin(users, eq(users.id, instructorPublishRequests.instructorId))
        .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
        .orderBy(desc(instructorPublishRequests.requestedAt));
      return rows;
    }),

  /** Admin approves or rejects a publish request */
  reviewPublishRequest: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      decision: z.enum(["approved", "rejected"]),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const db = getDb();
      const req = await db.select().from(instructorPublishRequests)
        .where(eq(instructorPublishRequests.id, input.requestId))
        .then(r => r[0]);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Publish request not found." });
      await db.update(instructorPublishRequests)
        .set({
          status: input.decision,
          reviewNote: input.reviewNote ?? null,
          reviewedByAdminId: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(instructorPublishRequests.id, input.requestId));
      // If approved, publish the course
      if (input.decision === "approved") {
        await db.update(lmsCourses)
          .set({ status: "public" })
          .where(eq(lmsCourses.id, req.courseId));
      }
      return { ok: true };
    }),

  /** Instructor: get own assigned courses with revenue share and publish status */
  getMyInstructorCourses: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();

      // Strategy: look up courses from TWO sources:
      // 1. instructor_course_permissions (instructorId = users.id) — explicit edit permissions
      // 2. lms_course_instructors via lms_instructors profile link (user_id -> instructor profile -> course assignments)

      // Source 1: instructor_course_permissions (direct user.id reference)
      const perms = await db.select({
        permId: instructorCoursePermissions.id,
        courseId: instructorCoursePermissions.courseId,
        canSelfPublish: instructorCoursePermissions.canSelfPublish,
        courseTitle: lmsCourses.title,
        courseStatus: lmsCourses.status,
        courseSlug: lmsCourses.slug,
        courseThumbnail: lmsCourses.thumbnailUrl,
      })
        .from(instructorCoursePermissions)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorCoursePermissions.courseId))
        .where(eq(instructorCoursePermissions.instructorId, ctx.user.id));

      // Source 2: lms_course_instructors via lms_instructors profile (user_id link)
      const instructorProfiles = await db.select({ id: lmsInstructors.id })
        .from(lmsInstructors)
        .where(and(eq(lmsInstructors.userId, ctx.user.id), eq(lmsInstructors.isActive, true)));

      const permCourseIds = new Set(perms.map(p => p.courseId));
      let profileCourses: typeof perms = [];

      if (instructorProfiles.length > 0) {
        const profileId = instructorProfiles[0].id;
        const ciRows = await db.select({
          courseId: lmsCourseInstructors.courseId,
          revenueSharePct: lmsCourseInstructors.revenueSharePct,
        })
          .from(lmsCourseInstructors)
          .where(eq(lmsCourseInstructors.instructorId, profileId));

        // Only include courses not already in perms
        const extraCourseIds = ciRows.filter(r => !permCourseIds.has(r.courseId)).map(r => r.courseId);
        if (extraCourseIds.length > 0) {
          const courses = await db.select({
            id: lmsCourses.id,
            title: lmsCourses.title,
            status: lmsCourses.status,
            slug: lmsCourses.slug,
            thumbnailUrl: lmsCourses.thumbnailUrl,
          })
            .from(lmsCourses)
            .where(sql`${lmsCourses.id} IN (${sql.join(extraCourseIds.map(id => sql`${id}`), sql`, `)})`);

          profileCourses = courses.map(c => ({
            permId: null as any,
            courseId: c.id,
            canSelfPublish: false,
            courseTitle: c.title,
            courseStatus: c.status,
            courseSlug: c.slug,
            courseThumbnail: c.thumbnailUrl,
          }));
        }
      }

      const allCourses = [...perms, ...profileCourses];

      // Determine instructor profile ID for revenue share lookups
      const profileId = instructorProfiles.length > 0 ? instructorProfiles[0].id : null;

      // Get revenue share for each course
      const enriched = await Promise.all(allCourses.map(async (p) => {
        // Try looking up revenue share by profile ID first, then by user ID
        let share: { revenueSharePct: number } | undefined;
        if (profileId) {
          [share] = await db.select({ revenueSharePct: lmsCourseInstructors.revenueSharePct })
            .from(lmsCourseInstructors)
            .where(and(eq(lmsCourseInstructors.courseId, p.courseId!), eq(lmsCourseInstructors.instructorId, profileId)))
            .limit(1);
        }
        if (!share) {
          [share] = await db.select({ revenueSharePct: lmsCourseInstructors.revenueSharePct })
            .from(lmsCourseInstructors)
            .where(and(eq(lmsCourseInstructors.courseId, p.courseId!), eq(lmsCourseInstructors.instructorId, ctx.user.id)))
            .limit(1);
        }
        // Get latest publish request status
        const [latestReq] = await db.select({
          id: instructorPublishRequests.id,
          status: instructorPublishRequests.status,
          note: instructorPublishRequests.note,
          reviewNote: instructorPublishRequests.reviewNote,
          requestedAt: instructorPublishRequests.requestedAt,
          reviewedAt: instructorPublishRequests.reviewedAt,
        })
          .from(instructorPublishRequests)
          .where(and(
            eq(instructorPublishRequests.courseId, p.courseId!),
            eq(instructorPublishRequests.instructorId, ctx.user.id),
          ))
          .orderBy(desc(instructorPublishRequests.requestedAt))
          .limit(1);
        return {
          ...p,
          revenueSharePct: share?.revenueSharePct ?? 0,
          latestPublishRequest: latestReq ?? null,
        };
      }));
      return enriched;
    }),

  /** Instructor: get own publish request history */
  getMyPublishRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      return db.select({
        id: instructorPublishRequests.id,
        courseId: instructorPublishRequests.courseId,
        status: instructorPublishRequests.status,
        note: instructorPublishRequests.note,
        reviewNote: instructorPublishRequests.reviewNote,
        requestedAt: instructorPublishRequests.requestedAt,
        reviewedAt: instructorPublishRequests.reviewedAt,
        courseTitle: lmsCourses.title,
      })
        .from(instructorPublishRequests)
        .leftJoin(lmsCourses, eq(lmsCourses.id, instructorPublishRequests.courseId))
        .where(eq(instructorPublishRequests.instructorId, ctx.user.id))
        .orderBy(desc(instructorPublishRequests.requestedAt));
    }),

  // ─── Default Team Pricing Tiers ───────────────────────────────────────────
  /** List all default team tiers for a course */
  listDefaultTeamTiers: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const tiers = await db.select().from(lmsDefaultTeamTiers)
        .where(eq(lmsDefaultTeamTiers.courseId, input.courseId))
        .orderBy(asc(lmsDefaultTeamTiers.minSeats));
      // Compute per-seat price for each tier
      const primaryPrice = Number(course.price ?? 0);
      return tiers.map(t => ({
        ...t,
        perSeatPrice: primaryPrice > 0
          ? Math.round(primaryPrice * (1 - Number(t.discountPercent) / 100) * 100) / 100
          : 0,
        primaryPrice,
      }));
    }),

  /** Upsert a default team tier (create or update by courseId+minSeats) */
  upsertDefaultTeamTier: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      minSeats: z.number().int().min(2).max(10000),
      discountPercent: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if a tier with this courseId+minSeats already exists
      const [existing] = await db.select().from(lmsDefaultTeamTiers)
        .where(and(eq(lmsDefaultTeamTiers.courseId, input.courseId), eq(lmsDefaultTeamTiers.minSeats, input.minSeats)))
        .limit(1);
      if (existing) {
        // If discount changed, clear cached Stripe IDs so a new link is generated
        const discountChanged = Number(existing.discountPercent) !== input.discountPercent;
        await db.update(lmsDefaultTeamTiers).set({
          discountPercent: String(input.discountPercent),
          ...(discountChanged ? { stripePriceId: null, stripePaymentLinkId: null, stripePaymentLinkUrl: null } : {}),
        }).where(eq(lmsDefaultTeamTiers.id, existing.id));
        return { id: existing.id };
      }
      const [inserted] = await db.insert(lmsDefaultTeamTiers).values({
        courseId: input.courseId,
        minSeats: input.minSeats,
        discountPercent: String(input.discountPercent),
      }).$returningId();
      return { id: inserted.id };
    }),

  /** Delete a default team tier */
  deleteDefaultTeamTier: protectedProcedure
    .input(z.object({ tierId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(lmsDefaultTeamTiers).where(eq(lmsDefaultTeamTiers.id, input.tierId));
      return { success: true };
    }),

  /** Generate (or retrieve cached) Stripe Payment Link for a team tier */
  createTeamTierPaymentLink: protectedProcedure
    .input(z.object({ tierId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [tier] = await db.select().from(lmsDefaultTeamTiers).where(eq(lmsDefaultTeamTiers.id, input.tierId)).limit(1);
      if (!tier) throw new TRPCError({ code: "NOT_FOUND", message: "Team tier not found" });
      const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, tier.courseId)).limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const validatePriceId = async (priceId: string | null | undefined): Promise<string | null> => { if (!priceId) return null; try { await stripe.prices.retrieve(priceId); return priceId; } catch (e: any) { if (e?.code === "resource_missing" || e?.statusCode === 404 || (e?.message && e.message.includes("No such price"))) return null; throw e; } };
      const stripe = getStripeClient();
      const learnDomain = "https://learn.allaboutultrasound.com";

      // Return cached link if still active
      if (tier.stripePaymentLinkId) {
        try {
          const existing = await stripe.paymentLinks.retrieve(tier.stripePaymentLinkId);
          if (existing.active) {
            return { url: existing.url };
          }
        } catch { /* fall through to recreate */ }
      }

      // Compute per-seat price
      const primaryPrice = Number(course.price ?? 0);
      const discountPct = Number(tier.discountPercent ?? 0);
      const perSeatPrice = Math.max(0.5, Math.round(primaryPrice * (1 - discountPct / 100) * 100) / 100);
      const currency = course.currency ?? "usd";

      // Create or reuse Stripe Price
      let stripePriceId = await validatePriceId(tier.stripePriceId ?? null);
      if (!stripePriceId) {
        const product = await stripe.products.create({
          name: `${course.title} — Team (${tier.minSeats}+ seats, ${discountPct}% off)`,
          description: course.subtitle ?? undefined,
          metadata: { course_id: String(course.id), team_tier_id: String(tier.id), min_seats: String(tier.minSeats) },
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(perSeatPrice * 100),
          currency,
        });
        stripePriceId = price.id;
        await db.update(lmsDefaultTeamTiers).set({ stripePriceId }).where(eq(lmsDefaultTeamTiers.id, tier.id));
      }

      // Create Payment Link with adjustable quantity (min = minSeats)
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: stripePriceId, quantity: tier.minSeats, adjustable_quantity: { enabled: true, minimum: tier.minSeats } }],
        allow_promotion_codes: true,
        metadata: { course_id: String(course.id), team_tier_id: String(tier.id), source: "lms_team_tier_payment_link" },
        after_completion: { type: "redirect", redirect: { url: `${learnDomain}/library` } },
      });

      await db.update(lmsDefaultTeamTiers).set({
        stripePaymentLinkId: paymentLink.id,
        stripePaymentLinkUrl: paymentLink.url,
      }).where(eq(lmsDefaultTeamTiers.id, tier.id));

      return { url: paymentLink.url };
    }),
});
