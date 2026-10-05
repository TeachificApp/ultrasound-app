import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

const mocks = vi.hoisted(() => ({ downloadStorageObject: vi.fn() }));
vi.mock("./lib/downloadStorageObject", () => ({ downloadStorageObject: mocks.downloadStorageObject }));

import { buildMinimalTestPptx } from "./lib/pptxImport";
import {
  AI_SOURCE_DOCX_MIME,
  AI_SOURCE_PPTX_MIME,
  extractFlashcardDocumentPages,
  pairFlashcardDocumentPages,
} from "./lib/flashcardDocumentGeneration";

const userId = 9;

function sourceFor(buffer: Buffer, mimeType: "application/pdf" | typeof AI_SOURCE_PPTX_MIME | typeof AI_SOURCE_DOCX_MIME, name: string) {
  const storageKey = `ai-generation-sources/${userId}/${name}`;
  mocks.downloadStorageObject.mockResolvedValueOnce(buffer);
  return { url: `https://files.example/${name}`, storageKey, mimeType, name };
}

describe("flashcard document generation", () => {
  it("pairs consecutive readable pages without adding source references", () => {
    expect(pairFlashcardDocumentPages(["Front page", "Back page", "Trailing page"])).toEqual({
      pairs: [{ front: "Front page", back: "Back page", frontPage: 1, backPage: 2 }],
      skippedPageCount: 1,
    });
  });

  it("extracts PowerPoint slide text so each consecutive pair can be a flashcard", async () => {
    const pptx = await buildMinimalTestPptx([
      { title: "Mitral valve", body: "Name the valve between the left atrium and ventricle." },
      { title: "Answer", body: "The mitral valve is between the left atrium and left ventricle." },
    ]);
    const pages = await extractFlashcardDocumentPages(sourceFor(pptx, AI_SOURCE_PPTX_MIME, "deck.pptx"), userId);
    const paired = pairFlashcardDocumentPages(pages);
    expect(paired.pairs).toHaveLength(1);
    expect(paired.pairs[0]?.front).toContain("Mitral valve");
    expect(paired.pairs[0]?.back).toContain("Answer");
  });

  it("extracts PDF page text for direct page-pair card creation", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([400, 300]).drawText("Question page", { x: 24, y: 200, font });
    pdf.addPage([400, 300]).drawText("Answer page", { x: 24, y: 200, font });
    const pages = await extractFlashcardDocumentPages(sourceFor(Buffer.from(await pdf.save()), "application/pdf", "deck.pdf"), userId);
    expect(pairFlashcardDocumentPages(pages).pairs[0]).toMatchObject({ front: expect.stringContaining("Question page"), back: expect.stringContaining("Answer page") });
  });

  it("extracts Word document paragraphs for AI-grounded flashcard generation", async () => {
    const docx = new JSZip();
    docx.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>Left ventricle</w:t></w:r></w:p><w:p><w:r><w:t>Pumps blood to the aorta</w:t></w:r></w:p></w:body></w:document>`);
    const bytes = Buffer.from(await docx.generateAsync({ type: "nodebuffer" }));
    const pages = await extractFlashcardDocumentPages(sourceFor(bytes, AI_SOURCE_DOCX_MIME, "notes.docx"), userId);
    expect(pages).toEqual(["Left ventricle", "Pumps blood to the aorta"]);
  });
});
