import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("source-only batch migration safeguards", () => {
  it("requires explicit execution and keeps sensitive raw token/webhook tables excluded", async () => {
    const source = await readFile(new URL("../scripts/migrateSourceOnlyRailwayBatches.mjs", import.meta.url), "utf8");
    expect(source).toContain('process.argv.includes("--execute")');
    expect(source).toContain('process.argv.includes("--resume")');
    expect(source).toContain("sso_tokens");
    expect(source).toContain("thinkificWebhookEvents");
    expect(source).toContain("webhookEvents");
    expect(source).toContain("refuses to modify existing tables");
    expect(source).toContain("JSON.stringify(value)");
    expect(source).toContain("combined inline VARCHAR footprint");
    expect(source).toContain("identifiers such as slugs remain VARCHAR");
  });
});
