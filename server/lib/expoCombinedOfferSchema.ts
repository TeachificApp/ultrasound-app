import { sql } from "drizzle-orm";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

export type MetadataColumn = { TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string };
export type MetadataIndex = { TABLE_NAME: string; INDEX_NAME: string; COLUMN_NAME: string; SEQ_IN_INDEX: number; NON_UNIQUE: number };
export type ExpoCombinedSchemaState = { columns: MetadataColumn[]; indexes: MetadataIndex[] };
type Db = { execute: (statement: ReturnType<typeof sql>) => Promise<unknown> };

export const EXPO_COMBINED_GROUP_TABLE_DDL = `CREATE TABLE IF NOT EXISTS \`ultrasound_expo_checkout_groups\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`user_id\` INT NOT NULL,
  \`vendor_application_id\` INT NULL,
  \`package_type\` ENUM('registrant','exhibitor','sponsor') NOT NULL,
  \`subtotal_cents\` INT NOT NULL,
  \`discount_cents\` INT NOT NULL,
  \`amount_cents\` INT NOT NULL,
  \`currency\` VARCHAR(8) NOT NULL DEFAULT 'usd',
  \`stripe_session_id\` VARCHAR(255) NULL,
  \`stripe_payment_intent_id\` VARCHAR(255) NULL,
  \`payment_status\` ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  \`paid_at\` TIMESTAMP NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`ultrasound_expo_checkout_groups_session_unique\` (\`stripe_session_id\`),
  KEY \`ultrasound_expo_checkout_groups_user_status_idx\` (\`user_id\`, \`payment_status\`),
  KEY \`ultrasound_expo_checkout_groups_vendor_application_idx\` (\`vendor_application_id\`)
)`;

export const EXPO_COMBINED_GROUP_COLUMNS = [
  ["id", "int", "NO"], ["user_id", "int", "NO"], ["vendor_application_id", "int", "YES"],
  ["package_type", "enum", "NO"], ["subtotal_cents", "int", "NO"], ["discount_cents", "int", "NO"],
  ["amount_cents", "int", "NO"], ["currency", "varchar", "NO"], ["stripe_session_id", "varchar", "YES"],
  ["stripe_payment_intent_id", "varchar", "YES"], ["payment_status", "enum", "NO"],
  ["paid_at", "timestamp", "YES"], ["created_at", "timestamp", "NO"], ["updated_at", "timestamp", "NO"],
] as const;

export const EXPO_COMBINED_SCHEMA_ADDITIONS = [
  { kind: "column", table: "ultrasound_expo_packages", column: "combined_with_package_id", ddl: "ALTER TABLE `ultrasound_expo_packages` ADD COLUMN `combined_with_package_id` INT NULL AFTER `is_active`" },
  { kind: "column", table: "ultrasound_expo_registrations", column: "checkout_group_id", ddl: "ALTER TABLE `ultrasound_expo_registrations` ADD COLUMN `checkout_group_id` INT NULL AFTER `vendor_application_id`" },
  { kind: "index", table: "ultrasound_expo_packages", index: "ultrasound_expo_packages_combined_with_idx", columns: ["combined_with_package_id"], unique: false, ddl: "CREATE INDEX `ultrasound_expo_packages_combined_with_idx` ON `ultrasound_expo_packages` (`combined_with_package_id`)" },
  { kind: "index", table: "ultrasound_expo_registrations", index: "ultrasound_expo_registrations_checkout_group_idx", columns: ["checkout_group_id"], unique: false, ddl: "CREATE INDEX `ultrasound_expo_registrations_checkout_group_idx` ON `ultrasound_expo_registrations` (`checkout_group_id`)" },
  { kind: "index", table: "ultrasound_expo_checkout_groups", index: "ultrasound_expo_checkout_groups_session_unique", columns: ["stripe_session_id"], unique: true, ddl: "CREATE UNIQUE INDEX `ultrasound_expo_checkout_groups_session_unique` ON `ultrasound_expo_checkout_groups` (`stripe_session_id`)" },
  { kind: "index", table: "ultrasound_expo_checkout_groups", index: "ultrasound_expo_checkout_groups_user_status_idx", columns: ["user_id", "payment_status"], unique: false, ddl: "CREATE INDEX `ultrasound_expo_checkout_groups_user_status_idx` ON `ultrasound_expo_checkout_groups` (`user_id`, `payment_status`)" },
  { kind: "index", table: "ultrasound_expo_checkout_groups", index: "ultrasound_expo_checkout_groups_vendor_application_idx", columns: ["vendor_application_id"], unique: false, ddl: "CREATE INDEX `ultrasound_expo_checkout_groups_vendor_application_idx` ON `ultrasound_expo_checkout_groups` (`vendor_application_id`)" },
] as const;

/** Metadata only: no table contents, recipient details, payment IDs or row writes. */
export async function inspectExpoCombinedOfferSchema(db: Db): Promise<ExpoCombinedSchemaState> {
  const [columnsResult, indexesResult] = await Promise.all([
    db.execute(sql`SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('ultrasound_expo_packages', 'ultrasound_expo_registrations', 'ultrasound_expo_checkout_groups')`),
    db.execute(sql`SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('ultrasound_expo_packages', 'ultrasound_expo_registrations', 'ultrasound_expo_checkout_groups')`),
  ]);
  return { columns: extractExecuteRows<MetadataColumn>(columnsResult), indexes: extractExecuteRows<MetadataIndex>(indexesResult) };
}

export function hasCombinedSchemaColumn(state: ExpoCombinedSchemaState, table: string, column: string, type = "int", nullable = "YES"): boolean {
  return state.columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === column && row.DATA_TYPE.toLowerCase() === type && row.IS_NULLABLE.toUpperCase() === nullable);
}

export function hasCombinedSchemaIndex(state: ExpoCombinedSchemaState, table: string, name: string, columns: readonly string[], unique: boolean): boolean {
  const rows = state.indexes.filter(row => row.TABLE_NAME === table && row.INDEX_NAME === name).sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
  return rows.length === columns.length && rows.every((row, index) => row.COLUMN_NAME === columns[index] && Number(row.SEQ_IN_INDEX) === index + 1 && Number(row.NON_UNIQUE) === (unique ? 0 : 1));
}

export function combinedGroupColumnsReady(state: ExpoCombinedSchemaState): boolean {
  return EXPO_COMBINED_GROUP_COLUMNS.every(([column, type, nullable]) => hasCombinedSchemaColumn(state, "ultrasound_expo_checkout_groups", column, type, nullable));
}

export function isExpoCombinedOfferSchemaReady(state: ExpoCombinedSchemaState): boolean {
  return combinedGroupColumnsReady(state)
    && hasCombinedSchemaIndex(state, "ultrasound_expo_checkout_groups", "PRIMARY", ["id"], true)
    && EXPO_COMBINED_SCHEMA_ADDITIONS.every(addition => addition.kind === "column"
      ? hasCombinedSchemaColumn(state, addition.table, addition.column)
      : hasCombinedSchemaIndex(state, addition.table, addition.index, addition.columns, addition.unique));
}

/** Do not unlock payment after only one column is added; fulfillment needs all three structures. */
export async function expoCombinedCheckoutSchemaAvailable(db: Db): Promise<boolean> {
  try { return isExpoCombinedOfferSchemaReady(await inspectExpoCombinedOfferSchema(db)); }
  catch { return false; }
}
