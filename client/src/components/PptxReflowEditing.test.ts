import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const preview = readFileSync(resolve(process.cwd(), "client/src/components/BlockPreview.tsx"), "utf8");
const settings = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("converted document rich-text editing", () => {
  it("renders converted slide HTML in preview and uses the slide-level editor when pptxSlide is present", () => {
    expect(preview).toContain("const html = d.html ?? \"\";");
    expect(settings).toContain("d.pdfPage ? (");
    expect(settings).toContain("<PdfPageRichTextEditor");
    expect(settings).toContain("d.pptxSlide ? (");
    expect(settings).toContain("<PptxSlideRichTextEditor");
    expect(settings).toContain("pptxRichSlideToHtml(pptxSlide)");
  });
});
