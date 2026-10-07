import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Additive IP location fields introduced by drizzle/0066_ip_access_log_location.sql.
 * Railway can deploy code against an older mirror before that migration has run.
 * Keeping this list here makes the application safe to start in that state without
 * rewriting or removing a single access log.
 */
export const IP_ACCESS_LOG_LOCATION_COLUMNS = [
  { name: "geo_lookup_status", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_lookup_status` VARCHAR(16) NULL" },
  { name: "geo_country", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_country` VARCHAR(96) NULL" },
  { name: "geo_region", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_region` VARCHAR(128) NULL" },
  { name: "geo_city", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_city` VARCHAR(128) NULL" },
  { name: "geo_postal_code", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_postal_code` VARCHAR(32) NULL" },
  { name: "geo_latitude", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_latitude` DECIMAL(10,7) NULL" },
  { name: "geo_longitude", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_longitude` DECIMAL(10,7) NULL" },
  { name: "geo_timezone", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_timezone` VARCHAR(128) NULL" },
  { name: "geo_isp", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_isp` VARCHAR(255) NULL" },
  { name: "geo_organization", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_organization` VARCHAR(255) NULL" },
  { name: "geo_asn", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_asn` VARCHAR(32) NULL" },
  { name: "geo_resolved_at", ddl: "ALTER TABLE `ip_access_logs` ADD COLUMN `geo_resolved_at` TIMESTAMP NULL" },
] as const;

async function listColumns(db: Db): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ip_access_logs'
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
 * Applies only the missing, additive IP-location columns before any content-access
 * request can write to ip_access_logs. It is idempotent and never changes log rows.
 */
export async function ensureIpAccessLogLocationSchema(
  db: Db | null | undefined,
): Promise<{ applied: string[]; error?: string }> {
  if (!db) return { applied: [], error: "Database unavailable" };

  const applied: string[] = [];
  try {
    const columns = await listColumns(db);
    for (const column of IP_ACCESS_LOG_LOCATION_COLUMNS) {
      if (columns.has(column.name)) continue;
      try {
        await db.execute(sql.raw(column.ddl));
        columns.add(column.name);
        applied.push(column.name);
      } catch (error) {
        if (isDuplicateColumnError(error)) {
          columns.add(column.name);
          continue;
        }
        throw error;
      }
    }
    if (applied.length > 0) {
      console.log(`[ensureIpAccessLogLocationSchema] Added columns: ${applied.join(", ")}`);
    }
    return { applied };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ensureIpAccessLogLocationSchema]", message);
    return { applied, error: message };
  }
}
