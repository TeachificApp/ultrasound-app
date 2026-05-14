import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

const indexes = [
  // lms_lessons
  ["idx_lms_lessons_course_id", "lms_lessons", "course_id"],
  ["idx_lms_lessons_section_id", "lms_lessons", "section_id"],
  ["idx_lms_lessons_course_section", "lms_lessons", "course_id, section_id"],
  // lms_sections
  ["idx_lms_sections_course_id", "lms_sections", "course_id"],
  // lms_enrollments
  ["idx_lms_enrollments_user_id", "lms_enrollments", "user_id"],
  ["idx_lms_enrollments_course_id", "lms_enrollments", "course_id"],
  ["idx_lms_enrollments_user_course", "lms_enrollments", "user_id, course_id"],
  // lms_lesson_progress
  ["idx_lms_lesson_progress_enrollment_id", "lms_lesson_progress", "enrollment_id"],
  ["idx_lms_lesson_progress_lesson_id", "lms_lesson_progress", "lesson_id"],
  // lms_course_instructors
  ["idx_lms_course_instructors_course_id", "lms_course_instructors", "course_id"],
  // lms_landing_pages
  ["idx_lms_landing_pages_course_id", "lms_landing_pages", "course_id"],
  // lms_lesson_notes
  ["idx_lms_lesson_notes_user_id", "lms_lesson_notes", "user_id"],
  ["idx_lms_lesson_notes_lesson_id", "lms_lesson_notes", "lesson_id"],
  ["idx_lms_lesson_notes_user_lesson", "lms_lesson_notes", "user_id, lesson_id"],
  // lms_lesson_bookmarks
  ["idx_lms_lesson_bookmarks_user_id", "lms_lesson_bookmarks", "user_id"],
  ["idx_lms_lesson_bookmarks_lesson_id", "lms_lesson_bookmarks", "lesson_id"],
  // lms_certificates
  ["idx_lms_certificates_enrollment_id", "lms_certificates", "enrollment_id"],
  // lms_quiz_questions
  ["idx_lms_quiz_questions_quiz_id", "lms_quiz_questions", "quiz_id"],
];

for (const [name, table, cols] of indexes) {
  try {
    await conn.execute(`CREATE INDEX \`${name}\` ON \`${table}\`(${cols})`);
    console.log(`✓ Created index ${name} on ${table}(${cols})`);
  } catch (e) {
    if (e.code === "ER_DUP_KEYNAME" || e.message?.includes("Duplicate key name")) {
      console.log(`  already exists: ${name}`);
    } else {
      console.error(`✗ Failed ${name}: ${e.message}`);
    }
  }
}

await conn.end();
console.log("Done.");
