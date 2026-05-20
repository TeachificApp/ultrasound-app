/**
 * Thinkific Course Importer Router
 *
 * Allows admins to:
 * 1. List all Thinkific courses
 * 2. Preview a course structure before import
 * 3. Run the import (creates draft course + sections + lessons + pending enrollments)
 * 4. Check import status
 * 5. Activate pending enrollments when a course is published
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsLandingPages,
  lmsThinkificImports,
  lmsPendingEnrollments,
  lmsEnrollments,
  users,
  type LmsPendingEnrollment,
} from "../../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  getAllThinkificCourses,
  getThinkificCourse,
  getChaptersForCourse,
  getContentsForChapter,
  getEnrollmentsForCourse,
  getThinkificInstructor,
  type ThinkificChapter,
  type ThinkificContent,
} from "../thinkific";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminOnly(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
}

/** Convert Thinkific content type to LMS lesson type */
function mapContentType(contentableType: string): "video" | "text" | "quiz" | "download" | "embed" {
  switch (contentableType.toLowerCase()) {
    case "video":
      return "video";
    case "quiz":
    case "exam":
    case "survey":
      return "quiz";
    case "download":
    case "attachment":
      return "download";
    case "presentation":
    case "audio":
      return "embed";
    default:
      return "text";
  }
}

/** Generate a URL-safe slug from a course name, with collision suffix */
function makeSlug(name: string, suffix?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return suffix ? `${base}-${suffix}` : base;
}

/** Strip HTML tags from a string */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Build a default Hero banner content block from a lesson title */
function buildHeroBannerBlock(title: string): object {
  return {
    id: `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "hero",
    data: {
      headline: title,
      headline2: "",
      subheadline: "",
      bgType: "color",
      bgColor: "#149096",
      textColor: "#ffffff",
      align: "left",
      buttons: [],
      showButtons: false,
    },
  };
}

// ─── Scrape Thinkific sales page ──────────────────────────────────────────────

/** Generate a unique block ID */
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A properly-structured landing page block: { id, type, data: { ... } } */
interface LandingBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

async function scrapeThinkificSalesPage(slug: string, subdomain: string): Promise<LandingBlock[]> {
  const url = `https://${subdomain}.thinkific.com/courses/${slug}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CourseImporter/1.0)",
        Accept: "text/html",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const blocks: LandingBlock[] = [];

    // ── 1. Hero block from page <h1> ──
    const titleMatch = html.match(/<h1[^>]*class="[^"]*course-hero[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) {
      const headline = stripHtml(titleMatch[1]);
      if (headline) {
        // Try to grab a subtitle from the first <h2> or .course-subtitle element
        const subMatch = html.match(/<[^>]*class="[^"]*(?:course-subtitle|hero-subtitle|tagline)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
          || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        const subheadline = subMatch ? stripHtml(subMatch[1]).slice(0, 200) : "";
        blocks.push({
          id: uid(),
          type: "hero",
          data: {
            headline,
            headline2: "",
            subheadline,
            bgType: "color",
            bgColor: "#149096",
            textColor: "#ffffff",
            align: "center",
            buttons: [{ text: "Enroll Now", color: "#ffffff", textColor: "#149096", link: "", style: "filled" }],
            showButtons: true,
          },
        });
      }
    }

    // ── 2. Description / body text block ──
    const descMatches = html.matchAll(/<div[^>]*class="[^"]*course-description[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    for (const match of descMatches) {
      const text = stripHtml(match[1]);
      if (text && text.length > 30) {
        blocks.push({
          id: uid(),
          type: "text",
          data: {
            html: `<p>${text}</p>`,
            align: "left",
            bgColor: "#ffffff",
            textColor: "#1a1a1a",
          },
        });
        break;
      }
    }

    // ── 3. "What you'll learn" bullet list ──
    const learnMatches = html.matchAll(/<ul[^>]*class="[^"]*(?:course-curriculum|what-you|learn)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi);
    for (const match of learnMatches) {
      const items: string[] = [];
      const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      for (const li of liMatches) {
        const text = stripHtml(li[1]);
        if (text) items.push(text);
      }
      if (items.length > 0) {
        blocks.push({
          id: uid(),
          type: "bullets",
          data: {
            headline: "What You'll Learn",
            items,
            iconColor: "#149096",
            bgColor: "#f8fffe",
          },
        });
        break;
      }
    }

    // ── 4. FAQ accordion ──
    const faqItems: { q: string; a: string }[] = [];
    const faqMatches = html.matchAll(/<div[^>]*class="[^"]*(?:faq|accordion)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    for (const match of faqMatches) {
      const qMatch = match[1].match(/<[^>]*class="[^"]*(?:question|title|heading)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
      const aMatch = match[1].match(/<[^>]*class="[^"]*(?:answer|body|content)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
      if (qMatch && aMatch) {
        faqItems.push({ q: stripHtml(qMatch[1]), a: stripHtml(aMatch[1]) });
      }
    }
    if (faqItems.length > 0) {
      blocks.push({
        id: uid(),
        type: "faq",
        data: {
          headline: "Frequently Asked Questions",
          items: faqItems,
          bgColor: "#ffffff",
          accentColor: "#149096",
        },
      });
    }

    // ── 5. Always append a curriculum_auto block at the end ──
    blocks.push({
      id: uid(),
      type: "curriculum_auto",
      data: {
        headline: "Course Curriculum",
        headlineColor: "#111827",
        bgColor: "#ffffff",
        showLocked: true,
        sectionBgColor: "#f9fafb",
        sectionTextColor: "#1f2937",
        sectionBorderColor: "#e5e7eb",
        lessonTextColor: "#374151",
        lessonLockedIconColor: "#d1d5db",
        lessonPreviewIconColor: "#14b8a6",
        lessonCountColor: "#9ca3af",
        iconStyle: "lock",
        cornerRadius: 12,
      },
    });

    return blocks;
  } catch {
    return [];
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const thinkificImportRouter = router({
  /** List all courses from Thinkific (for the course picker) */
  listCourses: protectedProcedure.query(async ({ ctx }) => {
    adminOnly(ctx.user.role);
    const courses = await getAllThinkificCourses();
    return courses.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      subtitle: c.subtitle,
      status: c.status,
      cardImageUrl: c.card_image_url,
      createdAt: c.created_at,
    }));
  }),

  /** Preview a course structure before importing */
  previewImport: protectedProcedure
    .input(z.object({ thinkificCourseId: z.number() }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const course = await getThinkificCourse(input.thinkificCourseId);
      const chapters = await getChaptersForCourse(input.thinkificCourseId);

      // Fetch contents for each chapter (parallel, up to 10 at a time)
      const chapterContents: { chapter: ThinkificChapter; contents: ThinkificContent[] }[] = [];
      for (const chapter of chapters) {
        const contents = await getContentsForChapter(chapter.id);
        chapterContents.push({ chapter, contents });
      }

      const totalLessons = chapterContents.reduce((sum, c) => sum + c.contents.length, 0);

      // Count only paid, active enrollments — exclude expired and free trials
      const allEnrollments = await getEnrollmentsForCourse(input.thinkificCourseId);
      const enrollments = allEnrollments.filter((e) => !e.expired && !e.is_free_trial);

      return {
        course: {
          id: course.id,
          name: course.name,
          slug: course.slug,
          subtitle: course.subtitle,
          description: course.description,
          cardImageUrl: course.card_image_url,
          status: course.status,
        },
        sections: chapterContents.map(({ chapter, contents }) => ({
          id: chapter.id,
          name: chapter.name,
          position: chapter.position,
          lessonCount: contents.length,
          lessons: contents.map((c) => ({
            id: c.id,
            name: c.name,
            type: mapContentType(c.contentable_type),
            contentableType: c.contentable_type,
            position: c.position,
            isFreePreview: c.free_preview,
            durationSeconds: c.duration_in_seconds,
          })),
        })),
        totalSections: chapters.length,
        totalLessons,
        totalEnrollments: enrollments.length,
      };
    }),

  /** Run the full import: create draft course + sections + lessons + pending enrollments */
  runImport: protectedProcedure
    .input(z.object({
      thinkificCourseId: z.number(),
      importEnrollments: z.boolean().default(true),
      scrapeSalesPage: z.boolean().default(true),
      subdomain: z.string().optional(), // override subdomain for sales page scraping
      courseType: z.enum(["course", "quiz", "download"]).default("course"), // content type to assign on import
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Create import record
      const [importRecord] = await db.insert(lmsThinkificImports).values({
        thinkificCourseId: input.thinkificCourseId,
        thinkificCourseName: "Importing...",
        status: "running",
        importedByUserId: ctx.user.id,
      });
      const importId = (importRecord as unknown as { insertId: number }).insertId;

      const log: string[] = [];

      try {
        // 1. Fetch course details
        const course = await getThinkificCourse(input.thinkificCourseId);
        log.push(`Fetched course: ${course.name}`);

        // Update import record with course name
        await db.update(lmsThinkificImports)
          .set({ thinkificCourseName: course.name, thinkificSlug: course.slug })
          .where(eq(lmsThinkificImports.id, importId));

        // 2. Generate unique slug
        let slug = makeSlug(course.name);
        const existing = await db.select({ id: lmsCourses.id })
          .from(lmsCourses)
          .where(eq(lmsCourses.slug, slug));
        if (existing.length > 0) {
          slug = makeSlug(course.name, `thinkific-${input.thinkificCourseId}`);
        }

        // 3. Scrape sales page if requested
        let salesPageBlocks: LandingBlock[] = [];
        if (input.scrapeSalesPage) {
          const subdomain = input.subdomain || "member";
          salesPageBlocks = await scrapeThinkificSalesPage(course.slug, subdomain);
          log.push(`Scraped sales page: ${salesPageBlocks.length} blocks`);
        }

        // 4. Fetch instructor info
        let instructorBio = "";
        if (course.instructor_id) {
          const instructor = await getThinkificInstructor(course.instructor_id);
          if (instructor) {
            instructorBio = instructor.bio || "";
            log.push(`Fetched instructor: ${instructor.full_name}`);
          }
        }

        // 5. Create the LMS course (draft)
        const priceFromCourse = 0; // will be set manually after import
        const [courseResult] = await db.insert(lmsCourses).values({
          slug,
          title: course.name,
          subtitle: course.subtitle || undefined,
          description: course.description ? stripHtml(course.description) : undefined,
          coverImageUrl: course.card_image_url || undefined,
          status: "draft",
          type: input.courseType,
          brand: "aaus",
          price: priceFromCourse,
          isFree: false,
          pricingType: "one_time",
          hasCertificate: course.certificate_enabled,
          showInstructor: !!instructorBio,
          createdByUserId: ctx.user.id,
        });
        const lmsCourseId = (courseResult as unknown as { insertId: number }).insertId;
        log.push(`Created LMS course ID: ${lmsCourseId} (draft)`);
        // 5b. Create landing page record with scraped blocks (so the page builder is pre-populated)
        if (salesPageBlocks.length > 0) {
          await db.insert(lmsLandingPages).values({
            courseId: lmsCourseId,
            heroTitle: course.name,
            heroSubtitle: course.subtitle || undefined,
            heroImageUrl: course.card_image_url || undefined,
            ctaText: "Enroll Now",
            isCustom: true,
            blocks: JSON.stringify(salesPageBlocks),
          });
          log.push(`Created landing page with ${salesPageBlocks.length} pre-built blocks`);
        }

        // 6. Fetch chapters and contents
        const chapters = await getChaptersForCourse(input.thinkificCourseId);
        log.push(`Found ${chapters.length} chapters`);

        let totalLessons = 0;

        for (const chapter of chapters) {
          // Create section
          const [sectionResult] = await db.insert(lmsSections).values({
            courseId: lmsCourseId,
            title: chapter.name,
            position: chapter.position,
            isPreview: chapter.free_preview,
          });
          const sectionId = (sectionResult as unknown as { insertId: number }).insertId;

          // Fetch and create lessons
          const contents = await getContentsForChapter(chapter.id);
          for (const content of contents) {
            const lessonType = mapContentType(content.contentable_type);
            const durationMinutes = content.duration_in_seconds
              ? Math.ceil(content.duration_in_seconds / 60)
              : undefined;

            // Build default hero banner block for the lesson
            const heroBannerBlock = buildHeroBannerBlock(content.name);
            const contentBlocks = JSON.stringify([heroBannerBlock]);

            await db.insert(lmsLessons).values({
              courseId: lmsCourseId,
              sectionId,
              title: content.name,
              type: lessonType,
              embedUrl: content.video_url || content.take_url || undefined,
              content: content.html_description ? stripHtml(content.html_description) : undefined,
              position: content.position,
              isPreview: content.free_preview,
              durationMinutes,
              contentBlocks,
            });
            totalLessons++;
          }
          log.push(`Imported section "${chapter.name}" with ${contents.length} lessons`);
        }

        // 7. Import enrollments directly into lms_enrollments (no welcome emails)
        let enrolledCount = 0;
        if (input.importEnrollments) {
          const allEnrollments = await getEnrollmentsForCourse(input.thinkificCourseId);
          // Only import paid, active enrollments — exclude expired and free trials
          const enrollments = allEnrollments.filter((e) => !e.expired && !e.is_free_trial);
          const skippedExpired = allEnrollments.filter((e) => e.expired).length;
          const skippedTrial = allEnrollments.filter((e) => !e.expired && e.is_free_trial).length;
          log.push(`Found ${enrollments.length} paid active enrollments to import (${skippedExpired} expired + ${skippedTrial} free trials skipped)`);
          const BATCH = 50;
          for (let i = 0; i < enrollments.length; i += BATCH) {
            const batch = enrollments.slice(i, i + BATCH);
            const emails = batch.map((e) => e.user_email.toLowerCase());
            // Find existing LMS users by email
            const matchedUsers = await db.select({ id: users.id, email: users.email })
              .from(users)
              .where(inArray(users.email, emails));
            const emailToUserId = new Map(
              matchedUsers.map((u: { id: number; email: string | null }) => [
                (u.email ?? "").toLowerCase(),
                u.id,
              ])
            );
            for (const e of batch) {
              const email = e.user_email.toLowerCase();
              let userId = emailToUserId.get(email);
              // Create a real account if not found — no email/notification sent
              if (!userId) {
                const displayName = e.user_name || email.split("@")[0];
                const [newUser] = await db.insert(users).values({
                  email,
                  name: displayName,
                  displayName,
                  isPending: false,
                  loginMethod: "email",
                  emailVerified: false,
                });
                userId = (newUser as any).insertId as number;
                emailToUserId.set(email, userId);
              }
              // Check if already enrolled (idempotent)
              const [existing] = await db.select({ id: lmsEnrollments.id })
                .from(lmsEnrollments)
                .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, lmsCourseId)))
                .limit(1);
              if (existing) continue;
              const progressPct = Math.round(parseFloat(e.percentage_completed || "0") * 100);
              await db.insert(lmsEnrollments).values({
                userId,
                courseId: lmsCourseId,
                enrolledAt: e.created_at ? new Date(e.created_at) : new Date(),
                completedAt: e.completed && e.completed_at ? new Date(e.completed_at) : null,
                progressPct,
              });
              enrolledCount++;
            }
          }
          log.push(`Enrolled ${enrolledCount} students (no welcome emails sent)`);
        }
        // 8. Update import record as complete
        await db.update(lmsThinkificImports).set({
          lmsCourseId,
          status: "complete",
          sectionsImported: chapters.length,
          lessonsImported: totalLessons,
          enrollmentsPending: 0,
          enrollmentsActivated: enrolledCount,
          importLog: log.join("\n"),
        }).where(eq(lmsThinkificImports.id, importId));
        return {
          success: true,
          importId,
          lmsCourseId,
          sectionsImported: chapters.length,
          lessonsImported: totalLessons,
          enrollmentsPending: 0,
          enrolledCount,
          log,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.push(`ERROR: ${errorMessage}`);
        await db.update(lmsThinkificImports).set({
          status: "failed",
          errorMessage,
          importLog: log.join("\n"),
        }).where(eq(lmsThinkificImports.id, importId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Import failed: ${errorMessage}` });
      }
    }),

  /** Get import status and log */
  getImportStatus: protectedProcedure
    .input(z.object({ importId: z.number() }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [record] = await db.select()
        .from(lmsThinkificImports)
        .where(eq(lmsThinkificImports.id, input.importId));
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      return record;
    }),

  /** List all past imports — enriched with real enrollment count from lms_enrollments */
  listImports: protectedProcedure.query(async ({ ctx }) => {
    adminOnly(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const imports = await db.select().from(lmsThinkificImports).orderBy(lmsThinkificImports.createdAt);
    // Fetch real enrollment counts from lms_enrollments for each linked course
    const courseIds = imports.map(i => i.lmsCourseId).filter(Boolean) as number[];
    const enrollmentCounts: Record<number, number> = {};
    if (courseIds.length > 0) {
      const counts = await db
        .select({ courseId: lmsEnrollments.courseId, count: sql<number>`count(*)` })
        .from(lmsEnrollments)
        .where(inArray(lmsEnrollments.courseId, courseIds))
        .groupBy(lmsEnrollments.courseId);
      for (const row of counts) {
        enrollmentCounts[row.courseId] = Number(row.count);
      }
    }
    return imports.map(imp => ({
      ...imp,
      // Real synced enrollment count (replaces stale enrollmentsPending / enrollmentsActivated)
      realEnrollmentCount: imp.lmsCourseId ? (enrollmentCounts[imp.lmsCourseId] ?? 0) : 0,
    }));
  }),

  /** Activate pending enrollments for a course (called when course is published) */
  activatePendingEnrollments: protectedProcedure
    .input(z.object({ lmsCourseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const pending = await db.select()
        .from(lmsPendingEnrollments)
        .where(and(
          eq(lmsPendingEnrollments.lmsCourseId, input.lmsCourseId),
          eq(lmsPendingEnrollments.status, "pending")
        ));

      let activated = 0;
      let skipped = 0;

      for (const pe of pending) {
        let lmsUserId = pe.lmsUserId;

        // Try to find user by email if not already matched
        if (!lmsUserId) {
          const [user] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.email, pe.thinkificEmail));
          if (user) lmsUserId = user.id;
        }

        if (!lmsUserId) {
          // No matching user — mark as skipped
          await db.update(lmsPendingEnrollments)
            .set({ status: "skipped" })
            .where(eq(lmsPendingEnrollments.id, pe.id));
          skipped++;
          continue;
        }

        // Check if already enrolled
        const [existing] = await db.select({ id: lmsEnrollments.id })
          .from(lmsEnrollments)
          .where(and(
            eq(lmsEnrollments.userId, lmsUserId),
            eq(lmsEnrollments.courseId, input.lmsCourseId)
          ));

        if (!existing) {
          await db.insert(lmsEnrollments).values({
            userId: lmsUserId,
            courseId: input.lmsCourseId,
            enrolledAt: pe.thinkificEnrolledAt || new Date(),
            progressPct: pe.thinkificProgressPct || 0,
          });
        }

        await db.update(lmsPendingEnrollments)
          .set({ status: "activated", lmsUserId, activatedAt: new Date() })
          .where(eq(lmsPendingEnrollments.id, pe.id));

        activated++;
      }

      // Update import record enrollment counts
      await db.update(lmsThinkificImports)
        .set({ enrollmentsActivated: activated })
        .where(eq(lmsThinkificImports.lmsCourseId, input.lmsCourseId));

      return { activated, skipped, total: pending.length };
    }),

  /** Get pending enrollment summary for a course */
  getPendingEnrollments: protectedProcedure
    .input(z.object({ lmsCourseId: z.number() }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const pending = await db.select()
        .from(lmsPendingEnrollments)
        .where(and(
          eq(lmsPendingEnrollments.lmsCourseId, input.lmsCourseId),
          eq(lmsPendingEnrollments.status, "pending")
        ));
      return {
        total: pending.length,
        matched: pending.filter((p: LmsPendingEnrollment) => p.lmsUserId !== null).length,
        unmatched: pending.filter((p: LmsPendingEnrollment) => p.lmsUserId === null).length,
        emails: pending.map((p: LmsPendingEnrollment) => ({
          email: p.thinkificEmail,
          name: p.thinkificName,
          matched: p.lmsUserId !== null,
          progressPct: p.thinkificProgressPct,
        })),
      };
    }),
});
