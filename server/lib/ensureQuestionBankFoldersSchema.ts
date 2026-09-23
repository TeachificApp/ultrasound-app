import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const SORT_ORDER_COLUMN = "sort_order";
const QUIZ_LOGO_URL_COLUMN = "quiz_logo_url";

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

/** Adds additive Question Bank folder fields when code reaches Railway before a manual migration. */
export async function ensureQuestionBankFoldersSchema(db: Db | null | undefined): Promise<{
  applied: boolean;
  hadSortOrder: boolean;
  hadQuizLogoUrl: boolean;
  error?: string;
}> {
  if (!db) {
    return { applied: false, hadSortOrder: false, hadQuizLogoUrl: false, error: "Database unavailable" };
  }

  try {
    const columns = await listTableColumns(db, "question_bank_folders");
    const hadSortOrder = columns.has(SORT_ORDER_COLUMN);
    const hadQuizLogoUrl = columns.has(QUIZ_LOGO_URL_COLUMN);
    let applied = false;
    if (!hadSortOrder) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `question_bank_folders` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `color`",
        ),
      );
      applied = true;
      console.log("[ensureQuestionBankFoldersSchema] Added sort_order column");
    }
    if (!hadQuizLogoUrl) {
      await db.execute(
        sql.raw(
          "ALTER TABLE `question_bank_folders` ADD COLUMN `quiz_logo_url` TEXT NULL AFTER `color`",
        ),
      );
      applied = true;
      console.log("[ensureQuestionBankFoldersSchema] Added quiz_logo_url column");
    }
    return { applied, hadSortOrder, hadQuizLogoUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isBenignAlterError(message)) {
      return { applied: false, hadSortOrder: true, hadQuizLogoUrl: true };
    }
    console.error("[ensureQuestionBankFoldersSchema]", message);
    return { applied: false, hadSortOrder: false, hadQuizLogoUrl: false, error: message };
  }
}
