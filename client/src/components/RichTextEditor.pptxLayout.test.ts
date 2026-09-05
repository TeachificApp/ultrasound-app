import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/RichTextEditor.tsx"), "utf8");

describe("PowerPoint rich-text slide layout nodes", () => {
  it("preserves responsive slide containers, editable text boxes, images, and shapes through the editor schema", () => {
    expect(source).toContain('name: "pptxSlideLayout"');
    expect(source).toContain('content: "pptxElement*"');
    expect(source).toContain('name: "pptxTextBox"');
    expect(source).toContain('content: "inline*"');
    expect(source).toContain('name: "pptxImage"');
    expect(source).toContain('name: "pptxShape"');
    expect(source).toContain("PptxSlideLayoutNode,");
    expect(source).toContain("PptxTextBoxNode,");
  });
});
