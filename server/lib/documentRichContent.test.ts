import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  assertLessonDocumentUpload,
  convertPdfToEditableLessonBlocks,
  convertPptxSlidesToEditableLessonBlocks,
  getLessonDocumentKind,
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

  it("converts each PowerPoint slide in order into editable text and image blocks with a retained source reference", () => {
    const result = convertPptxSlidesToEditableLessonBlocks([
      {
        title: "First slide",
        backgroundColor: "#eaffff",
        elements: [
          { type: "text", content: "First lesson point", x: 5, y: 10, zIndex: 1 },
          { type: "image", src: "https://example.test/first.png", x: 10, y: 20, zIndex: 2 },
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
    expect(result.blocks.map(block => block.type)).toEqual(["text", "image", "text"]);
    expect(String(result.blocks[0].data.html)).toContain("First lesson point");
    expect(String(result.blocks[2].data.html)).toContain("Second lesson point");
    expect((result.blocks[1].data.sourceDocument as any).storageUrl).toBe(source.storageUrl);
    expect(result.blocks.some(block => block.type === ("embed" as any))).toBe(false);
  });

  it("renders each PDF page as a preserved editable image plus editable rich text without inserting a PDF viewer", async () => {
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
    expect(uploaded.every(asset => asset.bytes > 0)).toBe(true);
    expect(result.blocks.map(block => block.type)).toEqual(["image", "text", "image", "text"]);
    expect(String(result.blocks[1].data.html)).toContain("First editable PDF page");
    expect(String(result.blocks[3].data.html)).toContain("Second editable PDF page");
    expect((result.blocks[0].data.sourceDocument as any).storageKey).toBe(source.storageKey);
    expect(result.blocks.some(block => block.type === ("embed" as any))).toBe(false);
  });
});
