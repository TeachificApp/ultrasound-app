import { describe, expect, it } from "vitest";
import { databaseUrlDiagnostics, resolveDatabaseUrl } from "./databaseUrl";

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "mysql://root:pass@host:3306/railway",
        MYSQL_URL: "mysql://other",
      } as NodeJS.ProcessEnv)
    ).toBe("mysql://root:pass@host:3306/railway");
  });

  it("falls back to MYSQL_URL", () => {
    expect(
      resolveDatabaseUrl({
        MYSQL_URL: "mysql://root:pass@host:3306/railway",
      } as NodeJS.ProcessEnv)
    ).toBe("mysql://root:pass@host:3306/railway");
  });

  it("builds URL from MYSQLHOST parts", () => {
    expect(
      resolveDatabaseUrl({
        MYSQLHOST: "viaduct.proxy.rlwy.net",
        MYSQLPORT: "37790",
        MYSQLUSER: "root",
        MYSQLPASSWORD: "secret",
        MYSQLDATABASE: "railway",
      } as NodeJS.ProcessEnv)
    ).toBe("mysql://root:secret@viaduct.proxy.rlwy.net:37790/railway");
  });

  it("reports which env vars are present", () => {
    expect(
      databaseUrlDiagnostics({
        MYSQL_URL: "mysql://root:pass@host:3306/railway",
      } as NodeJS.ProcessEnv)
    ).toMatchObject({
      hasResolvedUrl: true,
      sources: { MYSQL_URL: true, DATABASE_URL: false },
    });
  });
});
