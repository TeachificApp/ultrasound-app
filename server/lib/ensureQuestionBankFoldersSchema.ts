import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const SORT_ORDER_COLUMN = "sort_order";

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

/** Adds question_bank_folders.sort_order when PR #111 deployed before manual migration. */
export async function ensureQuestionBankFoldersSchema(db: Db | null | undefined): Promise<{
  applied: boolean;
  hadSortOrder: boolean;
  error?: string;
}> {
  if (!db) {
    return { applied: false, hadSortOrder: false, error: "Database unavailable" };
  }

  try {
    const columns = await listTableColumns(db, "question_bank_folders");
    if (columns.has(SORT_ORDER_COLUMN)) {
      return { applied: false, hadSortOrder: true };
    }

    await db.execute(
      sql.raw(
        "ALTER TABLE `question_bank_folders` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `color`",
      ),
    );

    console.log("[ensureQuestionBankFoldersSchema] Added sort_order column");
    return { applied: true, hadSortOrder: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isBenignAlterError(message)) {
      return { applied: false, hadSortOrder: true };
    }
    console.error("[ensureQuestionBankFoldersSchema]", message);
    return { applied: false, hadSortOrder: false, error: message };
  }
}
