import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("inline lesson survey scales", () => {
  it("reports the actual configured Likert scale length rather than assuming five choices", () => {
    const source = readFileSync(resolve(import.meta.dirname, "CoursePlayer.tsx"), "utf8");
    expect(source).toContain("({selected}/{parsedLabels.length})");
    expect(source).not.toContain("({selected}/5)");
  });
});
