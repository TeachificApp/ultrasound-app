import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const preview = readFileSync(resolve(process.cwd(), "client/src/components/BlockPreview.tsx"), "utf8");
const settings = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("reflowed PowerPoint rich-text editing", () => {
  it("uses the ordinary HTML renderer and normal rich-text settings instead of the overlay or layer editor", () => {
    expect(preview).toContain("const html = d.html ?? \"\";");
    expect(preview).not.toContain("d.pptxSlide ?");
    expect(settings).toContain("<RichTextEditor");
    expect(settings).not.toContain("<PptxSlideRichTextEditor");
    expect(settings).not.toContain("pptxRichSlideToHtml");
  });
});
