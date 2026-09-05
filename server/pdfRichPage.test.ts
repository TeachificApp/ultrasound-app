import { describe, expect, it } from "vitest";
import { pdfDocumentPageSectionHtml, wrapContinuousDocumentHtml } from "../shared/pdfRichPage";

describe("continuous document html helpers", () => {
  it("wraps multiple page sections into one seamless rich-text document", () => {
    const html = wrapContinuousDocumentHtml([
      pdfDocumentPageSectionHtml("https://example.test/page-1.png", ["First paragraph"], 1),
      pdfDocumentPageSectionHtml("https://example.test/page-2.png", ["Second paragraph"], 2),
    ]);
    expect(html).toContain('data-converted-document="1"');
    expect(html).toContain('data-document-page="1"');
    expect(html).toContain('data-document-page="2"');
    expect(html).toContain("First paragraph");
    expect(html).toContain("Second paragraph");
    expect(html).toContain('data-document-page-break="1"');
    expect(html).not.toContain("position:absolute");
  });
});
