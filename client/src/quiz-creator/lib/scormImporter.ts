/**
 * SCORM / QTI Package Importer
 *
 * Parses SCORM ZIP packages (1.2 and 2004) that contain QTI assessment XML.
 * Extracts questions and converts them to our QuizFile format.
 *
 * Supported QTI versions:
 * - QTI 1.2 (IMS QTI)
 * - QTI 2.1 (IMS QTI v2)
 *
 * Supported question types:
 * - Multiple Choice (single & multi-select)
 * - True/False
 * - Fill in the Blank
 * - Short Answer / Essay
 * - Matching
 * - Ordering
 */
import { v4 as uuidv4 } from "uuid";
import type {
  QuizFile,
  QuizQuestion,
  QuestionType,
  McqData,
  TfData,
  MatchingData,
  FillBlankData,
  ShortAnswerData,
  OrderingData,
  EssayData,
} from "../types/quiz";

// ─── JSZip Loader ────────────────────────────────────────────────────────────
let JSZipLib: any = null;
async function getJSZip() {
  if (JSZipLib) return JSZipLib;
  if ((window as any).JSZip) {
    JSZipLib = (window as any).JSZip;
    return JSZipLib;
  }
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

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ScormImportResult {
  quiz: QuizFile;
  mediaCount: number;
  questionCount: number;
  warnings: string[];
  scormVersion: "1.2" | "2004" | "unknown";
}

// ─── XML Parser Helper ───────────────────────────────────────────────────────
function parseXml(xmlString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  return doc;
}

function getTextContent(el: Element | null): string {
  if (!el) return "";
  return el.textContent?.trim() ?? "";
}

function querySelectorNS(parent: Element | Document, selector: string): Element | null {
  // Try without namespace first, then with common QTI namespaces
  let el = parent.querySelector(selector);
  if (el) return el;
  // Try case-insensitive tag matching
  const tagName = selector.replace(/[[\]]/g, "");
  const elements = parent.getElementsByTagName(tagName);
  return elements.length > 0 ? elements[0] : null;
}

function querySelectorAllNS(parent: Element | Document, selector: string): Element[] {
  let els = parent.querySelectorAll(selector);
  if (els.length > 0) return Array.from(els);
  // Try case-insensitive tag matching
  const tagName = selector.replace(/[[\]]/g, "").split(" ").pop() ?? selector;
  const elements = parent.getElementsByTagName(tagName);
  return Array.from(elements);
}

// ─── Media Extraction ────────────────────────────────────────────────────────
async function extractMedia(
  zip: any,
  basePath: string,
  src: string,
  uploadFn: (file: File) => Promise<string>
): Promise<string | null> {
  // Resolve relative path
  const mediaPath = basePath ? `${basePath}/${src}` : src;
  const file = zip.file(mediaPath) || zip.file(src);
  if (!file) return null;

  const blob = await file.async("blob");
  const ext = src.split(".").pop()?.toLowerCase() ?? "bin";
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", webp: "image/webp", mp4: "video/mp4", webm: "video/webm",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
  };
  const mime = mimeMap[ext] || "application/octet-stream";
  const mediaFile = new File([blob], src.split("/").pop() ?? "media", { type: mime });
  return uploadFn(mediaFile);
}

// ─── QTI 1.2 Parser ─────────────────────────────────────────────────────────
function parseQti12Item(
  itemEl: Element,
  warnings: string[]
): { question: QuizQuestion | null; mediaRefs: string[] } {
  const mediaRefs: string[] = [];
  const ident = itemEl.getAttribute("ident") || uuidv4();
  const title = itemEl.getAttribute("title") || "";

  // Get presentation element
  const presentation = itemEl.querySelector("presentation");
  if (!presentation) {
    warnings.push(`Item "${title || ident}": No presentation element found`);
    return { question: null, mediaRefs };
  }

  // Get question text from material/mattext
  let stem = "";
  const materialEls = presentation.querySelectorAll("material mattext");
  if (materialEls.length > 0) {
    stem = getTextContent(materialEls[0]);
  }
  // Also check flow > material
  if (!stem) {
    const flowMaterial = presentation.querySelector("flow material mattext");
    if (flowMaterial) stem = getTextContent(flowMaterial);
  }

  // Check for images in material
  const matimages = presentation.querySelectorAll("material matimage, matimage");
  matimages.forEach((img) => {
    const uri = img.getAttribute("uri") || img.getAttribute("src") || "";
    if (uri) mediaRefs.push(uri);
  });

  // Determine question type from response_lid / response_str / response_num
  const responseLid = presentation.querySelector("response_lid");
  const responseStr = presentation.querySelector("response_str");
  const responseNum = presentation.querySelector("response_num");

  // Get response processing for correct answers
  const resprocessing = itemEl.querySelector("resprocessing");
  const correctResponses: Set<string> = new Set();
  if (resprocessing) {
    const respconditions = resprocessing.querySelectorAll("respcondition");
    respconditions.forEach((cond) => {
      const setvar = cond.querySelector("setvar");
      if (setvar && parseFloat(getTextContent(setvar)) > 0) {
        const varequals = cond.querySelectorAll("varequal");
        varequals.forEach((ve) => correctResponses.add(getTextContent(ve)));
      }
    });
  }

  // Get feedback/explanation
  let explanation = "";
  const feedbacks = itemEl.querySelectorAll("itemfeedback mattext");
  if (feedbacks.length > 0) {
    explanation = getTextContent(feedbacks[0]);
  }

  if (responseLid) {
    // MCQ or True/False
    const rcardinality = responseLid.getAttribute("rcardinality") || "Single";
    const choices = responseLid.querySelectorAll("render_choice response_label");
    const choiceList: { id: string; text: string; correct: boolean }[] = [];

    choices.forEach((choice) => {
      const choiceIdent = choice.getAttribute("ident") || uuidv4();
      const mattext = choice.querySelector("material mattext");
      const text = getTextContent(mattext);
      choiceList.push({
        id: uuidv4(),
        text,
        correct: correctResponses.has(choiceIdent),
      });
    });

    // Detect True/False
    if (
      choiceList.length === 2 &&
      ((choiceList[0].text.toLowerCase() === "true" && choiceList[1].text.toLowerCase() === "false") ||
        (choiceList[0].text.toLowerCase() === "false" && choiceList[1].text.toLowerCase() === "true"))
    ) {
      const trueChoice = choiceList.find((c) => c.text.toLowerCase() === "true");
      const question: QuizQuestion = {
        id: uuidv4(),
        type: "tf",
        order: 0,
        points: 1,
        required: true,
        stem: stem || title,
        explanation,
        data: { correct: trueChoice?.correct ?? true } as any,
      };
      return { question, mediaRefs };
    }

    // MCQ
    const multiSelect = rcardinality.toLowerCase() === "multiple";
    const question: QuizQuestion = {
      id: uuidv4(),
      type: "mcq",
      order: 0,
      points: 1,
      required: true,
      stem: stem || title,
      explanation,
      data: { choices: choiceList, multiSelect } as any,
    };
    return { question, mediaRefs };
  }

  if (responseStr) {
    // Fill in the blank or short answer or essay
    const rows = responseStr.querySelector("render_fib");
    const rowCount = parseInt(rows?.getAttribute("rows") ?? "1", 10);

    if (rowCount > 3) {
      // Essay
      const question: QuizQuestion = {
        id: uuidv4(),
        type: "essay",
        order: 0,
        points: 1,
        required: true,
        stem: stem || title,
        explanation,
        data: {
          minWords: 0,
          maxWords: 5000,
          placeholder: "",
          rubric: "",
        } as any,
      };
      return { question, mediaRefs };
    }

    // Short answer / fill blank
    const correctAnswer = Array.from(correctResponses).join(", ");
    if (stem.includes("___") || stem.includes("____")) {
      // Fill in the blank
      const question: QuizQuestion = {
        id: uuidv4(),
        type: "fill_blank",
        order: 0,
        points: 1,
        required: true,
        stem: stem || title,
        explanation,
        data: {
          template: stem.replace(/_{3,}/g, "{{blank}}"),
          blanks: [{
            id: uuidv4(),
            acceptedAnswers: correctAnswer ? [correctAnswer] : [""],
            caseSensitive: false,
          }],

        } as any,
      };
      return { question, mediaRefs };
    }

    // Short answer
    const question: QuizQuestion = {
      id: uuidv4(),
      type: "short_answer",
      order: 0,
      points: 1,
      required: true,
      stem: stem || title,
      explanation,
      data: {
        sampleAnswer: correctAnswer || "",
        keywords: correctAnswer ? correctAnswer.split(",").map((s: string) => s.trim()) : [],
        autoGrade: true,
      } as any,
    };
    return { question, mediaRefs };
  }

  // Matching - look for response_grp
  const responseGrp = presentation.querySelector("response_grp");
  if (responseGrp) {
    // Parse matching pairs
    const pairs: { id: string; premise: string; response: string }[] = [];
    const grpLabels = responseGrp.querySelectorAll("render_choice response_label");
    grpLabels.forEach((label) => {
      const text = getTextContent(label.querySelector("material mattext"));
      pairs.push({ id: uuidv4(), premise: text, response: "" });
    });
    // Try to get right side from other materials
    const question: QuizQuestion = {
      id: uuidv4(),
      type: "matching",
      order: 0,
      points: 1,
      required: true,
      stem: stem || title,
      explanation,
      data: { pairs, distractors: [] } as any,
    };
    warnings.push(`Item "${title || ident}": Matching question imported with limited pair data`);
    return { question, mediaRefs };
  }

  // Fallback: treat as essay if we can't determine type
  warnings.push(`Item "${title || ident}": Unknown question type, imported as essay`);
  const question: QuizQuestion = {
    id: uuidv4(),
    type: "essay",
    order: 0,
    points: 1,
    required: true,
    stem: stem || title,
    explanation,
    data: { minWords: 0, maxWords: 5000, placeholder: "", rubric: [] } as any,
  };
  return { question, mediaRefs };
}

// ─── QTI 2.1 Parser ─────────────────────────────────────────────────────────
function parseQti21Item(
  doc: Document,
  warnings: string[]
): { question: QuizQuestion | null; mediaRefs: string[] } {
  const mediaRefs: string[] = [];

  // Get assessmentItem root
  const assessmentItem = doc.querySelector("assessmentItem") || doc.documentElement;
  const identifier = assessmentItem.getAttribute("identifier") || uuidv4();
  const title = assessmentItem.getAttribute("title") || "";

  // Get item body
  const itemBody = assessmentItem.querySelector("itemBody");
  if (!itemBody) {
    warnings.push(`Item "${title || identifier}": No itemBody found`);
    return { question: null, mediaRefs };
  }

  // Extract stem text from itemBody (first p or div)
  let stem = "";
  const bodyChildren = itemBody.children;
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];
    const tag = child.tagName.toLowerCase();
    if (tag === "p" || tag === "div" || tag === "prompt") {
      stem = getTextContent(child);
      break;
    }
  }
  if (!stem) {
    // Try prompt inside interaction
    const prompt = itemBody.querySelector("prompt");
    if (prompt) stem = getTextContent(prompt);
  }
  if (!stem) stem = title;

  // Check for images
  const images = itemBody.querySelectorAll("img, object");
  images.forEach((img) => {
    const src = img.getAttribute("src") || img.getAttribute("data") || "";
    if (src) mediaRefs.push(src);
  });

  // Get response declarations for correct answers
  const responseDeclarations = assessmentItem.querySelectorAll("responseDeclaration");
  const correctValues: string[] = [];
  responseDeclarations.forEach((rd) => {
    const correctResponse = rd.querySelector("correctResponse");
    if (correctResponse) {
      const values = correctResponse.querySelectorAll("value");
      values.forEach((v) => correctValues.push(getTextContent(v)));
    }
  });

  // Get feedback
  let explanation = "";
  const modalFeedback = assessmentItem.querySelector("modalFeedback");
  if (modalFeedback) explanation = getTextContent(modalFeedback);

  // Determine interaction type
  const choiceInteraction = itemBody.querySelector("choiceInteraction");
  const inlineChoiceInteraction = itemBody.querySelector("inlineChoiceInteraction");
  const textEntryInteraction = itemBody.querySelector("textEntryInteraction");
  const extendedTextInteraction = itemBody.querySelector("extendedTextInteraction");
  const matchInteraction = itemBody.querySelector("matchInteraction");
  const orderInteraction = itemBody.querySelector("orderInteraction");
  const gapMatchInteraction = itemBody.querySelector("gapMatchInteraction");

  if (choiceInteraction) {
    const maxChoices = parseInt(choiceInteraction.getAttribute("maxChoices") ?? "1", 10);
    const multiSelect = maxChoices > 1 || maxChoices === 0;

    // Get prompt if not already captured
    if (!stem) {
      const prompt = choiceInteraction.querySelector("prompt");
      if (prompt) stem = getTextContent(prompt);
    }

    const simpleChoices = choiceInteraction.querySelectorAll("simpleChoice");
    const choices: { id: string; text: string; correct: boolean }[] = [];
    simpleChoices.forEach((sc) => {
      const ident = sc.getAttribute("identifier") || "";
      choices.push({
        id: uuidv4(),
        text: getTextContent(sc),
        correct: correctValues.includes(ident),
      });
    });

    // Detect True/False
    if (
      choices.length === 2 &&
      ((choices[0].text.toLowerCase() === "true" && choices[1].text.toLowerCase() === "false") ||
        (choices[0].text.toLowerCase() === "false" && choices[1].text.toLowerCase() === "true"))
    ) {
      const trueChoice = choices.find((c) => c.text.toLowerCase() === "true");
      return {
        question: {
          id: uuidv4(),
          type: "tf",
          order: 0,
          points: 1,
          required: true,
          stem,
          explanation,
          data: { correct: trueChoice?.correct ?? true } as any,
        },
        mediaRefs,
      };
    }

    return {
      question: {
        id: uuidv4(),
        type: "mcq",
        order: 0,
        points: 1,
        required: true,
        stem,
        explanation,
        data: { choices, multiSelect } as any,
      },
      mediaRefs,
    };
  }

  if (matchInteraction) {
    // Matching question
    const simpleMatchSets = matchInteraction.querySelectorAll("simpleMatchSet");
    const pairs: { id: string; premise: string; response: string }[] = [];

    if (simpleMatchSets.length >= 2) {
      const leftSet = simpleMatchSets[0].querySelectorAll("simpleAssociableChoice");
      const rightSet = simpleMatchSets[1].querySelectorAll("simpleAssociableChoice");
      const leftItems = Array.from(leftSet).map((el) => ({
        id: el.getAttribute("identifier") || "",
        text: getTextContent(el),
      }));
      const rightItems = Array.from(rightSet).map((el) => ({
        id: el.getAttribute("identifier") || "",
        text: getTextContent(el),
      }));

      // Match based on correctValues (format: "leftId rightId")
      leftItems.forEach((left) => {
        const matchValue = correctValues.find((v) => v.startsWith(left.id + " ") || v.includes(left.id));
        const rightId = matchValue?.split(" ")[1] ?? "";
        const right = rightItems.find((r) => r.id === rightId);
        pairs.push({ id: uuidv4(), premise: left.text, response: right?.text ?? "" });
      });
    }

    return {
      question: {
        id: uuidv4(),
        type: "matching",
        order: 0,
        points: 1,
        required: true,
        stem,
        explanation,
        data: { pairs, distractors: [] } as any,
      },
      mediaRefs,
    };
  }

  if (orderInteraction) {
    const simpleChoices = orderInteraction.querySelectorAll("simpleChoice");
    const items: { id: string; text: string; correctPosition: number }[] = [];
    simpleChoices.forEach((sc, idx) => {
      const ident = sc.getAttribute("identifier") || "";
      const correctIdx = correctValues.indexOf(ident);
      items.push({
        id: uuidv4(),
        text: getTextContent(sc),
        correctPosition: correctIdx >= 0 ? correctIdx : idx,
      });
    });

    return {
      question: {
        id: uuidv4(),
        type: "ordering",
        order: 0,
        points: 1,
        required: true,
        stem,
        explanation,
        data: { items } as any,
      },
      mediaRefs,
    };
  }

  if (extendedTextInteraction) {
    return {
      question: {
        id: uuidv4(),
        type: "essay",
        order: 0,
        points: 1,
        required: true,
        stem,
        explanation,
        data: { minWords: 0, maxWords: 5000, placeholder: "", rubric: [] } as any,
      },
      mediaRefs,
    };
  }

  if (textEntryInteraction || inlineChoiceInteraction || gapMatchInteraction) {
    // Fill in the blank
    const blanks = [{
      id: uuidv4(),
      acceptedAnswers: correctValues.length > 0 ? correctValues : [""],
      caseSensitive: false,
    }];

    return {
      question: {
        id: uuidv4(),
        type: "fill_blank",
        order: 0,
        points: 1,
        required: true,
        stem,
        explanation,
        data: {
          blanks,
          template: stem.replace(/_{3,}/g, "{{blank}}"),
        } as any,
      },
      mediaRefs,
    };
  }

  // Fallback
  warnings.push(`Item "${title || identifier}": Unknown QTI 2.1 interaction type, imported as essay`);
  return {
    question: {
      id: uuidv4(),
      type: "essay",
      order: 0,
      points: 1,
      required: true,
      stem,
      explanation,
      data: { minWords: 0, maxWords: 5000, placeholder: "", rubric: [] } as any,
    },
    mediaRefs,
  };
}

// ─── Main Import Function ────────────────────────────────────────────────────
export function isScormPackage(file: File): boolean {
  return (
    file.name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

export async function importScormQuiz(
  file: File,
  uploadFn: (file: File) => Promise<string>
): Promise<ScormImportResult> {
  const warnings: string[] = [];
  const JSZip = await getJSZip();
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  let scormVersion: "1.2" | "2004" | "unknown" = "unknown";
  const questions: QuizQuestion[] = [];
  let mediaCount = 0;

  // ── Step 1: Find imsmanifest.xml ──────────────────────────────────────────
  const manifestFile = zip.file("imsmanifest.xml") || zip.file("IMSMANIFEST.XML");
  let assessmentFiles: string[] = [];
  let basePath = "";

  if (manifestFile) {
    const manifestXml = await manifestFile.async("string");
    const manifestDoc = parseXml(manifestXml);

    // Detect SCORM version
    const schemaVersion = manifestDoc.querySelector("schemaversion, schemaVersion");
    const schemaText = getTextContent(schemaVersion).toLowerCase();
    if (schemaText.includes("2004") || schemaText.includes("cam 1.3")) {
      scormVersion = "2004";
    } else if (schemaText.includes("1.2") || schemaText.includes("1.1")) {
      scormVersion = "1.2";
    }

    // Find assessment resources (type contains "imsqti" or file ends with .xml in assessment folders)
    const resources = manifestDoc.querySelectorAll("resource");
    resources.forEach((res) => {
      const type = (res.getAttribute("type") || "").toLowerCase();
      const href = res.getAttribute("href") || "";

      if (
        type.includes("imsqti") ||
        type.includes("assessment") ||
        type.includes("qti") ||
        href.toLowerCase().includes("assessment") ||
        href.toLowerCase().includes("qti")
      ) {
        if (href) assessmentFiles.push(href);
        // Also check file elements within the resource
        const files = res.querySelectorAll("file");
        files.forEach((f) => {
          const fHref = f.getAttribute("href") || "";
          if (fHref.endsWith(".xml") && fHref !== href) {
            assessmentFiles.push(fHref);
          }
        });
      }
    });

    // If no assessment resources found by type, look for XML files in common locations
    if (assessmentFiles.length === 0) {
      resources.forEach((res) => {
        const href = res.getAttribute("href") || "";
        if (href.endsWith(".xml") && href !== "imsmanifest.xml") {
          assessmentFiles.push(href);
        }
      });
    }
  }

  // ── Step 2: If no manifest, scan for QTI XML files ────────────────────────
  if (assessmentFiles.length === 0) {
    const allFiles = Object.keys(zip.files);
    assessmentFiles = allFiles.filter((f) => {
      const lower = f.toLowerCase();
      return (
        lower.endsWith(".xml") &&
        !lower.includes("imsmanifest") &&
        !lower.includes("metadata") &&
        (lower.includes("assessment") ||
          lower.includes("qti") ||
          lower.includes("quiz") ||
          lower.includes("test") ||
          lower.includes("item"))
      );
    });

    // If still nothing, try all XML files
    if (assessmentFiles.length === 0) {
      assessmentFiles = allFiles.filter(
        (f) => f.toLowerCase().endsWith(".xml") && !f.toLowerCase().includes("imsmanifest")
      );
    }
  }

  // ── Step 3: Parse each assessment file ────────────────────────────────────
  for (const assessmentPath of assessmentFiles) {
    const xmlFile = zip.file(assessmentPath);
    if (!xmlFile) continue;

    const xmlContent = await xmlFile.async("string");
    const doc = parseXml(xmlContent);

    // Determine base path for media resolution
    basePath = assessmentPath.includes("/")
      ? assessmentPath.substring(0, assessmentPath.lastIndexOf("/"))
      : "";

    // Check if this is QTI 2.x (has assessmentItem or assessmentTest)
    const isQti2 =
      doc.querySelector("assessmentItem") !== null ||
      doc.querySelector("assessmentTest") !== null ||
      xmlContent.includes("www.imsglobal.org/xsd/imsqti_v2");

    if (isQti2) {
      // QTI 2.x - could be a single item or a test with references
      const assessmentItem = doc.querySelector("assessmentItem");
      if (assessmentItem) {
        const { question, mediaRefs } = parseQti21Item(doc, warnings);
        if (question) {
          // Handle media
          for (const ref of mediaRefs) {
            const url = await extractMedia(zip, basePath, ref, uploadFn);
            if (url) {
              question.image = { url, alt: "" };
              mediaCount++;
            }
          }
          questions.push(question);
        }
      }

      // Check for assessmentTest with item references
      const assessmentTest = doc.querySelector("assessmentTest");
      if (assessmentTest) {
        const itemRefs = assessmentTest.querySelectorAll("assessmentItemRef");
        for (let i = 0; i < itemRefs.length; i++) {
          const href = itemRefs[i].getAttribute("href") || "";
          if (!href) continue;
          const itemPath = basePath ? `${basePath}/${href}` : href;
          const itemFile = zip.file(itemPath) || zip.file(href);
          if (!itemFile) {
            warnings.push(`Referenced item not found: ${href}`);
            continue;
          }
          const itemXml = await itemFile.async("string");
          const itemDoc = parseXml(itemXml);
          const { question, mediaRefs } = parseQti21Item(itemDoc, warnings);
          if (question) {
            for (const ref of mediaRefs) {
              const url = await extractMedia(zip, basePath, ref, uploadFn);
              if (url) {
                question.image = { url, alt: "" };
                mediaCount++;
              }
            }
            questions.push(question);
          }
        }
      }
    } else {
      // QTI 1.2 - look for item elements
      const items = doc.querySelectorAll("item");
      if (items.length === 0) continue;

      for (let i = 0; i < items.length; i++) {
        const { question, mediaRefs } = parseQti12Item(items[i], warnings);
        if (question) {
          for (const ref of mediaRefs) {
            const url = await extractMedia(zip, basePath, ref, uploadFn);
            if (url) {
              question.image = { url, alt: "" };
              mediaCount++;
            }
          }
          questions.push(question);
        }
      }
    }
  }

  // ── Step 4: Assign order ──────────────────────────────────────────────────
  questions.forEach((q, i) => {
    q.order = i;
  });

  if (questions.length === 0) {
    warnings.push("No questions could be extracted from this SCORM package. Ensure it contains QTI assessment XML.");
  }

  // ── Step 5: Build QuizFile ────────────────────────────────────────────────
  const quizTitle = file.name.replace(/\.(zip|scorm)$/i, "").replace(/[_-]/g, " ");
  const quiz = {
    meta: {
      id: uuidv4(),
      title: quizTitle,
      description: `Imported from SCORM package (${scormVersion})`,
      author: "",
      authorEmail: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      licenseKey: null,
      teachificOrgId: null,
      tags: ["scorm-import"],
      passingScore: 70,
      timeLimit: null,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showFeedback: "immediate" as const,
      allowRetry: true,
      maxAttempts: 3,
    },
    questions,
  } as QuizFile;
  return {

    quiz,
    mediaCount,
    questionCount: questions.length,
    warnings,
    scormVersion,
  };
}
