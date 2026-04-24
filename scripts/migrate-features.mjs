import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  // ─── Certificate of Completion ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS lms_certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    enrollment_id INT NOT NULL,
    certificate_url TEXT NOT NULL,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_course (user_id, course_id)
  )`,

  // ─── Lesson Notes ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS lms_lesson_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    course_id INT NOT NULL,
    note LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_course (user_id, course_id),
    INDEX idx_user_lesson (user_id, lesson_id)
  )`,

  // ─── Lesson Bookmarks ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS lms_lesson_bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    course_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_lesson (user_id, lesson_id)
  )`,

  // ─── Section drip_days ─────────────────────────────────────────────────────
  `ALTER TABLE lms_sections ADD COLUMN IF NOT EXISTS drip_days INT NOT NULL DEFAULT 0`,
];

for (const sql of statements) {
  try {
    await conn.query(sql);
    console.log('OK:', sql.slice(0, 60).replace(/\n/g, ' '));
  } catch (e) {
    console.error('FAILED:', e.message, '\nSQL:', sql.slice(0, 80));
  }
}

await conn.end();
console.log('Migration complete.');
process.exit(0);
