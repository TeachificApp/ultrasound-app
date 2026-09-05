import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const preview = readFileSync(resolve(process.cwd(), "client/src/components/BlockPreview.tsx"), "utf8");
const settings = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("converted document rich-text editing", () => {
  it("uses the standard rich-text editor for continuous converted documents", () => {
    expect(preview).toContain("const html = d.html ?? \"\";");
    expect(settings).toContain("Edit the full converted document in this continuous rich-text field");
    expect(settings).toContain("<RichTextEditor");
    expect(settings).not.toMatch(/d\.pptxSlide \? \(/);
  });
});
