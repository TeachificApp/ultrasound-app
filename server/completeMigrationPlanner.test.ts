import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("complete migration planner safeguards", () => {
  it("keeps every complete-migration plan read-only and insert-only", async () => {
    const source = await readFile(new URL("../scripts/planCompleteManusRailwayMigration.mjs", import.meta.url), "utf8");
    expect(source).toContain("Read-only complete migration planner");
    expect(source).toContain("No current or future batch may update or delete a Railway row");
    expect(source).not.toContain(".execute(");
  });

  it("lists identity before Teach and common divergent reconciliation", async () => {
    const source = await readFile(new URL("../scripts/planCompleteManusRailwayMigration.mjs", import.meta.url), "utf8");
    expect(source.indexOf('domain: "identity"')).toBeLessThan(source.indexOf('domain: "teach_live_games"'));
    expect(source.indexOf('domain: "teach_live_games"')).toBeLessThan(source.indexOf('domain: "common_divergent"'));
  });
});

