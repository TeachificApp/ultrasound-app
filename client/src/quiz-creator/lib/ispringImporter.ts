/**
 * iSpring .quiz File Importer
 *
 * iSpring .quiz files are ZIP archives containing:
 * - document.json: All question data, settings, branding
 * - media files: images, videos, audio referenced in questions
 *
 * This module parses the ZIP, extracts the document.json,
 * uploads embedded media to S3, and converts to our QuizFile format.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  QuizFile,
  QuizQuestion,
  QuestionType,
  QuizMeta,
  QuizBranding,
  McqData,
  TfData,
  MatchingData,
  FillBlankData,
  ShortAnswerData,
  OrderingData,
  NumericData,
  LikertData,
  EssayData,
  DragWordsData,
  DropdownData,
  DragDropData,
  HotspotData,
  ImageChoiceData,
} from "../types/quiz";

// ─── ZIP Parsing (using JSZip loaded from CDN or bundled) ────────────────────

let JSZipLib: any = null;

async function getJSZip() {
  if (JSZipLib) return JSZipLib;
  // Try to import from window (CDN) or dynamic import
  if ((window as any).JSZip) {
    JSZipLib = (window as any).JSZip;
    return JSZipLib;
  }
  // Load from CDN
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load JSZip"));
    document.head.appendChild(script);
  });
  JSZipLib = (window as any).JSZip;
  return JSZipLib;
}

// ─── Media Upload Helper ─────────────────────────────────────────────────────

interface MediaFile {
  path: string;
  blob: Blob;
  mimeType: string;
}

async function uploadMediaToS3(
  mediaFiles: MediaFile[],
  uploadFn: (file: File) => Promise<string>
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  for (const media of mediaFiles) {
    try {
      const file = new File([media.blob], media.path.split("/").pop() || "media", { type: media.mimeType });
      const url = await uploadFn(file);
      urlMap.set(media.path, url);
    } catch (e) {
      console.warn(`Failed to upload media: ${media.path}`, e);
    }
  }
  return urlMap;
}

// ─── Text Extraction from iSpring JSON structure ─────────────────────────────

function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;

  // Handle nested text structure: { d: [{ c: [{ t: "text" }] }] }
  if (node.d && Array.isArray(node.d)) {
    return node.d
      .map((para: any) => {
        if (para.c && Array.isArray(para.c)) {
          return para.c.map((seg: any) => seg.t || seg.text || "").join("");
        }
        return para.t || para.text || "";
      })
      .join("\n");
  }

  // Handle simple text
  if (node.t) return node.t;
  if (node.text) return node.text;

  return "";
}

function extractHtml(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return `<p>${node}</p>`;

  if (node.d && Array.isArray(node.d)) {
    return node.d
      .map((para: any) => {
        if (para.c && Array.isArray(para.c)) {
          const content = para.c
            .map((seg: any) => {
              let text = seg.t || seg.text || "";
              if (seg.b) text = `<strong>${text}</strong>`;
              if (seg.i) text = `<em>${text}</em>`;
              if (seg.u) text = `<u>${text}</u>`;
              return text;
            })
            .join("");
          return `<p>${content}</p>`;
        }
        return `<p>${para.t || para.text || ""}</p>`;
      })
      .join("");
  }

  return `<p>${node.t || node.text || ""}</p>`;
}

// ─── Question Type Mapping ───────────────────────────────────────────────────

function mapQuestionType(ispringType: string): QuestionType {
  const typeMap: Record<string, QuestionType> = {
    mc: "mcq",
    mr: "mcq", // multiple response = mcq with multiSelect
    tf: "tf",
    sa: "short_answer",
    fib: "fill_blank",
    match: "matching",
    seq: "ordering",
    hs: "hotspot",
    dd: "drag_drop",
    dw: "drag_words",
    sl: "dropdown", // select from list
    num: "numeric",
    likert: "likert",
    essay: "essay",
    // Fallback mappings
    multiple_choice: "mcq",
    multiple_response: "mcq",
    true_false: "tf",
    short_answer: "short_answer",
    fill_in_blank: "fill_blank",
    matching: "matching",
    sequence: "ordering",
    hotspot: "hotspot",
    drag_and_drop: "drag_drop",
    drag_the_words: "drag_words",
    select_from_lists: "dropdown",
    numeric: "numeric",
    likert_scale: "likert",
  };
  return typeMap[ispringType?.toLowerCase()] || "mcq";
}

// ─── Question Data Conversion ────────────────────────────────────────────────

function convertQuestionData(
  ispringQ: any,
  type: QuestionType,
  mediaUrlMap: Map<string, string>
): any {
  const resolveMedia = (path: string | undefined): string => {
    if (!path) return "";
    return mediaUrlMap.get(path) || path;
  };

  switch (type) {
    case "mcq": {
      const choices = (ispringQ.C?.chs || ispringQ.choices || []).map((ch: any) => ({
        id: uuidv4(),
        text: extractText(ch.t || ch.text || ch),
        correct: !!ch.c || !!ch.correct,
        imageUrl: resolveMedia(ch.img || ch.image),
      }));
      const isMultiResponse = ispringQ.tp === "mr" || ispringQ.type === "multiple_response" || choices.filter((c: any) => c.correct).length > 1;
      return { choices, multiSelect: isMultiResponse } as McqData;
    }

    case "tf": {
      const correct = ispringQ.C?.correct ?? ispringQ.correct ?? true;
      return { correct: !!correct } as TfData;
    }

    case "matching": {
      const pairs = (ispringQ.C?.pairs || ispringQ.pairs || []).map((p: any) => ({
        id: uuidv4(),
        premise: extractText(p.l || p.left || p.premise),
        response: extractText(p.r || p.right || p.response),
        premiseImageUrl: resolveMedia(p.lImg || p.leftImage),
        responseImageUrl: resolveMedia(p.rImg || p.rightImage),
      }));
      const distractors = (ispringQ.C?.distractors || ispringQ.distractors || []).map((d: any) => extractText(d));
      return { pairs, extraDistractors: distractors.length > 0 ? distractors : undefined } as MatchingData;
    }

    case "ordering": {
      const items = (ispringQ.C?.items || ispringQ.items || []).map((item: any) => ({
        id: uuidv4(),
        text: extractText(item.t || item.text || item),
        imageUrl: resolveMedia(item.img || item.image),
      }));
      return { items } as OrderingData;
    }

    case "fill_blank": {
      const template = extractText(ispringQ.C?.template || ispringQ.template || ispringQ.D);
      const blanks = (ispringQ.C?.blanks || ispringQ.blanks || []).map((b: any, idx: number) => ({
        id: b.id || `blank${idx + 1}`,
        acceptedAnswers: Array.isArray(b.answers) ? b.answers : [b.answer || b.text || ""],
        caseSensitive: b.caseSensitive ?? false,
      }));
      return { template, blanks } as FillBlankData;
    }

    case "short_answer": {
      const sampleAnswer = extractText(ispringQ.C?.answer || ispringQ.answer || "");
      const keywords = ispringQ.C?.keywords || ispringQ.keywords || [];
      const variants = ispringQ.C?.variants || ispringQ.variants || [];
      return {
        sampleAnswer,
        keywords: Array.isArray(keywords) ? keywords : [],
        autoGrade: !!ispringQ.C?.autoGrade,
        acceptedVariants: Array.isArray(variants) ? variants : [],
      } as ShortAnswerData;
    }

    case "hotspot": {
      const imageUrl = resolveMedia(ispringQ.C?.image || ispringQ.image || "");
      const regions = (ispringQ.C?.regions || ispringQ.regions || []).map((r: any) => ({
        id: uuidv4(),
        label: r.label || "",
        correct: r.correct ?? true,
        shape: r.shape || "rect",
        x: r.x || 0,
        y: r.y || 0,
        width: r.width,
        height: r.height,
        radius: r.radius,
        points: r.points,
      }));
      return {
        imageUrl,
        imageAlt: ispringQ.C?.imageAlt || "",
        regions,
        multiSelect: regions.filter((r: any) => r.correct).length > 1,
      } as HotspotData;
    }

    case "drag_drop": {
      const bgImage = resolveMedia(ispringQ.C?.backgroundImage || ispringQ.backgroundImage || "");
      const targets = (ispringQ.C?.targets || ispringQ.targets || []).map((t: any) => ({
        id: uuidv4(),
        label: t.label || "",
        x: t.x || 0,
        y: t.y || 0,
        width: t.width || 20,
        height: t.height || 15,
      }));
      const items = (ispringQ.C?.items || ispringQ.items || []).map((item: any, idx: number) => ({
        id: uuidv4(),
        text: extractText(item.t || item.text || item),
        imageUrl: resolveMedia(item.img || item.image),
        targetId: targets[item.targetIndex ?? idx]?.id || targets[0]?.id || "",
      }));
      return { backgroundImageUrl: bgImage, targets, items } as DragDropData;
    }

    case "drag_words": {
      const template = extractText(ispringQ.C?.template || ispringQ.template || "");
      const blanks = (ispringQ.C?.blanks || ispringQ.blanks || []).map((b: any, idx: number) => ({
        id: b.id || `blank${idx + 1}`,
        correctWord: b.word || b.correctWord || "",
      }));
      const distractors = ispringQ.C?.distractors || ispringQ.distractors || [];
      return { template, blanks, distractorWords: distractors } as DragWordsData;
    }

    case "dropdown": {
      const template = extractText(ispringQ.C?.template || ispringQ.template || "");
      const blanks = (ispringQ.C?.blanks || ispringQ.blanks || []).map((b: any, idx: number) => ({
        id: b.id || `blank${idx + 1}`,
        options: b.options || ["Option 1", "Option 2"],
        correctIndex: b.correctIndex ?? 0,
      }));
      return { template, blanks } as DropdownData;
    }

    case "numeric": {
      return {
        correctValue: ispringQ.C?.value ?? ispringQ.value ?? 0,
        tolerance: ispringQ.C?.tolerance ?? ispringQ.tolerance ?? 0,
        allowRange: !!(ispringQ.C?.rangeMin || ispringQ.rangeMin),
        rangeMin: ispringQ.C?.rangeMin ?? ispringQ.rangeMin,
        rangeMax: ispringQ.C?.rangeMax ?? ispringQ.rangeMax,
        unit: ispringQ.C?.unit || ispringQ.unit,
      } as NumericData;
    }

    case "likert": {
      const statements = (ispringQ.C?.statements || ispringQ.statements || []).map((s: any) => ({
        id: uuidv4(),
        text: extractText(s.t || s.text || s),
      }));
      const scaleLabels = ispringQ.C?.scaleLabels || ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
      return {
        statements,
        scaleLabels,
        scaleSize: scaleLabels.length,
      } as LikertData;
    }

    case "essay": {
      return {
        minWords: ispringQ.C?.minWords,
        maxWords: ispringQ.C?.maxWords,
        placeholder: ispringQ.C?.placeholder || "Write your answer here...",
        rubric: ispringQ.C?.rubric || "",
      } as EssayData;
    }

    default:
      return { choices: [], multiSelect: false } as McqData;
  }
}

// ─── Main Import Function ────────────────────────────────────────────────────

export interface ImportResult {
  quiz: QuizFile;
  mediaCount: number;
  questionCount: number;
  warnings: string[];
}

export async function importISpringQuiz(
  file: File,
  uploadFn: (file: File) => Promise<string>
): Promise<ImportResult> {
  const warnings: string[] = [];
  const JSZip = await getJSZip();

  // Read the file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Try to parse as ZIP first
  let zip: any;
  let documentJson: any;

  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    // Not a ZIP - might be our own .quiz format or plain JSON
    const text = await file.text();
    try {
      // Try as plain JSON
      documentJson = JSON.parse(text);
    } catch {
      throw new Error(
        "Unable to parse .quiz file. It may be in an unsupported format or encrypted."
      );
    }
  }

  // If it's a ZIP, extract document.json and media
  let mediaUrlMap = new Map<string, string>();

  if (zip) {
    // Find document.json (might be at root or in a subfolder)
    let docJsonFile = zip.file("document.json");
    if (!docJsonFile) {
      // Try to find it in any subfolder
      const allFiles = Object.keys(zip.files);
      const docPath = allFiles.find((f: string) => f.endsWith("document.json"));
      if (docPath) docJsonFile = zip.file(docPath);
    }

    if (!docJsonFile) {
      // Try data.json as alternative
      docJsonFile = zip.file("data.json");
      if (!docJsonFile) {
        const allFiles = Object.keys(zip.files);
        const dataPath = allFiles.find((f: string) => f.endsWith("data.json"));
        if (dataPath) docJsonFile = zip.file(dataPath);
      }
    }

    if (!docJsonFile) {
      throw new Error("No document.json found in the .quiz archive");
    }

    const docText = await docJsonFile.async("string");
    documentJson = JSON.parse(docText);

    // Extract and upload media files
    const mediaFiles: MediaFile[] = [];
    const mediaExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a"];

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if ((zipEntry as any).dir) continue;
      const ext = path.toLowerCase().substring(path.lastIndexOf("."));
      if (mediaExtensions.includes(ext)) {
        const blob = await (zipEntry as any).async("blob");
        const mimeMap: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
          ".mp3": "audio/mpeg",
          ".wav": "audio/wav",
          ".ogg": "audio/ogg",
          ".m4a": "audio/mp4",
        };
        mediaFiles.push({ path, blob, mimeType: mimeMap[ext] || "application/octet-stream" });
      }
    }

    if (mediaFiles.length > 0) {
      try {
        mediaUrlMap = await uploadMediaToS3(mediaFiles, uploadFn);
      } catch (e) {
        warnings.push(`Some media files could not be uploaded: ${(e as Error).message}`);
      }
    }
  }

  // ─── Parse document.json into our QuizFile format ────────────────────────

  const quiz = convertDocumentToQuiz(documentJson, mediaUrlMap, warnings);

  return {
    quiz,
    mediaCount: mediaUrlMap.size,
    questionCount: quiz.questions.length,
    warnings,
  };
}

function convertDocumentToQuiz(
  doc: any,
  mediaUrlMap: Map<string, string>,
  warnings: string[]
): QuizFile {
  const now = new Date().toISOString();

  // Extract quiz metadata
  const meta: QuizMeta = {
    id: uuidv4(),
    title: doc.title || doc.nm || doc.name || "Imported Quiz",
    description: extractText(doc.description || doc.desc || ""),
    author: doc.author || doc.authorName || "",
    authorEmail: doc.authorEmail || "",
    createdAt: doc.createdAt || now,
    updatedAt: now,
    version: 1,
    licenseKey: null,
    teachificOrgId: null,
    tags: doc.tags || [],
    passingScore: doc.passingScore ?? doc.passScore ?? 70,
    timeLimit: doc.timeLimit ?? doc.tl ?? null,
    shuffleQuestions: doc.shuffleQuestions ?? doc.rnd ?? false,
    shuffleAnswers: doc.shuffleAnswers ?? doc.rndAns ?? false,
    showFeedback: doc.showFeedback ?? "immediate",
    allowRetry: doc.allowRetry ?? true,
    maxAttempts: doc.maxAttempts ?? 3,
    allowBackNavigation: doc.allowBackNavigation ?? true,
    showProgressBar: doc.showProgressBar ?? true,
  };

  // Extract branding
  if (doc.branding || doc.theme || doc.design) {
    const b = doc.branding || doc.theme || doc.design || {};
    meta.branding = {
      primaryColor: b.primaryColor || b.accentColor || "#24abbc",
      backgroundColor: b.backgroundColor || b.bgColor || "#ffffff",
      textColor: b.textColor,
      fontFamily: b.fontFamily || b.font,
      logoUrl: b.logoUrl || b.logo ? (mediaUrlMap.get(b.logoUrl || b.logo) || b.logoUrl || b.logo) : undefined,
      backgroundImageUrl: b.backgroundImage ? (mediaUrlMap.get(b.backgroundImage) || b.backgroundImage) : undefined,
      backgroundOverlay: b.backgroundOverlay,
    };
  }

  // Extract questions
  let rawQuestions: any[] = [];

  // iSpring format: data.sl.g[].S[]
  if (doc.sl?.g) {
    for (const group of doc.sl.g) {
      if (group.S && Array.isArray(group.S)) {
        rawQuestions.push(...group.S);
      }
    }
  }
  // Alternative format: data.questions[]
  else if (doc.questions && Array.isArray(doc.questions)) {
    rawQuestions = doc.questions;
  }
  // Alternative: data.slides[]
  else if (doc.slides && Array.isArray(doc.slides)) {
    rawQuestions = doc.slides.filter((s: any) => s.tp || s.type); // filter out info slides
  }
  // Alternative: flat array at root
  else if (Array.isArray(doc)) {
    rawQuestions = doc;
  }

  const questions: QuizQuestion[] = rawQuestions.map((q: any, idx: number) => {
    const typeStr = q.tp || q.type || "mc";
    const type = mapQuestionType(typeStr);
    const stem = extractText(q.D || q.question || q.stem || q.text || "");
    const stemHtml = extractHtml(q.D || q.question || q.stem || "");

    // Extract question media
    let image: QuizQuestion["image"] = null;
    let audio: QuizQuestion["audio"] = null;
    let video: QuizQuestion["video"] = null;

    if (q.img || q.image) {
      const imgPath = q.img || q.image;
      image = { url: mediaUrlMap.get(imgPath) || imgPath, alt: q.imgAlt || "" };
    }
    if (q.audio) {
      const audioPath = typeof q.audio === "string" ? q.audio : q.audio.src;
      audio = { url: mediaUrlMap.get(audioPath) || audioPath, label: q.audio.label };
    }
    if (q.video) {
      const videoPath = typeof q.video === "string" ? q.video : q.video.src;
      video = { url: mediaUrlMap.get(videoPath) || videoPath, type: q.video.type };
    }

    // Extract feedback
    let feedback: QuizQuestion["feedback"] = undefined;
    if (q.fb || q.feedback) {
      const fb = q.fb || q.feedback;
      feedback = {
        correct: extractText(fb.correct || fb.right || fb.pass || ""),
        incorrect: extractText(fb.incorrect || fb.wrong || fb.fail || ""),
        partial: extractText(fb.partial || ""),
      };
    }

    let data;
    try {
      data = convertQuestionData(q, type, mediaUrlMap);
    } catch (e) {
      warnings.push(`Question ${idx + 1}: Failed to convert data for type "${typeStr}". Using default.`);
      data = { choices: [{ id: uuidv4(), text: "Option A", correct: true }], multiSelect: false };
    }

    return {
      id: uuidv4(),
      type,
      order: idx + 1,
      points: q.points ?? q.score ?? 1,
      required: q.required ?? true,
      stem,
      stemHtml: stemHtml !== `<p>${stem}</p>` ? stemHtml : undefined,
      image,
      audio,
      video,
      explanation: extractText(q.explanation || q.exp || ""),
      feedback,
      backgroundImageUrl: q.bgImage ? (mediaUrlMap.get(q.bgImage) || q.bgImage) : undefined,
      backgroundColor: q.bgColor,
      data,
    };
  });

  if (questions.length === 0) {
    warnings.push("No questions could be extracted from the file.");
  }

  return { meta, questions };
}

// ─── Export: detect if a file is an iSpring .quiz file ───────────────────────

export async function isISpringQuizFile(file: File): Promise<boolean> {
  // Check if it's a ZIP file (first 4 bytes = PK\x03\x04)
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    return true;
  }
  return false;
}
