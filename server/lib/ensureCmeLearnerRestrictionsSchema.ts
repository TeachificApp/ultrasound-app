import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type RequiredColumn = {
  table: "lms_enrollments" | "lms_lessons";
  name: "cme_credit_restricted" | "hide_for_cme_restricted";
  definition: string;
};

/**
 * These fields were introduced by drizzle/0118_cme_learner_restrictions.sql.
 * Railway deployments can run newer LMS access code before the additive
 * migration reaches the active application database. Reconcile only these
 * non-destructive columns before any learner-access query can read them.
 */
export const CME_LEARNER_RESTRICTION_COLUMNS: readonly RequiredColumn[] = [
  {
    table: "lms_enrollments",
    name: "cme_credit_restricted",
    definition: "TINYINT(1) NOT NULL DEFAULT 0",
  },
  {
    table: "lms_lessons",
    name: "hide_for_cme_restricted",
    definition: "TINYINT(1) NOT NULL DEFAULT 0",
  },
] as const;

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column/i.test(message);
}

async function listColumns(db: Db, table: RequiredColumn["table"]): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `);
  const rows = extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result);
  return new Set(rows.flatMap((row) => {
    const name = row.COLUMN_NAME ?? row.column_name;
    return name ? [name] : [];
  }));
}

/**
 * Idempotently brings an active Railway schema forward without touching learner
 * records, existing course access, or certificate data.
 */
export async function ensureCmeLearnerRestrictionsSchema(
  db: Db | null | undefined,
): Promise<{ applied: boolean; missingBefore: string[]; missingAfter: string[]; errors: string[] }> {
  const required = [...CME_LEARNER_RESTRICTION_COLUMNS];
  if (!db) {
    return {
      applied: false,
      missingBefore: required.map((column) => `${column.table}.${column.name}`),
      missingAfter: required.map((column) => `${column.table}.${column.name}`),
      errors: ["Database unavailable"],
    };
  }

  const columnsByTable = new Map<RequiredColumn["table"], Set<string>>();
  try {
    for (const table of ["lms_enrollments", "lms_lessons"] as const) {
      columnsByTable.set(table, await listColumns(db, table));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      applied: false,
      missingBefore: required.map((column) => `${column.table}.${column.name}`),
      missingAfter: required.map((column) => `${column.table}.${column.name}`),
      errors: [message],
    };
  }

  const missingBefore = required
    .filter((column) => !columnsByTable.get(column.table)?.has(column.name))
    .map((column) => `${column.table}.${column.name}`);
  const errors: string[] = [];

  for (const column of required) {
    const existing = columnsByTable.get(column.table);
    if (existing?.has(column.name)) continue;

    try {
      await db.execute(sql.raw(
        `ALTER TABLE \`${column.table}\` ADD COLUMN \`${column.name}\` ${column.definition}`,
      ));
      existing?.add(column.name);
    } catch (error) {
      if (isDuplicateColumnError(error)) {
        existing?.add(column.name);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${column.table}.${column.name}: ${message}`);
      console.error("[ensureCmeLearnerRestrictionsSchema] ADD failed:", column.table, column.name, message);
    }
  }

  const missingAfter = required
    .filter((column) => !columnsByTable.get(column.table)?.has(column.name))
    .map((column) => `${column.table}.${column.name}`);
  const applied = missingBefore.length > 0;
  if (applied && missingAfter.length === 0) {
    console.log("[ensureCmeLearnerRestrictionsSchema] CME learner restriction columns are ready");
  }

  return { applied, missingBefore, missingAfter, errors };
}
