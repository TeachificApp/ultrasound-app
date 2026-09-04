import { createCanvas } from "@napi-rs/canvas";
import type { TeachSlide } from "../../shared/teachPresentation";

export const LESSON_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const LESSON_DOCUMENT_MAX_PAGES = 100;

export type LessonDocumentKind = "pdf" | "pptx";

export type LessonDocumentSource = {
  fileName: string;
  mimeType: string;
  storageKey: string;
  storageUrl: string;
  convertedAt: string;
};

export type EditableLessonBlock = {
  id: string;
  type: "text" | "image";
  data: Record<string, unknown>;
};

export type DocumentConversionResult = {
  blocks: EditableLessonBlock[];
  warnings: string[];
  pageCount: number;
};

export type DocumentImageUploader = (fileName: string, data: Buffer, mimeType: string) => Promise<string>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeBlockId(prefix: string, index: number, part: number) {
  return `${prefix}-${index}-${part}-${Math.random().toString(36).slice(2, 8)}`;
}

function sourceMetadata(source: LessonDocumentSource, kind: LessonDocumentKind, index: number) {
  return {
    sourceDocument: {
      fileName: source.fileName,
      mimeType: source.mimeType,
      storageKey: source.storageKey,
      storageUrl: source.storageUrl,
      convertedAt: source.convertedAt,
      kind,
      index,
    },
  };
}

function paragraphsToHtml(heading: string, paragraphs: string[]) {
  const body = paragraphs
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<h2>${escapeHtml(heading)}</h2>${body || "<p></p>"}`;
}

export function getLessonDocumentKind(fileName: string, mimeType: string): LessonDocumentKind | null {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedName.endsWith(".pdf") || normalizedMime === "application/pdf") return "pdf";
  if (
    normalizedName.endsWith(".pptx") ||
    normalizedMime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) return "pptx";
  return null;
}

export function assertLessonDocumentUpload(fileName: string, mimeType: string, byteLength: number) {
  if (!getLessonDocumentKind(fileName, mimeType)) {
    throw new Error("Choose a PDF or PowerPoint .pptx file.");
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw new Error("The selected document is empty or invalid.");
  }
  if (byteLength > LESSON_DOCUMENT_MAX_BYTES) {
    throw new Error("Choose a document no larger than 25 MB.");
  }
}

function asTextLines(items: unknown[]): string[] {
  const positioned = items
    .map((candidate) => {
      const item = candidate as { str?: unknown; transform?: unknown };
      const text = typeof item.str === "string" ? item.str.trim() : "";
      const transform = Array.isArray(item.transform) ? item.transform : [];
      const y = typeof transform[5] === "number" ? transform[5] : 0;
      const x = typeof transform[4] === "number" ? transform[4] : 0;
      return { text, x, y };
    })
    .filter(item => item.text);

  const rows: Array<{ y: number; values: Array<{ text: string; x: number }> }> = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 3);
    if (row) row.values.push({ text: item.text, x: item.x });
    else rows.push({ y: item.y, values: [{ text: item.text, x: item.x }] });
  }
  return rows
    .map(row => row.values.sort((a, b) => a.x - b.x).map(item => item.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

type PdfCanvasFactory = {
  create: (width: number, height: number) => { canvas: ReturnType<typeof createCanvas>; context: ReturnType<ReturnType<typeof createCanvas>["getContext"]> };
  reset: (canvasAndContext: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) => void;
  destroy: (canvasAndContext: { canvas: ReturnType<typeof createCanvas> }) => void;
};

const pdfCanvasFactory: PdfCanvasFactory = {
  create(width, height) {
    const canvas = createCanvas(Math.max(1, width), Math.max(1, height));
    return { canvas, context: canvas.getContext("2d") };
  },
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = Math.max(1, width);
    canvasAndContext.canvas.height = Math.max(1, height);
  },
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 1;
    canvasAndContext.canvas.height = 1;
  },
};

export async function convertPdfToEditableLessonBlocks(
  buffer: Buffer,
  source: LessonDocumentSource,
  uploadImage: DocumentImageUploader,
): Promise<DocumentConversionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as {
    getDocument: (options: Record<string, unknown>) => {
      promise: Promise<{
        numPages: number;
        getPage: (index: number) => Promise<{
          getTextContent: () => Promise<{ items: unknown[] }>;
          getViewport: (options: { scale: number }) => { width: number; height: number };
          render: (options: Record<string, unknown>) => { promise: Promise<void> };
          cleanup?: () => void;
        }>;
      }>;
      destroy?: () => Promise<void>;
    };
  };
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  const warnings: string[] = [];
  try {
    const document = await loadingTask.promise;
    if (!Number.isInteger(document.numPages) || document.numPages < 1) {
      throw new Error("The PDF does not contain any readable pages.");
    }
    if (document.numPages > LESSON_DOCUMENT_MAX_PAGES) {
      throw new Error(`This PDF has ${document.numPages} pages. Convert no more than ${LESSON_DOCUMENT_MAX_PAGES} pages at a time.`);
    }

    const blocks: EditableLessonBlock[] = [];
    for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex += 1) {
      const page = await document.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const textLines = asTextLines(textContent.items);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvasAndContext = pdfCanvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({
        canvasContext: canvasAndContext.context as never,
        viewport,
        canvasFactory: pdfCanvasFactory,
      }).promise;
      const imageUrl = await uploadImage(
        `page-${pageIndex}.png`,
        Buffer.from(canvasAndContext.canvas.toBuffer("image/png")),
        "image/png",
      );
      const metadata = sourceMetadata(source, "pdf", pageIndex);
      blocks.push({
        id: makeBlockId("pdf-page-image", pageIndex, 1),
        type: "image",
        data: {
          url: imageUrl,
          alt: `${source.fileName} page ${pageIndex}`,
          caption: "",
          align: "center",
          maxWidth: "100%",
          showShadow: false,
          noBorder: false,
          ...metadata,
        },
      });
      blocks.push({
        id: makeBlockId("pdf-page-text", pageIndex, 2),
        type: "text",
        data: {
          html: paragraphsToHtml(`Page ${pageIndex}`, textLines),
          align: "left",
          bgColor: "#ffffff",
          textColor: "#1a1a1a",
          ...metadata,
        },
      });
      if (textLines.length === 0) {
        warnings.push(`Page ${pageIndex} has no machine-readable text. Its rendered page image was retained and can be replaced or supplemented in the editor.`);
      }
      page.cleanup?.();
    }
    return { blocks, warnings, pageCount: document.numPages };
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("The PDF could not be converted. Try exporting it again as a standard PDF.");
  } finally {
    await loadingTask.destroy?.();
  }
}

export function convertPptxSlidesToEditableLessonBlocks(
  slides: TeachSlide[],
  source: LessonDocumentSource,
): DocumentConversionResult {
  if (!slides.length) throw new Error("The PowerPoint does not contain any readable slides.");
  if (slides.length > LESSON_DOCUMENT_MAX_PAGES) {
    throw new Error(`This PowerPoint has ${slides.length} slides. Convert no more than ${LESSON_DOCUMENT_MAX_PAGES} slides at a time.`);
  }
  const warnings: string[] = [];
  const blocks: EditableLessonBlock[] = [];
  slides.forEach((slide, slideOffset) => {
    const index = slideOffset + 1;
    const metadata = sourceMetadata(source, "pptx", index);
    const elements = [...slide.elements].sort((a, b) => a.y - b.y || a.x - b.x || a.zIndex - b.zIndex);
    const text = elements
      .filter(element => element.type === "text")
      .map(element => typeof element.content === "string" ? element.content.trim() : "")
      .filter(Boolean);
    const images = elements.filter(element => element.type === "image" && typeof element.src === "string" && element.src);
    const shapes = elements.filter(element => element.type === "shape");

    blocks.push({
      id: makeBlockId("pptx-slide-text", index, 1),
      type: "text",
      data: {
        html: paragraphsToHtml(slide.title || `Slide ${index}`, text),
        align: "left",
        bgColor: slide.backgroundColor || "#ffffff",
        textColor: "#1a1a1a",
        ...metadata,
      },
    });
    images.forEach((image, imageOffset) => {
      blocks.push({
        id: makeBlockId("pptx-slide-image", index, imageOffset + 2),
        type: "image",
        data: {
          url: image.src,
          alt: `${source.fileName} slide ${index} image ${imageOffset + 1}`,
          caption: "",
          align: "center",
          maxWidth: "100%",
          showShadow: false,
          noBorder: false,
          ...metadata,
        },
      });
    });
    if (text.length === 0 && images.length === 0) {
      warnings.push(`Slide ${index} has no extractable text or image. The original PowerPoint is retained in the lesson source reference.`);
    }
    if (shapes.length > 0) {
      warnings.push(`Slide ${index} contains ${shapes.length} vector shape${shapes.length === 1 ? "" : "s"} that could not be promoted as individual responsive blocks. Its text, images, and original source reference were retained.`);
    }
  });
  return { blocks, warnings, pageCount: slides.length };
}
