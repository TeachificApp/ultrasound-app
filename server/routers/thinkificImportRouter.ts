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
  getContentDetail,
  getEnrollmentsForCourse,
  getThinkificInstructor,
  type ThinkificChapter,
  type ThinkificContent,
  type ThinkificContentDetail,
} from "../thinkific";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminOnly(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
}

/**
 * Convert Thinkific content type to LMS lesson type.
 * The API returns types like: HtmlItem, Iframe, Video, Quiz, Pdf, Download, Audio, Presentation, Survey, Exam
 * Additionally, we can infer type from the take_url path segments:
 *   /multimedia/ → video/embed, /texts/ → text, /quizzes/ → quiz, /downloads/ → download
 */
function mapContentType(contentableType: string, takeUrl?: string | null): "video" | "text" | "quiz" | "download" | "embed" | "video_text" {
  const type = contentableType.toLowerCase();

  // First try to infer from take_url path (more reliable)
  if (takeUrl) {
    if (takeUrl.includes("/multimedia/")) return "embed";
    if (takeUrl.includes("/texts/")) return "text";
    if (takeUrl.includes("/quizzes/")) return "quiz";
    if (takeUrl.includes("/downloads/") || takeUrl.includes("/pdfs/")) return "download";
    if (takeUrl.includes("/surveys/")) return "quiz";
    if (takeUrl.includes("/lessons/")) return "video";
  }

  // Fallback to contentable_type
  switch (type) {
    case "video":
      return "video";
    case "iframe":
      return "embed";
    case "htmlitem":
    case "html_item":
    case "text":
      return "text";
    case "quiz":
    case "exam":
    case "survey":
      return "quiz";
    case "download":
    case "attachment":
    case "pdf":
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
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

/** Generate a unique block ID */
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A properly-structured landing page block */
interface LandingBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

// ─── Scrape Thinkific sales page ──────────────────────────────────────────────

/**
 * Scrapes the Thinkific sales/landing page for a course.
 * The page is rendered at: https://{subdomain}.thinkific.com/courses/{slug}
 * which redirects to: https://member.allaboutultrasound.com/courses/{slug}
 *
 * Extracts: title, description, pricing, curriculum, images, and FAQ.
 */
async function scrapeThinkificSalesPage(slug: string, customDomain: string): Promise<{ blocks: LandingBlock[]; price: number }> {
  // Try the public Thinkific subdomain first (no login required), then fall back to custom domain
  const { ENV } = await import("../_core/env");
  const thinkificSubdomain = ENV.thinkificSubdomain;
  const urlsToTry: string[] = [];
  if (thinkificSubdomain) {
    urlsToTry.push(`https://${thinkificSubdomain}.thinkific.com/courses/${slug}`);
  }
  // Only try custom domain if it's NOT a member portal (those require login)
  if (customDomain && !customDomain.startsWith("member.")) {
    urlsToTry.push(`https://${customDomain}/courses/${slug}`);
  }
  // Always try the generic Thinkific subdomain as last resort
  if (!thinkificSubdomain) {
    urlsToTry.push(`https://${customDomain}/courses/${slug}`);
  }

  let html = "";
  let price = 0;

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const text = await res.text();
      // Check if we got a real page (not a login redirect)
      if (text.includes("login") && text.includes("password") && !text.includes("course-landing")) {
        continue; // skip login pages
      }
      html = text;
      break;
    } catch {
      continue;
    }
  }

  if (!html) return { blocks: [], price: 0 };

  try {

    const bodyIdx = html.indexOf("<body");
    const body = bodyIdx > -1 ? html.slice(bodyIdx) : html;
    const blocks: LandingBlock[] = [];

    // ── 1. Extract course title from page ──
    // Thinkific pages have the course title in a heading with class containing "course" or in the banner
    let pageTitle = "";
    const titleMatch = body.match(/class="[^"]*(?:course-landing|banner)[^"]*__title[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i)
      || body.match(/class="[^"]*course[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
    if (titleMatch) {
      pageTitle = stripHtml(titleMatch[1]);
    }

    // ── 2. Extract description from card__description or course description divs ──
    let description = "";
    const descMatches = [...body.matchAll(/class="[^"]*(?:card__description|course-landing[^"]*description)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    for (const m of descMatches) {
      const text = stripHtml(m[1]);
      if (text && text.length > 20) {
        description = text;
        break;
      }
    }
    // Fallback: look for any description div
    if (!description) {
      const anyDesc = body.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (anyDesc) {
        const text = stripHtml(anyDesc[1]);
        if (text.length > 20) description = text;
      }
    }

    // ── 3. Extract pricing ──
    const priceMatches = [...body.matchAll(/\$(\d+(?:[.,]\d{2})?)/g)];
    if (priceMatches.length > 0) {
      // Take the first price found (usually the main course price)
      const priceStr = priceMatches[0][1].replace(",", "");
      price = Math.round(parseFloat(priceStr) * 100); // convert to cents
    }

    // ── 4. Extract images (course card image, banner image) ──
    let heroImage = "";
    const imgMatches = [...body.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)];
    for (const m of imgMatches) {
      const src = m[1];
      // Skip tiny icons and logos
      if (src.includes("thinkific") && src.includes("file_uploads") && !src.includes("logo") && !src.includes("icon")) {
        heroImage = src;
        break;
      }
    }

    // ── 5. Build hero block ──
    if (pageTitle || description) {
      blocks.push({
        id: uid(),
        type: "hero",
        data: {
          headline: pageTitle || "Course",
          headline2: "",
          subheadline: description.slice(0, 200),
          bgType: heroImage ? "image" : "color",
          bgColor: "#149096",
          bgImage: heroImage || "",
          textColor: "#ffffff",
          align: "center",
          buttons: [{ text: "Enroll Now", color: "#ffffff", textColor: "#149096", link: "", style: "filled" }],
          showButtons: true,
        },
      });
    }

    // ── 6. Description text block (if longer than hero subheadline) ──
    if (description && description.length > 200) {
      blocks.push({
        id: uid(),
        type: "text",
        data: {
          html: `<p>${description}</p>`,
          align: "left",
          bgColor: "#ffffff",
          textColor: "#1a1a1a",
        },
      });
    }

    // ── 7. Extract curriculum from the page (chapter names and lesson names) ──
    const chapterNames: string[] = [];
    const chapterHeadings = [...body.matchAll(/class="[^"]*chapter[^"]*(?:title|name|heading)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/gi)];
    for (const m of chapterHeadings) {
      const text = stripHtml(m[1]);
      if (text && text.length > 2 && text.length < 200) {
        chapterNames.push(text);
      }
    }

    // ── 8. Always append a curriculum_auto block ──
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

    // ── 9. FAQ section (if found) ──
    const faqItems: { q: string; a: string }[] = [];
    const faqMatches = [...body.matchAll(/class="[^"]*(?:faq|accordion)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/gi)];
    for (const match of faqMatches) {
      const qMatch = match[1].match(/<[^>]*class="[^"]*(?:question|title|heading|toggle)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
      const aMatch = match[1].match(/<[^>]*class="[^"]*(?:answer|body|content|panel)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
      if (qMatch && aMatch) {
        const q = stripHtml(qMatch[1]);
        const a = stripHtml(aMatch[1]);
        if (q && a) faqItems.push({ q, a });
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

    return { blocks, price };
  } catch {
    return { blocks: [], price: 0 };
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

      // Fetch contents for each chapter
      const chapterContents: { chapter: ThinkificChapter; contents: ThinkificContent[] }[] = [];
      for (const chapter of chapters) {
        const contents = await getContentsForChapter(chapter.id);
        chapterContents.push({ chapter, contents });
      }

      const totalLessons = chapterContents.reduce((sum, c) => sum + c.contents.length, 0);

      // Count only activated, non-expired enrollments
      const allEnrollments = await getEnrollmentsForCourse(input.thinkificCourseId);
      const enrollments = allEnrollments.filter((e) => !e.expired && e.activated_at !== null);

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
            type: mapContentType(c.contentable_type, c.take_url),
            contentableType: c.contentable_type,
            position: c.position,
            isFreePreview: c.free ?? c.free_preview ?? false,
            takeUrl: c.take_url,
          })),
        })),
        totalSections: chapters.length,
        totalLessons,
        totalEnrollments: enrollments.length,
      };
    }),

  /** Run the full import: create draft course + sections + lessons + enrollments */
  runImport: protectedProcedure
    .input(z.object({
      thinkificCourseId: z.number(),
      importEnrollments: z.boolean().default(true),
      scrapeSalesPage: z.boolean().default(true),
      customDomain: z.string().optional(), // custom domain for sales page scraping (e.g., member.allaboutultrasound.com)
      courseType: z.enum(["course", "quiz", "download"]).default("course"),
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

        // 3. Scrape sales page if requested — get blocks + pricing
        let salesPageBlocks: LandingBlock[] = [];
        let scrapedPrice = 0;
        if (input.scrapeSalesPage) {
          // Use provided custom domain, or empty string so scraper tries Thinkific subdomain first
          const customDomain = input.customDomain || "";
          const result = await scrapeThinkificSalesPage(course.slug, customDomain);
          salesPageBlocks = result.blocks;
          scrapedPrice = result.price;
          log.push(`Scraped sales page: ${salesPageBlocks.length} blocks, price: $${(scrapedPrice / 100).toFixed(2)}`);
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
        const coursePrice = scrapedPrice || 0;
        const isFree = coursePrice === 0;
        const [courseResult] = await db.insert(lmsCourses).values({
          slug,
          title: course.name,
          subtitle: course.subtitle || undefined,
          description: course.description ? stripHtml(course.description) : undefined,
          coverImageUrl: course.card_image_url || undefined,
          status: "draft",
          type: input.courseType,
          brand: "aaus",
          price: coursePrice,
          isFree,
          pricingType: isFree ? "free" : "one_time",
          hasCertificate: course.certificate_enabled,
          showInstructor: !!instructorBio,
          createdByUserId: ctx.user.id,
        });
        const lmsCourseId = (courseResult as unknown as { insertId: number }).insertId;
        log.push(`Created LMS course ID: ${lmsCourseId} (draft, price: $${(coursePrice / 100).toFixed(2)})`);

        // 5b. Create landing page record
        let finalLandingBlocks = salesPageBlocks;
        if (finalLandingBlocks.length === 0) {
          // Build a minimal landing page from Thinkific API data
          const fallbackBlocks: LandingBlock[] = [];
          // Hero block
          fallbackBlocks.push({
            id: uid(),
            type: "hero",
            data: {
              headline: course.name,
              headline2: "",
              subheadline: course.subtitle || "",
              bgType: course.banner_image_url ? "image" : "color",
              bgColor: "#149096",
              bgImage: course.banner_image_url || "",
              textColor: "#ffffff",
              align: "center",
              buttons: [{ text: "Enroll Now", color: "#ffffff", textColor: "#149096", link: "", style: "filled" }],
              showButtons: true,
            },
          });
          // Description block from API (preserve HTML if available)
          if (course.description && course.description.trim().length > 0) {
            const descHtml = course.description.trim().startsWith("<")
              ? course.description
              : `<p>${course.description}</p>`;
            fallbackBlocks.push({
              id: uid(),
              type: "text",
              data: {
                html: descHtml,
                align: "left",
                bgColor: "#ffffff",
                textColor: "#1a1a1a",
              },
            });
          }
          // Curriculum block
          fallbackBlocks.push({
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
          finalLandingBlocks = fallbackBlocks;
          log.push(`Built fallback landing page from API data: ${finalLandingBlocks.length} blocks`);
        }
        await db.insert(lmsLandingPages).values({
          courseId: lmsCourseId,
          heroTitle: course.name,
          heroSubtitle: course.subtitle || undefined,
          heroImageUrl: course.card_image_url || undefined,
          ctaText: "Enroll Now",
          isCustom: true,
          blocks: JSON.stringify(finalLandingBlocks),
        });
        log.push(`Created landing page with ${finalLandingBlocks.length} blocks`);

        // 6. Fetch chapters and contents — create sections + lessons
        const chapters = await getChaptersForCourse(input.thinkificCourseId);
        log.push(`Found ${chapters.length} chapters`);

        let totalLessons = 0;

        for (const chapter of chapters) {
          // Create section
          const [sectionResult] = await db.insert(lmsSections).values({
            courseId: lmsCourseId,
            title: chapter.name,
            position: chapter.position,
            isPreview: chapter.free_preview ?? false,
          });
          const sectionId = (sectionResult as unknown as { insertId: number }).insertId;

          // Fetch and create lessons
          const contents = await getContentsForChapter(chapter.id);
          for (const content of contents) {
            const lessonType = mapContentType(content.contentable_type, content.take_url);

            // Use `free` field (what the API actually returns), fallback to free_preview for compat
            const isFreePreview = content.free ?? content.free_preview ?? false;

            // Fetch full content detail (html_description, video_url, quiz questions, etc.)
            // Rate-limited to 120 req/min — add a small delay between requests
            const detail: ThinkificContentDetail | null = await getContentDetail(content.id);
            if (detail) {
              log.push(`  Fetched detail for lesson "${content.name}" (type: ${content.contentable_type})`);
            }

            // Resolve the best video URL from the detail
            let embedUrl: string | undefined;
            if (detail?.video_url) {
              embedUrl = detail.video_url;
            } else if (detail?.wistia_hashed_id) {
              embedUrl = `https://fast.wistia.net/embed/iframe/${detail.wistia_hashed_id}`;
            } else if (detail?.youtube_video_id) {
              embedUrl = `https://www.youtube.com/embed/${detail.youtube_video_id}`;
            } else if (detail?.vimeo_video_id) {
              embedUrl = `https://player.vimeo.com/video/${detail.vimeo_video_id}`;
            }

            // ─── Build content blocks ───────────────────────────────────────────
            // Strategy: rich text block is the PRIMARY container for all lesson content.
            // Most Thinkific lessons are rich text + video + inline images + embed links.
            // Supplementary blocks (video, embed, download, quiz) are added when present.
            const blocks: object[] = [];

            // 1. VIDEO block — placed first so it appears above the text description
            if (embedUrl) {
              // Determine provider label for the video block
              let videoProvider = "url";
              if (detail?.wistia_hashed_id) videoProvider = "wistia";
              else if (detail?.youtube_video_id) videoProvider = "youtube";
              else if (detail?.vimeo_video_id) videoProvider = "vimeo";
              blocks.push({
                id: `video-${uid()}`,
                type: "video",
                data: {
                  url: embedUrl,
                  provider: videoProvider,
                  caption: "",
                  bgColor: "#000000",
                  autoplay: false,
                },
              });
            }

            // 2. RICH TEXT block — primary content container
            //    html_description contains the full rich HTML body including inline images.
            //    body/description are fallbacks for content types that use different field names.
            const htmlDesc =
              detail?.html_description ||
              (detail as any)?.body ||
              content.html_description ||
              null;
            const plainDesc = detail?.description || content.description || null;

            if (htmlDesc && htmlDesc.trim().length > 0) {
              blocks.push({
                id: `text-${uid()}`,
                type: "text",
                data: {
                  html: htmlDesc,
                  align: "left",
                  bgColor: "#ffffff",
                  textColor: "#1a1a1a",
                },
              });
            } else if (plainDesc && plainDesc.trim().length > 0) {
              // Wrap plain text in a paragraph so the text block renders correctly
              blocks.push({
                id: `text-${uid()}`,
                type: "text",
                data: {
                  html: `<p>${plainDesc}</p>`,
                  align: "left",
                  bgColor: "#ffffff",
                  textColor: "#1a1a1a",
                },
              });
            }

            // 3. EMBED block — for iframe/multimedia content types that have a take_url
            //    but no video ID (e.g., external tool embeds, H5P, etc.)
            if (
              lessonType === "embed" &&
              !embedUrl &&
              content.take_url
            ) {
              blocks.push({
                id: `embed-${uid()}`,
                type: "embed",
                data: {
                  url: content.take_url,
                  caption: "",
                  bgColor: "#f9fafb",
                },
              });
            }

            // 4. DOWNLOAD block — for PDF/file attachment content types
            if (detail?.download_url) {
              blocks.push({
                id: `download-${uid()}`,
                type: "download",
                data: {
                  url: detail.download_url,
                  fileName: detail.file_name || content.name,
                  fileSize: detail.file_size || null,
                  mimeType: detail.content_type || null,
                  bgColor: "#f9fafb",
                  accentColor: "#149096",
                },
              });
            }

            // 5. QUIZ block — for quiz/exam/survey content types with questions
            if (detail?.questions && detail.questions.length > 0) {
              const quizQuestions = detail.questions.map((q) => ({
                id: `q-${q.id}`,
                text: q.text,
                type: q.question_type === "true_false" ? "true_false" : "multiple_choice",
                explanation: q.explanation || null,
                imageUrl: q.image_url || null,
                answers: (q.answers ?? []).map((a) => ({
                  id: `a-${a.id}`,
                  text: a.text,
                  correct: a.correct,
                  imageUrl: (a as any).image_url || null,
                })),
              }));
              blocks.push({
                id: `quiz-${uid()}`,
                type: "quiz",
                data: {
                  title: content.name,
                  questions: quizQuestions,
                  passingScore: detail.pass_percent ?? 70,
                  randomizeQuestions: detail.randomize_questions ?? false,
                  showCorrectAnswers: detail.show_answers ?? true,
                  bgColor: "#f9fafb",
                  accentColor: "#149096",
                },
              });
            }

            const contentBlocks = JSON.stringify(blocks);

            const htmlDescForContent = detail?.html_description || content.html_description;
            const plainDescForContent = detail?.description || content.description;
            const durationSecs = detail?.duration_in_seconds ?? content.duration_in_seconds;

            await db.insert(lmsLessons).values({
              courseId: lmsCourseId,
              sectionId,
              title: content.name,
              type: lessonType,
              embedUrl,
              content: htmlDescForContent
                ? stripHtml(htmlDescForContent)
                : (plainDescForContent || undefined),
              position: content.position,
              isPreview: isFreePreview,
              previewMode: isFreePreview ? "preview" : "none",
              durationMinutes: durationSecs
                ? Math.ceil(durationSecs / 60)
                : undefined,
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
          // Only import activated, non-expired enrollments
          const enrollments = allEnrollments.filter((e) => !e.expired && e.activated_at !== null);
          const skippedExpired = allEnrollments.filter((e) => e.expired).length;
          const skippedTrial = allEnrollments.filter((e) => !e.expired && e.activated_at === null).length;
          log.push(`Found ${enrollments.length} active enrollments to import (${skippedExpired} expired + ${skippedTrial} unactivated/trial skipped)`);

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
                try {
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
                } catch (insertErr: any) {
                  // Duplicate email — try to find existing
                  const [existingUser] = await db.select({ id: users.id })
                    .from(users)
                    .where(eq(users.email, email))
                    .limit(1);
                  if (existingUser) {
                    userId = existingUser.id;
                    emailToUserId.set(email, userId);
                  } else {
                    log.push(`WARN: Could not create/find user for ${email}: ${insertErr.message}`);
                    continue;
                  }
                }
              }

              // Check if already enrolled (idempotent)
              const [existingEnrollment] = await db.select({ id: lmsEnrollments.id })
                .from(lmsEnrollments)
                .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, lmsCourseId)))
                .limit(1);
              if (existingEnrollment) continue;

              // percentage_completed from Thinkific is a decimal string: "1.0" = 100%, "0.5" = 50%
              const rawPct = parseFloat(e.percentage_completed || "0");
              const progressPct = Math.round(rawPct * 100);

              await db.insert(lmsEnrollments).values({
                userId,
                courseId: lmsCourseId,
                enrolledAt: e.created_at ? new Date(e.created_at) : new Date(),
                completedAt: e.completed && e.completed_at ? new Date(e.completed_at) : null,
                progressPct: Math.min(progressPct, 100), // cap at 100
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

  /**
   * Re-sync an already-imported course:
   *  • Re-fetches all lesson content (html_description, video, quiz, download) and updates contentBlocks
   *  • Re-syncs enrollments (upserts from Thinkific, updates progress)
   *  • Re-scrapes the Thinkific sales/landing page and updates lms_landing_pages blocks
   *
   * Input: { lmsCourseId } — the local LMS course ID (from a previous import)
   * Optional: { customDomain } — used for sales page scraping
   */
  resyncCourse: protectedProcedure
    .input(z.object({
      lmsCourseId: z.number(),
      customDomain: z.string().optional(),
      resyncContent: z.boolean().default(true),
      resyncEnrollments: z.boolean().default(true),
      resyncLandingPage: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const log: string[] = [];

      // Look up the import record to get the Thinkific course ID
      const [importRecord] = await db.select()
        .from(lmsThinkificImports)
        .where(eq(lmsThinkificImports.lmsCourseId, input.lmsCourseId))
        .limit(1);
      if (!importRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: `No import record found for LMS course ID ${input.lmsCourseId}` });
      }
      const thinkificCourseId = importRecord.thinkificCourseId;
      log.push(`Resyncing LMS course ${input.lmsCourseId} from Thinkific course ${thinkificCourseId}`);

      let lessonsUpdated = 0;
      let enrollmentsUpdated = 0;
      let landingPageUpdated = false;

      try {
        // ─── 1. Re-sync lesson content ────────────────────────────────────────────────────
        if (input.resyncContent) {
          const chapters = await getChaptersForCourse(thinkificCourseId);
          log.push(`Found ${chapters.length} chapters`);

          for (const chapter of chapters) {
            const contents = await getContentsForChapter(chapter.id);
            for (const content of contents) {
              // Fetch full detail for this lesson
              const detail: ThinkificContentDetail | null = await getContentDetail(content.id);

              // Resolve embed URL
              let embedUrl: string | undefined;
              if (detail?.video_url) {
                embedUrl = detail.video_url;
              } else if (detail?.wistia_hashed_id) {
                embedUrl = `https://fast.wistia.net/embed/iframe/${detail.wistia_hashed_id}`;
              } else if (detail?.youtube_video_id) {
                embedUrl = `https://www.youtube.com/embed/${detail.youtube_video_id}`;
              } else if (detail?.vimeo_video_id) {
                embedUrl = `https://player.vimeo.com/video/${detail.vimeo_video_id}`;
              }

              // Build content blocks (same logic as import)
              const blocks: object[] = [];

              if (embedUrl) {
                let videoProvider = "url";
                if (detail?.wistia_hashed_id) videoProvider = "wistia";
                else if (detail?.youtube_video_id) videoProvider = "youtube";
                else if (detail?.vimeo_video_id) videoProvider = "vimeo";
                blocks.push({
                  id: `video-${uid()}`,
                  type: "video",
                  data: { url: embedUrl, provider: videoProvider, caption: "", bgColor: "#000000", autoplay: false },
                });
              }

              const htmlDesc = detail?.html_description || (detail as any)?.body || content.html_description || null;
              const plainDesc = detail?.description || content.description || null;
              if (htmlDesc && htmlDesc.trim().length > 0) {
                blocks.push({ id: `text-${uid()}`, type: "text", data: { html: htmlDesc, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
              } else if (plainDesc && plainDesc.trim().length > 0) {
                blocks.push({ id: `text-${uid()}`, type: "text", data: { html: `<p>${plainDesc}</p>`, align: "left", bgColor: "#ffffff", textColor: "#1a1a1a" } });
              }

              const lessonType = mapContentType(content.contentable_type, content.take_url);
              if (lessonType === "embed" && !embedUrl && content.take_url) {
                blocks.push({ id: `embed-${uid()}`, type: "embed", data: { url: content.take_url, caption: "", bgColor: "#f9fafb" } });
              }

              if (detail?.download_url) {
                blocks.push({
                  id: `download-${uid()}`, type: "download",
                  data: { url: detail.download_url, fileName: detail.file_name || content.name, fileSize: detail.file_size || null, mimeType: detail.content_type || null, bgColor: "#f9fafb", accentColor: "#149096" },
                });
              }

              if (detail?.questions && detail.questions.length > 0) {
                const quizQuestions = detail.questions.map((q) => ({
                  id: `q-${q.id}`, text: q.text,
                  type: q.question_type === "true_false" ? "true_false" : "multiple_choice",
                  explanation: q.explanation || null, imageUrl: q.image_url || null,
                  answers: (q.answers ?? []).map((a) => ({ id: `a-${a.id}`, text: a.text, correct: a.correct, imageUrl: (a as any).image_url || null })),
                }));
                blocks.push({
                  id: `quiz-${uid()}`, type: "quiz",
                  data: { title: content.name, questions: quizQuestions, passingScore: detail.pass_percent ?? 70, randomizeQuestions: detail.randomize_questions ?? false, showCorrectAnswers: detail.show_answers ?? true, bgColor: "#f9fafb", accentColor: "#149096" },
                });
              }

              const durationSecs = detail?.duration_in_seconds ?? content.duration_in_seconds;

              // Find the matching lesson by courseId + title + position
              const [existingLesson] = await db.select({ id: lmsLessons.id })
                .from(lmsLessons)
                .where(and(
                  eq(lmsLessons.courseId, input.lmsCourseId),
                  eq(lmsLessons.position, content.position),
                ))
                .limit(1);

              if (existingLesson) {
                await db.update(lmsLessons)
                  .set({
                    title: content.name,
                    type: lessonType,
                    embedUrl,
                    content: htmlDesc ? stripHtml(htmlDesc) : (plainDesc || undefined),
                    durationMinutes: durationSecs ? Math.ceil(durationSecs / 60) : undefined,
                    contentBlocks: JSON.stringify(blocks),
                  })
                  .where(eq(lmsLessons.id, existingLesson.id));
                lessonsUpdated++;
              }
            }
          }
          log.push(`Updated ${lessonsUpdated} lessons with fresh content`);
        }

        // ─── 2. Re-sync enrollments ────────────────────────────────────────────────────────
        if (input.resyncEnrollments) {
          const allEnrollments = await getEnrollmentsForCourse(thinkificCourseId);
          const activeEnrollments = allEnrollments.filter((e) => !e.expired && e.activated_at !== null);
          log.push(`Found ${activeEnrollments.length} active Thinkific enrollments`);

          const BATCH = 50;
          for (let i = 0; i < activeEnrollments.length; i += BATCH) {
            const batch = activeEnrollments.slice(i, i + BATCH);
            const emails = batch.map((e) => e.user_email.toLowerCase());

            const matchedUsers = await db.select({ id: users.id, email: users.email })
              .from(users)
              .where(inArray(users.email, emails));
            const emailToUserId = new Map(
              matchedUsers.map((u: { id: number; email: string | null }) => [
                (u.email ?? "").toLowerCase(), u.id,
              ])
            );

            for (const e of batch) {
              const email = e.user_email.toLowerCase();
              let userId = emailToUserId.get(email);

              if (!userId) {
                const displayName = e.user_name || email.split("@")[0];
                try {
                  const [newUser] = await db.insert(users).values({
                    email, name: displayName, displayName, isPending: false, loginMethod: "email", emailVerified: false,
                  });
                  userId = (newUser as any).insertId as number;
                  emailToUserId.set(email, userId);
                } catch {
                  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
                  if (existingUser) { userId = existingUser.id; emailToUserId.set(email, userId); }
                  else continue;
                }
              }

              const rawPct = parseFloat(e.percentage_completed || "0");
              const progressPct = Math.min(Math.round(rawPct * 100), 100);

              // Upsert: update progress if already enrolled, insert if not
              const [existing] = await db.select({ id: lmsEnrollments.id })
                .from(lmsEnrollments)
                .where(and(eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, input.lmsCourseId)))
                .limit(1);

              if (existing) {
                await db.update(lmsEnrollments)
                  .set({ progressPct, completedAt: e.completed && e.completed_at ? new Date(e.completed_at) : null })
                  .where(eq(lmsEnrollments.id, existing.id));
              } else {
                await db.insert(lmsEnrollments).values({
                  userId, courseId: input.lmsCourseId,
                  enrolledAt: e.created_at ? new Date(e.created_at) : new Date(),
                  completedAt: e.completed && e.completed_at ? new Date(e.completed_at) : null,
                  progressPct,
                });
              }
              enrollmentsUpdated++;
            }
          }
          log.push(`Synced ${enrollmentsUpdated} enrollments`);
        }

        // ─── 3. Re-scrape landing page ───────────────────────────────────────────────────────
        if (input.resyncLandingPage) {
          const course = await getThinkificCourse(thinkificCourseId);
          const customDomain = input.customDomain || "";
          const { blocks: newBlocks } = await scrapeThinkificSalesPage(course.slug, customDomain);
          if (newBlocks.length > 0) {
            // Update existing landing page record for this course
            await db.update(lmsLandingPages)
              .set({ blocks: JSON.stringify(newBlocks) })
              .where(eq(lmsLandingPages.courseId, input.lmsCourseId));
            landingPageUpdated = true;
            log.push(`Re-scraped landing page: ${newBlocks.length} blocks`);
          } else {
            log.push(`Landing page scrape returned 0 blocks — keeping existing blocks`);
          }
        }

        // Update import record with resync timestamp
        await db.update(lmsThinkificImports)
          .set({
            status: "complete",
            lessonsImported: lessonsUpdated,
            enrollmentsActivated: enrollmentsUpdated,
            importLog: `[RESYNC ${new Date().toISOString()}]\n${log.join("\n")}`,
          })
          .where(eq(lmsThinkificImports.lmsCourseId, input.lmsCourseId));

        return { success: true, lessonsUpdated, enrollmentsUpdated, landingPageUpdated, log };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.push(`ERROR: ${errorMessage}`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Resync failed: ${errorMessage}` });
      }
    }),
});
