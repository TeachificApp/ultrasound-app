import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Columns added after the original Manus TiDB mirror — required by current app queries. */
export const LMS_COURSES_REQUIRED_COLUMNS = [
  "bundle_only",
  "show_in_library",
  "enrollment_close_date",
  "meta_keywords",
  "certificate_template_id",
  "credit_hours",
  "certificate_title_override",
  "show_instructor",
  "hide_progress",
  "course_overview_top_blocks",
  "course_overview_blocks",
  "course_overview_bottom_blocks",
  "send_enrollment_email",
  "custom_thank_you_enabled",
  "custom_thank_you_blocks",
  "post_purchase_redirect_url",
  "welcome_email_enabled",
  "welcome_email_subject",
  "welcome_email_body",
  "hide_pricing_options",
  "upsell_enabled",
  "upsell_course_id",
  "upsell_product_type",
  "upsell_product_id",
  "upsell_headline",
  "upsell_description",
  "completion_redirect_url",
  "completion_email_enabled",
  "completion_email_subject",
  "completion_email_body",
  "primary_color",
  "accent_color",
  "gradient_from",
  "gradient_to",
  "gradient_direction",
  "thumbnail_url",
  "custom_labels",
  "default_mark_complete",
  "player_theme",
  "allow_group_purchase",
  "library_order",
  "publish_domain",
  "multi_cohort_mode",
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
  "player_sidebar_blocks",
  "purchase_terms_text",
  "purchase_terms_link_text_1",
  "purchase_terms_link_url_1",
  "purchase_terms_link_text_2",
  "purchase_terms_link_url_2",
] as const;

/** Plain ADD COLUMN definitions (Railway MySQL does not support ADD COLUMN IF NOT EXISTS). */
const LMS_COURSES_COLUMN_DEFS: Record<(typeof LMS_COURSES_REQUIRED_COLUMNS)[number], string> = {
  enrollment_close_date: "TIMESTAMP NULL",
  bundle_only: "TINYINT(1) NOT NULL DEFAULT 0",
  meta_keywords: "TEXT NULL",
  certificate_template_id: "INT NULL",
  credit_hours: "VARCHAR(16) NULL",
  certificate_title_override: "VARCHAR(512) NULL",
  show_instructor: "TINYINT(1) NOT NULL DEFAULT 0",
  hide_progress: "TINYINT(1) NOT NULL DEFAULT 0",
  show_in_library: "TINYINT(1) NOT NULL DEFAULT 1",
  course_overview_top_blocks: "LONGTEXT NULL",
  course_overview_blocks: "LONGTEXT NULL",
  course_overview_bottom_blocks: "LONGTEXT NULL",
  send_enrollment_email: "TINYINT(1) NOT NULL DEFAULT 1",
  custom_thank_you_enabled: "TINYINT(1) NOT NULL DEFAULT 0",
  custom_thank_you_blocks: "LONGTEXT NULL",
  post_purchase_redirect_url: "VARCHAR(1024) NULL",
  welcome_email_enabled: "TINYINT(1) NOT NULL DEFAULT 1",
  welcome_email_subject: "VARCHAR(500) NULL",
  welcome_email_body: "LONGTEXT NULL",
  hide_pricing_options: "TINYINT(1) NOT NULL DEFAULT 0",
  upsell_enabled: "TINYINT(1) NOT NULL DEFAULT 0",
  upsell_course_id: "INT NULL",
  upsell_product_type: "VARCHAR(20) NULL",
  upsell_product_id: "INT NULL",
  upsell_headline: "VARCHAR(500) NULL",
  upsell_description: "TEXT NULL",
  completion_redirect_url: "VARCHAR(1024) NULL",
  completion_email_enabled: "TINYINT(1) NOT NULL DEFAULT 0",
  completion_email_subject: "VARCHAR(500) NULL",
  completion_email_body: "LONGTEXT NULL",
  primary_color: "VARCHAR(20) DEFAULT '#179ca3'",
  accent_color: "VARCHAR(20) DEFAULT '#0d9488'",
  gradient_from: "VARCHAR(20) DEFAULT '#179ca3'",
  gradient_to: "VARCHAR(20) DEFAULT '#0d9488'",
  gradient_direction: "VARCHAR(30) DEFAULT '135deg'",
  thumbnail_url: "TEXT NULL",
  custom_labels: "LONGTEXT NULL",
  default_mark_complete: "INT NOT NULL DEFAULT 1",
  player_theme: "ENUM('light','dark') NOT NULL DEFAULT 'light'",
  allow_group_purchase: "TINYINT(1) NOT NULL DEFAULT 1",
  library_order: "INT NOT NULL DEFAULT 0",
  publish_domain: "VARCHAR(255) NULL",
  multi_cohort_mode: "TINYINT(1) NOT NULL DEFAULT 0",
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
  player_sidebar_blocks: "LONGTEXT NULL",
  purchase_terms_text: "TEXT NULL",
  purchase_terms_link_text_1: "VARCHAR(255) NULL",
  purchase_terms_link_url_1: "VARCHAR(2048) NULL",
  purchase_terms_link_text_2: "VARCHAR(255) NULL",
  purchase_terms_link_url_2: "VARCHAR(2048) NULL",
};

const MODIFY_STATEMENTS = [
  "ALTER TABLE `lms_courses` MODIFY COLUMN `status` ENUM('draft','public','hidden','private','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft'",
  "ALTER TABLE `lms_courses` MODIFY COLUMN `type` ENUM('course','quiz','download','cohort','workshop') NOT NULL DEFAULT 'course'",
  "ALTER TABLE `lms_courses` MODIFY COLUMN `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00",
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
  const rows = await db.execute(
    sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tableName}`,
  );
  const list = Array.isArray(rows)
    ? rows
    : Array.isArray((rows as { 0?: unknown[] })?.[0])
      ? (rows as unknown as [Array<{ COLUMN_NAME?: string; column_name?: string }>])[0]
      : [];
  const names = new Set<string>();
  for (const row of list as Array<{ COLUMN_NAME?: string; column_name?: string }>) {
    const name = row.COLUMN_NAME ?? row.column_name;
    if (name) names.add(name);
  }
  return names;
}

export async function inspectLmsCoursesSchema(db: Db | null | undefined) {
  if (!db) {
    return {
      tableExists: false,
      missingColumns: [...LMS_COURSES_REQUIRED_COLUMNS],
      courseCount: null as number | null,
      featuredPublicCount: null as number | null,
      queryOk: false,
      queryError: "Database unavailable",
    };
  }

  let tableExists = true;
  let missingColumns: string[] = [];
  let courseCount: number | null = null;
  let featuredPublicCount: number | null = null;
  let queryOk = false;
  let queryError: string | null = null;

  try {
    const columns = await listTableColumns(db, "lms_courses");
    missingColumns = LMS_COURSES_REQUIRED_COLUMNS.filter((col) => !columns.has(col));
  } catch (err) {
    tableExists = false;
    queryError = err instanceof Error ? err.message : "Failed to inspect columns";
    missingColumns = [...LMS_COURSES_REQUIRED_COLUMNS];
  }

  try {
    const countRows = await db.execute(sql`SELECT COUNT(*) AS c FROM lms_courses`);
    const countRow = Array.isArray(countRows)
      ? countRows[0]
      : (countRows as unknown as [Array<{ c?: number }>])?.[0]?.[0];
    courseCount = Number((countRow as { c?: number })?.c ?? 0);
  } catch {
    courseCount = null;
  }

  try {
    await db.execute(
      sql`SELECT id FROM lms_courses WHERE status = 'public' AND is_featured = 1 LIMIT 1`,
    );
    queryOk = true;
    const featuredRows = await db.execute(
      sql`SELECT COUNT(*) AS c FROM lms_courses WHERE status = 'public' AND is_featured = 1`,
    );
    const featuredRow = Array.isArray(featuredRows)
      ? featuredRows[0]
      : (featuredRows as unknown as [Array<{ c?: number }>])?.[0]?.[0];
    featuredPublicCount = Number((featuredRow as { c?: number })?.c ?? 0);
  } catch (err) {
    queryOk = false;
    queryError = err instanceof Error ? err.message : "Featured courses query failed";
  }

  return {
    tableExists,
    missingColumns,
    courseCount,
    featuredPublicCount,
    queryOk,
    queryError,
  };
}

async function runAlter(db: Db, statement: string): Promise<void> {
  await db.execute(sql.raw(statement));
}

/** Idempotent schema sync for Railway MySQL after Manus mirror. Safe to run on every startup. */
export async function ensureLmsCoursesSchema(db: Db | null | undefined): Promise<{
  applied: boolean;
  missingBefore: string[];
  missingAfter: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  if (!db) {
    return {
      applied: false,
      missingBefore: [...LMS_COURSES_REQUIRED_COLUMNS],
      missingAfter: [...LMS_COURSES_REQUIRED_COLUMNS],
      errors: ["Database unavailable"],
    };
  }

  const before = await inspectLmsCoursesSchema(db);
  if (before.missingColumns.length === 0 && before.queryOk) {
    return {
      applied: false,
      missingBefore: [],
      missingAfter: [],
      errors: [],
    };
  }

  let existingColumns = await listTableColumns(db, "lms_courses");

  for (const statement of MODIFY_STATEMENTS) {
    try {
      await runAlter(db, statement);
    } catch (err) {
      const message = formatSqlError(err);
      if (!isBenignAlterError(message)) {
        errors.push(message);
        console.error("[ensureLmsCoursesSchema] MODIFY failed:", statement.slice(0, 80), message);
      }
    }
  }

  for (const column of LMS_COURSES_REQUIRED_COLUMNS) {
    if (existingColumns.has(column)) continue;
    const definition = LMS_COURSES_COLUMN_DEFS[column];
    const statement = `ALTER TABLE \`lms_courses\` ADD COLUMN \`${column}\` ${definition}`;
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
      console.error("[ensureLmsCoursesSchema] ADD failed:", column, message);
    }
  }

  const after = await inspectLmsCoursesSchema(db);
  const applied = before.missingColumns.length > 0 || !before.queryOk;
  if (applied && after.queryOk) {
    console.log(
      `[ensureLmsCoursesSchema] OK — courses=${after.courseCount}, featured public=${after.featuredPublicCount}`,
    );
  } else if (applied) {
    console.error(
      `[ensureLmsCoursesSchema] Incomplete — missing=${after.missingColumns.length}, queryError=${after.queryError}`,
    );
  }

  return {
    applied,
    missingBefore: before.missingColumns,
    missingAfter: after.missingColumns,
    errors,
  };
}
