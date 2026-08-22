import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("common-gap reconciliation safeguards", () => {
  it("excludes bearer-like token tables and verifies content before insert-only reconciliation", async () => {
    const source = await readFile(new URL("../scripts/reconcileCommonRailwayGaps.mjs", import.meta.url), "utf8");
    expect(source).toContain("access_token_uses");
    expect(source).toContain("auto_login_tokens");
    expect(source).toContain("commonContentConflicts");
    expect(source).toContain("unresolvedUniqueOrPrimaryKeyConflicts");
    expect(source).toContain("invalidDate");
    expect(source).toContain("INSERT IGNORE");
    expect(source).toContain("make no updates/deletes");
  });
});
