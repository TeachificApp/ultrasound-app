import JSZip from "jszip";
import { downloadStorageObject } from "./downloadStorageObject";
import { parsePptxBuffer } from "./pptxImport";

export const AI_SOURCE_PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation" as const;
export const AI_SOURCE_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
export const PAIRABLE_FLASHCARD_DOCUMENT_MIME_TYPES = ["application/pdf", AI_SOURCE_PPTX_MIME] as const;
export const TEXT_FLASHCARD_DOCUMENT_MIME_TYPES = [AI_SOURCE_PPTX_MIME, AI_SOURCE_DOCX_MIME] as const;

export type FlashcardDocumentSource = {
  url: string;
  storageKey?: string;
  mimeType: typeof PAIRABLE_FLASHCARD_DOCUMENT_MIME_TYPES[number] | typeof TEXT_FLASHCARD_DOCUMENT_MIME_TYPES[number];
  name: string;
};

export type FlashcardDocumentPair = {
  front: string;
  back: string;
  frontPage: number;
  backPage: number;
};

export type PairedFlashcardDocument = {
  pairs: FlashcardDocumentPair[];
  skippedPageCount: number;
};

function decodeXmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDocxParagraphs(buffer: Buffer) {
  return JSZip.loadAsync(buffer).then(async archive => {
    const documentXml = archive.file("word/document.xml");
    if (!documentXml) throw new Error("The Word document could not be read.");
    const xml = await documentXml.async("string");
    const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
      .map(match => decodeXmlText(match[1] ?? ""))
      .filter(Boolean);
    if (!paragraphs.length) throw new Error("The Word document does not contain readable text.");
    return paragraphs;
  });
}

async function extractPdfPages(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as {
    getDocument: (options: Record<string, unknown>) => {
      promise: Promise<{
        numPages: number;
        getPage: (index: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: unknown }> }> }>;
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
  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const content = await (await document.getPage(index)).getTextContent();
      pages.push(content.items.map(item => typeof item.str === "string" ? item.str : "").join(" ").replace(/\s+/g, " ").trim());
    }
    return pages;
  } finally {
    await loadingTask.destroy?.();
  }
}

async function extractPptxPages(buffer: Buffer) {
  const parsed = await parsePptxBuffer(buffer);
  return parsed.slides.map(slide => slide.elements
    .filter(element => element.type === "text")
    .map(element => String(element.content ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim());
}

function assertOwnedAiSource(source: FlashcardDocumentSource, userId: number) {
  const expectedPrefix = `ai-generation-sources/${userId}/`;
  if (!source.storageKey || !source.storageKey.startsWith(expectedPrefix) || source.storageKey.includes("..")) {
    throw new Error("Re-upload the source file before generating flashcards.");
  }
}

export async function loadAiGenerationSourceBuffer(source: FlashcardDocumentSource, userId: number) {
  assertOwnedAiSource(source, userId);
  return downloadStorageObject(source.storageKey!, source.url);
}

/** Extracts page/slide text while preserving order for front/back pair generation. */
export async function extractFlashcardDocumentPages(source: FlashcardDocumentSource, userId: number) {
  const buffer = await loadAiGenerationSourceBuffer(source, userId);
  if (source.mimeType === "application/pdf") return extractPdfPages(buffer);
  if (source.mimeType === AI_SOURCE_PPTX_MIME) return extractPptxPages(buffer);
  if (source.mimeType === AI_SOURCE_DOCX_MIME) return extractDocxParagraphs(buffer);
  throw new Error("Choose a PDF, PowerPoint (.pptx), or Word (.docx) source file.");
}

/** Creates one card from each consecutive PDF/PPT page pair: first page front, second page back. */
export function pairFlashcardDocumentPages(pages: string[]): PairedFlashcardDocument {
  const pairs: FlashcardDocumentPair[] = [];
  for (let index = 0; index + 1 < pages.length; index += 2) {
    const front = pages[index]?.trim() ?? "";
    const back = pages[index + 1]?.trim() ?? "";
    if (front && back) {
      pairs.push({ front, back, frontPage: index + 1, backPage: index + 2 });
    }
  }
  if (!pairs.length) {
    throw new Error("This source needs at least one consecutive pair of pages or slides with readable text.");
  }
  return { pairs, skippedPageCount: pages.length % 2 };
}

/** Returns silent factual text for AI flashcard generation from Word or PowerPoint sources. */
export async function extractFlashcardDocumentText(source: FlashcardDocumentSource, userId: number) {
  const pages = await extractFlashcardDocumentPages(source, userId);
  const text = pages
    .filter(Boolean)
    .map((page, index) => `Section ${index + 1}: ${page}`)
    .join("\n\n")
    .slice(0, 60_000);
  if (!text.trim()) throw new Error("The selected source does not contain readable text.");
  return text;
}
