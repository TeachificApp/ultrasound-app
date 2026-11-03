import { sql } from "drizzle-orm";
import type { getDb } from "../db";
import { shouldRunExpoTenantStartupMigration } from "./ensureExpoTenantSchema";
import {
  EXPO_COMBINED_GROUP_TABLE_DDL, EXPO_COMBINED_SCHEMA_ADDITIONS,
  combinedGroupColumnsReady, hasCombinedSchemaColumn, hasCombinedSchemaIndex,
  inspectExpoCombinedOfferSchema, isExpoCombinedOfferSchemaReady,
  type ExpoCombinedSchemaState,
} from "./expoCombinedOfferSchema";

export { EXPO_COMBINED_GROUP_TABLE_DDL, EXPO_COMBINED_SCHEMA_ADDITIONS } from "./expoCombinedOfferSchema";
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type ExpoCombinedOfferMigrationResult = { status: "ready" | "failed" | "skipped"; applied: boolean; error?: string };

/** Same production Railway + application MySQL allowlist as the earlier approved migration. */
export const shouldRunExpoCombinedOfferStartupMigration = shouldRunExpoTenantStartupMigration;

function concurrentAddition(error: unknown, kind: "column" | "index"): boolean {
  const seen = new Set<object>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (kind === "column" && (value.code === "ER_DUP_FIELDNAME" || value.errno === 1060)) return true;
    if (kind === "index" && (value.code === "ER_DUP_KEYNAME" || value.errno === 1061)) return true;
    current = value.cause;
  }
  return false;
}

function existingSchemaCompatible(state: ExpoCombinedSchemaState): boolean {
  // Only the two already-authored nullable links may be added. Never MODIFY an
  // existing differently typed column, recreate a table, or rewrite a payment.
  for (const addition of EXPO_COMBINED_SCHEMA_ADDITIONS) {
    if (addition.kind === "column") {
      if (state.columns.some(row => row.TABLE_NAME === addition.table && row.COLUMN_NAME === addition.column)
        && !hasCombinedSchemaColumn(state, addition.table, addition.column)) return false;
    } else if (state.indexes.some(row => row.TABLE_NAME === addition.table && row.INDEX_NAME === addition.index)
      && !hasCombinedSchemaIndex(state, addition.table, addition.index, addition.columns, addition.unique)) return false;
  }
  const groupExists = state.columns.some(row => row.TABLE_NAME === "ultrasound_expo_checkout_groups");
  return !groupExists || (combinedGroupColumnsReady(state)
    && hasCombinedSchemaIndex(state, "ultrasound_expo_checkout_groups", "PRIMARY", ["id"], true));
}

/**
 * Owner-approved startup migration for the two-event 20% offer. This deliberately
 * does not execute 0119's event date/copy updates, seed packages, pair options,
 * activate prices, send email or run any payment/fulfillment operation.
 * MySQL DDL is non-transactional: partial additions are safe to resume next boot.
 */
export async function ensureExpoCombinedOfferSchema(
  db: Db | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ExpoCombinedOfferMigrationResult> {
  if (!shouldRunExpoCombinedOfferStartupMigration(env)) return { status: "skipped", applied: false };
  if (!db) return { status: "failed", applied: false, error: "Railway MySQL is unavailable; the combined Expo migration was not applied." };
  try {
    let state = await inspectExpoCombinedOfferSchema(db);
    if (!hasCombinedSchemaColumn(state, "ultrasound_expo_packages", "id", "int", "NO")
      || !state.columns.some(row => row.TABLE_NAME === "ultrasound_expo_packages" && row.COLUMN_NAME === "is_active")
      || !hasCombinedSchemaColumn(state, "ultrasound_expo_registrations", "id", "int", "NO")
      || !state.columns.some(row => row.TABLE_NAME === "ultrasound_expo_registrations" && row.COLUMN_NAME === "vendor_application_id")) {
      return { status: "failed", applied: false, error: "The existing Expo package or registration table is unavailable. No schema change was attempted." };
    }
    if (!existingSchemaCompatible(state)) {
      return { status: "failed", applied: false, error: "Existing combined Expo schema differs from the approved structure. No existing columns, indexes or records were replaced." };
    }
    if (isExpoCombinedOfferSchemaReady(state)) return { status: "ready", applied: false };
    let applied = false;
    if (!state.columns.some(row => row.TABLE_NAME === "ultrasound_expo_checkout_groups")) {
      await db.execute(sql.raw(EXPO_COMBINED_GROUP_TABLE_DDL));
      applied = true;
      state = await inspectExpoCombinedOfferSchema(db);
      if (!existingSchemaCompatible(state) || !combinedGroupColumnsReady(state)) throw new Error("Combined group table verification failed");
    }
    for (const addition of EXPO_COMBINED_SCHEMA_ADDITIONS) {
      const present = addition.kind === "column"
        ? hasCombinedSchemaColumn(state, addition.table, addition.column)
        : hasCombinedSchemaIndex(state, addition.table, addition.index, addition.columns, addition.unique);
      if (present) continue;
      try { await db.execute(sql.raw(addition.ddl)); applied = true; }
      catch (error) { if (!concurrentAddition(error, addition.kind)) throw error; }
      state = await inspectExpoCombinedOfferSchema(db);
      const verified = addition.kind === "column"
        ? hasCombinedSchemaColumn(state, addition.table, addition.column)
        : hasCombinedSchemaIndex(state, addition.table, addition.index, addition.columns, addition.unique);
      if (!verified || !existingSchemaCompatible(state)) throw new Error("Combined schema addition verification failed");
    }
    // Never signal readiness from the existence of the pairing column alone.
    if (!isExpoCombinedOfferSchemaReady(await inspectExpoCombinedOfferSchema(db))) throw new Error("Complete combined checkout schema verification failed");
    return { status: "ready", applied };
  } catch {
    return { status: "failed", applied: false, error: "Unable to apply or verify the approved combined Expo migration. Check Railway MySQL CREATE, ALTER and INDEX permissions. Existing event dates, packages, prices, pairings and registrations were not changed; verified additive steps can resume on the next deployment." };
  }
}
