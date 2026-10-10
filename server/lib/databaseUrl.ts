type Environment = NodeJS.ProcessEnv;

function value(env: Environment, key: string): string | null {
  const candidate = env[key]?.trim();
  return candidate || null;
}

/**
 * Resolves the sole application database connection.
 *
 * Railway production prefers its MySQL service reference. `DATABASE_URL` remains
 * a fallback so a correctly configured Railway service continues working when the
 * explicit MySQL reference has not yet been added.
 */
export function resolveApplicationDatabaseUrl(env: Environment = process.env): string | null {
  const isRailway = env.RAILWAY_PRIMARY === "true"
    || env.RAILWAY_ENVIRONMENT === "production"
    || env.RAILWAY_SERVICE_ID !== undefined;

  const railwayMysql = value(env, "RAILWAY_MYSQL_URL") || value(env, "MYSQL_URL");
  if (isRailway && railwayMysql) return railwayMysql;

  return value(env, "DATABASE_URL");
}

export function isRailwayMysqlUrl(databaseUrl: string | null | undefined): boolean {
  if (!databaseUrl) return false;
  return databaseUrl.includes(".rlwy.net") || databaseUrl.includes("railway.internal");
}
