import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  assertLessonDocumentUpload,
  convertPdfToEditableLessonBlocks,
  convertPptxSlidesToEditableLessonBlocks,
  findPptxHeaderFooterElementIds,
  getLessonDocumentKind,
  LESSON_DOCUMENT_MAX_BYTES,
  LESSON_DOCUMENT_MAX_MB,
} from "./documentRichContent";

const source = {
  fileName: "lesson-source.pdf",
  mimeType: "application/pdf",
  storageKey: "lms-documents/lesson-18/test/source-lesson-source.pdf",
  storageUrl: "https://example.test/source-lesson-source.pdf",
  convertedAt: "2026-09-04T00:00:00.000Z",
};

describe("document rich-content conversion", () => {
  it("recognizes only supported PDF and PowerPoint document kinds", () => {
    expect(getLessonDocumentKind("lesson.pdf", "application/pdf")).toBe("pdf");
    expect(getLessonDocumentKind("slides.pptx", "application/octet-stream")).toBe("pptx");
    expect(getLessonDocumentKind("image.png", "image/png")).toBeNull();
    expect(() => assertLessonDocumentUpload("image.png", "image/png", 100)).toThrow(/PDF or PowerPoint/i);
    expect(() => assertLessonDocumentUpload("lesson.pdf", "application/pdf", 0)).toThrow(/empty/i);
  });

  it("allows document conversion uploads through 50 MB and rejects only files above the shared bound", () => {
    expect(LESSON_DOCUMENT_MAX_MB).toBe(50);
    expect(() => assertLessonDocumentUpload("lesson.pdf", "application/pdf", LESSON_DOCUMENT_MAX_BYTES)).not.toThrow();
    expect(() => assertLessonDocumentUpload("lesson.pdf", "application/pdf", LESSON_DOCUMENT_MAX_BYTES + 1)).toThrow(/50 MB/);
  });

  it("converts an entire PowerPoint into one continuous document rich-text block", () => {
    const result = convertPptxSlidesToEditableLessonBlocks([
      {
        title: "First slide",
        backgroundColor: "#eaffff",
        sourceWidth: 850,
        sourceHeight: 1100,
        elements: [
          { type: "text", content: "First lesson point", x: 5, y: 20, width: 55, height: 12, zIndex: 1, style: { fontSize: 22, fontWeight: "bold", fontStyle: "normal", textAlign: "left", color: "#179ca3", backgroundColor: "#ffffff", fontFamily: "Arial" } },
          { type: "shape", x: 2, y: 2, width: 3, height: 95, zIndex: 2, shape: "rectangle", fill: "#179ca3", stroke: "#179ca3" },
          { type: "image", src: "https://example.test/first.png", x: 62, y: 20, width: 33, height: 35, zIndex: 3 },
        ],
      },
      {
        title: "Second slide",
        backgroundColor: "#ffffff",
        elements: [
          { type: "text", content: "Second lesson point", x: 5, y: 10, zIndex: 1 },
        ],
      },
    ] as any, { ...source, fileName: "lesson-source.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(result.pageCount).toBe(2);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.type).toBe("text");
    const html = String(result.blocks[0]?.data.html);
    expect(html).toContain('data-converted-document="1"');
    expect(html).toContain('data-document-slide="1"');
    expect(html).toContain('data-document-slide="2"');
    expect(html).toContain('data-pptx-document-slide="1"');
    expect(html).toContain('data-pptx-columns="1"');
    expect(html).toContain('width:100%;height:auto');
    expect(html).toContain('src="https://example.test/first.png"');
    expect(html).toContain("First lesson point");
    expect(html).toContain("Second lesson point");
    expect(html).toContain("class=\"not-prose\"");
    expect(result.blocks[0]?.data.pptxSlide).toBeUndefined();
    expect((result.blocks[0]?.data.sourceDocument as any).pageCount).toBe(2);
  });

  it("preserves native PowerPoint table cell styling as a real HTML table", () => {
    const result = convertPptxSlidesToEditableLessonBlocks([{
      title: "Table slide",
      elements: [
        { id: "h1", type: "text", sourceName: "Table 1", content: "Concept", x: 5, y: 20, width: 35, height: 5, zIndex: 1, style: { fontWeight: "bold", backgroundColor: "#179ca3", color: "#ffffff" } },
        { id: "h2", type: "text", sourceName: "Table 1", content: "Impact", x: 45, y: 20, width: 35, height: 5, zIndex: 2, style: { fontWeight: "bold", backgroundColor: "#179ca3", color: "#ffffff" } },
        { id: "c1", type: "text", sourceName: "Table 1", content: "Frequency", x: 5, y: 30, width: 35, height: 5, zIndex: 3 },
        { id: "c2", type: "text", sourceName: "Table 1", content: "Resolution", x: 45, y: 30, width: 35, height: 5, zIndex: 4 },
      ],
    }] as any, { ...source, fileName: "table.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    const html = String(result.blocks[0]?.data.html);
    expect(html).toContain('data-pptx-table="1"');
    expect(html).toContain("<table");
    expect(html).toContain("Concept");
    expect(html).toContain("Frequency");
    expect(html).toContain("background-color:#179ca3");
    expect(html).not.toContain("position:absolute");
  });

  it("includes headers and footers by default and excludes only repeated or explicitly named edge layers when asked", () => {
    const slides = [
      {
        title: "First slide",
        elements: [
          { id: "one-header", type: "text", content: "Course header", sourceName: "Header text", x: 3, y: 2, width: 60, height: 4, zIndex: 1 },
          { id: "one-title", type: "text", content: "Unique instructional title", x: 8, y: 10, width: 80, height: 8, zIndex: 2 },
          { id: "one-footer", type: "text", content: "Copyright", sourceName: "Footer", x: 6, y: 94, width: 40, height: 4, zIndex: 3 },
        ],
      },
      {
        title: "Second slide",
        elements: [
          { id: "two-header", type: "text", content: "Course header", sourceName: "Header text", x: 3, y: 2, width: 60, height: 4, zIndex: 1 },
          { id: "two-title", type: "text", content: "Another instructional title", x: 8, y: 10, width: 80, height: 8, zIndex: 2 },
          { id: "two-footer", type: "text", content: "Copyright", sourceName: "Footer", x: 6, y: 94, width: 40, height: 4, zIndex: 3 },
        ],
      },
    ] as any;
    expect(findPptxHeaderFooterElementIds(slides).map(ids => [...ids].sort())).toEqual([
      ["one-footer", "one-header"],
      ["two-footer", "two-header"],
    ]);
    const pptxSource = { ...source, fileName: "headers.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    const included = convertPptxSlidesToEditableLessonBlocks(slides, pptxSource);
    const excluded = convertPptxSlidesToEditableLessonBlocks(slides, pptxSource, { includeHeadersAndFooters: false });
    expect(String(included.blocks[0]?.data.html)).toContain("Course header");
    expect(String(included.blocks[0]?.data.html)).toContain("Copyright");
    expect(String(excluded.blocks[0]?.data.html)).not.toContain("Course header");
    expect(String(excluded.blocks[0]?.data.html)).not.toContain("Copyright");
    expect(String(excluded.blocks[0]?.data.html)).toContain("Unique instructional title");
    expect((included.blocks[0]?.data.documentConversion as any).includeHeadersAndFooters).toBe(true);
    expect((excluded.blocks[0]?.data.documentConversion as any).includeHeadersAndFooters).toBe(false);
  });

  it("renders an entire PDF as one continuous editable rich-text block", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const firstPage = pdf.addPage([400, 300]);
    firstPage.drawText("First editable PDF page", { x: 48, y: 200, size: 18, font });
    const secondPage = pdf.addPage([400, 300]);
    secondPage.drawText("Second editable PDF page", { x: 48, y: 200, size: 18, font });
    const uploaded: Array<{ fileName: string; bytes: number }> = [];

    const result = await convertPdfToEditableLessonBlocks(
      Buffer.from(await pdf.save()),
      source,
      async (fileName, data) => {
        uploaded.push({ fileName, bytes: data.length });
        return `https://example.test/${fileName}`;
      },
    );

    expect(result.pageCount).toBe(2);
    expect(uploaded).toHaveLength(2);
    expect(result.blocks).toHaveLength(1);
    const html = String(result.blocks[0]?.data.html);
    expect(html).toContain('data-converted-document="1"');
    expect(html).toContain('data-document-page="1"');
    expect(html).toContain('data-document-page="2"');
    expect(html).toContain("First editable PDF page");
    expect(html).toContain("Second editable PDF page");
    expect(html).not.toContain("position:absolute");
    expect((result.blocks[0]?.data.sourceDocument as any).pageCount).toBe(2);
  });
});
