/**
 * caseLibraryRouter.ts
 * tRPC procedures for the Echo Case Library engine.
 *
 * Public:
 *   listCases        — paginated list of approved cases (with filters)
 *   getCase          — full case detail with media and questions
 *
 * Protected (any logged-in user):
 *   submitCase       — submit a new case (pending approval)
 *   submitAttempt    — record answers for a case's questions
 *   getUserSubmissions — list own submitted cases
 *   uploadMedia      — get a presigned S3 upload URL for a media file
 *
 * Admin-only:
 *   listPendingCases  — review queue of pending cases
 *   approveCase       — approve a pending case
 *   rejectCase        — reject with reason
 *   adminCreateCase   — create a case directly (auto-approved)
 *   adminUpdateCase   — edit any case
 *   adminDeleteCase   — hard delete a case and its media
 *   listAllCases      — paginated list of all cases for admin management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  echoLibraryCases,
  echoLibraryCaseMedia,
  echoLibraryCaseQuestions,
  echoLibraryCaseAttempts,
  caseViewEvents,
  users,
} from "../../drizzle/schema";
import { eq, and, desc, sql, count, like, or, gte } from "drizzle-orm";
import { storagePut } from "../storage";
import { sendEmail, buildCaseApprovedEmail, buildCaseRejectedEmail, buildNewCaseSubmissionAdminEmail } from "../_core/email";
import { notifyOwner } from "../_core/notification";
import { createPatchedFetch } from "../_core/patchedFetch";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// ─── Admin guard ─────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Input schemas ────────────────────────────────────────────────────────────
const caseInputSchema = z.object({
  title: z.string().min(5).max(300),
  summary: z.string().min(10).max(5000),
  clinicalHistory: z.string().max(5000).optional(),
  diagnosis: z.string().max(300).optional(),
  teachingPoints: z.array(z.string().max(500)).max(10).optional(),
  modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS", "Other"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  tags: z.array(z.string().max(50)).max(10).default([]),
  hipaaAcknowledged: z.boolean(),
  // Optional credit attribution
  submitterCreditName: z.string().max(200).optional(),
  submitterLinkedIn: z
    .string()
    .max(500)
    .optional()
    .refine(
      (val) => !val || /^https:\/\/(www\.)?linkedin\.com\/(in|company|school)\/[\w\-%.]+\/?$/i.test(val),
      { message: "Must be a valid LinkedIn URL (e.g. https://www.linkedin.com/in/yourname or https://www.linkedin.com/company/name)" }
    ),
  // Embedded media (already uploaded to S3)
  media: z
    .array(
      z.object({
        type: z.enum(["image", "video"]),
        url: z.string().url(),
        fileKey: z.string().max(500),
        caption: z.string().max(300).optional(),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .max(20)
    .default([]),
  // Embedded MCQ questions
  questions: z
    .array(
      z.object({
        question: z.string().min(5).max(2000),
        options: z.array(z.string().min(1)).min(2).max(6),
        correctAnswer: z.number().int().min(0),
        explanation: z.string().max(2000).optional(),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .max(10)
    .default([]),
});

// ─── Router ───────────────────────────────────────────────────────────────────
export const caseLibraryRouter = router({
  /** Paginated list of approved cases — free members see max 50 cases */
  listCases: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(12),
        modality: z
          .enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS", "Other"])
          .optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        search: z.string().max(100).optional(),
        sortBy: z.enum(["newest", "mostViewed"]).default("newest").optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Premium gate: free members can browse at most 50 cases
      const FREE_CASE_LIMIT = 50;
      const isPremiumUser = (ctx.user as any)?.isPremium === true || (ctx.user as any)?.role === "admin";

      const offset = (input.page - 1) * input.limit;
      // For free users, block pages beyond the free limit
      if (!isPremiumUser && offset >= FREE_CASE_LIMIT) {
        return { cases: [], total: FREE_CASE_LIMIT, page: input.page, limit: input.limit, isPremiumGated: true, freeCaseLimit: FREE_CASE_LIMIT };
      }
      const conditions: any[] = [eq(echoLibraryCases.status, "approved")];

      if (input.modality) conditions.push(eq(echoLibraryCases.modality, input.modality));
      if (input.difficulty) conditions.push(eq(echoLibraryCases.difficulty, input.difficulty));
      if (input.search) {
        const searchTerm = `%${input.search.toLowerCase()}%`;
        conditions.push(
          sql`(LOWER(${echoLibraryCases.title}) LIKE ${searchTerm} OR LOWER(${echoLibraryCases.summary}) LIKE ${searchTerm} OR LOWER(${echoLibraryCases.diagnosis}) LIKE ${searchTerm})`
        );
      }

      const where = and(...conditions);

      const [cases, totalResult] = await Promise.all([
        db
          .select({
            id: echoLibraryCases.id,
            title: echoLibraryCases.title,
            summary: echoLibraryCases.summary,
            diagnosis: echoLibraryCases.diagnosis,
            modality: echoLibraryCases.modality,
            difficulty: echoLibraryCases.difficulty,
            tags: echoLibraryCases.tags,
            viewCount: echoLibraryCases.viewCount,
            submittedAt: echoLibraryCases.submittedAt,
            isAdminSubmission: echoLibraryCases.isAdminSubmission,
          })
          .from(echoLibraryCases)
          .where(where)
          .orderBy(
            input.sortBy === "mostViewed"
              ? desc(echoLibraryCases.viewCount)
              : desc(echoLibraryCases.submittedAt)
          )
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: count(echoLibraryCases.id) })
          .from(echoLibraryCases)
          .where(where),
      ]);

      // Attach thumbnail (first image media per case)
      const caseIds = cases.map((c) => c.id);
      let thumbnails: Record<number, string> = {};
      if (caseIds.length > 0) {
        const media = await db
          .select({ caseId: echoLibraryCaseMedia.caseId, url: echoLibraryCaseMedia.url })
          .from(echoLibraryCaseMedia)
          .where(
            and(
              sql`${echoLibraryCaseMedia.caseId} IN (${caseIds.join(",")})`,
              eq(echoLibraryCaseMedia.type, "image")
            )
          )
          .orderBy(echoLibraryCaseMedia.sortOrder);
        for (const m of media) {
          if (!thumbnails[m.caseId]) thumbnails[m.caseId] = m.url;
        }
      }

      const rawTotal = totalResult[0]?.count ?? 0;
      // Cap visible total for free users
      const visibleTotal = isPremiumUser ? rawTotal : Math.min(rawTotal, FREE_CASE_LIMIT);
      // Trim cases that would exceed the free limit
      const visibleCases = isPremiumUser
        ? cases
        : cases.filter((_, i) => offset + i < FREE_CASE_LIMIT);

      return {
        cases: visibleCases.map((c) => ({
          ...c,
          tags: c.tags ? JSON.parse(c.tags) : [],
          thumbnail: thumbnails[c.id] ?? null,
        })),
        total: visibleTotal,
        page: input.page,
        limit: input.limit,
        isPremiumGated: !isPremiumUser && rawTotal > FREE_CASE_LIMIT,
        freeCaseLimit: FREE_CASE_LIMIT,
      };
    }),

  /** Full case detail with media and questions (increments view count) */
  getCase: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [caseRow] = await db
        .select()
        .from(echoLibraryCases)
        .where(eq(echoLibraryCases.id, input.id))
        .limit(1);

      if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      if (caseRow.status !== "approved" && ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }

      // Increment view count and log event (fire-and-forget)
      db.update(echoLibraryCases)
        .set({ viewCount: sql`${echoLibraryCases.viewCount} + 1` })
        .where(eq(echoLibraryCases.id, input.id))
        .catch(() => {});
      db.insert(caseViewEvents)
        .values({ caseId: input.id })
        .catch(() => {});

      const [media, questions] = await Promise.all([
        db
          .select()
          .from(echoLibraryCaseMedia)
          .where(eq(echoLibraryCaseMedia.caseId, input.id))
          .orderBy(echoLibraryCaseMedia.sortOrder),
        db
          .select()
          .from(echoLibraryCaseQuestions)
          .where(eq(echoLibraryCaseQuestions.caseId, input.id))
          .orderBy(echoLibraryCaseQuestions.sortOrder),
      ]);

      // Fetch submitter display name
      const [submitter] = await db
        .select({ displayName: users.displayName, name: users.name })
        .from(users)
        .where(eq(users.id, caseRow.submittedByUserId))
        .limit(1);

      // If authenticated, check if user has attempted this case
      let userAttempt = null;
      if (ctx.user) {
        const [attempt] = await db
          .select()
          .from(echoLibraryCaseAttempts)
          .where(
            and(
              eq(echoLibraryCaseAttempts.userId, ctx.user.id),
              eq(echoLibraryCaseAttempts.caseId, input.id)
            )
          )
          .limit(1);
        userAttempt = attempt ?? null;
      }

      return {
        ...caseRow,
        tags: caseRow.tags ? JSON.parse(caseRow.tags) : [],
        teachingPoints: caseRow.teachingPoints ? JSON.parse(caseRow.teachingPoints) : [],
        media,
        questions: questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
        })),
        submitterName: submitter?.displayName || submitter?.name || "Anonymous",
        userAttempt: userAttempt
          ? {
              answers: userAttempt.answers ? JSON.parse(userAttempt.answers) : {},
              score: userAttempt.score,
              totalQuestions: userAttempt.totalQuestions,
            }
          : null,
      };
    }),

  /** Submit a new case (requires HIPAA acknowledgement) */
  submitCase: protectedProcedure
    .input(caseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (!input.hipaaAcknowledged) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must acknowledge the HIPAA/PHI policy before submitting",
        });
      }

      const isAdmin = ctx.user.role === "admin";

      const [result] = await db.insert(echoLibraryCases).values({
        title: input.title,
        summary: input.summary,
        clinicalHistory: input.clinicalHistory ?? null,
        diagnosis: input.diagnosis ?? null,
        teachingPoints: input.teachingPoints ? JSON.stringify(input.teachingPoints) : null,
        modality: input.modality,
        difficulty: input.difficulty,
        tags: JSON.stringify(input.tags),
        status: isAdmin ? "approved" : "pending",
        isAdminSubmission: isAdmin,
        submittedByUserId: ctx.user.id,
        hipaaAcknowledged: input.hipaaAcknowledged,
        submitterCreditName: input.submitterCreditName?.trim() || null,
        submitterLinkedIn: input.submitterLinkedIn?.trim() || null,
      });

      const caseId = (result as any).insertId as number;

      // Insert media
      if (input.media.length > 0) {
        await db.insert(echoLibraryCaseMedia).values(
          input.media.map((m) => ({
            caseId,
            type: m.type,
            url: m.url,
            fileKey: m.fileKey,
            caption: m.caption ?? null,
            sortOrder: m.sortOrder,
          }))
        );
      }

      // Insert questions
      if (input.questions.length > 0) {
        await db.insert(echoLibraryCaseQuestions).values(
          input.questions.map((q) => ({
            caseId,
            question: q.question,
            options: JSON.stringify(q.options),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            sortOrder: q.sortOrder,
          }))
        );
      }

      // Notify admin when a regular user submits a case for review
      if (!isAdmin) {
        const submitterName = ctx.user.displayName || ctx.user.name || "A user";
        const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
        const adminUrl = `${appUrl}/admin/cases`;

        // In-app notification to the platform owner
        notifyOwner({
          title: "New Echo Case Submission",
          content: `${submitterName} submitted a new case for review: "${input.title}" (${input.modality}, ${input.difficulty}). Visit Case Management to approve or reject it.`,
        }).catch((err) => console.error("[caseLibrary] Failed to send in-app notification:", err));

        // Email notification to the admin inbox (SENDGRID_FROM_EMAIL)
        const adminEmail = process.env.SENDGRID_FROM_EMAIL;
        if (adminEmail) {
          const { subject, htmlBody, previewText } = buildNewCaseSubmissionAdminEmail({
            submitterName,
            caseTitle: input.title,
            modality: input.modality,
            difficulty: input.difficulty,
            adminUrl,
          });
          sendEmail({
            to: { name: "iHeartEcho™ Admin", email: adminEmail },
            subject,
            htmlBody,
            previewText,
          }).catch((err) => console.error("[caseLibrary] Failed to send admin notification email:", err));
        }
      }

      return {
        caseId,
        status: isAdmin ? "approved" : "pending",
        message: isAdmin
          ? "Case published successfully"
          : "Case submitted for review. It will appear in the library once approved.",
      };
    }),
  /** Get a presigned S3 upload URL for case media */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().max(255),
        contentType: z.string().max(100),
        mediaType: z.enum(["image", "video"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ext = input.filename.split(".").pop() ?? "bin";
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `case-media/${ctx.user.id}/${Date.now()}-${randomSuffix}.${ext}`;

      // Upload a placeholder to get the URL (actual upload happens from client via presigned URL)
      // For now return the key so client can POST to /api/upload-media
      return { fileKey, uploadEndpoint: "/api/upload-media" };
    }),

  /** Record a user's answers for a case */
  submitAttempt: protectedProcedure
    .input(
      z.object({
        caseId: z.number().int().positive(),
        answers: z.record(z.string(), z.number().int().min(0)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify case exists and is approved
      const [caseRow] = await db
        .select({ id: echoLibraryCases.id, status: echoLibraryCases.status })
        .from(echoLibraryCases)
        .where(eq(echoLibraryCases.id, input.caseId))
        .limit(1);

      if (!caseRow || caseRow.status !== "approved") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }

      const questions = await db
        .select({ id: echoLibraryCaseQuestions.id, correctAnswer: echoLibraryCaseQuestions.correctAnswer })
        .from(echoLibraryCaseQuestions)
        .where(eq(echoLibraryCaseQuestions.caseId, input.caseId));

      let score = 0;
      for (const q of questions) {
        const selected = input.answers[String(q.id)];
        if (selected !== undefined && selected === q.correctAnswer) score++;
      }

      // Upsert attempt
      const existing = await db
        .select({ id: echoLibraryCaseAttempts.id })
        .from(echoLibraryCaseAttempts)
        .where(
          and(
            eq(echoLibraryCaseAttempts.userId, ctx.user.id),
            eq(echoLibraryCaseAttempts.caseId, input.caseId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(echoLibraryCaseAttempts)
          .set({
            answers: JSON.stringify(input.answers),
            score,
            totalQuestions: questions.length,
          })
          .where(eq(echoLibraryCaseAttempts.id, existing[0].id));
      } else {
        await db.insert(echoLibraryCaseAttempts).values({
          userId: ctx.user.id,
          caseId: input.caseId,
          answers: JSON.stringify(input.answers),
          score,
          totalQuestions: questions.length,
        });
      }

      return { score, totalQuestions: questions.length };
    }),

  /** List the current user's own submissions */
  getUserSubmissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const cases = await db
      .select()
      .from(echoLibraryCases)
      .where(eq(echoLibraryCases.submittedByUserId, ctx.user.id))
      .orderBy(desc(echoLibraryCases.submittedAt));

    return cases.map((c) => ({
      ...c,
      tags: c.tags ? JSON.parse(c.tags) : [],
      teachingPoints: c.teachingPoints ? JSON.parse(c.teachingPoints) : [],
    }));
  }),

   /** Fetch a user's own case with media and questions (for edit/resubmit) */
  getMyCase: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [caseRow] = await db
        .select()
        .from(echoLibraryCases)
        .where(
          and(
            eq(echoLibraryCases.id, input.id),
            eq(echoLibraryCases.submittedByUserId, ctx.user.id)
          )
        )
        .limit(1);
      if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      const [media, questions] = await Promise.all([
        db
          .select()
          .from(echoLibraryCaseMedia)
          .where(eq(echoLibraryCaseMedia.caseId, input.id))
          .orderBy(echoLibraryCaseMedia.sortOrder),
        db
          .select()
          .from(echoLibraryCaseQuestions)
          .where(eq(echoLibraryCaseQuestions.caseId, input.id))
          .orderBy(echoLibraryCaseQuestions.sortOrder),
      ]);
      return {
        ...caseRow,
        tags: caseRow.tags ? JSON.parse(caseRow.tags) : [],
        teachingPoints: caseRow.teachingPoints ? JSON.parse(caseRow.teachingPoints) : [],
        media,
        questions: questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options) as string[],
        })),
      };
    }),

  /** Update a rejected case and reset its status to pending (resubmission) */
  updateCase: protectedProcedure
    .input(caseInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (!input.hipaaAcknowledged) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must acknowledge the HIPAA/PHI policy before resubmitting",
        });
      }
      // Verify ownership and that the case is in rejected status
      const [existing] = await db
        .select()
        .from(echoLibraryCases)
        .where(
          and(
            eq(echoLibraryCases.id, input.id),
            eq(echoLibraryCases.submittedByUserId, ctx.user.id)
          )
        )
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      if (existing.status !== "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only rejected cases can be resubmitted",
        });
      }
      // Update the case fields and reset to pending
      await db
        .update(echoLibraryCases)
        .set({
          title: input.title,
          summary: input.summary,
          clinicalHistory: input.clinicalHistory ?? null,
          diagnosis: input.diagnosis ?? null,
          teachingPoints: input.teachingPoints ? JSON.stringify(input.teachingPoints) : null,
          modality: input.modality,
          difficulty: input.difficulty,
          tags: JSON.stringify(input.tags),
          status: "pending",
          rejectionReason: null,
          hipaaAcknowledged: input.hipaaAcknowledged,
          submitterCreditName: input.submitterCreditName?.trim() || null,
          submitterLinkedIn: input.submitterLinkedIn?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(echoLibraryCases.id, input.id));
      // Replace media: delete old, insert new
      await db.delete(echoLibraryCaseMedia).where(eq(echoLibraryCaseMedia.caseId, input.id));
      if (input.media.length > 0) {
        await db.insert(echoLibraryCaseMedia).values(
          input.media.map((m) => ({
            caseId: input.id,
            type: m.type,
            url: m.url,
            fileKey: m.fileKey,
            caption: m.caption ?? null,
            sortOrder: m.sortOrder,
          }))
        );
      }
      // Replace questions: delete old, insert new
      await db.delete(echoLibraryCaseQuestions).where(eq(echoLibraryCaseQuestions.caseId, input.id));
      if (input.questions.length > 0) {
        await db.insert(echoLibraryCaseQuestions).values(
          input.questions.map((q) => ({
            caseId: input.id,
            question: q.question,
            options: JSON.stringify(q.options),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            sortOrder: q.sortOrder,
          }))
        );
      }
      // Notify admin of resubmission
      const submitterName = ctx.user.displayName || ctx.user.name || "A user";
      const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
      notifyOwner({
        title: "Case Resubmitted for Review",
        content: `${submitterName} resubmitted a case: "${input.title}" (${input.modality}). Visit Case Management to review it.`,
      }).catch((err) => console.error("[caseLibrary] Failed to send resubmission notification:", err));
      const adminEmail = process.env.SENDGRID_FROM_EMAIL;
      if (adminEmail) {
        const { subject, htmlBody, previewText } = buildNewCaseSubmissionAdminEmail({
          submitterName,
          caseTitle: input.title,
          modality: input.modality,
          difficulty: input.difficulty,
          adminUrl: `${appUrl}/admin/cases`,
        });
        sendEmail({
          to: { name: "iHeartEcho™ Admin", email: adminEmail },
          subject: `[Resubmission] ${subject}`,
          htmlBody,
          previewText,
        }).catch((err) => console.error("[caseLibrary] Failed to send resubmission email:", err));
      }
      return { caseId: input.id, status: "pending" as const };
    }),

  // ─── Admin procedures ─────────────────────────────────────────────────────
  /** Returns the count of cases awaiting admin review (admin only) */
  getPendingCount: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [result] = await db
      .select({ count: count(echoLibraryCases.id) })
      .from(echoLibraryCases)
      .where(eq(echoLibraryCases.status, "pending"));
    return { count: result?.count ?? 0 };
  }),

  listPendingCases: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const cases = await db
      .select()
      .from(echoLibraryCases)
      .where(eq(echoLibraryCases.status, "pending"))
      .orderBy(echoLibraryCases.submittedAt);

    // Fetch submitter names
    const userIds = Array.from(new Set(cases.map((c) => c.submittedByUserId)));
    let submitterMap: Record<number, string> = {};
    if (userIds.length > 0) {
      const userList = await db
        .select({ id: users.id, displayName: users.displayName, name: users.name })
        .from(users)
        .where(sql`${users.id} IN (${userIds.join(",")})`);
      for (const u of userList) {
        submitterMap[u.id] = u.displayName || u.name || "Unknown";
      }
    }

    return cases.map((c) => ({
      ...c,
      tags: c.tags ? JSON.parse(c.tags) : [],
      submitterName: submitterMap[c.submittedByUserId] ?? "Unknown",
    }));
  }),

  approveCase: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch case + submitter info before updating (needed for email)
      const [caseRow] = await db
        .select({
          id: echoLibraryCases.id,
          title: echoLibraryCases.title,
          submittedByUserId: echoLibraryCases.submittedByUserId,
          isAdminSubmission: echoLibraryCases.isAdminSubmission,
        })
        .from(echoLibraryCases)
        .where(eq(echoLibraryCases.id, input.id))
        .limit(1);

      await db
        .update(echoLibraryCases)
        .set({
          status: "approved",
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: null,
        })
        .where(eq(echoLibraryCases.id, input.id));

      // Send approval email to submitter (skip for admin-created cases)
      if (caseRow && !caseRow.isAdminSubmission && caseRow.submittedByUserId) {
        const [submitter] = await db
          .select({ email: users.email, displayName: users.displayName, name: users.name })
          .from(users)
          .where(eq(users.id, caseRow.submittedByUserId))
          .limit(1);
        if (submitter?.email) {
          const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
          const firstName = (submitter.displayName || submitter.name || "there").split(" ")[0];
          const { subject, htmlBody, previewText } = buildCaseApprovedEmail({
            firstName,
            caseTitle: caseRow.title,
            caseUrl: `${appUrl}/case-library/${caseRow.id}`,
          });
          // Fire-and-forget — don't block the mutation on email delivery
          sendEmail({ to: { name: firstName, email: submitter.email }, subject, htmlBody, previewText }).catch(
            (err) => console.error("[caseLibrary] Failed to send approval email:", err)
          );
        }
      }

      return { success: true };
    }),

  rejectCase: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().min(5).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch case + submitter info before updating (needed for email)
      const [caseRow] = await db
        .select({
          id: echoLibraryCases.id,
          title: echoLibraryCases.title,
          submittedByUserId: echoLibraryCases.submittedByUserId,
          isAdminSubmission: echoLibraryCases.isAdminSubmission,
        })
        .from(echoLibraryCases)
        .where(eq(echoLibraryCases.id, input.id))
        .limit(1);

      await db
        .update(echoLibraryCases)
        .set({
          status: "rejected",
          reviewedByUserId: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason,
        })
        .where(eq(echoLibraryCases.id, input.id));

      // Send rejection email to submitter (skip for admin-created cases)
      if (caseRow && !caseRow.isAdminSubmission && caseRow.submittedByUserId) {
        const [submitter] = await db
          .select({ email: users.email, displayName: users.displayName, name: users.name })
          .from(users)
          .where(eq(users.id, caseRow.submittedByUserId))
          .limit(1);
        if (submitter?.email) {
          const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
          const firstName = (submitter.displayName || submitter.name || "there").split(" ")[0];
          const { subject, htmlBody, previewText } = buildCaseRejectedEmail({
            firstName,
            caseTitle: caseRow.title,
            reason: input.reason,
            submitUrl: `${appUrl}/case-library/submit`,
          });
          // Fire-and-forget — don't block the mutation on email delivery
          sendEmail({ to: { name: firstName, email: submitter.email }, subject, htmlBody, previewText }).catch(
            (err) => console.error("[caseLibrary] Failed to send rejection email:", err)
          );
        }
      }

      return { success: true };
    }),

  adminCreateCase: adminProcedure
    .input(caseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [result] = await db.insert(echoLibraryCases).values({
        title: input.title,
        summary: input.summary,
        clinicalHistory: input.clinicalHistory ?? null,
        diagnosis: input.diagnosis ?? null,
        teachingPoints: input.teachingPoints ? JSON.stringify(input.teachingPoints) : null,
        modality: input.modality,
        difficulty: input.difficulty,
        tags: JSON.stringify(input.tags),
        status: "approved",
          isAdminSubmission: true,
        submittedByUserId: ctx.user.id,
        hipaaAcknowledged: true,
        submitterCreditName: input.submitterCreditName?.trim() || null,
        submitterLinkedIn: input.submitterLinkedIn?.trim() || null,
      });
      const caseId = (result as any).insertId as number;
      if (input.media.length > 0) {
        await db.insert(echoLibraryCaseMedia).values(
          input.media.map((m) => ({
            caseId,
            type: m.type,
            url: m.url,
            fileKey: m.fileKey,
            caption: m.caption ?? null,
            sortOrder: m.sortOrder,
          }))
        );
      }

      if (input.questions.length > 0) {
        await db.insert(echoLibraryCaseQuestions).values(
          input.questions.map((q) => ({
            caseId,
            question: q.question,
            options: JSON.stringify(q.options),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? null,
            sortOrder: q.sortOrder,
          }))
        );
      }

      return { caseId };
    }),

  adminUpdateCase: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(5).max(300).optional(),
        summary: z.string().min(10).max(5000).optional(),
        clinicalHistory: z.string().max(5000).optional().nullable(),
        diagnosis: z.string().max(300).optional().nullable(),
        teachingPoints: z.array(z.string().max(500)).max(10).optional(),
        modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS", "Other"]).optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        tags: z.array(z.string().max(50)).max(10).optional(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        submitterCreditName: z.string().max(200).optional().nullable(),
        submitterLinkedIn: z
          .string()
          .max(500)
          .optional()
          .nullable()
          .refine(
            (v) => !v || /^https?:\/\/(www\.)?linkedin\.com\/(in|company|school)\/[\w\-%.]+\/?$/i.test(v),
            { message: "Please enter a valid LinkedIn URL (linkedin.com/in/name or linkedin.com/company/name)." }
          ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { id, teachingPoints, tags, ...rest } = input;
      await db
        .update(echoLibraryCases)
        .set({
          ...rest,
          ...(teachingPoints !== undefined ? { teachingPoints: JSON.stringify(teachingPoints) } : {}),
          ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
        })
        .where(eq(echoLibraryCases.id, id));

      return { success: true };
    }),

  adminDeleteCase: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Delete related records first
      await db.delete(echoLibraryCaseMedia).where(eq(echoLibraryCaseMedia.caseId, input.id));
      await db.delete(echoLibraryCaseQuestions).where(eq(echoLibraryCaseQuestions.caseId, input.id));
      await db.delete(echoLibraryCaseAttempts).where(eq(echoLibraryCaseAttempts.caseId, input.id));
      await db.delete(echoLibraryCases).where(eq(echoLibraryCases.id, input.id));

      return { success: true };
    }),

  listAllCases: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        search: z.string().max(100).optional(),
        tag: z.string().max(100).optional(),
        modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS", "Other"]).optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        mediaFilter: z.enum(["all", "has_media", "no_media"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.limit;
      const conditions: any[] = [];

      if (input.status) conditions.push(eq(echoLibraryCases.status, input.status));
      if (input.modality) conditions.push(eq(echoLibraryCases.modality, input.modality));
      if (input.difficulty) conditions.push(eq(echoLibraryCases.difficulty, input.difficulty));
      if (input.mediaFilter === "has_media") {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM echoLibraryCaseMedia WHERE echoLibraryCaseMedia.caseId = ${echoLibraryCases.id})`
        );
      } else if (input.mediaFilter === "no_media") {
        conditions.push(
          sql`NOT EXISTS (SELECT 1 FROM echoLibraryCaseMedia WHERE echoLibraryCaseMedia.caseId = ${echoLibraryCases.id})`
        );
      }
      if (input.search) {
        const searchTerm = `%${input.search.toLowerCase()}%`;
        conditions.push(
          sql`(LOWER(${echoLibraryCases.title}) LIKE ${searchTerm} OR LOWER(${echoLibraryCases.diagnosis}) LIKE ${searchTerm} OR LOWER(${echoLibraryCases.tags}) LIKE ${searchTerm})`
        );
      }
      // Tag filter: search within JSON tags array
      if (input.tag) {
        const tagTerm = `%${input.tag.toLowerCase()}%`;
        conditions.push(sql`LOWER(${echoLibraryCases.tags}) LIKE ${tagTerm}`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [cases, totalResult] = await Promise.all([
        db
          .select()
          .from(echoLibraryCases)
          .where(where)
          .orderBy(desc(echoLibraryCases.submittedAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: count(echoLibraryCases.id) })
          .from(echoLibraryCases)
          .where(where),
      ]);

      // Fetch submitter names
      const userIds = Array.from(new Set(cases.map((c) => c.submittedByUserId)));
      let submitterMap: Record<number, string> = {};
      if (userIds.length > 0) {
        const userList = await db
          .select({ id: users.id, displayName: users.displayName, name: users.name })
          .from(users)
          .where(sql`${users.id} IN (${userIds.join(",")})`);
        for (const u of userList) {
          submitterMap[u.id] = u.displayName || u.name || "Unknown";
        }
      }

      return {
        cases: cases.map((c) => ({
          ...c,
          tags: c.tags ? JSON.parse(c.tags) : [],
          submitterName: submitterMap[c.submittedByUserId] ?? "Unknown",
        })),
        total: totalResult[0]?.count ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  /**
   * AI-powered echo case generator.
   * Given a clinical scenario prompt, generates a complete echo case with
   * summary, clinical history, diagnosis, teaching points, and MCQs.
   * Returns the generated case data for admin preview before saving.
   */
  aiGenerateCase: adminProcedure
    .input(
      z.object({
        prompt: z.string().min(10).max(1000).describe("Clinical scenario description"),
        modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "POCUS", "Other"]).default("TTE"),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
        questionCount: z.number().int().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ input }) => {
      const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL ?? "").replace(/\/+$/, "");
      const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY ?? "";

      if (!forgeBaseUrl || !forgeApiKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI service not configured. Missing Forge API credentials.",
        });
      }

      const promptText = `You are an expert echocardiography educator creating a ${input.difficulty} ${input.modality} echo case.

Clinical scenario: "${input.prompt}"

Generate a complete, educationally rich echo case. Return ONLY a valid JSON object with NO markdown, NO code fences, NO explanation — just the raw JSON.

Required JSON format:
{"title":"...","summary":"...","clinicalHistory":"...","diagnosis":"...","teachingPoints":["...","..."],"tags":["...","..."],"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}

Field requirements:
- title: concise descriptive case title (max 100 chars)
- summary: 2-3 sentence overview for the library card
- clinicalHistory: detailed history (age, sex, presenting symptoms, relevant past history, reason for echo)
- diagnosis: primary diagnosis or key finding (max 100 chars)
- teachingPoints: array of 2-5 concise clinical teaching points
- tags: array of 2-8 relevant clinical tags
- questions: array of exactly ${input.questionCount} MCQ questions, each with exactly 4 options, a 0-indexed correctAnswer (0, 1, 2, or 3), and a clear explanation

Guidelines:
- Use accurate ASE/AHA/ACC guidelines where applicable
- Clinical history should be realistic and educational
- MCQ distractors should be plausible but clearly distinguishable
- Teaching points should be actionable clinical pearls
- Difficulty: ${input.difficulty} (beginner=basic concepts, intermediate=clinical application, advanced=complex interpretation)`;

      let text: string;
      try {
        const baseURL = forgeBaseUrl.endsWith("/v1") ? forgeBaseUrl : `${forgeBaseUrl}/v1`;
        const openai = createOpenAI({
          baseURL,
          apiKey: forgeApiKey,
          // Use native fetch (not patched) — patched fetch is for streaming SSE only
        });
        const result = await generateText({
          model: openai.chat("gpt-4o"),
          messages: [{ role: "user", content: promptText }],
          temperature: 0.7,
          maxOutputTokens: 2000,
        });
        text = result.text ?? "";
        if (!text) throw new Error("AI returned empty response");
      } catch (aiErr) {
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI generation failed: ${errMsg.substring(0, 300)}`,
        });
      }

      // Parse the JSON response — handle multiple formats the model may return
      let object: {
        title: string;
        summary: string;
        clinicalHistory: string;
        diagnosis: string;
        teachingPoints: string[];
        tags: string[];
        questions: Array<{
          question: string;
          options: string[];
          correctAnswer: number;
          explanation: string;
        }>;
      };
      try {
        // Strip markdown code fences if present
        let cleaned = text
          .replace(/^```(?:json)?\s*/im, "")
          .replace(/\s*```\s*$/im, "")
          .trim();
        // Extract first JSON object from text (handles prose before/after)
        const jsonMatch = cleaned.match(/({[\s\S]*})/); 
        if (jsonMatch) cleaned = jsonMatch[1].trim();
        object = JSON.parse(cleaned);
        if (!object.title || !object.questions || !Array.isArray(object.questions)) {
          throw new Error("Response missing required fields (title, questions)");
        }
      } catch (parseErr) {
        const preview = text?.substring(0, 300) ?? "(empty)";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)} | Raw preview: ${preview}`,
        });
      }

      return {
        ...object,
        modality: input.modality,
        difficulty: input.difficulty,
      };
    }),

  // ── Admin: Media Management ──────────────────────────────────────────────────

  /** Save a media item to a case (after S3 upload via existing uploadMedia procedure). */
  adminSaveMedia: adminProcedure
    .input(
      z.object({
        caseId: z.number().int().positive(),
        type: z.enum(["image", "video"]),
        url: z.string().url(),
        fileKey: z.string().max(500),
        caption: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db
        .select({ sortOrder: echoLibraryCaseMedia.sortOrder })
        .from(echoLibraryCaseMedia)
        .where(eq(echoLibraryCaseMedia.caseId, input.caseId))
        .orderBy(desc(echoLibraryCaseMedia.sortOrder))
        .limit(1);
      const nextOrder = (existing[0]?.sortOrder ?? -1) + 1;
      const [row] = await db
        .insert(echoLibraryCaseMedia)
        .values({
          caseId: input.caseId,
          type: input.type,
          url: input.url,
          fileKey: input.fileKey,
          caption: input.caption ?? null,
          sortOrder: nextOrder,
        })
        .$returningId();
      return { id: row.id, sortOrder: nextOrder };
    }),

  /** Update a media item's caption or sort order. */
  adminUpdateMedia: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        caption: z.string().max(300).optional().nullable(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...rest } = input;
      await db.update(echoLibraryCaseMedia).set(rest).where(eq(echoLibraryCaseMedia.id, id));
      return { success: true };
    }),

  /** Delete a media item from a case. */
  adminDeleteMedia: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(echoLibraryCaseMedia).where(eq(echoLibraryCaseMedia.id, input.id));
      return { success: true };
    }),

  // ── Admin: Question Management ───────────────────────────────────────────────

  /** Add a new MCQ question to a case. */
  adminAddQuestion: adminProcedure
    .input(
      z.object({
        caseId: z.number().int().positive(),
        question: z.string().min(5).max(2000),
        options: z.array(z.string().min(1).max(500)).length(4),
        correctAnswer: z.number().int().min(0).max(3),
        explanation: z.string().max(3000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db
        .select({ sortOrder: echoLibraryCaseQuestions.sortOrder })
        .from(echoLibraryCaseQuestions)
        .where(eq(echoLibraryCaseQuestions.caseId, input.caseId))
        .orderBy(desc(echoLibraryCaseQuestions.sortOrder))
        .limit(1);
      const nextOrder = (existing[0]?.sortOrder ?? -1) + 1;
      const [row] = await db
        .insert(echoLibraryCaseQuestions)
        .values({
          caseId: input.caseId,
          question: input.question,
          options: JSON.stringify(input.options),
          correctAnswer: input.correctAnswer,
          explanation: input.explanation ?? null,
          sortOrder: nextOrder,
        })
        .$returningId();
      return { id: row.id, sortOrder: nextOrder };
    }),

  /** Update an existing MCQ question. */
  adminUpdateQuestion: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        question: z.string().min(5).max(2000).optional(),
        options: z.array(z.string().min(1).max(500)).length(4).optional(),
        correctAnswer: z.number().int().min(0).max(3).optional(),
        explanation: z.string().max(3000).optional().nullable(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, options, ...rest } = input;
      await db
        .update(echoLibraryCaseQuestions)
        .set({
          ...rest,
          ...(options !== undefined ? { options: JSON.stringify(options) } : {}),
        })
        .where(eq(echoLibraryCaseQuestions.id, id));
      return { success: true };
    }),

  /** Delete a question from a case. */
  adminDeleteQuestion: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(echoLibraryCaseQuestions).where(eq(echoLibraryCaseQuestions.id, input.id));
      return { success: true };
    }),

  /**
   * Weekly view trends for admin analytics.
   * Returns the last N weeks of view counts aggregated per case.
   */
  getViewTrends: adminProcedure
    .input(
      z.object({
        weeks: z.number().int().min(4).max(52).default(12),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Cutoff date
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.weeks * 7);

      // Fetch all view events in the window
      const events = await db
        .select({ caseId: caseViewEvents.caseId, viewedAt: caseViewEvents.viewedAt })
        .from(caseViewEvents)
        .where(gte(caseViewEvents.viewedAt, cutoff));

      // Build week labels (ISO week strings: YYYY-Www)
      const getWeekKey = (date: Date): string => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      };

      // Generate ordered week keys for the window
      const weekKeys: string[] = [];
      const weekLabels: string[] = [];
      for (let i = input.weeks - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const key = getWeekKey(d);
        if (!weekKeys.includes(key)) {
          weekKeys.push(key);
          weekLabels.push(
            d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          );
        }
      }

      // Aggregate events by week
      const weeklyTotals: Record<string, number> = {};
      for (const key of weekKeys) weeklyTotals[key] = 0;
      for (const ev of events) {
        const key = getWeekKey(new Date(ev.viewedAt));
        if (key in weeklyTotals) weeklyTotals[key]++;
      }

      // Per-case breakdown (top 10 by total views in window)
      const caseTotals: Record<number, number> = {};
      for (const ev of events) {
        caseTotals[ev.caseId] = (caseTotals[ev.caseId] ?? 0) + 1;
      }
      const topCaseIds = Object.entries(caseTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => Number(id));

      // Fetch case titles
      const caseTitles: Record<number, string> = {};
      if (topCaseIds.length > 0) {
        const rows = await db
          .select({ id: echoLibraryCases.id, title: echoLibraryCases.title })
          .from(echoLibraryCases)
          .where(sql`${echoLibraryCases.id} IN (${topCaseIds.join(",")})`);
        for (const r of rows) caseTitles[r.id] = r.title;
      }

      // Per-case weekly series
      const caseWeekly: Record<number, Record<string, number>> = {};
      for (const id of topCaseIds) {
        caseWeekly[id] = {};
        for (const key of weekKeys) caseWeekly[id][key] = 0;
      }
      for (const ev of events) {
        if (!topCaseIds.includes(ev.caseId)) continue;
        const key = getWeekKey(new Date(ev.viewedAt));
        if (key in caseWeekly[ev.caseId]) caseWeekly[ev.caseId][key]++;
      }

      return {
        weekLabels,
        weekKeys,
        totalByWeek: weekKeys.map((k) => weeklyTotals[k]),
        cases: topCaseIds.map((id) => ({
          id,
          title: caseTitles[id] ?? `Case #${id}`,
          totalViews: caseTotals[id],
          viewsByWeek: weekKeys.map((k) => caseWeekly[id][k]),
        })),
      };
    }),

  /**
   * getRelatedCases — returns up to 4 approved cases that share at least one
   * tag with the given case, ordered by number of matching tags then by view
   * count descending. Excludes the current case.
   */
  getRelatedCases: publicProcedure
    .input(
      z.object({
        caseId: z.number().int().positive(),
        tags: z.array(z.string()).min(1).max(20),
        limit: z.number().int().min(1).max(8).default(4),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Fetch a broader pool of approved cases (excluding current)
      // We'll filter by tag overlap in JS since tags are stored as JSON strings
      const candidates = await db
        .select({
          id: echoLibraryCases.id,
          title: echoLibraryCases.title,
          summary: echoLibraryCases.summary,
          modality: echoLibraryCases.modality,
          difficulty: echoLibraryCases.difficulty,
          tags: echoLibraryCases.tags,
          viewCount: echoLibraryCases.viewCount,
          submittedAt: echoLibraryCases.submittedAt,
        })
        .from(echoLibraryCases)
        .where(
          and(
            eq(echoLibraryCases.status, "approved"),
            sql`${echoLibraryCases.id} != ${input.caseId}`
          )
        )
        .orderBy(desc(echoLibraryCases.viewCount))
        .limit(200);

      const inputTagSet = new Set(input.tags.map((t) => t.toLowerCase()));

      // Score each candidate by number of matching tags
      const scored = candidates
        .map((c) => {
          const caseTags: string[] = c.tags ? JSON.parse(c.tags) : [];
          const matchCount = caseTags.filter((t) => inputTagSet.has(t.toLowerCase())).length;
          return { ...c, tags: caseTags, matchCount };
        })
        .filter((c) => c.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount || (b.viewCount ?? 0) - (a.viewCount ?? 0))
        .slice(0, input.limit);

      return scored.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary,
        modality: c.modality,
        difficulty: c.difficulty,
        tags: c.tags,
        viewCount: c.viewCount ?? 0,
        submittedAt: c.submittedAt,
        matchCount: c.matchCount,
      }));
    }),
});
