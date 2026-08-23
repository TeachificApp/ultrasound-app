import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Columns added after the original Manus mirror — required by Drizzle full-table selects. */
export const LMS_COHORT_GROUPS_REQUIRED_COLUMNS = [
  "location",
  "duration_hours",
  "landing_blocks",
  "access_duration_days",
  "waitlist_enabled",
  "waitlist_heading",
  "waitlist_body",
  "waitlist_cta_label",
  "waitlist_cta_url",
  "waitlist_redirect_url",
  "waitlist_success_message",
  "presale_welcome_heading",
  "presale_welcome_body",
  "presale_welcome_media_url",
  "presale_welcome_cta_label",
  "presale_welcome_cta_url",
] as const;

const LMS_COHORT_GROUPS_COLUMN_DEFS: Record<(typeof LMS_COHORT_GROUPS_REQUIRED_COLUMNS)[number], string> = {
  location: "VARCHAR(300) NULL",
  duration_hours: "INT NULL",
  landing_blocks: "LONGTEXT NULL",
  access_duration_days: "INT NULL",
  waitlist_enabled: "TINYINT(1) NOT NULL DEFAULT 0",
  waitlist_heading: "VARCHAR(500) NULL",
  waitlist_body: "LONGTEXT NULL",
  waitlist_cta_label: "VARCHAR(255) NULL",
  waitlist_cta_url: "VARCHAR(2048) NULL",
  waitlist_redirect_url: "VARCHAR(2048) NULL",
  waitlist_success_message: "LONGTEXT NULL",
  presale_welcome_heading: "VARCHAR(500) NULL",
  presale_welcome_body: "LONGTEXT NULL",
  presale_welcome_media_url: "TEXT NULL",
  presale_welcome_cta_label: "VARCHAR(255) NULL",
  presale_welcome_cta_url: "VARCHAR(2048) NULL",
};

const MODIFY_STATEMENTS = [
  "ALTER TABLE `lms_cohort_groups` MODIFY COLUMN `status` ENUM('draft','open','active','completed','archived','waitlist','presale') NOT NULL DEFAULT 'draft'",
] as const;

function formatSqlError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) return `${err.message} | ${cause.message}`;
    return err.message;
  }
  return String(err);
}

function isBenignAlterError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("duplicate column") || lower.includes("duplicate column name");
}

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

export async function inspectLmsCohortGroupsSchema(db: Db | null | undefined) {
  if (!db) {
    return {
      tableExists: false,
      missingColumns: [...LMS_COHORT_GROUPS_REQUIRED_COLUMNS],
      groupCount: null as number | null,
      queryOk: false,
      queryError: "Database unavailable",
    };
  }

  let tableExists = true;
  let missingColumns: string[] = [];
  let groupCount: number | null = null;
  let queryOk = false;
  let queryError: string | null = null;

  try {
    const columns = await listTableColumns(db, "lms_cohort_groups");
    missingColumns = LMS_COHORT_GROUPS_REQUIRED_COLUMNS.filter((col) => !columns.has(col));
  } catch (err) {
    tableExists = false;
    queryError = err instanceof Error ? err.message : "Failed to inspect columns";
    missingColumns = [...LMS_COHORT_GROUPS_REQUIRED_COLUMNS];
  }

  try {
    const countRows = await db.execute(sql`SELECT COUNT(*) AS c FROM lms_cohort_groups`);
    const countRow = extractExecuteRows<{ c?: number }>(countRows)[0];
    groupCount = Number(countRow?.c ?? 0);
  } catch {
    groupCount = null;
  }

  try {
    await db.execute(
      sql`SELECT id, course_id, name, landing_blocks, waitlist_enabled FROM lms_cohort_groups LIMIT 1`,
    );
    queryOk = true;
  } catch (err) {
    queryOk = false;
    queryError = err instanceof Error ? err.message : "Cohort groups query failed";
  }

  return {
    tableExists,
    missingColumns,
    groupCount,
    queryOk,
    queryError,
  };
}

async function runAlter(db: Db, statement: string): Promise<void> {
  await db.execute(sql.raw(statement));
}

/** Idempotent schema sync for Railway MySQL after Manus mirror. Safe to run on every startup. */
export async function ensureLmsCohortGroupsSchema(db: Db | null | undefined): Promise<{
  applied: boolean;
  missingBefore: string[];
  missingAfter: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  if (!db) {
    return {
      applied: false,
      missingBefore: [...LMS_COHORT_GROUPS_REQUIRED_COLUMNS],
      missingAfter: [...LMS_COHORT_GROUPS_REQUIRED_COLUMNS],
      errors: ["Database unavailable"],
    };
  }

  const before = await inspectLmsCohortGroupsSchema(db);
  if (before.missingColumns.length === 0 && before.queryOk) {
    return {
      applied: false,
      missingBefore: [],
      missingAfter: [],
      errors: [],
    };
  }

  let existingColumns = await listTableColumns(db, "lms_cohort_groups");

  for (const statement of MODIFY_STATEMENTS) {
    try {
      await runAlter(db, statement);
    } catch (err) {
      const message = formatSqlError(err);
      if (!isBenignAlterError(message)) {
        errors.push(message);
        console.error("[ensureLmsCohortGroupsSchema] MODIFY failed:", statement.slice(0, 80), message);
      }
    }
  }

  for (const column of LMS_COHORT_GROUPS_REQUIRED_COLUMNS) {
    if (existingColumns.has(column)) continue;
    const definition = LMS_COHORT_GROUPS_COLUMN_DEFS[column];
    const statement = `ALTER TABLE \`lms_cohort_groups\` ADD COLUMN \`${column}\` ${definition}`;
    try {
      await runAlter(db, statement);
      existingColumns.add(column);
    } catch (err) {
      const message = formatSqlError(err);
      if (isBenignAlterError(message)) {
        existingColumns.add(column);
        continue;
      }
      errors.push(message);
      console.error("[ensureLmsCohortGroupsSchema] ADD failed:", column, message);
    }
  }

  const after = await inspectLmsCohortGroupsSchema(db);
  const applied = before.missingColumns.length > 0 || !before.queryOk;
  if (applied && after.queryOk) {
    console.log(`[ensureLmsCohortGroupsSchema] OK — cohort groups=${after.groupCount}`);
  } else if (applied) {
    console.error(
      `[ensureLmsCohortGroupsSchema] Incomplete — missing=${after.missingColumns.length}, queryError=${after.queryError}`,
    );
  }

  return {
    applied,
    missingBefore: before.missingColumns,
    missingAfter: after.missingColumns,
    errors,
  };
}
