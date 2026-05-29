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
} from "../../drizzle/schema";
import { getEnrollmentsForCourse, getThinkificCourse } from "../thinkific";
import { sendEmail, buildFreePreviewConfirmationEmail } from "../_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Shared helpers (used by all LMS sub-routers) ────────────────────────────

export async function assertAdmin(ctx: { user: { id: number; role: string } }) {
  if (ctx.user.role !== "admin") {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!u || u.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function uniqueSlug(db: Awaited<ReturnType<typeof getDb>>, base: string): Promise<string> {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  let slug = base;
  let attempt = 0;
  while (true) {
    const [existing] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

export async function recalcProgress(db: Awaited<ReturnType<typeof getDb>>, enrollmentId: number) {
  if (!db) return;
  const [enrollRow] = await db.select().from(lmsEnrollments).where(eq(lmsEnrollments.id, enrollmentId)).limit(1);
  if (!enrollRow) return;
  const courseId = enrollRow.courseId;

  // Get all section IDs for this course
  const courseSections = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.courseId, courseId));
  const sectionIds = courseSections.map(s => s.id);

  // Count lessons that count toward progress — exclude free-preview lessons hidden after purchase
  // (previewMode = 'preview_hide_after_purchase' are not visible to enrolled students so must not count)
  let totalCount = 0;
  const excludeHiddenPreview = sql`${lmsLessons.previewMode} != 'preview_hide_after_purchase' OR ${lmsLessons.previewMode} IS NULL`;
  if (sectionIds.length > 0) {
    const [totalRows] = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
      and(
        sql`(${lmsLessons.courseId} = ${courseId} OR ${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)}))`,
        excludeHiddenPreview
      )
    );
    totalCount = Number(totalRows?.count ?? 0);
  } else {
    const [totalRows] = await db.select({ count: sql<number>`count(*)` }).from(lmsLessons).where(
      and(eq(lmsLessons.courseId, courseId), excludeHiddenPreview)
    );
    totalCount = Number(totalRows?.count ?? 0);
  }
  const total = totalCount;
  if (total === 0) return;

  // Count completed lessons — also exclude hidden preview lessons from the completed count
  // so that any stale progress records for those lessons don't inflate the percentage
  const countableIds = await db
    .select({ id: lmsLessons.id })
    .from(lmsLessons)
    .where(
      sectionIds.length > 0
        ? and(
            sql`(${lmsLessons.courseId} = ${courseId} OR ${lmsLessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)}))`,
            excludeHiddenPreview
          )
        : and(eq(lmsLessons.courseId, courseId), excludeHiddenPreview)
    );
  const countableIdSet = countableIds.map(r => r.id);
  const completedRows = countableIdSet.length > 0
    ? await db.select({ count: sql<number>`count(*)` }).from(lmsLessonProgress).where(
        and(
          eq(lmsLessonProgress.enrollmentId, enrollmentId),
          isNotNull(lmsLessonProgress.completedAt),
          inArray(lmsLessonProgress.lessonId, countableIdSet)
        )
      )
    : [{ count: 0 }];
  const completed = Number(completedRows[0]?.count ?? 0);
  const pct = Math.round((completed / total) * 100);
  const wasCompleted = !!enrollRow.completedAt;

  await db.update(lmsEnrollments).set({
    progressPct: pct,
    completedAt: pct >= 100 ? new Date() : null,
  }).where(eq(lmsEnrollments.id, enrollmentId));

  // Issue certificate if newly completed and course has hasCertificate enabled
  if (pct >= 100 && !wasCompleted) {
    void issueCertificateIfEnabled(db, enrollmentId, enrollRow.userId, courseId).catch(e =>
      console.error("[certificate] Failed to issue certificate:", e)
    );
  }
}

export async function issueCertificateIfEnabled(
  db: Awaited<ReturnType<typeof getDb>>,
  enrollmentId: number,
  userId: number,
  courseId: number
) {
  if (!db) return;
  // Check course has certificate enabled
  const [course] = await db.select({ hasCertificate: lmsCourses.hasCertificate, title: lmsCourses.title, certificateTemplateId: lmsCourses.certificateTemplateId }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  if (!course?.hasCertificate) return;

  // Check if certificate already issued
  const [existing] = await db.select({ id: lmsCertificates.id }).from(lmsCertificates)
    .where(and(eq(lmsCertificates.userId, userId), eq(lmsCertificates.courseId, courseId))).limit(1);
  if (existing) return;

  // Get user info
  const [user] = await db.select({ name: users.name, email: users.email, displayName: users.displayName, credentials: users.credentials }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email) return;

  const learnerName = user.displayName || user.name || "Learner";
  const issuedAt = new Date();

  // Fetch certificate template if assigned
  let template: any = null;
  if (course.certificateTemplateId) {
    const [tmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.id, course.certificateTemplateId)).limit(1);
    template = tmpl ?? null;
  }
  if (!template) {
    // Fall back to default template
    const [defaultTmpl] = await db.select().from(lmsCertificateTemplates).where(eq(lmsCertificateTemplates.isDefault, true)).limit(1);
    template = defaultTmpl ?? null;
  }

  // Generate PDF
  const pdfBuffer = await generateCertificatePdf({
    learnerName,
    courseTitle: course.title,
    issuedAt,
    credentials: user.credentials,
    template,
  });

  // Upload PDF to S3
  const suffix = randomBytes(6).toString("hex");
  const fileKey = `certificates/cert-${userId}-${courseId}-${suffix}.pdf`;
  const { url: certificateUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

  // Save certificate record
  await db.insert(lmsCertificates).values({
    userId,
    courseId,
    enrollmentId,
    certificateUrl,
    templateId: template?.id ?? null,
    issuedAt,
  });

  // Send email
  await sendCertificateEmail({
    to: { name: learnerName, email: user.email },
    courseTitle: course.title,
    certificateUrl,
    pdfBuffer,
    issuedAt,
  });

  console.log(`[certificate] Issued certificate for user ${userId}, course ${courseId}`);
}

// ─── Public Router ────────────────────────────────────────────────────────────
