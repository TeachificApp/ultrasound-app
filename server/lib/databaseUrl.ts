type Environment = NodeJS.ProcessEnv;

function value(env: Environment, key: string): string | null {
  const candidate = env[key]?.trim();
  return candidate || null;
}

export function isRailwayMysqlUrl(databaseUrl: string | null | undefined): boolean {
  if (!databaseUrl) return false;
  return databaseUrl.includes(".rlwy.net") || databaseUrl.includes("railway.internal");
}

export function isLegacyManusDatabaseUrl(databaseUrl: string | null | undefined): boolean {
  if (!databaseUrl) return false;
  return databaseUrl.includes("tidbcloud.com") || databaseUrl.includes("prod.aws");
}

/**
 * Resolves the only permitted application database connection.
 *
 * A Railway deployment must use its Railway MySQL service reference. It must
 * never fall back to a Manus/TiDB `DATABASE_URL`: doing so can make a valid
 * purchase, enrollment, or password session appear missing to learners.
 *
 * Local development keeps `DATABASE_URL` as a conventional fallback.
 */
export function resolveApplicationDatabaseUrl(env: Environment = process.env): string | null {
  const isRailway = env.RAILWAY_PRIMARY === "true"
    || env.RAILWAY_ENVIRONMENT === "production"
    || env.RAILWAY_SERVICE_ID !== undefined;

  const explicitRailwayMysql = value(env, "RAILWAY_MYSQL_URL") || value(env, "MYSQL_URL");
  if (isRailway) {
    if (explicitRailwayMysql && isRailwayMysqlUrl(explicitRailwayMysql)) return explicitRailwayMysql;

    // Some Railway services expose the linked database directly as DATABASE_URL.
    // Accept it only when it is demonstrably the Railway MySQL service.
    const databaseUrl = value(env, "DATABASE_URL");
    if (databaseUrl && isRailwayMysqlUrl(databaseUrl)) return databaseUrl;

    // Fail closed instead of serving a second/legacy database. The startup guard
    // logs a clear configuration error without disclosing any credentials.
    return null;
  }

  return value(env, "DATABASE_URL") || explicitRailwayMysql;
}
