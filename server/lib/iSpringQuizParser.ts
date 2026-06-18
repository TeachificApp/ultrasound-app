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
}

export interface ParsedQuestion {
  id: string;
  ispringType: string;
  type: "mcq" | "truefalse";
  questionHtml: string;
  questionText: string;
  answers: ParsedAnswer[];
  correctAnswer: string;
  explanationHtml: string;
  explanationText: string;
  imageRefs: string[];
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

function extractImageRefs(html: string): string[] {
  const refs: string[] = [];
  const re = /storage:\/\/[^\s"'<>)]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    refs.push(m[0]);
  }
  return [...new Set(refs)];
}

function getTextFromDBlock(d: any): { html: string; text: string } {
  if (!d) return { html: "", text: "" };
  const html = d.h ?? "";
  const text = d.d?.[0] ?? stripHtml(html);
  return { html, text };
}

function parseChoices(chs: any[]): ParsedAnswer[] {
  if (!Array.isArray(chs)) return [];
  return chs.map((ch: any) => {
    const { html, text } = getTextFromDBlock(ch.t);
    const imageRef = ch.t?.r?.[0] ?? undefined;
    return {
      text: text || stripHtml(html),
      html,
      isCorrect: ch.c === true,
      imageRef,
    };
  });
}

function getFeedback(q: any): { html: string; text: string } {
  const correctHtml = q?.s?.F?.c?.v?.h ?? "";
  const incorrectHtml = q?.s?.F?.ic?.v?.h ?? "";
  const html = correctHtml || incorrectHtml;
  return { html, text: stripHtml(html) };
}

function parseQuestion(q: any): ParsedQuestion | null {
  const tp = q.tp as string;
  if (!tp) return null;

  const { html: questionHtml, text: questionText } = getTextFromDBlock(q.D);
  const feedback = getFeedback(q);
  const imageRefs = extractImageRefs(questionHtml);

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
      imageRefs,
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
        imageRefs,
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
      imageRefs,
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
  const groups: ParsedGroup[] = [];

  for (const rawGroup of rawGroups) {
    const groupId: string = rawGroup.i ?? String(groups.length);
    const groupName: string = rawGroup.T ?? `Group ${groups.length + 1}`;
    const rawQuestions: any[] = rawGroup.S ?? [];

    const questions: ParsedQuestion[] = [];
    for (const rawQ of rawQuestions) {
      const parsed = parseQuestion(rawQ);
      if (parsed) {
        questions.push(parsed);
        allImageRefs.push(...parsed.imageRefs);
        for (const a of parsed.answers) {
          if (a.imageRef) allImageRefs.push(a.imageRef);
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
  };
}

function parseQuizFromHtml(html: string): ParsedQuiz {
  if (!html.includes("iSpring") && !html.includes("QuizPlayer")) {
    throw new Error("Not an iSpring SCORM package");
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
