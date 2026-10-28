export type PrimaryHostMaintenanceEnv = Pick<
  NodeJS.ProcessEnv,
  "RAILWAY_PRIMARY" | "RAILWAY_ENVIRONMENT" | "ENABLE_IN_PROCESS_BACKGROUND_JOBS"
>;

/**
 * Recurring jobs and startup schema maintenance belong on a durable primary host.
 * Managed, scale-to-zero preview/publish containers should only serve HTTP traffic
 * unless explicitly configured as a dedicated worker.
 */
export function shouldRunPrimaryHostMaintenance(
  env: PrimaryHostMaintenanceEnv = process.env,
): boolean {
  if (env.ENABLE_IN_PROCESS_BACKGROUND_JOBS === "true") return true;
  if (env.RAILWAY_PRIMARY === "true") return true;

  return env.RAILWAY_ENVIRONMENT === "production" && env.RAILWAY_PRIMARY !== "false";
}
