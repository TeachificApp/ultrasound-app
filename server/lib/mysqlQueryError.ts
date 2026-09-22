import { DrizzleQueryError } from "drizzle-orm/errors";

function readMysqlCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function readMysqlMessage(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const message = (err as { sqlMessage?: unknown; message?: unknown }).sqlMessage
    ?? (err as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

/** User-safe message for Drizzle/MySQL failures (no params or secrets). */
export function formatMysqlQueryError(err: unknown, context: string): string {
  const cause = err instanceof DrizzleQueryError ? err.cause : err;
  const code = readMysqlCode(cause);
  const sqlMessage = readMysqlMessage(cause);

  if (code === "ER_NO_SUCH_TABLE" && sqlMessage?.includes("study_group")) {
    return `${context}: Study Groups database tables are not installed yet. Apply drizzle/0070_study_groups.sql (and drizzle/0073_study_group_legacy_period_compat.sql) on Railway MySQL, then retry.`;
  }
  if (code === "ER_BAD_FIELD_ERROR" && sqlMessage?.includes("study_group")) {
    return `${context}: Study Groups schema is out of date on Railway MySQL. Apply drizzle/0070_study_groups.sql and drizzle/0073_study_group_legacy_period_compat.sql, then redeploy.`;
  }

  if (sqlMessage) return `${context}: ${sqlMessage}`;
  if (err instanceof Error && err.message && !err.message.startsWith("Failed query:")) {
    return `${context}: ${err.message}`;
  }
  return `${context}. Please try again or contact support if this continues.`;
}
