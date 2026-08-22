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

  const alterStatements = [
    "ALTER TABLE `lms_courses` MODIFY COLUMN `status` ENUM('draft','public','hidden','private','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft'",
    "ALTER TABLE `lms_courses` MODIFY COLUMN `type` ENUM('course','quiz','download','cohort','workshop') NOT NULL DEFAULT 'course'",
    "ALTER TABLE `lms_courses` MODIFY COLUMN `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `enrollment_close_date` TIMESTAMP NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `bundle_only` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `meta_keywords` TEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `certificate_template_id` INT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `credit_hours` VARCHAR(16) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `certificate_title_override` VARCHAR(512) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `show_instructor` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `hide_progress` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `show_in_library` TINYINT(1) NOT NULL DEFAULT 1",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `course_overview_top_blocks` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `course_overview_blocks` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `course_overview_bottom_blocks` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `send_enrollment_email` TINYINT(1) NOT NULL DEFAULT 1",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `custom_thank_you_enabled` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `custom_thank_you_blocks` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `post_purchase_redirect_url` VARCHAR(1024) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `welcome_email_enabled` TINYINT(1) NOT NULL DEFAULT 1",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `welcome_email_subject` VARCHAR(500) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `welcome_email_body` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `hide_pricing_options` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `upsell_enabled` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `upsell_course_id` INT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `upsell_product_type` VARCHAR(20) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `upsell_product_id` INT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `upsell_headline` VARCHAR(500) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `upsell_description` TEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `completion_redirect_url` VARCHAR(1024) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `completion_email_enabled` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `completion_email_subject` VARCHAR(500) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `completion_email_body` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `primary_color` VARCHAR(20) DEFAULT '#179ca3'",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `accent_color` VARCHAR(20) DEFAULT '#0d9488'",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `gradient_from` VARCHAR(20) DEFAULT '#179ca3'",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `gradient_to` VARCHAR(20) DEFAULT '#0d9488'",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `gradient_direction` VARCHAR(30) DEFAULT '135deg'",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `thumbnail_url` TEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `custom_labels` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `default_mark_complete` INT NOT NULL DEFAULT 1",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `player_theme` ENUM('light','dark') NOT NULL DEFAULT 'light'",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `allow_group_purchase` TINYINT(1) NOT NULL DEFAULT 1",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `library_order` INT NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `publish_domain` VARCHAR(255) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `multi_cohort_mode` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_enabled` TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_heading` VARCHAR(500) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_body` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_cta_label` VARCHAR(255) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_cta_url` VARCHAR(2048) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_redirect_url` VARCHAR(2048) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `waitlist_success_message` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `presale_welcome_heading` VARCHAR(500) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `presale_welcome_body` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `presale_welcome_media_url` TEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `presale_welcome_cta_label` VARCHAR(255) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `presale_welcome_cta_url` VARCHAR(2048) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `player_sidebar_blocks` LONGTEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `purchase_terms_text` TEXT NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `purchase_terms_link_text_1` VARCHAR(255) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `purchase_terms_link_url_1` VARCHAR(2048) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `purchase_terms_link_text_2` VARCHAR(255) NULL",
    "ALTER TABLE `lms_courses` ADD COLUMN IF NOT EXISTS `purchase_terms_link_url_2` VARCHAR(2048) NULL",
  ];

  for (const statement of alterStatements) {
    try {
      await runAlter(db, statement);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      console.error("[ensureLmsCoursesSchema] Statement failed:", statement.slice(0, 80), message);
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
