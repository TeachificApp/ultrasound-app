import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveStorageBackend, isRailwayPrimaryHost } from "./storageBackend";

const R2_ENV = {
  CF_R2_ACCOUNT_ID: "acct",
  CF_R2_ACCESS_KEY_ID: "key",
  CF_R2_SECRET_ACCESS_KEY: "secret",
  CF_R2_PUBLIC_URL: "https://pub.example.r2.dev",
};

const FORGE_ENV = {
  BUILT_IN_FORGE_API_URL: "https://forge.manus.ai",
  BUILT_IN_FORGE_API_KEY: "forge-key",
};

describe("resolveStorageBackend", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "STORAGE_BACKEND",
      "CF_R2_ACCOUNT_ID",
      "CF_R2_ACCESS_KEY_ID",
      "CF_R2_SECRET_ACCESS_KEY",
      "CF_R2_PUBLIC_URL",
      "BUILT_IN_FORGE_API_URL",
      "BUILT_IN_FORGE_API_KEY",
    ]) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("prefers R2 in auto mode when R2 credentials are set", () => {
    Object.assign(process.env, R2_ENV, FORGE_ENV);
    expect(resolveStorageBackend()).toBe("r2");
  });

  it("uses Forge in auto mode when only Forge is configured", () => {
    Object.assign(process.env, FORGE_ENV);
    expect(resolveStorageBackend()).toBe("forge");
  });

  it("forces R2 when STORAGE_BACKEND=r2", () => {
    process.env.STORAGE_BACKEND = "r2";
    Object.assign(process.env, R2_ENV);
    expect(resolveStorageBackend()).toBe("r2");
  });

  it("forces Forge when STORAGE_BACKEND=forge", () => {
    process.env.STORAGE_BACKEND = "forge";
    Object.assign(process.env, FORGE_ENV);
    expect(resolveStorageBackend()).toBe("forge");
  });

  it("throws when no backend is configured", () => {
    expect(() => resolveStorageBackend()).toThrow(/No storage backend/);
  });
});

describe("isRailwayPrimaryHost", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["RAILWAY_PRIMARY", "DATABASE_URL", "RAILWAY_ENVIRONMENT"]) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns true when RAILWAY_PRIMARY=true", () => {
    process.env.RAILWAY_PRIMARY = "true";
    expect(isRailwayPrimaryHost()).toBe(true);
  });

  it("returns true when DATABASE_URL points to Railway", () => {
    process.env.DATABASE_URL = "mysql://root:pass@viaduct.proxy.rlwy.net:37790/railway";
    expect(isRailwayPrimaryHost()).toBe(true);
  });

  it("returns false on Manus TiDB by default", () => {
    process.env.DATABASE_URL =
      "mysql://user:pass@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/db";
    expect(isRailwayPrimaryHost()).toBe(false);
  });
});
