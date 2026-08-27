import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const SOURCE_COLUMNS = [
  { name: "source_lesson_id", ddl: "ADD COLUMN `source_lesson_id` INT NULL" },
  { name: "source_block_id", ddl: "ADD COLUMN `source_block_id` VARCHAR(128) NULL" },
  { name: "source_question_index", ddl: "ADD COLUMN `source_question_index` INT NULL" },
] as const;

async function listTableColumns(db: Db, tableName: string): Promise<Set<string>> {
  const result = await db.execute(
    sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tableName}`,
  );
  const list = extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result);
  const names = new Set<string>();
  for (const row of list) {
    const name = row.COLUMN_NAME ?? row.column_name;
    if (name) names.add(name);
  }
  return names;
}

function isBenignAlterError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("duplicate column") || lower.includes("duplicate column name");
}

/** Adds question_bank source tracking columns when migration 0037 was not run manually. */
export async function ensureQuestionBankLessonSourceSchema(db: Db | null | undefined): Promise<{
  applied: boolean;
  hadAllColumns: boolean;
  error?: string;
}> {
  if (!db) {
    return { applied: false, hadAllColumns: false, error: "Database unavailable" };
  }

  try {
    const columns = await listTableColumns(db, "question_bank");
    const missing = SOURCE_COLUMNS.filter((col) => !columns.has(col.name));
    if (missing.length === 0) {
      return { applied: false, hadAllColumns: true };
    }

    for (const col of missing) {
      await db.execute(sql.raw(`ALTER TABLE \`question_bank\` ${col.ddl}`));
    }

    // Index is optional for sync; add when all source columns exist.
    try {
      await db.execute(sql.raw(
        "CREATE INDEX idx_question_bank_lesson_source ON question_bank (source_lesson_id, source_block_id, source_question_index)",
      ));
    } catch (indexErr) {
      const msg = indexErr instanceof Error ? indexErr.message : String(indexErr);
      if (!msg.toLowerCase().includes("duplicate")) {
        console.warn("[ensureQuestionBankLessonSourceSchema] index:", msg);
      }
    }

    console.log("[ensureQuestionBankLessonSourceSchema] Added lesson quiz source columns");
    return { applied: true, hadAllColumns: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isBenignAlterError(message)) {
      return { applied: false, hadAllColumns: true };
    }
    console.error("[ensureQuestionBankLessonSourceSchema]", message);
    return { applied: false, hadAllColumns: false, error: message };
  }
}
