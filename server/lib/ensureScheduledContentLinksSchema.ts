import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Ensures the additive scheduled-content table exists when application code
 * reaches Railway ahead of the matching migration. This never changes user,
 * enrollment, payment, resource, recording, or schedule data.
 */
export async function ensureScheduledContentLinksSchema(db: Db | null | undefined) {
  if (!db) return { ensured: false, error: "Database unavailable" };
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS \`scheduled_content_links\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`source_type\` ENUM('cohort_group','workshop_instance') NOT NULL,
        \`source_id\` INT NOT NULL,
        \`target_type\` ENUM('course','download','webinar','workshop_instance') NOT NULL,
        \`target_id\` INT NOT NULL,
        \`access_duration_days\` INT NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`created_by_user_id\` INT NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`scheduled_content_links_source_idx\` (\`source_type\`, \`source_id\`, \`sort_order\`),
        INDEX \`scheduled_content_links_target_idx\` (\`target_type\`, \`target_id\`)
      )
    `));
    return { ensured: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ensureScheduledContentLinksSchema]", message);
    return { ensured: false, error: message };
  }
}
