import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Railway local authentication configuration", () => {
  it("uses the local session/database path without a managed OAuth fallback", async () => {
    const [envSource, sdkSource, railwaySource] = await Promise.all([
      readFile(new URL("./_core/env.ts", import.meta.url), "utf8"),
      readFile(new URL("./_core/sdk.ts", import.meta.url), "utf8"),
      readFile(new URL("../railway.toml", import.meta.url), "utf8"),
    ]);
    expect(envSource).toContain('authBackend: process.env.AUTH_BACKEND ?? "manus"');
    expect(sdkSource).toContain('ENV.authBackend === "local"');
    expect(sdkSource).toContain('throw ForbiddenError("User not found")');
    expect(railwaySource).toContain('AUTH_BACKEND = "local"');
    expect(railwaySource).toContain('STORAGE_BACKEND = "r2"');
  });
});

