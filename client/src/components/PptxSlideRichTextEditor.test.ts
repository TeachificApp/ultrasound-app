import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/PptxSlideRichTextEditor.tsx"), "utf8");

describe("PowerPoint slide-level editor", () => {
  it("edits one selected text or image layer while preserving the combined slide model", () => {
    expect(source).toContain("Converted PowerPoint slide");
    expect(source).toContain("Slide layers");
    expect(source).toContain("Edit selected text layer");
    expect(source).toContain("plainTextFromRichHtml");
    expect(source).toContain("pptxRichSlideToHtml(value)");
    expect(source).toContain("Image URL");
  });
});
