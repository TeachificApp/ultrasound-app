import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Adds the opaque session binding introduced by drizzle/0064_railway_single_active_device_sessions.sql.
 * Railway mirrors can run newer SSO code before this additive column is available.
 * A NULL value keeps legacy SSO tokens redeemable while newer tokens preserve the approved browser session.
 */
export const SSO_TOKEN_SESSION_COLUMN = {
  name: "session_id",
  ddl: "ALTER TABLE `sso_tokens` ADD COLUMN `session_id` VARCHAR(96) NULL AFTER `user_id`",
} as const;

async function listColumns(db: Db): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sso_tokens'
  `);
  const rows = extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result);
  return new Set(rows.flatMap((row) => {
    const name = row.COLUMN_NAME ?? row.column_name;
    return name ? [name] : [];
  }));
}

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column/i.test(message);
}

/**
 * Ensures an older database accepts SSO token reads and writes before the app
 * begins accepting requests. The operation is additive, idempotent, and never
 * modifies existing token rows.
 */
export async function ensureSsoTokenSessionSchema(
  db: Db | null | undefined,
): Promise<{ applied: boolean; error?: string }> {
  if (!db) return { applied: false, error: "Database unavailable" };

  try {
    const columns = await listColumns(db);
    if (columns.has(SSO_TOKEN_SESSION_COLUMN.name)) return { applied: false };

    try {
      await db.execute(sql.raw(SSO_TOKEN_SESSION_COLUMN.ddl));
      console.log("[ensureSsoTokenSessionSchema] Added session_id to sso_tokens");
      return { applied: true };
    } catch (error) {
      if (isDuplicateColumnError(error)) return { applied: false };
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ensureSsoTokenSessionSchema]", message);
    return { applied: false, error: message };
  }
}
