import { isRailwayMysqlUrl, resolveApplicationDatabaseUrl } from "./databaseUrl";

/** Log once at boot when production may be pointed at the wrong database. */
export function logProductionDatabaseConfigurationWarnings(env: NodeJS.ProcessEnv = process.env): void {
  const onRailway =
    env.RAILWAY_PRIMARY === "true"
    || env.RAILWAY_ENVIRONMENT === "production"
    || env.RAILWAY_SERVICE_ID !== undefined;

  if (!onRailway && env.NODE_ENV !== "production") return;

  const resolved = resolveApplicationDatabaseUrl(env);
  if (!resolved) {
    console.error("[Database] No DATABASE_URL / RAILWAY_MYSQL_URL / MYSQL_URL configured.");
    return;
  }

  const isLegacyManusTiDb =
    resolved.includes("tidbcloud.com")
    || resolved.includes("gateway06.us-east-1.prod.aws");

  if (isLegacyManusTiDb) {
    console.error(
      "[Database] CRITICAL: Resolved URL looks like legacy Manus TiDB. "
        + "Set RAILWAY_MYSQL_URL (or DATABASE_URL) to Railway MySQL so learners and Stripe share one database.",
    );
    return;
  }

  if (onRailway && !isRailwayMysqlUrl(resolved)) {
    console.warn(
      "[Database] Railway deployment resolved a non-Railway MySQL host. Verify RAILWAY_MYSQL_URL / MYSQL_URL wiring.",
    );
  }
}
