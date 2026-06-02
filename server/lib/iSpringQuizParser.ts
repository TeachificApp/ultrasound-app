/**
 * iSpringQuizParser.ts
 *
 * Parses iSpring QuizMaker SCORM exports (version 11.x and later).
 *
 * iSpring 11.x embeds all quiz data as a base64-encoded JSON blob in index.html,
 * passed directly to QuizPlayer.start(). This parser:
 *   1. Reads index.html from an extracted SCORM directory
 *   2. Extracts and decodes the base64 data blob
 *   3. Walks the JSON structure to extract groups, questions, answers, and feedback
 *   4. Returns a normalized ParsedQuiz object ready for DB insertion
 *
 * Supported question types:
 *   - MultipleChoice  → "mcq"
 *   - TrueFalse       → "truefalse"
 *   - MultipleResponse → "mcq" (multi-select stored as comma-separated correct answers)
 *
 * Formatting: question HTML is preserved as-is from the iSpring export so that
 * color, font, and layout are retained when rendered in the platform quiz engine.
 */

import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedAnswer {
  text: string;       // Plain text (for correctAnswer matching)
  html: string;       // Full HTML (for rich rendering)
  isCorrect: boolean;
  imageRef?: string;  // storage:// reference if the answer has an image
}

export interface ParsedQuestion {
  /** iSpring internal ID */
  id: string;
  /** iSpring question type */
  ispringType: string;
  /** Normalized platform type */
  type: "mcq" | "truefalse";
  /** Question text as HTML (preserves iSpring styling) */
  questionHtml: string;
  /** Question text as plain text (for search/display) */
  questionText: string;
  /** Answer choices */
  answers: ParsedAnswer[];
  /** Correct answer text (matches one of answers[].text) */
  correctAnswer: string;
  /** Explanation/feedback HTML */
  explanationHtml: string;
  /** Explanation as plain text */
  explanationText: string;
  /** Image references (storage:// paths) used in the question */
  imageRefs: string[];
}

export interface ParsedGroup {
  /** iSpring group ID */
  id: string;
  /** Group name as defined in iSpring QuizMaker */
  name: string;
  questions: ParsedQuestion[];
}

export interface ParsedQuiz {
  title: string;
  groups: ParsedGroup[];
  /** All unique image refs across the quiz (storage:// paths) */
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

/** Extract storage:// image references from iSpring HTML */
function extractImageRefs(html: string): string[] {
  const refs: string[] = [];
  const re = /storage:\/\/[^\s"'<>)]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    refs.push(m[0]);
  }
  return [...new Set(refs)];
}

/** Get the plain text from an iSpring D-block (question or answer descriptor) */
function getTextFromDBlock(d: any): { html: string; text: string } {
  if (!d) return { html: "", text: "" };
  const html = d.h ?? "";
  // iSpring stores plain text in d.d[0] — use it as fallback
  const text = d.d?.[0] ?? stripHtml(html);
  return { html, text };
}

// ─── Question parsers ─────────────────────────────────────────────────────────

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

/** Extract feedback HTML from iSpring question settings */
function getFeedback(q: any): { html: string; text: string } {
  // Correct feedback is in q.s.F.c.v.h
  const correctHtml = q?.s?.F?.c?.v?.h ?? "";
  // Incorrect feedback is in q.s.F.ic.v.h
  const incorrectHtml = q?.s?.F?.ic?.v?.h ?? "";
  // Prefer correct feedback; fall back to incorrect; strip HTML for text
  const html = correctHtml || incorrectHtml;
  return { html, text: stripHtml(html) };
}

function parseQuestion(q: any): ParsedQuestion | null {
  const tp = q.tp as string;
  if (!tp) return null;

  const { html: questionHtml, text: questionText } = getTextFromDBlock(q.D);
  const feedback = getFeedback(q);
  const imageRefs = extractImageRefs(questionHtml);

  // MultipleChoice and MultipleResponse use q.C.chs[]
  if (tp === "MultipleChoice" || tp === "MultipleResponse") {
    const answers = parseChoices(q.C?.chs ?? []);
    const correctAnswers = answers.filter(a => a.isCorrect);
    if (answers.length === 0) return null;

    return {
      id: q.i ?? "",
      ispringType: tp,
      type: "mcq",
      questionHtml,
      questionText,
      answers,
      correctAnswer: correctAnswers.map(a => a.text).join("|"),
      explanationHtml: feedback.html,
      explanationText: feedback.text,
      imageRefs,
    };
  }

  // TrueFalse uses q.C.chs[] with "True" and "False" choices
  if (tp === "TrueFalse") {
    const answers = parseChoices(q.C?.chs ?? []);
    // iSpring TrueFalse may not have explicit chs — derive from q.C.ca (correct answer index)
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
        correctAnswer: trueFirst.find(a => a.isCorrect)?.text ?? "True",
        explanationHtml: feedback.html,
        explanationText: feedback.text,
        imageRefs,
      };
    }
    const correctAnswer = answers.find(a => a.isCorrect)?.text ?? answers[0]?.text ?? "True";
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

  // Unsupported types (Sequence, Matching, WordBank, etc.) — skip
  return null;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse an iSpring SCORM quiz from an extracted directory.
 * The directory should contain index.html (and data/ subfolder).
 *
 * @param extractedDir  Path to the extracted SCORM directory (contains index.html)
 * @returns ParsedQuiz or throws if not a valid iSpring quiz
 */
export function parseISpringQuiz(extractedDir: string): ParsedQuiz {
  // Find index.html — may be in a subdirectory
  let indexPath = path.join(extractedDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    // Try one level deep
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

  const html = fs.readFileSync(indexPath, "utf8");

  // Validate it's an iSpring export
  if (!html.includes("iSpring") && !html.includes("QuizPlayer")) {
    throw new Error("Not an iSpring SCORM package");
  }

  // Extract the base64 data blob - it's assigned to `var data = "..."` or passed inline
  const b64Match =
    html.match(/var\s+data\s*=\s*"([A-Za-z0-9+/=]{100,})"/) ??
    html.match(/"([A-Za-z0-9+/=]{500,})";\s*document\.addEventListener/);
  if (!b64Match) {
    throw new Error("Could not find iSpring data blob in index.html");
  }

  const decoded = Buffer.from(b64Match[1], "base64").toString("utf8");
  return parseISpringDataBlob(decoded);
}

function parseISpringDataBlob(jsonStr: string): ParsedQuiz {
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

/**
 * Parse an iSpring SCORM quiz from a ZIP buffer (in-memory).
 * Useful when the ZIP has already been downloaded to a Buffer.
 */
export async function parseISpringQuizFromBuffer(zipBuffer: Buffer): Promise<ParsedQuiz> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Find index.html
  const indexEntry = entries.find(e =>
    e.entryName.toLowerCase().endsWith("index.html") &&
    !e.entryName.includes("__MACOSX")
  );
  if (!indexEntry) throw new Error("index.html not found in SCORM ZIP");

  const html = indexEntry.getData().toString("utf8");

  if (!html.includes("iSpring") && !html.includes("QuizPlayer")) {
    throw new Error("Not an iSpring SCORM package");
  }

  const b64Match = html.match(/var\s+data\s*=\s*"([A-Za-z0-9+/=]{100,})"/) ??
    html.match(/"([A-Za-z0-9+/=]{500,})";\s*document\.addEventListener/);

  if (!b64Match) throw new Error("Could not find iSpring data blob in index.html");

  const decoded = Buffer.from(b64Match[1], "base64").toString("utf8");
  return parseISpringDataBlob(decoded);
}
