import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Railway authentication compatibility alignment", () => {
  it("requires explicit execution and never reads source user credentials", async () => {
    const source = await readFile(new URL("../scripts/alignRailwayAuthCompatibilityColumns.mjs", import.meta.url), "utf8");
    expect(source).toContain('process.argv.includes("--execute")');
    expect(source).toContain("No source credential or token data was copied");
    expect(source).not.toContain("DATABASE_URL");
  });
});

