import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("identity foundation migration safeguards", () => {
  it("requires an execution flag and excludes credential/token columns", async () => {
    const source = await readFile(new URL("../scripts/migrateRailwayIdentityFoundation.mjs", import.meta.url), "utf8");
    expect(source).toContain("process.argv.includes(\"--execute\")");
    expect(source).toContain('"passwordHash"');
    expect(source).toContain('"magicLinkToken"');
    expect(source).toContain('"accessToken"');
    expect(source).toContain("No source credential or authentication token was copied; no emails were sent; no target rows were updated or deleted.");
  });
});

