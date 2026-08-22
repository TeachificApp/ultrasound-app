import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Railway independent identity migration design", () => {
  it("forbids copying managed authentication material and automatic user email", async () => {
    const design = await readFile(new URL("../docs/railway-independent-identity-migration-design.md", import.meta.url), "utf8");
    expect(design).toContain("never copied");
    expect(design).toContain("must remain **silent**");
    expect(design).toContain("no updates or deletes are permitted");
  });
});

