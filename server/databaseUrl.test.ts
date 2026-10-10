import { describe, expect, it } from "vitest";
import { isRailwayMysqlUrl, resolveApplicationDatabaseUrl } from "./lib/databaseUrl";

describe("resolveApplicationDatabaseUrl", () => {
  const legacyUrl = "mysql://legacy:secret@gateway06.us-east-1.prod.aws.tidbcloud.com:4000/legacy";
  const railwayUrl = "mysql://railway:secret@mysql.railway.internal:3306/railway";

  it("uses Railway MySQL as the sole production application database when available", () => {
    expect(resolveApplicationDatabaseUrl({
      NODE_ENV: "production",
      RAILWAY_ENVIRONMENT: "production",
      DATABASE_URL: legacyUrl,
      RAILWAY_MYSQL_URL: railwayUrl,
    })).toBe(railwayUrl);
  });

  it("uses Railway's native MYSQL_URL reference in production", () => {
    expect(resolveApplicationDatabaseUrl({
      RAILWAY_PRIMARY: "true",
      DATABASE_URL: legacyUrl,
      MYSQL_URL: railwayUrl,
    })).toBe(railwayUrl);
  });

  it("keeps DATABASE_URL as the local-development fallback", () => {
    expect(resolveApplicationDatabaseUrl({ DATABASE_URL: legacyUrl })).toBe(legacyUrl);
  });

  it("detects Railway private and public MySQL URLs", () => {
    expect(isRailwayMysqlUrl("mysql://root:pass@mysql.railway.internal:3306/railway")).toBe(true);
    expect(isRailwayMysqlUrl("mysql://root:pass@viaduct.proxy.rlwy.net:37790/railway")).toBe(true);
    expect(isRailwayMysqlUrl(legacyUrl)).toBe(false);
  });
});
