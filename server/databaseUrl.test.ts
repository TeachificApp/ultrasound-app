import { describe, expect, it } from "vitest";
import {
  isLegacyManusDatabaseUrl,
  isRailwayMysqlUrl,
  resolveApplicationDatabaseUrl,
} from "./lib/databaseUrl";

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

  it("uses explicit Railway MySQL even when the application runtime is not Railway", () => {
    expect(resolveApplicationDatabaseUrl({
      DATABASE_URL: legacyUrl,
      RAILWAY_MYSQL_URL: railwayUrl,
    })).toBe(railwayUrl);
  });

  it("fails closed on Railway instead of reading a retired Manus database", () => {
    expect(resolveApplicationDatabaseUrl({
      RAILWAY_PRIMARY: "true",
      DATABASE_URL: legacyUrl,
    })).toBeNull();
  });

  it("permits a Railway DATABASE_URL only when it points at Railway MySQL", () => {
    expect(resolveApplicationDatabaseUrl({
      RAILWAY_PRIMARY: "true",
      DATABASE_URL: railwayUrl,
    })).toBe(railwayUrl);
  });

  it("never falls back to a retired Manus database outside Railway", () => {
    expect(resolveApplicationDatabaseUrl({ DATABASE_URL: legacyUrl })).toBeNull();
  });

  it("fails closed for a non-Railway database URL", () => {
    expect(resolveApplicationDatabaseUrl({ DATABASE_URL: "mysql://root:secret@localhost:3306/other" })).toBeNull();
  });

  it("detects Railway private/public MySQL and retired Manus URLs", () => {
    expect(isRailwayMysqlUrl("mysql://root:pass@mysql.railway.internal:3306/railway")).toBe(true);
    expect(isRailwayMysqlUrl("mysql://root:pass@viaduct.proxy.rlwy.net:37790/railway")).toBe(true);
    expect(isRailwayMysqlUrl(legacyUrl)).toBe(false);
    expect(isLegacyManusDatabaseUrl(legacyUrl)).toBe(true);
    expect(isLegacyManusDatabaseUrl(railwayUrl)).toBe(false);
  });
});
