import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function ensureCohortDripSchema(db: Db | null | undefined) {
  if (!db) return { ensured: false, error: "Database unavailable" };
  const additions = [
    ["lms_cohort_assignments", "lesson_id", "INT NULL"],
    ["lms_cohort_assignments", "drip_days", "INT NOT NULL DEFAULT 0"],
    ["lms_cohort_recordings", "drip_days", "INT NOT NULL DEFAULT 0"],
    ["lms_cohort_groups", "recordings_enabled", "BOOLEAN NOT NULL DEFAULT TRUE"],
  ] as const;
  try {
    for (const [table, column, definition] of additions) {
      const existing = await db.execute(sql`SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column} LIMIT 1`);
      const rows = (existing as any)[0] ?? [];
      if (rows.length === 0) await db.execute(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`));
    }
    const indexRows = (await db.execute(sql`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'lms_cohort_assignments' AND index_name = 'lms_cohort_assignments_lesson_idx' LIMIT 1`) as any)[0] ?? [];
    if (indexRows.length === 0) await db.execute(sql.raw("CREATE INDEX `lms_cohort_assignments_lesson_idx` ON `lms_cohort_assignments` (`lesson_id`)"));
    return { ensured: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ensureCohortDripSchema]", message);
    return { ensured: false, error: message };
  }
}
