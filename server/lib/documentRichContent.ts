import { createCanvas } from "@napi-rs/canvas";
import type { TeachSlide } from "../../shared/teachPresentation";
import { pptxRichSlideToHtml, teachSlideToPptxRichSlide } from "../../shared/pptxRichSlide";

export const LESSON_DOCUMENT_MAX_MB = 50;
export const LESSON_DOCUMENT_MAX_BYTES = LESSON_DOCUMENT_MAX_MB * 1024 * 1024;
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

export type PptxConversionOptions = {
  includeHeadersAndFooters?: boolean;
};

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

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function finitePercent(value: number | undefined, fallback: number) {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : fallback));
}

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : fallback;
}

function safeFontFamily(value: unknown) {
  if (typeof value !== "string") return "Arial, sans-serif";
  const clean = value.replace(/[^a-zA-Z0-9 ,_-]/g, "").trim();
  return clean ? `'${clean}', Arial, sans-serif` : "Arial, sans-serif";
}

function richTextFontSize(value: unknown) {
  const pointSize = typeof value === "number" && Number.isFinite(value) ? Math.min(72, Math.max(8, value)) : 16;
  const responsiveSize = Math.min(13, Math.max(0.8, pointSize / 8));
  return `clamp(9px, ${responsiveSize.toFixed(2)}cqw, ${Math.round(pointSize * 1.34)}px)`;
}

function pptxElementStyle(element: TeachSlide["elements"][number], includeTextStyle: boolean) {
  const base = [
    "position:absolute",
    `left:${finitePercent(element.x, 0)}%`,
    `top:${finitePercent(element.y, 0)}%`,
    `width:${finitePercent(element.width, 100)}%`,
    `height:${finitePercent(element.height, 100)}%`,
    `z-index:${Math.max(1, Math.round(element.zIndex ?? 1))}`,
    "box-sizing:border-box",
  ];
  if (!includeTextStyle) return base.join(";");
  const style = element.style;
  base.push(
    `color:${safeColor(style?.color, "#1a1a1a")}`,
    `font-family:${safeFontFamily(style?.fontFamily)}`,
    `font-size:${richTextFontSize(style?.fontSize)}`,
    `font-weight:${style?.fontWeight === "bold" ? "700" : "400"}`,
    `font-style:${style?.fontStyle === "italic" ? "italic" : "normal"}`,
    `text-align:${style?.textAlign ?? "left"}`,
    `text-decoration:${style?.textDecoration ?? "none"}`,
    `line-height:${style?.lineHeight ?? 1.2}`,
    "overflow:hidden",
    "white-space:normal",
  );
  if (style?.backgroundColor) base.push(`background-color:${safeColor(style.backgroundColor, "transparent")}`);
  return base.join(";");
}

/**
 * Serializes one PowerPoint slide to one responsive rich-text composition.
 * Percent-based geometry preserves visual placement while allowing the slide to
 * scale to the width of a lesson text block.
 */
export function convertPptxSlideToRichTextHtml(slide: TeachSlide) {
  return pptxRichSlideToHtml(teachSlideToPptxRichSlide(slide));
}

function headerFooterSignature(element: TeachSlide["elements"][number]) {
  const content = typeof element.content === "string" ? element.content.replace(/\s+/g, " ").trim().toLowerCase() : "";
  const name = element.sourceName?.trim().toLowerCase() ?? "";
  const src = typeof element.src === "string" ? element.src.split("/").pop()?.toLowerCase() ?? "" : "";
  return [element.type, name, content, src, element.shape ?? "", element.fill ?? "", Math.round(element.x), Math.round(element.y), Math.round(element.width), Math.round(element.height)].join("|");
}

function isHeaderFooterName(name: string | undefined) {
  return !!name && /\b(header|footer|slide\s*(?:number|no\.?|#)|date|copyright)\b/i.test(name);
}

function isEdgeElement(element: TeachSlide["elements"][number]) {
  const topEdge = element.y <= 8 && element.height <= 14;
  const bottomEdge = element.y + element.height >= 92 && element.height <= 14;
  return topEdge || bottomEdge;
}

/**
 * Finds only low-risk repeated header/footer elements. A unique slide title is
 * never classified merely because it sits near the top edge.
 */
export function findPptxHeaderFooterElementIds(slides: TeachSlide[]) {
  const repeatedSignatures = new Map<string, number>();
  for (const slide of slides) {
    for (const element of slide.elements) {
      if (!isEdgeElement(element) || isHeaderFooterName(element.sourceName)) continue;
      const signature = headerFooterSignature(element);
      repeatedSignatures.set(signature, (repeatedSignatures.get(signature) ?? 0) + 1);
    }
  }
  const repeatedMinimum = Math.max(2, Math.ceil(slides.length * 0.5));
  return slides.map((slide) => new Set(slide.elements
    .filter((element) => {
      if (isHeaderFooterName(element.sourceName)) return true;
      return isEdgeElement(element) && (repeatedSignatures.get(headerFooterSignature(element)) ?? 0) >= repeatedMinimum;
    })
    .map((element) => element.id)));
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
    throw new Error(`Choose a document no larger than ${LESSON_DOCUMENT_MAX_MB} MB.`);
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
  options: PptxConversionOptions = {},
): DocumentConversionResult {
  if (!slides.length) throw new Error("The PowerPoint does not contain any readable slides.");
  if (slides.length > LESSON_DOCUMENT_MAX_PAGES) {
    throw new Error(`This PowerPoint has ${slides.length} slides. Convert no more than ${LESSON_DOCUMENT_MAX_PAGES} slides at a time.`);
  }
  const warnings: string[] = [];
  const blocks: EditableLessonBlock[] = [];
  const includeHeadersAndFooters = options.includeHeadersAndFooters !== false;
  const excludedIdsBySlide = includeHeadersAndFooters ? [] : findPptxHeaderFooterElementIds(slides);
  let excludedCount = 0;
  slides.forEach((slide, slideOffset) => {
    const index = slideOffset + 1;
    const metadata = sourceMetadata(source, "pptx", index);
    const excludedIds = excludedIdsBySlide[slideOffset] ?? new Set<string>();
    excludedCount += excludedIds.size;
    const filteredSlide = excludedIds.size
      ? { ...slide, elements: slide.elements.filter((element) => !excludedIds.has(element.id)) }
      : slide;
    const elements = [...filteredSlide.elements].sort((a, b) => a.y - b.y || a.x - b.x || a.zIndex - b.zIndex);
    const text = elements
      .filter(element => element.type === "text")
      .map(element => typeof element.content === "string" ? element.content.trim() : "")
      .filter(Boolean);
    const images = elements.filter(element => element.type === "image" && typeof element.src === "string" && element.src);
    const shapes = elements.filter(element => element.type === "shape");

    const pptxSlide = teachSlideToPptxRichSlide(filteredSlide);
    blocks.push({
      id: makeBlockId("pptx-slide-rich-text", index, 1),
      type: "text",
      data: {
        html: pptxRichSlideToHtml(pptxSlide),
        pptxSlide,
        align: "left",
        bgColor: filteredSlide.backgroundColor || "#ffffff",
        textColor: "#1a1a1a",
        pptxConversion: { includeHeadersAndFooters },
        ...metadata,
      },
    });
    if (text.length === 0 && images.length === 0 && shapes.length === 0) {
      warnings.push(`Slide ${index} has no extractable text, image, or visual shape. The original PowerPoint is retained in the lesson source reference.`);
    }
  });
  if (!includeHeadersAndFooters && excludedCount === 0) {
    warnings.push("No repeated or explicitly named PowerPoint header/footer elements were detected, so all slide elements were retained.");
  }
  return { blocks, warnings, pageCount: slides.length };
}
