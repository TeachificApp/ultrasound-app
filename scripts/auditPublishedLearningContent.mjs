#!/usr/bin/env node
/**
 * Read-only integrity audit for published courses and standalone quizzes.
 * Uses DATABASE_URL and public HTTP checks; never writes data.
 */
import mysql from "mysql2/promise";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.LEARNING_AUDIT_BASE_URL || "https://learn.allaboutultrasound.com";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the published learning-content audit.");

const connection = await mysql.createConnection(databaseUrl);
const issues = [];
const checks = [];

function addIssue(severity, category, subject, detail) {
  issues.push({ severity, category, subject, detail });
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseJson(value) {
  if (!nonEmpty(value)) return { value: null, error: null };
  try {
    return { value: JSON.parse(value), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

async function mapBounded(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

const [courses] = await connection.query(`
  SELECT c.id, c.slug, c.title, c.type, c.status
  FROM lms_courses c
  WHERE c.status = 'public'
  ORDER BY c.id
`);

const [lessons] = await connection.query(`
  SELECT
    l.id, l.title, l.type, l.content, l.video_content, l.embed_url,
    l.media_asset_id, l.standalone_quiz_id, l.content_blocks,
    l.lesson_status, l.course_id AS direct_course_id, s.course_id AS section_course_id,
    c.id AS resolved_course_id, c.slug AS course_slug, c.title AS course_title,
    ma.id AS media_found_id, ma.slug AS media_slug, ma.mediaType AS media_type,
    ma.deletedAt AS media_deleted_at,
    mv.id AS media_version_id, mv.s3Url AS media_url, mv.fileName AS media_file_name,
    mv.scormExtractionStatus AS scorm_status, mv.scormExtractedPrefix AS scorm_prefix,
    mv.scormLaunchFile AS scorm_launch_file,
    sq.id AS standalone_quiz_found_id, sq.status AS standalone_quiz_status,
    sq.builder_config AS standalone_builder_config,
    (SELECT COUNT(*) FROM standalone_quiz_questions sqq WHERE sqq.quiz_id = l.standalone_quiz_id) AS standalone_question_count,
    lq.id AS lms_quiz_id,
    (SELECT COUNT(*) FROM lms_quiz_questions lqq WHERE lqq.quiz_id = lq.id) AS lms_quiz_question_count
  FROM lms_lessons l
  LEFT JOIN lms_sections s ON s.id = l.section_id
  INNER JOIN lms_courses c ON c.id = COALESCE(l.course_id, s.course_id)
  LEFT JOIN mediaAssets ma ON ma.id = l.media_asset_id AND ma.deletedAt IS NULL
  LEFT JOIN (
    SELECT assetId, MAX(versionNumber) AS max_version
    FROM mediaVersions
    GROUP BY assetId
  ) latest_mv ON latest_mv.assetId = l.media_asset_id
  LEFT JOIN mediaVersions mv
    ON mv.assetId = latest_mv.assetId AND mv.versionNumber = latest_mv.max_version
  LEFT JOIN standalone_quizzes sq ON sq.id = l.standalone_quiz_id
  LEFT JOIN lms_quizzes lq ON lq.lesson_id = l.id
  WHERE c.status = 'public' AND l.lesson_status = 'published'
  ORDER BY c.id, l.position, l.id
`);

const [standaloneQuizzes] = await connection.query(`
  SELECT
    q.id, q.title, q.status, q.access_type, q.builder_config,
    (SELECT COUNT(*) FROM standalone_quiz_questions sqq WHERE sqq.quiz_id = q.id) AS linked_question_count
  FROM standalone_quizzes q
  WHERE q.status = 'published'
  ORDER BY q.id
`);

const courseLessonCounts = new Map();
for (const lesson of lessons) {
  courseLessonCounts.set(lesson.resolved_course_id, (courseLessonCounts.get(lesson.resolved_course_id) ?? 0) + 1);
}
for (const course of courses) {
  const lessonCount = courseLessonCounts.get(course.id) ?? 0;
  checks.push({ kind: "course_curriculum", id: course.id, slug: course.slug, lessonCount });
  if (lessonCount === 0) addIssue("error", "course", `course:${course.id}:${course.slug}`, "Published course has no published lessons.");
}

const embedUrls = new Set();
for (const lesson of lessons) {
  const subject = `lesson:${lesson.id}:${lesson.course_slug}`;
  if (!lesson.resolved_course_id) addIssue("error", "lesson", subject, "Lesson cannot resolve to a published course.");

  const blocks = parseJson(lesson.content_blocks);
  if (blocks.error) addIssue("error", "content_blocks", subject, `Invalid content_blocks JSON: ${blocks.error}`);
  const hasBlocks = Array.isArray(blocks.value) && blocks.value.length > 0;

  const needsPlayableSource = ["video", "video_text", "embed"].includes(lesson.type);
  const hasInlineSource = nonEmpty(lesson.embed_url) || nonEmpty(lesson.content) || hasBlocks;
  if (needsPlayableSource && !lesson.media_asset_id && !hasInlineSource) {
    addIssue("error", "lesson_media", subject, `Published ${lesson.type} lesson has no media asset, embed URL, content, or content block.`);
  }

  if (lesson.media_asset_id) {
    if (!lesson.media_found_id || lesson.media_deleted_at) {
      addIssue("error", "media_asset", subject, `Referenced media asset ${lesson.media_asset_id} is missing or deleted.`);
    } else if (!lesson.media_version_id || !nonEmpty(lesson.media_url)) {
      addIssue("error", "media_asset", subject, `Referenced media asset ${lesson.media_asset_id} has no current media version.`);
    } else if (["scorm", "zip", "lms"].includes(String(lesson.media_type))) {
      if (lesson.scorm_status !== "done" || !nonEmpty(lesson.scorm_prefix) || !nonEmpty(lesson.scorm_launch_file)) {
        addIssue("error", "scorm", subject, `Interactive package ${lesson.media_slug} is not extraction-ready (status=${lesson.scorm_status ?? "none"}).`);
      }
    }
  }

  if (lesson.type === "quiz") {
    if (!lesson.lms_quiz_id) {
      addIssue("error", "lms_quiz", subject, "Published quiz lesson has no LMS quiz record.");
    } else if (Number(lesson.lms_quiz_question_count) === 0) {
      addIssue("error", "lms_quiz", subject, "Published LMS quiz has no questions.");
    }
  }

  if (lesson.type === "standalone_quiz") {
    if (!lesson.standalone_quiz_found_id) {
      addIssue("error", "standalone_quiz", subject, "Published standalone quiz lesson references a missing quiz.");
    } else if (lesson.standalone_quiz_status !== "published") {
      addIssue("error", "standalone_quiz", subject, `Published lesson references a standalone quiz with status=${lesson.standalone_quiz_status}.`);
    } else {
      const builder = parseJson(lesson.standalone_builder_config);
      const builderQuestions = Array.isArray(builder.value?.questions) ? builder.value.questions.length : 0;
      if (Number(lesson.standalone_question_count) === 0 && builderQuestions === 0) {
        addIssue("error", "standalone_quiz", subject, "Referenced published standalone quiz has no linked or visual-builder questions.");
      }
    }
  }

  if (nonEmpty(lesson.embed_url) && /^https?:\/\//i.test(lesson.embed_url)) embedUrls.add(lesson.embed_url);
}

for (const quiz of standaloneQuizzes) {
  const builder = parseJson(quiz.builder_config);
  if (builder.error) addIssue("error", "standalone_quiz", `standalone_quiz:${quiz.id}`, `Invalid builder_config JSON: ${builder.error}`);
  const builderQuestions = Array.isArray(builder.value?.questions) ? builder.value.questions.length : 0;
  checks.push({ kind: "standalone_quiz", id: quiz.id, linkedQuestionCount: Number(quiz.linked_question_count), builderQuestionCount: builderQuestions });
  if (Number(quiz.linked_question_count) === 0 && builderQuestions === 0) {
    addIssue("error", "standalone_quiz", `standalone_quiz:${quiz.id}`, "Published standalone quiz has no linked or visual-builder questions.");
  }
}

const routeChecks = await mapBounded(courses, 8, async (course) => {
  const url = `${baseUrl}/courses/${encodeURIComponent(course.slug)}`;
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    return { kind: "course_landing", id: course.id, slug: course.slug, url, status: response.status, ok: response.ok };
  } catch (error) {
    return { kind: "course_landing", id: course.id, slug: course.slug, url, status: 0, ok: false, error: error instanceof Error ? error.message : "Fetch failed" };
  }
});
checks.push(...routeChecks);
for (const check of routeChecks) {
  if (!check.ok) addIssue("error", "course_route", `course:${check.id}:${check.slug}`, `Landing route returned ${check.status}${check.error ? ` (${check.error})` : ""}.`);
}

const embedChecks = await mapBounded([...embedUrls], 6, async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15000) });
    return { kind: "external_embed", url, status: response.status, ok: response.ok || response.status === 405 };
  } catch (error) {
    return { kind: "external_embed", url, status: 0, ok: false, error: error instanceof Error ? error.message : "Fetch failed" };
  }
});
checks.push(...embedChecks);
for (const check of embedChecks) {
  if (!check.ok) addIssue("warning", "external_embed", check.url, `External embed check returned ${check.status}${check.error ? ` (${check.error})` : ""}.`);
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  totals: {
    publishedCourses: courses.length,
    publishedLessons: lessons.length,
    publishedStandaloneQuizzes: standaloneQuizzes.length,
    externalEmbedsChecked: embedChecks.length,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  },
  issues,
  checks,
};

const reportPath = path.resolve(process.cwd(), "tmp", "published-learning-content-audit.json");
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, totals: report.totals, issues }, null, 2));
await connection.end();
if (report.totals.errors > 0) process.exitCode = 2;
