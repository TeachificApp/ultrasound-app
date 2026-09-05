import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/PdfPageRichTextEditor.tsx"), "utf8");
const settings = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("legacy PDF page rich-text editing", () => {
  it("keeps the legacy per-page editor available for older converted blocks only", () => {
    expect(source).toContain("Converted PDF page");
    expect(source).toContain("Editable page text");
    expect(source).toContain("<RichTextEditor");
    expect(settings).toContain("<PdfPageRichTextEditor");
    expect(settings).toContain("continuous rich-text field");
  });
});
