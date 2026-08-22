import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Railway identity delta reconciliation", () => {
  it("is explicit about ID preservation, insert-only operations, and excluded credentials", async () => {
    const source = await readFile(new URL("../scripts/reconcileRailwayIdentityDelta.mjs", import.meta.url), "utf8");
    expect(source).toContain("const EXECUTE = process.argv.includes(\"--execute\")");
    expect(source).toContain("INSERT IGNORE INTO");
    expect(source).toContain("passwordHash");
    expect(source).toContain("missingUsers");
    expect(source).toContain("sourceUsers === railwayUsers");
    expect(source).not.toContain("UPDATE `users`");
    expect(source).not.toContain("DELETE FROM");
  });
});
