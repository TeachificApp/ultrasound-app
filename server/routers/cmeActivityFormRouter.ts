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
import { and, eq, leftJoin, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assertAdmin } from "./lmsHelpers";
import { cmeActivityForms, cmeSendHistory, lmsCourses, lmsInstructors, cmeFinancialDisclosures, webinars, draftNotifyEntries, cmeGenericDisclosures, lmsEnrollments, users, webinarRegistrations, workshopEnrollments, workshopInstances } from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { generateCmeActivityDocx } from "../lib/cmeActivityDocx";
import { generateCmeActivityPdf } from "../lib/cmeActivityPdf";
import { generateDisclosurePdf } from "../lib/disclosurePdf";

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

      // Get CME-eligible products: only courses with certificate enabled OR non-empty creditHours
      const { or, eq, isNotNull, and, ne } = await import("drizzle-orm");
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
        .where(
          or(
            // Has certificate enabled (boolean true)
            eq(lmsCourses.hasCertificate, true),
            // Has CME credit hours set (non-null AND non-empty string)
            and(
              isNotNull(lmsCourses.creditHours),
              ne(lmsCourses.creditHours, ""),
            ),
          )
        )
        .orderBy(lmsCourses.title);

      // Also get CME-eligible webinars
      const cmeWebinars = await db
        .select({
          id: webinars.id,
          title: webinars.title,
          slug: webinars.slug,
          status: webinars.status,
          creditHours: webinars.creditHours,
          hasCertificate: webinars.hasCertificate,
          type: sql<string>`'webinar'`,
        })
        .from(webinars)
        .where(
          or(
            eq(webinars.hasCertificate, true),
            and(
              isNotNull(webinars.creditHours),
              ne(webinars.creditHours, ""),
            ),
          )
        )
        .orderBy(webinars.title);

      // Merge courses + webinars into one list with a source tag
      const allItems = [
        ...courses.map(c => ({ ...c, source: 'course' as const })),
        ...cmeWebinars.map(w => ({ ...w, source: 'webinar' as const })),
      ].sort((a, b) => a.title.localeCompare(b.title));

      if (allItems.length === 0) return [];

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

      return allItems.map(course => {
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
      /** Optional editable recipient list; falls back to CardioServ defaults */
      recipients: z.array(z.object({
        label: z.enum(["To", "CC"]),
        email: z.string().email(),
        name: z.string(),
      })).min(1).optional(),
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

      // Build To/CC from input or fall back to CardioServ defaults
      const defaultRecipients = [
        { label: "To" as const, email: "don@cardioserv.net", name: "Don Gerig" },
        { label: "CC" as const, email: "j.buckland@cardioserv.net", name: "Judith Buckland" },
        { label: "CC" as const, email: "admin@allaboutultrasound.com", name: "All About Ultrasound Admin" },
      ];
      const recipientList = (input.recipients && input.recipients.length > 0) ? input.recipients : defaultRecipients;
      const toRecipients = recipientList.filter(r => r.label === "To").map(r => ({ name: r.name, email: r.email }));
      const ccRecipients = recipientList.filter(r => r.label === "CC").map(r => ({ name: r.name, email: r.email }));
      if (toRecipients.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "At least one To: recipient is required" });

      const payload = {
        personalizations: [{
          to: toRecipients,
          ...(ccRecipients.length > 0 ? { cc: ccRecipients } : {}),
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

      // ── Auto-enroll Don Gerig in the CME product ──────────────────────────
      // When the CardioServ approval email is sent, automatically enroll
      // Don Gerig (don@cardioserv.net) so he can access and review the content.
      // Supports: course, cohort, quiz (lms_enrollments), webinar (webinar_registrations),
      //           workshop (workshop_enrollments).
      try {
        const [donUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, "don@cardioserv.net"))
          .limit(1);
        if (donUser) {
          const productType = (input as any).productType ?? "course";
          const productId = input.courseId;
          if (productType === "webinar") {
            // Webinar: insert into webinar_registrations
            const [existingReg] = await db.select({ id: webinarRegistrations.id }).from(webinarRegistrations)
              .where(and(eq(webinarRegistrations.userId, donUser.id), eq(webinarRegistrations.webinarId, productId))).limit(1);
            if (!existingReg) {
              await db.insert(webinarRegistrations).values({ webinarId: productId, userId: donUser.id, firstName: "Don", lastName: "Gerig", email: "don@cardioserv.net" });
              console.log(`[CME Email] Auto-registered Don Gerig in webinar id=${productId}`);
            } else {
              console.log(`[CME Email] Don Gerig already registered in webinar id=${productId} — skipping`);
            }
          } else if (productType === "workshop") {
            // Workshop: insert into workshop_enrollments
            const [existingWS] = await db.select({ id: workshopEnrollments.id }).from(workshopEnrollments)
              .where(and(eq(workshopEnrollments.userId, donUser.id), eq(workshopEnrollments.workshopId, productId))).limit(1);
            if (!existingWS) {
              // Get the first active instance for this workshop (instanceId is required)
              const [firstInstance] = await db.select({ id: workshopInstances.id }).from(workshopInstances)
                .where(eq(workshopInstances.workshopId, productId)).limit(1);
              if (firstInstance) {
                await db.insert(workshopEnrollments).values({ workshopId: productId, instanceId: firstInstance.id, userId: donUser.id });
                console.log(`[CME Email] Auto-enrolled Don Gerig in workshop id=${productId} instance id=${firstInstance.id}`);
              } else {
                console.log(`[CME Email] No instances found for workshop id=${productId} — skipping Don Gerig enrollment`);
              }
            } else {
              console.log(`[CME Email] Don Gerig already enrolled in workshop id=${productId} — skipping`);
            }
          } else {
            // course / cohort / quiz — all use lms_enrollments
            const [existing] = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments)
              .where(and(eq(lmsEnrollments.userId, donUser.id), eq(lmsEnrollments.courseId, productId))).limit(1);
            if (!existing) {
              await db.insert(lmsEnrollments).values({ userId: donUser.id, courseId: productId, enrollmentType: "complimentary" });
              console.log(`[CME Email] Auto-enrolled Don Gerig (id=${donUser.id}) in ${productType} id=${productId} (${course.title})`);
            } else {
              console.log(`[CME Email] Don Gerig already enrolled in ${productType} id=${productId} — skipping`);
            }
          }
        } else {
          console.log(`[CME Email] Don Gerig (don@cardioserv.net) not found in users table — skipping auto-enroll`);
        }
      } catch (enrollErr: any) {
        // Non-fatal: log but don't fail the email send
        console.error(`[CME Email] Auto-enroll Don Gerig failed:`, enrollErr?.message);
      }
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
      const { users } = await import("../../drizzle/schema").then(m => m);
      const rows = await db
        .select({
          id: lmsInstructors.id,
          name: lmsInstructors.name,
          email: lmsInstructors.email,
          title: lmsInstructors.title,
          userEmail: users.email,
        })
        .from(lmsInstructors)
        .leftJoin(users, eq(users.id, lmsInstructors.userId))
        .where(eq(lmsInstructors.isActive, true))
        .orderBy(lmsInstructors.name);
      // Prefer direct email column; fall back to linked user account email
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email || r.userEmail || null,
        title: r.title,
      }));
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

  // ── Financial Disclosure: Send to faculty member ───────────────────────────
  sendFinancialDisclosure: protectedProcedure
    .input(z.object({
      courseId: z.number().int().positive(),
      facultyName: z.string().min(1),
      facultyEmail: z.string().email(),
      origin: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get course info for the form
      const [course] = await db.select({ title: lmsCourses.title })
        .from(lmsCourses).where(eq(lmsCourses.id, input.courseId)).limit(1);
      // Get CME form for education date
      const [cmeForm] = await db.select({ proposedDate: cmeActivityForms.proposedDate })
        .from(cmeActivityForms).where(eq(cmeActivityForms.courseId, input.courseId)).limit(1);
      // Generate a secure unique token
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      // Check if a disclosure already exists for this faculty+course
      const [existing] = await db.select()
        .from(cmeFinancialDisclosures)
        .where(eq(cmeFinancialDisclosures.courseId, input.courseId))
        .limit(100);
      // Upsert: if pending/sent record exists for this faculty email, update it; otherwise insert
      const existingForFaculty = await db.select()
        .from(cmeFinancialDisclosures)
        .where(eq(cmeFinancialDisclosures.courseId, input.courseId))
        .then(rows => rows.find(r => r.facultyEmail.toLowerCase() === input.facultyEmail.toLowerCase() && r.status !== 'submitted'));
      const baseUrl = input.origin || `https://${process.env.CANONICAL_ROOT_DOMAIN || 'learn.allaboutultrasound.com'}`;
      const formUrl = `${baseUrl}/cme-disclosure/${existingForFaculty?.token || token}`;
      const now = new Date();
      if (existingForFaculty) {
        // Re-send: update sentAt
        await db.update(cmeFinancialDisclosures)
          .set({ sentAt: now, status: 'sent', updatedAt: now })
          .where(eq(cmeFinancialDisclosures.id, existingForFaculty.id));
      } else {
        // New disclosure request
        await db.insert(cmeFinancialDisclosures).values({
          courseId: input.courseId,
          token,
          facultyName: input.facultyName,
          facultyEmail: input.facultyEmail,
          courseTitle: course?.title || '',
          educationDate: cmeForm?.proposedDate || '',
          sentAt: now,
          status: 'sent',
          createdBy: ctx.user.id,
        });
      }
      // Send email to faculty — only mark as sent if email delivery succeeds
      const disclosureFormUrl = existingForFaculty ? `${baseUrl}/cme-disclosure/${existingForFaculty.token}` : formUrl;
      const emailSent = await sendEmail({
        to: { name: input.facultyName, email: input.facultyEmail },
        subject: `Financial Disclosure Form — ${course?.title || 'CME Activity'}`,
        htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#189aa1;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:20px;">Disclosure of Financial Relationships</h2>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <p>Dear ${input.facultyName},</p>
            <p>As a faculty member or planner for <strong>${course?.title || 'this CME activity'}</strong>, you are required to complete a Financial Disclosure form in accordance with ACCME Standards for Integrity and Independence.</p>
            <p>Please click the button below to complete your disclosure electronically. This should take less than 5 minutes.</p>
            <p style="margin:24px 0;text-align:center;">
              <a href="${disclosureFormUrl}" style="background:#189aa1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Complete Financial Disclosure</a>
            </p>
            <p style="color:#6b7280;font-size:13px;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${disclosureFormUrl}" style="color:#189aa1;">${disclosureFormUrl}</a></p>
            <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;margin-top:20px;padding-top:16px;">Questions? Contact <a href="mailto:don@cardioserv.net" style="color:#189aa1;">don@cardioserv.net</a> or <a href="mailto:j.buckland@cardioserv.net" style="color:#189aa1;">j.buckland@cardioserv.net</a></p>
          </div>
        </div>`,
      });
      if (!emailSent) {
        // Roll back status to pending if email failed
        const targetId = existingForFaculty?.id;
        if (targetId) {
          await db.update(cmeFinancialDisclosures)
            .set({ status: 'pending', sentAt: null, updatedAt: new Date() })
            .where(eq(cmeFinancialDisclosures.id, targetId));
        } else {
          // Delete the newly inserted record
          await db.delete(cmeFinancialDisclosures)
            .where(eq(cmeFinancialDisclosures.token, token));
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Email delivery failed. Please check SendGrid configuration and try again.' });
      }
      return { success: true, token: existingForFaculty?.token || token };
    }),

  // ── Financial Disclosure: Get status for a course ─────────────────────────
  getFinancialDisclosureStatus: protectedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { disclosures: [], linkedGeneric: [] };
      const { cmeGenericDisclosures } = await import("../../drizzle/schema");
      const [disclosures, linkedGeneric] = await Promise.all([
        db.select().from(cmeFinancialDisclosures)
          .where(eq(cmeFinancialDisclosures.courseId, input.courseId))
          .orderBy(cmeFinancialDisclosures.createdAt),
        db.select().from(cmeGenericDisclosures)
          .where(eq(cmeGenericDisclosures.linkedCourseId, input.courseId))
          .orderBy(cmeGenericDisclosures.submittedAt),
      ]);
      return { disclosures, linkedGeneric };
    }),

  // ── Financial Disclosure: Mark as received (internal tracking) ───────────
  markDisclosureReceived: protectedProcedure
    .input(z.object({
      disclosureId: z.number().int().positive(),
      receivedNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(cmeFinancialDisclosures)
        .set({ receivedAt: new Date(), receivedNotes: input.receivedNotes || null, updatedAt: new Date() })
        .where(eq(cmeFinancialDisclosures.id, input.disclosureId));
      return { success: true };
    }),

  // ── Download a submitted disclosure as PDF ──────────────────────────────
  downloadDisclosurePdf: protectedProcedure
    .input(z.object({ disclosureId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(cmeFinancialDisclosures)
        .where(eq(cmeFinancialDisclosures.id, input.disclosureId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Disclosure not found" });
      if (row.status !== "submitted") throw new TRPCError({ code: "BAD_REQUEST", message: "Disclosure has not been submitted yet" });

      const roles: string[] = (() => { try { return JSON.parse(row.rolesJson ?? "[]"); } catch { return []; } })();
      const relationships: Array<{ company: string; relationship: string; ended: boolean }> = (() => {
        try {
          const raw: Array<{ company: string; type?: string; relationship?: string; ended: boolean }> = JSON.parse(row.relationshipsJson ?? "[]");
          return raw.map(r => ({ company: r.company, relationship: r.type ?? r.relationship ?? "", ended: r.ended }));
        } catch { return []; }
      })();

      const pdfBuffer = await generateDisclosurePdf({
        facultyName: row.facultyName,
        facultyEmail: row.facultyEmail,
        courseTitle: row.courseTitle ?? "Unknown Course",
        roles,
        hasRelationships: (row.noRelationships === 1 || relationships.length === 0) ? "no" : "yes",
        relationships,
        attestationName: row.attestationName ?? "",
        attestationDate: row.attestationDate ?? "",
        submittedAt: row.submittedAt ?? new Date(),
      });

      const safeName = row.facultyName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const key = `cme-disclosures/${safeName}-${row.id}-${Date.now()}.pdf`;
      const { url } = await storagePut(key, pdfBuffer, "application/pdf");
      return { url };
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

  // ── Download PDF for a generic (non-course-linked) disclosure ────────────────────
  downloadGenericDisclosurePdf: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { cmeGenericDisclosures } = await import("../../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const [row] = await db
        .select()
        .from(cmeGenericDisclosures)
        .where(eqOp(cmeGenericDisclosures.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Generic disclosure not found" });

      const roles: string[] = (() => { try { return JSON.parse(row.rolesJson ?? "[]"); } catch { return []; } })();
      const relationships: Array<{ company: string; relationship: string; ended: boolean }> = (() => {
        try {
          const raw: Array<{ company: string; type?: string; relationship?: string; nature?: string; ended: boolean }> = JSON.parse(row.relationshipsJson ?? "[]");
          return raw.map(r => ({ company: r.company, relationship: r.type ?? r.relationship ?? r.nature ?? "", ended: r.ended }));
        } catch { return []; }
      })();

      const pdfBuffer = await generateDisclosurePdf({
        facultyName: row.facultyName,
        facultyEmail: row.facultyEmail,
        courseTitle: row.activityTitle ?? "Generic Submission",
        roles,
        hasRelationships: row.noRelationships ? "no" : "yes",
        relationships,
        attestationName: row.attestationName ?? "",
        attestationDate: row.attestationDate ?? "",
        submittedAt: row.submittedAt ? new Date(row.submittedAt) : new Date(),
      });

      const safeName = row.facultyName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const key = `cme-generic-disclosures/${safeName}-${row.id}-${Date.now()}.pdf`;
      const { url } = await storagePut(key, pdfBuffer, "application/pdf");
      return { url };
    }),

  listGenericDisclosures: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      relationships: z.enum(["all", "none", "disclosed"]).optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      limit: z.number().int().min(1).max(500).optional().default(200),
      offset: z.number().int().min(0).optional().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { rows: [] };
      const { cmeGenericDisclosures } = await import("../../drizzle/schema").then(m => m);
      const { desc: descOrd, like, or, eq: eqOp, and: andOp, ne, gte, lte } = await import("drizzle-orm");
      const searchTerm = input?.search?.trim();
      const conditions = [];
      if (searchTerm) {
        conditions.push(or(
          like(cmeGenericDisclosures.facultyName, `%${searchTerm}%`),
          like(cmeGenericDisclosures.facultyEmail, `%${searchTerm}%`),
          like(cmeGenericDisclosures.activityTitle, `%${searchTerm}%`),
        ));
      }
      if (input?.relationships === "none") {
        conditions.push(eqOp(cmeGenericDisclosures.noRelationships, 1));
      } else if (input?.relationships === "disclosed") {
        conditions.push(eqOp(cmeGenericDisclosures.noRelationships, 0));
      }
      if (input?.dateFrom) {
        conditions.push(gte(cmeGenericDisclosures.submittedAt, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        conditions.push(lte(cmeGenericDisclosures.submittedAt, new Date(input.dateTo)));
      }
      const whereClause = conditions.length > 0 ? andOp(...conditions) : undefined;
      const rows = await db
        .select()
        .from(cmeGenericDisclosures)
        .where(whereClause as any)
        .orderBy(descOrd(cmeGenericDisclosures.submittedAt))
        .limit(input?.limit ?? 200)
        .offset(input?.offset ?? 0);
      return { rows };
    }),

  // ── Link a generic disclosure to a specific course ─────────────────────────────────
  linkGenericDisclosureToCourse: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      courseId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { cmeGenericDisclosures } = await import("../../drizzle/schema");
      const { eq: eqOp, set } = await import("drizzle-orm");
      await db
        .update(cmeGenericDisclosures)
        .set({ linkedCourseId: input.courseId })
        .where(eqOp(cmeGenericDisclosures.id, input.id));
      return { success: true };
    }),

  // ── Unlink a generic disclosure from its course ─────────────────────────────────
  unlinkGenericDisclosure: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { cmeGenericDisclosures } = await import("../../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      await db
        .update(cmeGenericDisclosures)
        .set({ linkedCourseId: null })
        .where(eqOp(cmeGenericDisclosures.id, input.id));
      return { success: true };
    }),

  // ── Bulk mark course-linked disclosures as received ────────────────────────────────
  bulkMarkDisclosuresReceived: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { inArray } = await import("drizzle-orm");
      await db
        .update(cmeFinancialDisclosures)
        .set({ status: "received", receivedAt: new Date(), receivedNotes: "Marked received in bulk via CME Management Hub" })
        .where(inArray(cmeFinancialDisclosures.id, input.ids));
      return { updated: input.ids.length };
    }),

  // ── List ALL course-linked disclosures for CME Management Hub ───────────────────
  listAllCourseDisclosures: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["all", "sent", "submitted", "received"]).optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) return { rows: [] };
      const { or, like, eq: eqOp, desc: descOp, gte, lte, and: andOp } = await import("drizzle-orm");
      let query = db
        .select({
          id: cmeFinancialDisclosures.id,
          courseId: cmeFinancialDisclosures.courseId,
          courseTitle: cmeFinancialDisclosures.courseTitle,
          facultyName: cmeFinancialDisclosures.facultyName,
          facultyEmail: cmeFinancialDisclosures.facultyEmail,
          status: cmeFinancialDisclosures.status,
          submittedAt: cmeFinancialDisclosures.submittedAt,
          receivedAt: cmeFinancialDisclosures.receivedAt,
          createdAt: cmeFinancialDisclosures.createdAt,
          attestationName: cmeFinancialDisclosures.attestationName,
          noRelationships: cmeFinancialDisclosures.noRelationships,
          rolesJson: cmeFinancialDisclosures.rolesJson,
          relationshipsJson: cmeFinancialDisclosures.relationshipsJson,
        })
        .from(cmeFinancialDisclosures)
        .$dynamic();

      const conditions = [];
      if (input?.search) {
        const s = `%${input.search}%`;
        conditions.push(or(
          like(cmeFinancialDisclosures.facultyName, s),
          like(cmeFinancialDisclosures.facultyEmail, s),
          like(cmeFinancialDisclosures.courseTitle, s),
        ));
      }
      if (input?.status && input.status !== "all") {
        conditions.push(eqOp(cmeFinancialDisclosures.status, input.status));
      }
      if (input?.dateFrom) {
        conditions.push(gte(cmeFinancialDisclosures.createdAt, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        conditions.push(lte(cmeFinancialDisclosures.createdAt, new Date(input.dateTo)));
      }
      if (conditions.length > 0) {
        query = query.where(andOp(...conditions) as any);
      }
      const rows = await query.orderBy(descOp(cmeFinancialDisclosures.createdAt)).limit(500);
      return { rows };
    }),

  listDraftNotifyEntries: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      productType: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { desc: descOp2, like, and: andOp2, eq: eqOp2 } = await import("drizzle-orm");
      let query = db.select().from(draftNotifyEntries).$dynamic();
      const conditions: any[] = [];
      if (input?.search) {
        const s = `%${input.search}%`;
        const { or } = await import("drizzle-orm");
        conditions.push(or(like(draftNotifyEntries.name, s), like(draftNotifyEntries.email, s), like(draftNotifyEntries.productTitle, s)));
      }
      if (input?.productType) {
        conditions.push(eqOp2(draftNotifyEntries.productType, input.productType));
      }
      if (conditions.length > 0) {
        query = query.where(andOp2(...conditions) as any);
      }
      const rows = await query.orderBy(descOp2(draftNotifyEntries.createdAt)).limit(500);
      return { rows };
    }),
});
