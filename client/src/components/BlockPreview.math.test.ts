import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BlockPreview equation rendering", () => {
  it("uses the KaTeX-aware renderer for AI Content block HTML", () => {
    const source = readFileSync(resolve(import.meta.dirname, "BlockPreview.tsx"), "utf8");
    const aiContentCase = source.match(/case "ai_content":[\s\S]*?case "hero":/)?.[0] ?? "";
    expect(aiContentCase).toContain("<MathContent html={d.html} className=\"prose max-w-none\" />");
    expect(aiContentCase).not.toContain("dangerouslySetInnerHTML");
  });
});
