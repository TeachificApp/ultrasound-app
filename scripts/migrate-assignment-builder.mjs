import mysql from "mysql2/promise";
import { readFileSync } from "fs";

// Load .env
const envFile = new URL("../.env", import.meta.url).pathname;
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const env = readFileSync(envFile, "utf8");
    const match = env.match(/^DATABASE_URL=(.+)$/m);
    if (match) DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
}
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(DATABASE_URL);

const migrations = [
  // Add content_blocks to assignments (skip if exists)
  `ALTER TABLE lms_cohort_assignments ADD COLUMN content_blocks JSON NULL AFTER description`,
  // Add file_url, file_key, grade, feedback, graded_at, graded_by to submissions
  `ALTER TABLE lms_cohort_submissions ADD COLUMN file_url VARCHAR(1024) NULL AFTER url_content`,
  `ALTER TABLE lms_cohort_submissions ADD COLUMN file_key VARCHAR(512) NULL AFTER file_url`,
  `ALTER TABLE lms_cohort_submissions ADD COLUMN grade DECIMAL(6,2) NULL AFTER file_key`,
  `ALTER TABLE lms_cohort_submissions ADD COLUMN feedback TEXT NULL AFTER grade`,
  `ALTER TABLE lms_cohort_submissions ADD COLUMN graded_at BIGINT NULL AFTER feedback`,
  `ALTER TABLE lms_cohort_submissions ADD COLUMN graded_by INT NULL AFTER graded_at`,
];

for (const sql of migrations) {
  try {
    await conn.execute(sql);
    console.log("✅", sql.substring(0, 60));
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("⏭  Already exists:", sql.substring(0, 60));
    } else {
      console.error("❌", e.message, "\n   SQL:", sql.substring(0, 80));
    }
  }
}

await conn.end();
console.log("Done.");
