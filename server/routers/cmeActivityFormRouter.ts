/**
 * cmeActivityFormRouter.ts
 * CME Activity Planning Form — tRPC procedures
 *
 * getCmeActivityForm(courseId)         — returns existing form or auto-fills defaults from course
 * generateCmeFormContent(courseId)     — AI-generates green text fields from course title/topic
 * saveCmeActivityForm(courseId, data)  — upserts the form
 * downloadCmeActivityForm(courseId)    — generates DOCX, uploads to S3, returns URL
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, leftJoin } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assertAdmin } from "./lmsHelpers";
import { cmeActivityForms, cmeSendHistory, lmsCourses, lmsInstructors } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { generateCmeActivityDocx } from "../lib/cmeActivityDocx";
import { generateCmeActivityPdf } from "../lib/cmeActivityPdf";

// ─── Zod schema for the form data ────────────────────────────────────────────
const cmeFormDataSchema = z.object({
  activityTitle: z.string().max(512).optional().nullable(),
  activityType: z.string().max(64).optional().nullable(),
  proposedDate: z.string().max(128).optional().nullable(),
  originalReleaseDate: z.string().max(128).optional().nullable(),
  mostRecentReviewDate: z.string().max(128).optional().nullable(),
  expirationDate: z.string().max(128).optional().nullable(),
  activityLengthHours: z.string().max(32).optional().nullable(),
  cmeCreditsRequested: z.string().max(32).optional().nullable(),
  offerMocCredit: z.string().max(32).optional().nullable(),
  offeredMoreThanOnce: z.string().max(32).optional().nullable(),
  activityStructure: z.string().max(64).optional().nullable(),
  targetAudience: z.string().max(64).optional().nullable(),
  estimatedLearners: z.string().max(64).optional().nullable(),
  practiceGapDescription: z.string().optional().nullable(),
  practiceGapReasons: z.string().optional().nullable(),
  improvementTypes: z.string().optional().nullable(),
  improvementKnowledgeText: z.string().optional().nullable(),
  improvementCompetenceText: z.string().optional().nullable(),
  improvementPerformanceText: z.string().optional().nullable(),
  learnerOutcomes: z.string().optional().nullable(),
  learningObjectives: z.string().optional().nullable(),
  deliveryDescription: z.string().optional().nullable(),
  activityIncludes: z.string().optional().nullable(),
  assessmentMethods: z.string().optional().nullable(),
  facultyJson: z.string().optional().nullable(),
  contentStatus: z.string().max(64).optional().nullable(),
  contentAvailableDate: z.string().max(128).optional().nullable(),
  marketingChannels: z.string().optional().nullable(),
  marketingMentionsCme: z.string().max(32).optional().nullable(),
  registrationFee: z.string().max(32).optional().nullable(),
  attestationName: z.string().max(256).optional().nullable(),
  attestationDate: z.string().max(64).optional().nullable(),
  attestationTitle: z.string().max(256).optional().nullable(),
  signatureDataUrl: z.string().optional().nullable(),
});

// ─── AI generation helper ─────────────────────────────────────────────────────
async function aiGenerateCmeContent(courseTitle: string, creditHours: string | null): Promise<{
  practiceGapDescription: string;
  practiceGapReasons: string;
  improvementKnowledgeText: string;
  improvementCompetenceText: string;
  improvementPerformanceText: string;
  learnerOutcomes: string;
  learningObjectives: string;
}> {
  const credits = creditHours ? `${creditHours} CME credit hours` : "CME credit";

  const prompt = `You are an expert CME (Continuing Medical Education) curriculum developer for All About Ultrasound, a professional ultrasound education platform. Generate content for an Activity Planning and Proposal Form for the following CME course:

Course Title: "${courseTitle}"
CME Credits: ${credits}

Generate the following sections in valid JSON format. Be specific, clinically accurate, and professional. Use ultrasound/sonography terminology appropriate for the course topic.

{
  "practiceGapDescription": "2-3 sentences describing the specific practice-based problem or challenge this course addresses. Focus on clinical performance gaps in ultrasound practice related to the course topic.",
  "practiceGapReasons": "2-3 sentences describing the primary reasons contributing to this practice gap (e.g., variability in technique, limited training, inconsistent protocols, complexity of anatomy/pathology).",
  "improvementKnowledgeText": "1-2 sentences starting with 'Knowledge (understanding updated information)—' describing what knowledge participants will gain.",
  "improvementCompetenceText": "1-2 sentences starting with 'Competence (improving ability to apply information correctly)—' describing what competence participants will improve.",
  "improvementPerformanceText": "1-2 sentences starting with 'Performance (improving practice, behavior, or workflow)—' describing how participants' clinical performance will improve.",
  "learnerOutcomes": "After completing this activity, learners should be able to:\\n• [4-5 specific, measurable outcomes as bullet points starting with action verbs like Accurately, Apply, Integrate, Recognize, Improve]",
  "learningObjectives": "• [4 specific, measurable learning objectives as bullet points starting with action verbs like Describe, Demonstrate, Apply, Interpret]"
}

Return ONLY the JSON object, no additional text.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert CME curriculum developer for ultrasound education. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "cme_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            practiceGapDescription: { type: "string" },
            practiceGapReasons: { type: "string" },
            improvementKnowledgeText: { type: "string" },
            improvementCompetenceText: { type: "string" },
            improvementPerformanceText: { type: "string" },
            learnerOutcomes: { type: "string" },
            learningObjectives: { type: "string" },
          },
          required: ["practiceGapDescription", "practiceGapReasons", "improvementKnowledgeText", "improvementCompetenceText", "improvementPerformanceText", "learnerOutcomes", "learningObjectives"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
}

export const cmeActivityFormRouter = router({
  // ── List all CME courses with form completion status ──────────────────────
  listCmeActivityForms: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get all CME-eligible products from lms_courses (all types: course, quiz, cohort, workshop, download)
      // Exclude archived/draft status courses to keep the list actionable
      const courses = await db
        .select({
          id: lmsCourses.id,
          title: lmsCourses.title,
          slug: lmsCourses.slug,
          status: lmsCourses.status,
          creditHours: lmsCourses.creditHours,
          hasCertificate: lmsCourses.hasCertificate,
          type: lmsCourses.type,
        })
        .from(lmsCourses)
        .orderBy(lmsCourses.title);

      if (courses.length === 0) return [];

      // Get all existing CME forms
      const forms = await db
        .select({
          courseId: cmeActivityForms.courseId,
          activityTitle: cmeActivityForms.activityTitle,
          proposedDate: cmeActivityForms.proposedDate,
          practiceGapDescription: cmeActivityForms.practiceGapDescription,
          learningObjectives: cmeActivityForms.learningObjectives,
          attestationDate: cmeActivityForms.attestationDate,
          updatedAt: cmeActivityForms.updatedAt,
          lastSentAt: cmeActivityForms.lastSentAt,
          cmeStatus: cmeActivityForms.cmeStatus,
          approvedAt: cmeActivityForms.approvedAt,
        })
        .from(cmeActivityForms);

      const formsByCourseId = new Map(forms.map(f => [f.courseId, f]));
      const now = Date.now();
      const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

      return courses.map(course => {
        const form = formsByCourseId.get(course.id);
        // Determine completeness: form exists + key sections filled
        const isComplete = !!(form &&
          form.practiceGapDescription?.trim() &&
          form.learningObjectives?.trim() &&
          form.attestationDate?.trim());
        const isStarted = !!form;
        // Compute effective cme status (auto-expire 2 years after approvedAt)
        let cmeStatus = form?.cmeStatus ?? "draft";
        if (cmeStatus === "approved" && form?.approvedAt && (now - form.approvedAt) > TWO_YEARS_MS) {
          cmeStatus = "expired";
        }
        // Map lmsCourses type to a display product type
        const productTypeMap: Record<string, string> = {
          course: "course",
          quiz: "quiz",
          cohort: "cohort",
          workshop: "workshop",
          download: "download",
        };
        return {
          ...course,
          productType: productTypeMap[course.type] ?? course.type,
          formStatus: isComplete ? "complete" : isStarted ? "in_progress" : "pending",
          formUpdatedAt: form?.updatedAt ?? null,
          formProposedDate: form?.proposedDate ?? null,
          lastSentAt: form?.lastSentAt ?? null,
          cmeStatus,
          approvedAt: form?.approvedAt ?? null,
        };
      });
    }),

  // ── Get form (existing or defaults) ──────────────────────────────────────
  getCmeActivityForm: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, creditHours: lmsCourses.creditHours, hasCertificate: lmsCourses.hasCertificate })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);

      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const [existing] = await db
        .select()
        .from(cmeActivityForms)
        .where(eq(cmeActivityForms.courseId, input.courseId))
        .limit(1);

      if (existing) return { form: existing, course, isNew: false };

      // Extract credit hours from title if DB column is null (e.g. "All About X - 2.5 CME" → "2.5")
      const titleCreditMatch = course.title?.match(/(\d+(?:\.\d+)?)\s*(?:CME|CE|credit)/i);
      const derivedCredits = course.creditHours ?? (titleCreditMatch ? titleCreditMatch[1] : "");

      // Return skeleton defaults (no AI yet — user clicks "Generate with AI")
      const defaults = {
        id: null,
        courseId: input.courseId,
        activityTitle: course.title ?? "",
        activityType: "enduring",
        proposedDate: "",
        originalReleaseDate: "",
        mostRecentReviewDate: "",
        expirationDate: "",
        activityLengthHours: derivedCredits,
        cmeCreditsRequested: derivedCredits,
        offerMocCredit: "no",
        offeredMoreThanOnce: "not_yet_determined",
        activityStructure: "ongoing",
        targetAudience: "sonographers",
        estimatedLearners: "",
        practiceGapDescription: "",
        practiceGapReasons: "",
        improvementTypes: JSON.stringify(["knowledge", "competence", "performance"]),
        improvementKnowledgeText: "",
        improvementCompetenceText: "",
        improvementPerformanceText: "",
        learnerOutcomes: "",
        learningObjectives: "",
        deliveryDescription: "Recorded video presentation with written content and quiz module.",
        activityIncludes: JSON.stringify(["knowledge_check"]),
        assessmentMethods: JSON.stringify(["post_test", "learner_evaluation"]),
        facultyJson: JSON.stringify([{ name: "Lara Williams", credentials: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE", role: "Planner, Presenter" }]),
        contentStatus: "fully_developed",
        contentAvailableDate: "Available now",
        marketingChannels: JSON.stringify(["email", "website", "social_media"]),
        marketingMentionsCme: "yes",
        registrationFee: "yes",
        attestationName: "Lara Williams",
        attestationDate: "",
        attestationTitle: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE",
        signatureDataUrl: null,
        createdAt: null,
        updatedAt: null,
        lastSentAt: null,
        cmeStatus: "draft",
        approvedAt: null,
      };

      return { form: defaults, course, isNew: true };
    }),

  // ── AI-generate green text fields from course title ───────────────────────
  generateCmeFormContent: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      courseTitle: z.string().min(1).max(512),
      creditHours: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const generated = await aiGenerateCmeContent(input.courseTitle, input.creditHours ?? null);
      return generated;
    }),

  // ── Save (upsert) form ────────────────────────────────────────────────────
  saveCmeActivityForm: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      data: cmeFormDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select({ id: cmeActivityForms.id })
        .from(cmeActivityForms)
        .where(eq(cmeActivityForms.courseId, input.courseId))
        .limit(1);

      if (existing) {
        await db
          .update(cmeActivityForms)
          .set(input.data as any)
          .where(eq(cmeActivityForms.courseId, input.courseId));
      } else {
        await db
          .insert(cmeActivityForms)
          .values({ courseId: input.courseId, ...input.data } as any);
      }

      return { success: true };
    }),

  // ── Download as DOCX ──────────────────────────────────────────────────────
  downloadCmeActivityForm: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [form] = await db
        .select()
        .from(cmeActivityForms)
        .where(eq(cmeActivityForms.courseId, input.courseId))
        .limit(1);

      const [course] = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, creditHours: lmsCourses.creditHours })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);

      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const titleCreditMatchDocx = course.title?.match(/(\d+(?:\.\d+)?)\s*(?:CME|CE|credit)/i);
      const derivedCreditsDocx = course.creditHours ?? (titleCreditMatchDocx ? titleCreditMatchDocx[1] : "");

      const formData = form ?? {
        courseId: input.courseId,
        activityTitle: course.title,
        activityType: "enduring",
        proposedDate: "",
        originalReleaseDate: "",
        mostRecentReviewDate: "",
        expirationDate: "",
        activityLengthHours: derivedCreditsDocx,
        cmeCreditsRequested: derivedCreditsDocx,
        offerMocCredit: "no",
        offeredMoreThanOnce: "not_yet_determined",
        activityStructure: "ongoing",
        targetAudience: "sonographers",
        estimatedLearners: "",
        practiceGapDescription: "",
        practiceGapReasons: "",
        improvementTypes: JSON.stringify(["knowledge", "competence", "performance"]),
        improvementKnowledgeText: "",
        improvementCompetenceText: "",
        improvementPerformanceText: "",
        learnerOutcomes: "",
        learningObjectives: "",
        deliveryDescription: "Recorded video presentation with written content and quiz module.",
        activityIncludes: JSON.stringify(["knowledge_check"]),
        assessmentMethods: JSON.stringify(["post_test", "learner_evaluation"]),
        facultyJson: JSON.stringify([{ name: "Lara Williams", credentials: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE", role: "Planner, Presenter" }]),
        contentStatus: "fully_developed",
        contentAvailableDate: "Available now",
        marketingChannels: JSON.stringify(["email", "website", "social_media"]),
        marketingMentionsCme: "yes",
        registrationFee: "yes",
        attestationName: "Lara Williams",
        attestationDate: "",
      };

      const docxBuffer = await generateCmeActivityDocx(formData as any);

      const safeTitle = (course.title ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      const key = `cme-forms/${safeTitle}-${Date.now()}.docx`;
      const { url } = await storagePut(
        key,
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      return { url };
    }),

  // ── Download as PDF ────────────────────────────────────────────────────────────────────
  downloadCmeActivityFormPdf: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [course] = await db
        .select({ title: lmsCourses.title, creditHours: lmsCourses.creditHours })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const [existing] = await db
        .select()
        .from(cmeActivityForms)
        .where(eq(cmeActivityForms.courseId, input.courseId))
        .limit(1);

      const titleCreditMatchPdf = course.title?.match(/(\d+(?:\.\d+)?)\s*(?:CME|CE|credit)/i);
      const derivedCreditsPdf = course.creditHours ?? (titleCreditMatchPdf ? titleCreditMatchPdf[1] : "");

      const formData = existing ?? {
        activityTitle: course.title,
        activityType: "enduring",
        activityStructure: "ongoing",
        originalReleaseDate: "",
        mostRecentReviewDate: "",
        expirationDate: "",
        activityLengthHours: derivedCreditsPdf,
        cmeCreditsRequested: derivedCreditsPdf,
        offerMocCredit: "no",
        offeredMoreThanOnce: "not_yet_determined",
        targetAudience: "sonographers",
      };

      const pdfBuffer = await generateCmeActivityPdf(formData as any);

      const safeTitle = (course.title ?? "cme-form").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      const key = `cme-forms/${safeTitle}-${Date.now()}.pdf`;
      const { url } = await storagePut(key, pdfBuffer, "application/pdf");

      return { url };
    }),

  // ── Send form PDF to CardioServ via email ─────────────────────────────────
  sendCmeFormToCardioServ: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      /** Editable email subject */
      subject: z.string().min(1).max(512),
      /** Editable email body (plain text, will be wrapped in HTML) */
      body: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [form] = await db
        .select()
        .from(cmeActivityForms)
        .where(eq(cmeActivityForms.courseId, input.courseId))
        .limit(1);

      const [course] = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, creditHours: lmsCourses.creditHours, slug: lmsCourses.slug })
        .from(lmsCourses)
        .where(eq(lmsCourses.id, input.courseId))
        .limit(1);

      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

      const formData = form ?? {
        courseId: input.courseId,
        activityTitle: course.title,
        activityType: "enduring",
        proposedDate: "",
        originalReleaseDate: "",
        mostRecentReviewDate: "",
        expirationDate: "",
        activityLengthHours: course.creditHours ?? "",
        cmeCreditsRequested: course.creditHours ?? "",
        offerMocCredit: "no",
        offeredMoreThanOnce: "not_yet_determined",
        activityStructure: "ongoing",
        targetAudience: "sonographers",
        estimatedLearners: "",
        practiceGapDescription: "",
        practiceGapReasons: "",
        improvementTypes: JSON.stringify(["knowledge", "competence", "performance"]),
        improvementKnowledgeText: "",
        improvementCompetenceText: "",
        improvementPerformanceText: "",
        learnerOutcomes: "",
        learningObjectives: "",
        deliveryDescription: "Recorded video presentation with written content and quiz module.",
        activityIncludes: JSON.stringify(["knowledge_check"]),
        assessmentMethods: JSON.stringify(["post_test", "learner_evaluation"]),
        facultyJson: JSON.stringify([{ name: "Lara Williams", credentials: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE", role: "Planner, Presenter" }]),
        contentStatus: "fully_developed",
        contentAvailableDate: "Available now",
        marketingChannels: JSON.stringify(["email", "website", "social_media"]),
        marketingMentionsCme: "yes",
        registrationFee: "yes",
        attestationName: "Lara Williams",
        attestationDate: "",
        attestationTitle: "BS, ACS, RCCS, RDCS (AE, PE, FE), RVT, RDMS, FASE",
        signatureDataUrl: null,
        createdAt: null,
        updatedAt: null,
      };

      // Generate PDF
      const pdfBuffer = await generateCmeActivityPdf(formData as any);

      // Build HTML email body from the plain-text body
      const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;line-height:1.7;max-width:640px;margin:0 auto;padding:24px;">
${input.body.split('\n').map(line => line.trim() ? `<p style="margin:0 0 12px;">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<br/>').join('')}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
<p style="font-size:12px;color:#94a3b8;">Sent from All About Ultrasound CME Administration</p>
</body></html>`;

      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Email service not configured" });

      const pdfBase64 = pdfBuffer.toString("base64");
      const safeTitle = (course.title ?? "CME-Activity-Form").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
      const filename = `${safeTitle}-CME-Activity-Form.pdf`;

      const senderEmail = process.env.SENDGRID_FROM_EMAIL || "admin@allaboutultrasound.com";

      const payload = {
        personalizations: [{
          to: [{ name: "Don Gerig", email: "don@cardioserv.net" }],
          cc: [
            { name: "Judith Buckland", email: "j.buckland@cardioserv.net" },
            { name: "All About Ultrasound Admin", email: "admin@allaboutultrasound.com" },
          ],
          subject: input.subject,
        }],
        from: { name: "All About Ultrasound", email: senderEmail },
        reply_to: { name: "All About Ultrasound", email: senderEmail },
        content: [{ type: "text/html", value: htmlBody }],
        attachments: [{
          content: pdfBase64,
          type: "application/pdf",
          filename,
          disposition: "attachment",
        }],
        tracking_settings: {
          click_tracking: { enable: false },
          open_tracking: { enable: false },
        },
      };

      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[CME Email] SendGrid error ${res.status}: ${text}`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Email send failed: ${res.status}` });
      }

      // Save lastSentAt timestamp and insert history record
      const now = Date.now();
      if (form) {
        await db.update(cmeActivityForms)
          .set({ lastSentAt: now })
          .where(eq(cmeActivityForms.courseId, input.courseId));
      }
      await db.insert(cmeSendHistory).values({
        courseId: input.courseId,
        sentAt: now,
        subject: input.subject,
        sentBy: ctx.user?.name ?? ctx.user?.email ?? "Admin",
      });

      console.log(`[CME Email] Sent "${input.subject}" to don@cardioserv.net for course ${course.title}`);
      return { success: true, lastSentAt: now };
    }),

  // ── Update CME status ────────────────────────────────────────
  updateCmeStatus: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      status: z.enum(["draft", "pending_approval", "approved", "expired"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const approvedAt = input.status === "approved" ? Date.now() : undefined;
      const updateData: Record<string, unknown> = { cmeStatus: input.status };
      if (approvedAt !== undefined) updateData.approvedAt = approvedAt;
      // If moving away from approved, clear approvedAt
      if (input.status !== "approved") updateData.approvedAt = null;
      await db.update(cmeActivityForms)
        .set(updateData as any)
        .where(eq(cmeActivityForms.courseId, input.courseId));
      return { success: true };
    }),

  // ── Get instructors list for CME faculty autocomplete ─────────────────────
  getInstructorsForCme: protectedProcedure
    .query(async ({ ctx }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({ id: lmsInstructors.id, name: lmsInstructors.name, title: lmsInstructors.title })
        .from(lmsInstructors)
        .where(eq(lmsInstructors.isActive, true))
        .orderBy(lmsInstructors.name);
      return rows;
    }),

  // ── Manually set approvedAt date ─────────────────────────────────────────
  updateApprovedAt: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      approvedAt: z.number().int().nullable(), // UTC ms timestamp, null to clear
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(cmeActivityForms)
        .set({ approvedAt: input.approvedAt } as any)
        .where(eq(cmeActivityForms.courseId, input.courseId));
      return { success: true };
    }),

  // ── Get send history for a course ────────────────────────────────────────
  getCmeSendHistory: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(cmeSendHistory)
        .where(eq(cmeSendHistory.courseId, input.courseId))
        .orderBy(cmeSendHistory.sentAt);
      return rows;
    }),
});
