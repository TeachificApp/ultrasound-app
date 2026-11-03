import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { resolveApplicationDatabaseUrl } from "./databaseUrl";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";
import { invalidateExpoTenantSchemaCache } from "./expoEventSchemaCompatibility";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type ExpoTenantMigrationResult = {
  status: "ready" | "failed" | "skipped";
  applied: boolean;
  error?: string;
};

/** Exactly the additive operation approved by the project owner. No seed or data updates. */
export const EXPO_TENANT_COLUMN_DDL = "ALTER TABLE `ultrasound_expo_events` ADD COLUMN `tenant` VARCHAR(40) NOT NULL DEFAULT 'ultrasound_expo' AFTER `id`";

/** A preview, a generic published container, or an unrelated database must never run this DDL. */
export function shouldRunExpoTenantStartupMigration(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production" || env.RAILWAY_PRIMARY === "false") return false;
  const railwayPrimary = env.RAILWAY_PRIMARY === "true"
    || env.RAILWAY_ENVIRONMENT === "production"
    || !!(env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID || env.RAILWAY_ENVIRONMENT_ID);
  return railwayPrimary && resolveApplicationDatabaseUrl(env) !== null;
}

async function listColumns(db: Db): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ultrasound_expo_events'
  `);
  return new Set(extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result)
    .flatMap(row => row.COLUMN_NAME ?? row.column_name ?? []));
}

function isConcurrentColumnAddition(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { code?: unknown; errno?: unknown; cause?: unknown };
  return failure.code === "ER_DUP_FIELDNAME" || failure.errno === 1060
    || (failure.cause !== error && isConcurrentColumnAddition(failure.cause));
}

/**
 * Startup-only, idempotent repair for the already-authored event identity schema.
 * Never executes the older migration's event seed, never alters existing dates,
 * and never reports success until INFORMATION_SCHEMA confirms the column.
 */
export async function ensureExpoTenantSchema(
  db: Db | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ExpoTenantMigrationResult> {
  if (!shouldRunExpoTenantStartupMigration(env)) return { status: "skipped", applied: false };
  if (!db) return { status: "failed", applied: false, error: "Railway MySQL is unavailable; the Expo identity migration was not applied." };

  try {
    const columns = await listColumns(db);
    if (columns.has("tenant")) {
      invalidateExpoTenantSchemaCache(db);
      return { status: "ready", applied: false };
    }
    if (!columns.has("id")) {
      return { status: "failed", applied: false, error: "The existing Expo events table was not found; no database change was attempted." };
    }

    let applied = false;
    try {
      await db.execute(sql.raw(EXPO_TENANT_COLUMN_DDL));
      applied = true;
    } catch (error) {
      // Several Railway replicas may start at once. Only a confirmed duplicate
      // column is acceptable, and it must still pass the verification below.
      if (!isConcurrentColumnAddition(error)) throw error;
    }

    if (!(await listColumns(db)).has("tenant")) {
      return { status: "failed", applied: false, error: "The Expo event identity column could not be verified; separate EchoExpo™ instance creation remains unavailable." };
    }
    invalidateExpoTenantSchemaCache(db);
    return { status: "ready", applied };
  } catch {
    // Database errors can contain credentials, connection strings or query
    // details. Keep the deployment log actionable without exposing those.
    return { status: "failed", applied: false, error: "Unable to apply or verify the approved Expo identity migration. Check the Railway MySQL connection and ALTER permission. Existing event data is unchanged." };
  }
}
