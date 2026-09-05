import { createCanvas } from "@napi-rs/canvas";
import type { TeachSlide, TeachSlideElement } from "../../shared/teachPresentation";

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

function elementTextHtml(element: TeachSlideElement) {
  return element.contentHtml || escapeHtml(element.content ?? "").replace(/\n/g, "<br />");
}

function elementTextBlockHtml(element: TeachSlideElement) {
  const fontSize = element.style?.fontSize ?? 16;
  const content = elementTextHtml(element);
  const color = element.style?.color && /^#[0-9a-f]{3,8}$/i.test(element.style.color) ? `color:${element.style.color};` : "";
  const background = element.style?.backgroundColor && /^#[0-9a-f]{3,8}$/i.test(element.style.backgroundColor)
    ? `background:${element.style.backgroundColor};`
    : "";
  const style = `${color}${background}margin:0;`;
  if (fontSize >= 28) return `<h2 style="${style}">${content}</h2>`;
  if (fontSize >= 21) return `<h3 style="${style}">${content}</h3>`;
  return background ? `<blockquote style="${style}">${content}</blockquote>` : `<p style="${style}">${content}</p>`;
}

function elementImageHtml(element: TeachSlideElement) {
  return element.src
    ? `<img src="${escapeAttribute(element.src)}" alt="" />`
    : "";
}

function elementShapeHtml(element: TeachSlideElement) {
  const color = element.fill && /^#[0-9a-f]{3,8}$/i.test(element.fill) ? `border-color:${element.fill};` : "";
  return `<hr data-pptx-shape="1" style="${color}" />`;
}

function reflowTableHtml(elements: TeachSlideElement[]) {
  const rows: TeachSlideElement[][] = [];
  for (const element of [...elements].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate[0]!.y - element.y) <= Math.max(2, element.height * 0.45));
    if (row) row.push(element); else rows.push([element]);
  }
  const body = rows.map((row, rowIndex) => `<tr>${row.sort((a, b) => a.x - b.x).map((cell) => {
    const tag = rowIndex === 0 || cell.style?.fontWeight === "bold" ? "th" : "td";
    const background = cell.style?.backgroundColor && /^#[0-9a-f]{3,8}$/i.test(cell.style.backgroundColor) ? `background:${cell.style.backgroundColor};` : "";
    const color = cell.style?.color && /^#[0-9a-f]{3,8}$/i.test(cell.style.color) ? `color:${cell.style.color};` : "";
    return `<${tag} style="border:1px solid #d9e4e7;padding:0.65rem;vertical-align:top;${background}${color}">${elementTextHtml(cell)}</${tag}>`;
  }).join("")}</tr>`).join("");
  return `<div style="overflow-x:auto;margin:1.25rem 0"><table style="width:100%;border-collapse:collapse">${body}</table></div>`;
}

function reflowRowHtml(elements: TeachSlideElement[]) {
  const blocks = [...elements].sort((a, b) => a.x - b.x || a.zIndex - b.zIndex)
    .map((element) => element.type === "image" ? elementImageHtml(element) : element.type === "shape" ? elementShapeHtml(element) : elementTextBlockHtml(element)).filter(Boolean);
  if (blocks.length <= 1) return blocks[0] ?? "";
  return `<table data-pptx-columns="1"><tbody><tr>${blocks.map((block) => `<td>${block}</td>`).join("")}</tr></tbody></table>`;
}

/** Converts one PPTX slide to normal-flow editable rich text, never an overlay. */
export function convertPptxSlideToRichTextHtml(slide: TeachSlide) {
  const content = slide.elements.filter((element) => element.type === "text" || element.type === "image" || element.type === "shape");
  const grouped = new Map<string, TeachSlideElement[]>();
  for (const element of content.filter((candidate) => candidate.type === "text")) {
    if (!element.sourceName) continue;
    const group = grouped.get(element.sourceName) ?? [];
    group.push(element);
    grouped.set(element.sourceName, group);
  }
  const tableIds = new Set<string>();
  const tables = [...grouped.entries()]
    .filter(([name, elements]) => /table/i.test(name) && elements.length >= 4)
    .map(([, elements]) => {
      elements.forEach((element) => tableIds.add(element.id));
      return { y: Math.min(...elements.map((element) => element.y)), html: reflowTableHtml(elements) };
    });
  const rows: Array<{ y: number; elements: TeachSlideElement[] }> = [];
  for (const element of content.filter((candidate) => !tableIds.has(candidate.id)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - element.y) <= Math.max(3, element.height * 0.35));
    if (row) row.elements.push(element); else rows.push({ y: element.y, elements: [element] });
  }
  const sections = [...rows.map((row) => ({ y: row.y, html: reflowRowHtml(row.elements) })), ...tables]
    .sort((a, b) => a.y - b.y).map((section) => section.html).filter(Boolean).join("");
  return `<div data-pptx-reflow="1" style="display:flex;flex-direction:column;gap:1rem">${sections || "<p></p>"}</div>`;
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
  const topEdge = element.y <= 14 && element.height <= 16;
  const bottomEdge = element.y + element.height >= 86 && element.height <= 16;
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
  const repeatedMinimum = 2;
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

    blocks.push({
      id: makeBlockId("pptx-slide-rich-text", index, 1),
      type: "text",
      data: {
        html: convertPptxSlideToRichTextHtml(filteredSlide),
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
