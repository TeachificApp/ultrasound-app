import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const QUESTION_BANK_COLUMNS: Array<{ name: string; ddl: string }> = [
  {
    name: "source_lesson_id",
    ddl: "ALTER TABLE `question_bank` ADD COLUMN `source_lesson_id` INT NULL",
  },
  {
    name: "source_block_id",
    ddl: "ALTER TABLE `question_bank` ADD COLUMN `source_block_id` VARCHAR(128) NULL",
  },
  {
    name: "source_question_index",
    ddl: "ALTER TABLE `question_bank` ADD COLUMN `source_question_index` INT NULL",
  },
  {
    name: "correct_feedback",
    ddl: "ALTER TABLE `question_bank` ADD COLUMN `correct_feedback` LONGTEXT NULL AFTER `explanation`",
  },
  {
    name: "incorrect_feedback",
    ddl: "ALTER TABLE `question_bank` ADD COLUMN `incorrect_feedback` LONGTEXT NULL AFTER `correct_feedback`",
  },
  {
    name: "builder_question_payload",
    ddl: "ALTER TABLE `question_bank` ADD COLUMN `builder_question_payload` LONGTEXT NULL",
  },
];

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

/** Idempotent schema sync for question_bank columns added after the Manus mirror. */
export async function ensureQuestionBankSchema(db: Db | null | undefined): Promise<{
  applied: string[];
  error?: string;
}> {
  if (!db) {
    return { applied: [], error: "Database unavailable" };
  }

  const applied: string[] = [];
  try {
    const columns = await listTableColumns(db, "question_bank");
    for (const column of QUESTION_BANK_COLUMNS) {
      if (columns.has(column.name)) continue;
      await db.execute(sql.raw(column.ddl));
      applied.push(column.name);
      columns.add(column.name);
    }
    if (applied.length > 0) {
      console.log(`[ensureQuestionBankSchema] Added columns: ${applied.join(", ")}`);
    }
    return { applied };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isBenignAlterError(message)) {
      return { applied };
    }
    console.error("[ensureQuestionBankSchema]", message);
    return { applied, error: message };
  }
}
