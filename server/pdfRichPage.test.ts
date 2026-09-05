import { describe, expect, it } from "vitest";
import { convertPdfPageToRichTextHtml } from "./lib/documentRichContent";
import { defaultPdfBodyHtml, pdfRichPageToHtml } from "../shared/pdfRichPage";

describe("pdfRichPage helpers", () => {
  it("builds reflowed page html without absolute text overlays", () => {
    const { html, pdfPage } = convertPdfPageToRichTextHtml("https://example.test/page-1.png", [
      "First paragraph line",
      "Second paragraph block",
    ], 2);
    expect(html).toContain('data-pdf-page="1"');
    expect(html).toContain('data-pdf-editable-text="1"');
    expect(html).toContain("First paragraph line");
    expect(html).toContain("Second paragraph block");
    expect(html).not.toContain("position:absolute");
    expect(pdfRichPageToHtml(pdfPage, 2)).toBe(html);
    expect(defaultPdfBodyHtml(["Alpha", "Beta"])).toContain("<p>Alpha</p>");
  });
});
