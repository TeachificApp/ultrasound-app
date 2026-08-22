/**
 * Resolve MySQL connection URL from common Railway / Manus env var names.
 * Railway's MySQL plugin may expose MYSQL_URL or DATABASE_PUBLIC_URL instead of DATABASE_URL.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const direct =
    env.DATABASE_URL ||
    env.MYSQL_URL ||
    env.MYSQL_PUBLIC_URL ||
    env.DATABASE_PUBLIC_URL ||
    env.RAILWAY_MYSQL_URL;
  if (direct?.trim()) return direct.trim();

  const host = env.MYSQLHOST || env.MYSQL_HOST;
  const port = env.MYSQLPORT || env.MYSQL_PORT || "3306";
  const user = env.MYSQLUSER || env.MYSQL_USER || "root";
  const password = env.MYSQLPASSWORD || env.MYSQL_PASSWORD;
  const database = env.MYSQLDATABASE || env.MYSQL_DATABASE || "railway";

  if (host && password) {
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    return `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;
  }

  return "";
}

export function databaseUrlDiagnostics(env: NodeJS.ProcessEnv = process.env) {
  const resolved = resolveDatabaseUrl(env);
  return {
    hasResolvedUrl: !!resolved,
    resolvedPrefix: resolved ? resolved.substring(0, 30) : "NOT SET",
    sources: {
      DATABASE_URL: !!env.DATABASE_URL,
      MYSQL_URL: !!env.MYSQL_URL,
      MYSQL_PUBLIC_URL: !!env.MYSQL_PUBLIC_URL,
      DATABASE_PUBLIC_URL: !!env.DATABASE_PUBLIC_URL,
      RAILWAY_MYSQL_URL: !!env.RAILWAY_MYSQL_URL,
      MYSQLHOST: !!env.MYSQLHOST,
    },
  };
}
