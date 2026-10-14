import { sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";

let ensured = false;

/** Idempotent — matches drizzle/0097_railway_mysql_reconciliation.sql */
export async function ensureWebhookEventsTable(db: MySql2Database<typeof schema>): Promise<void> {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`webhookEvents\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`source\` VARCHAR(64) NOT NULL DEFAULT 'thinkific',
      \`stripeEventId\` VARCHAR(128) NULL,
      \`resource\` VARCHAR(64) NOT NULL,
      \`action\` VARCHAR(64) NOT NULL,
      \`email\` VARCHAR(255) NULL,
      \`productName\` VARCHAR(512) NULL,
      \`httpStatus\` INT NOT NULL DEFAULT 200,
      \`outcome\` VARCHAR(64) NOT NULL DEFAULT 'ignored',
      \`message\` TEXT NULL,
      \`rawPayload\` TEXT NULL,
      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`idx_webhookEvents_stripeEventId\` (\`stripeEventId\`)
    )
  `);
  ensured = true;
}
