import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const CREATE_ATTEMPTS_TABLE = [
  "CREATE TABLE IF NOT EXISTS `lms_inline_quiz_attempts` (",
  "  `id` INT NOT NULL AUTO_INCREMENT,",
  "  `user_id` INT NOT NULL,",
  "  `course_id` INT NOT NULL,",
  "  `lesson_id` INT NOT NULL,",
  "  `quiz_block_id` VARCHAR(128) NOT NULL,",
  "  `score` INT NOT NULL,",
  "  `passed` TINYINT(1) NOT NULL,",
  "  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
  "  `account_field_values` LONGTEXT NULL,",
  "  PRIMARY KEY (`id`),",
  "  KEY `idx_inline_quiz_attempt_course_lesson` (`course_id`, `lesson_id`),",
  "  KEY `idx_inline_quiz_attempt_user` (`user_id`)",
  ")",
].join("\n");

const CREATE_RESPONSES_TABLE = [
  "CREATE TABLE IF NOT EXISTS `lms_inline_quiz_responses` (",
  "  `id` INT NOT NULL AUTO_INCREMENT,",
  "  `attempt_id` INT NOT NULL,",
  "  `question_key` VARCHAR(128) NOT NULL,",
  "  `question_text` TEXT NOT NULL,",
  "  `question_type` VARCHAR(32) NOT NULL,",
  "  `answer_value` TEXT NULL,",
  "  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
  "  PRIMARY KEY (`id`),",
  "  KEY `idx_inline_quiz_response_attempt` (`attempt_id`)",
  ")",
].join("\n");

let schemaPromise: Promise<void> | null = null;

async function listColumns(db: Db, tableName: string): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tableName}
  `);
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row: { COLUMN_NAME?: unknown; column_name?: unknown }) => row.COLUMN_NAME ?? row.column_name)
      .filter((column): column is string => typeof column === "string"),
  );
}

function isDuplicateColumn(error: unknown): boolean {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  return /duplicate column/i.test(message);
}

/**
 * Creates only the two append-only reporting tables when absent and adds the
 * optional snapshot column when an older Railway database is still in use.
 * It never alters, deletes, or reads learner attempt records.
 */
export async function ensureInlineLessonQuizSchema(db: Db | null | undefined): Promise<void> {
  if (!db) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(sql.raw(CREATE_ATTEMPTS_TABLE));
      await db.execute(sql.raw(CREATE_RESPONSES_TABLE));
      const attemptColumns = await listColumns(db, "lms_inline_quiz_attempts");
      if (!attemptColumns.has("account_field_values")) {
        try {
          await db.execute(sql.raw("ALTER TABLE `lms_inline_quiz_attempts` ADD COLUMN `account_field_values` LONGTEXT NULL"));
        } catch (error) {
          if (!isDuplicateColumn(error)) throw error;
        }
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export const INLINE_LESSON_QUIZ_SCHEMA_CONTRACT = {
  attemptsTable: "lms_inline_quiz_attempts",
  responsesTable: "lms_inline_quiz_responses",
  optionalAttemptColumn: "account_field_values",
} as const;
