import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const TABLE_NAME = "auth_email_send_log";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS auth_email_send_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  email_type ENUM('magic_link', 'password_reset') NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_id INT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_email_send_email_type_sent (email, email_type, sent_at),
  INDEX idx_auth_email_send_ip_sent (ip_address, sent_at)
)`;

async function tableExists(db: Db): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${TABLE_NAME}
    LIMIT 1
  `);
  return extractExecuteRows<{ ok?: number }>(result).length > 0;
}

export async function inspectAuthEmailSendLogSchema(db: Db | null | undefined) {
  if (!db) {
    return { tableExists: false, error: "Database unavailable" };
  }
  try {
    const exists = await tableExists(db);
    return { tableExists: exists };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { tableExists: false, error: message };
  }
}

export async function ensureAuthEmailSendLogSchema(db: Db | null | undefined) {
  if (!db) {
    return { created: false, tableExists: false, error: "Database unavailable" };
  }

  const before = await tableExists(db);
  if (before) {
    return { created: false, tableExists: true };
  }

  await db.execute(sql.raw(CREATE_TABLE_SQL));
  const after = await tableExists(db);
  if (!after) {
    throw new Error(`Failed to create ${TABLE_NAME} table`);
  }

  console.log(`[Startup] Created missing ${TABLE_NAME} table (auth email rate limiting)`);
  return { created: true, tableExists: true };
}
