/**
 * iSpringQuizParser.ts
 *
 * Parses iSpring QuizMaker SCORM exports (version 11.x and later).
 */
import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedAnswer {
  text: string;
  html: string;
  isCorrect: boolean;
  imageRef?: string;
  videoRef?: string;
}

export interface ParsedQuestion {
  id: string;
  ispringType: string;
  type: "mcq" | "truefalse" | "hotspot";
  questionHtml: string;
  questionText: string;
  answers: ParsedAnswer[];
  correctAnswer: string;
  explanationHtml: string;
  explanationText: string;
  imageRefs: string[];
  videoRefs: string[];
  questionImageRefs: string[];
  questionVideoRefs: string[];
  feedbackImageRefs: string[];
  feedbackVideoRefs: string[];
  hotspotMarkers?: Array<{
    id: string;
    label: string;
    isCorrect: boolean;
    shape: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  correctAnswers?: string;
}

export interface ParsedGroup {
  id: string;
  name: string;
  questions: ParsedQuestion[];
}

export interface ParsedQuiz {
  title: string;
  groups: ParsedGroup[];
  allImageRefs: string[];
  allVideoRefs: string[];
}

/**
 * Raised when an iSpring HTML export is a presentation-style flashcard deck,
 * rather than a QuizMaker package with scored questions and answer keys.
 */
export class ISpringFlashcardDeckError extends Error {
  constructor() {
    super(
      "This file is an iSpring flashcard deck, not a graded iSpring quiz. Flashcard decks do not include the answer keys and response options required for Question Bank import. Keep it as an interactive flashcard ZIP, or export the material as an iSpring QuizMaker quiz before importing it."
    );
    this.name = "ISpringFlashcardDeckError";
  }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isVideoRef(ref: string): boolean {
  return /\.(mp4|m4v|webm|mov|wmv|avi|m3u8)(?:$|[?#])/i.test(ref);
}

function isSupportedMediaRef(ref: string): boolean {
  return /^storage:\/\//i.test(ref)
    || /\.(png|jpe?g|gif|webp|svg|mp4|m4v|webm|mov|wmv|avi|m3u8)(?:$|[?#])/i.test(ref);
}

function normalizeMediaRef(ref: string): string | null {
  const normalized = ref.trim().replace(/^['"]|['"]$/g, "");
  if (!normalized || normalized.startsWith("data:") || normalized.startsWith("#")) return null;
  return isSupportedMediaRef(normalized) ? normalized : null;
}

/**
 * iSpring can declare package media in its JSON resource list or embed it as
 * `src`, `poster`, `href`, CSS `url()`, and lazy-load attributes in its HTML.
 * Collect each supported local or absolute image/video reference once so the
 * import step can copy package assets into durable Question Bank storage.
 */
function extractMediaRefsFromHtml(html: string): string[] {
  if (!html) return [];
  const refs: string[] = [];
  const storageRe = /storage:\/\/[^\s"'<>)]+/g;
  const attributeRe = /(?:src|href|poster|data-src|data-poster)\s*=\s*["']([^"']+)["']/gi;
  const cssUrlRe = /url\(\s*(['"]?)([^'"\s)]+)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = storageRe.exec(html)) !== null) refs.push(match[0]);
  while ((match = attributeRe.exec(html)) !== null) refs.push(match[1]);
  while ((match = cssUrlRe.exec(html)) !== null) refs.push(match[2]);
  return [...new Set(refs.map(normalizeMediaRef).filter((ref): ref is string => Boolean(ref)))];
}

function getTextFromDBlock(d: any): { html: string; text: string } {
  if (!d) return { html: "", text: "" };
  const html = d.h ?? "";
  const text = d.d?.[0] ?? stripHtml(html);
  return { html, text };
}

function getDeclaredMediaRefs(block: any): string[] {
  return getNestedMediaRefs(block?.r);
}

/**
 * iSpring stores media in a mixture of direct resource arrays and nested
 * attachment/feedback objects (for example `at.i.i`, `at.v.i`, and
 * `s.F.c.v.r[].assetId`). Traverse those structures without assuming one
 * export-version-specific layout.
 */
function getNestedMediaRefs(value: unknown): string[] {
  const refs = new Set<string>();
  const visit = (entry: unknown) => {
    if (typeof entry === "string") {
      const direct = normalizeMediaRef(entry);
      if (direct) refs.add(direct);
      for (const ref of extractMediaRefsFromHtml(entry)) refs.add(ref);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (entry && typeof entry === "object") {
      Object.values(entry as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return [...refs];
}

function parseChoices(chs: any[]): ParsedAnswer[] {
  if (!Array.isArray(chs)) return [];
  return chs.map((ch: any) => {
    const { html, text } = getTextFromDBlock(ch.t);
    const mediaRefs = [...new Set([
      ...extractMediaRefsFromHtml(html),
      ...getDeclaredMediaRefs(ch.t),
      ...getNestedMediaRefs(ch),
    ])];
    const imageRef = mediaRefs.find((ref) => !isVideoRef(ref));
    const videoRef = mediaRefs.find(isVideoRef);
    return {
      text: text || stripHtml(html),
      html,
      isCorrect: ch.c === true,
      ...(imageRef ? { imageRef } : {}),
      ...(videoRef ? { videoRef } : {}),
    };
  });
}

function getFeedback(q: any): { html: string; text: string; refs: string[] } {
  const correctValue = q?.s?.F?.c?.v;
  const incorrectValue = q?.s?.F?.ic?.v;
  const correctHtml = correctValue?.h ?? "";
  const incorrectHtml = incorrectValue?.h ?? "";
  const html = correctHtml || incorrectHtml;
  return {
    html,
    text: stripHtml(html),
    refs: [...new Set([
      ...extractMediaRefsFromHtml(correctHtml),
      ...extractMediaRefsFromHtml(incorrectHtml),
      ...getDeclaredMediaRefs(correctValue),
      ...getDeclaredMediaRefs(incorrectValue),
      ...getNestedMediaRefs(correctValue),
      ...getNestedMediaRefs(incorrectValue),
    ])],
  };
}

function parseQuestion(q: any): ParsedQuestion | null {
  const tp = q.tp as string;
  if (!tp) return null;

  const { html: questionHtml, text: questionText } = getTextFromDBlock(q.D);
  const feedback = getFeedback(q);
  const questionRefs = [...new Set([
    ...extractMediaRefsFromHtml(questionHtml),
    ...getDeclaredMediaRefs(q.D),
    ...getNestedMediaRefs(q.D),
    ...getNestedMediaRefs(q.at),
    ...getNestedMediaRefs(q.tp === "Hotspot" ? q.C?.i : null),
  ])];
  const feedbackRefs = [...new Set([...extractMediaRefsFromHtml(feedback.html), ...feedback.refs])];

  const withMedia = (answers: ParsedAnswer[]) => {
    const answerRefs = answers.flatMap((answer) => [
      ...extractMediaRefsFromHtml(answer.html),
      ...(answer.imageRef ? [answer.imageRef] : []),
      ...(answer.videoRef ? [answer.videoRef] : []),
    ]);
    const questionImageRefs = questionRefs.filter((ref) => !isVideoRef(ref));
    const questionVideoRefs = questionRefs.filter(isVideoRef);
    const feedbackImageRefs = feedbackRefs.filter((ref) => !isVideoRef(ref));
    const feedbackVideoRefs = feedbackRefs.filter(isVideoRef);
    const allRefs = [...questionRefs, ...feedbackRefs, ...answerRefs];
    return {
      imageRefs: [...new Set(allRefs.filter((ref) => !isVideoRef(ref)))],
      videoRefs: [...new Set(allRefs.filter(isVideoRef))],
      questionImageRefs,
      questionVideoRefs,
      feedbackImageRefs,
      feedbackVideoRefs,
    };
  };

  if (tp === "MultipleChoice" || tp === "MultipleResponse") {
    const answers = parseChoices(q.C?.chs ?? []);
    const correctAnswers = answers.filter((a) => a.isCorrect);
    if (answers.length === 0) return null;

    return {
      id: q.i ?? "",
      ispringType: tp,
      type: "mcq",
      questionHtml,
      questionText,
      answers,
      correctAnswer: correctAnswers.map((a) => a.text).join("|"),
      explanationHtml: feedback.html,
      explanationText: feedback.text,
      ...withMedia(answers),
    };
  }

  if (tp === "TrueFalse") {
    const answers = parseChoices(q.C?.chs ?? []);
    if (answers.length === 0) {
      const correctIndex = q.C?.ca ?? 0;
      const trueFirst: ParsedAnswer[] = [
        { text: "True", html: "True", isCorrect: correctIndex === 0 },
        { text: "False", html: "False", isCorrect: correctIndex === 1 },
      ];
      return {
        id: q.i ?? "",
        ispringType: tp,
        type: "truefalse",
        questionHtml,
        questionText,
        answers: trueFirst,
        correctAnswer: trueFirst.find((a) => a.isCorrect)?.text ?? "True",
        explanationHtml: feedback.html,
        explanationText: feedback.text,
        ...withMedia(trueFirst),
      };
    }
    const correctAnswer = answers.find((a) => a.isCorrect)?.text ?? answers[0]?.text ?? "True";
    return {
      id: q.i ?? "",
      ispringType: tp,
      type: "truefalse",
      questionHtml,
      questionText,
      answers,
      correctAnswer,
      explanationHtml: feedback.html,
      explanationText: feedback.text,
      ...withMedia(answers),
    };
  }

  if (tp === "Hotspot") {
    const answers = Array.isArray(q.C?.a) ? q.C.a : [];
    const toPercent = (value: unknown) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      const percent = numeric > 100 ? numeric / 100 : numeric;
      return Math.max(0, Math.min(100, percent));
    };
    const markers = answers.map((answer: any, index: number) => {
      const region = answer?.r ?? {};
      return {
        id: `${q.i ?? "hotspot"}-${index + 1}`,
        label: stripHtml(answer?.t ?? answer?.l ?? ""),
        isCorrect: answer?.c !== false,
        shape: "rect" as const,
        x: toPercent(region.x),
        y: toPercent(region.y),
        width: toPercent(region.w),
        height: toPercent(region.h),
      };
    });
    const correctMarkerIndexes = markers
      .map((marker, index) => marker.isCorrect ? index : -1)
      .filter((index) => index >= 0);
    const imageRef = getNestedMediaRefs(q.C?.i).find((ref) => !isVideoRef(ref));
    const hotspotRefs = [...new Set([
      ...getNestedMediaRefs(q.C),
      ...(imageRef ? [imageRef] : []),
    ])];
    return {
      id: q.i ?? "",
      ispringType: tp,
      type: "hotspot",
      questionHtml,
      questionText,
      answers: [],
      correctAnswer: "",
      correctAnswers: JSON.stringify(correctMarkerIndexes),
      explanationHtml: feedback.html,
      explanationText: feedback.text,
      hotspotMarkers: markers,
      imageRefs: [...new Set([...withMedia([]).imageRefs, ...hotspotRefs.filter((ref) => !isVideoRef(ref))])],
      videoRefs: [...new Set([...withMedia([]).videoRefs, ...hotspotRefs.filter(isVideoRef)])],
      questionImageRefs: imageRef ? [imageRef] : questionRefs.filter((ref) => !isVideoRef(ref)),
      questionVideoRefs: questionRefs.filter(isVideoRef),
      feedbackImageRefs: feedbackRefs.filter((ref) => !isVideoRef(ref)),
      feedbackVideoRefs: feedbackRefs.filter(isVideoRef),
    };
  }

  return null;
}

// ─── Base64 / JSON extraction ─────────────────────────────────────────────────

/** Extract the iSpring base64 quiz payload from index.html (handles split string literals). */
export function extractISpringBase64FromHtml(html: string): string | null {
  const varAssign = html.match(/var\s+data\s*=\s*([\s\S]*?);/);
  if (varAssign) {
    const parts = [...varAssign[1].matchAll(/"([A-Za-z0-9+/=\s]*)"/g)].map((m) =>
      m[1].replace(/\s+/g, "")
    );
    const joined = parts.join("");
    if (joined.length >= 100) return joined;
  }

  const startMatch = html.match(/QuizPlayer\.start\s*\(\s*"([A-Za-z0-9+/=]{100,})"/);
  if (startMatch) return startMatch[1];

  const legacyMatch = html.match(/"([A-Za-z0-9+/=]{500,})";\s*document\.addEventListener/);
  if (legacyMatch) return legacyMatch[1];

  let longest = "";
  for (const m of html.matchAll(/"([A-Za-z0-9+/=]{200,})"/g)) {
    if (m[1].length > longest.length) longest = m[1];
  }
  return longest.length >= 100 ? longest : null;
}

function decodeISpringBase64(b64: string): string {
  const normalized = b64.replace(/\s+/g, "");
  const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();
  if (!decoded) throw new Error("iSpring data blob decoded to empty string");
  return decoded;
}

export function parseISpringDataBlob(jsonStr: string): ParsedQuiz {
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse iSpring data blob as JSON: ${e}`);
  }

  const d = data?.d;
  if (!d) throw new Error("Invalid iSpring data structure: missing 'd' key");

  const title: string = d.T ?? "Imported Quiz";
  const sl = d.sl ?? {};
  const rawGroups: any[] = sl.g ?? [];

  const allImageRefs: string[] = [];
  const allVideoRefs: string[] = [];
  const groups: ParsedGroup[] = [];

  for (const rawGroup of rawGroups) {
    const groupId: string = rawGroup.i ?? String(groups.length);
    const groupName: string = stripHtml(rawGroup.T ?? "") || `Group ${groups.length + 1}`;
    const rawQuestions: any[] = rawGroup.S ?? [];

    const questions: ParsedQuestion[] = [];
    for (const rawQ of rawQuestions) {
      const parsed = parseQuestion(rawQ);
      if (parsed) {
        questions.push(parsed);
        allImageRefs.push(...parsed.imageRefs);
        allVideoRefs.push(...parsed.videoRefs);
        for (const a of parsed.answers) {
          if (a.imageRef) allImageRefs.push(a.imageRef);
          if (a.videoRef) allVideoRefs.push(a.videoRef);
        }
      }
    }

    if (questions.length > 0) {
      groups.push({ id: groupId, name: groupName, questions });
    }
  }

  return {
    title,
    groups,
    allImageRefs: [...new Set(allImageRefs)],
    allVideoRefs: [...new Set(allVideoRefs)],
  };
}

export function parseQuizFromHtml(html: string): ParsedQuiz {
  if (!html.includes("iSpring") && !html.includes("QuizPlayer")) {
    throw new Error("Not an iSpring SCORM package");
  }

  // iSpring Presentation flashcard exports contain one JavaScript file per card
  // and often a misleading base64 blob. They are not QuizMaker packages, so
  // parsing that blob as question JSON produces an unreadable syntax error.
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const isPresentationDeck = /\bispringPresentation\b|\bPresentationPlayer\b/i.test(html)
    && !/\bQuizPlayer\b/i.test(html);
  if (/flashcards?/i.test(title) || isPresentationDeck) {
    throw new ISpringFlashcardDeckError();
  }

  const b64 = extractISpringBase64FromHtml(html);
  if (!b64) throw new Error("Could not find iSpring data blob in index.html");
  return parseISpringDataBlob(decodeISpringBase64(b64));
}

type ZipEntry = { entryName: string; getData: () => Buffer };

function pickBestIndexHtml(entries: ZipEntry[]): ZipEntry | null {
  const candidates = entries.filter(
    (e) =>
      e.entryName.toLowerCase().endsWith("index.html") &&
      !e.entryName.includes("__MACOSX")
  );
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = -1;
  for (const entry of candidates) {
    const html = entry.getData().toString("utf8");
    const b64 = extractISpringBase64FromHtml(html);
    const score = (b64?.length ?? 0) + (html.includes("QuizPlayer") ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

function tryParseJsonEntries(entries: ZipEntry[]): ParsedQuiz | null {
  for (const entry of entries) {
    const name = entry.entryName.toLowerCase();
    if (!name.endsWith(".json") && !name.endsWith(".js")) continue;
    const raw = entry.getData().toString("utf8").trim();
    const attempts = [raw];
    const jsonMatch = raw.match(/(\{[\s\S]*"d"[\s\S]*\})/);
    if (jsonMatch) attempts.push(jsonMatch[1]);
    for (const attempt of attempts) {
      try {
        const parsed = parseISpringDataBlob(attempt);
        if (parsed.groups.length > 0) return parsed;
      } catch {
        // try next
      }
    }
  }
  return null;
}

export function parseISpringQuiz(extractedDir: string): ParsedQuiz {
  let indexPath = path.join(extractedDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    const entries = fs.readdirSync(extractedDir);
    for (const entry of entries) {
      const candidate = path.join(extractedDir, entry, "index.html");
      if (fs.existsSync(candidate)) {
        indexPath = candidate;
        break;
      }
    }
  }
  if (!fs.existsSync(indexPath)) {
    throw new Error("index.html not found in SCORM package");
  }
  return parseQuizFromHtml(fs.readFileSync(indexPath, "utf8"));
}

export async function parseISpringQuizFromBuffer(zipBuffer: Buffer): Promise<ParsedQuiz> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const indexEntry = pickBestIndexHtml(entries);
  if (indexEntry) {
    try {
      return parseQuizFromHtml(indexEntry.getData().toString("utf8"));
    } catch (e) {
      const fromJson = tryParseJsonEntries(entries);
      if (fromJson) return fromJson;
      throw e;
    }
  }

  const fromJson = tryParseJsonEntries(entries);
  if (fromJson) return fromJson;

  throw new Error("index.html not found in SCORM ZIP");
}
