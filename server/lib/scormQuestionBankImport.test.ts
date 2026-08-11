import AdmZip from "adm-zip";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { loadScormImportFromBase64 } from "./scormQuestionBankImport";

function createZipBase64(entries: Record<string, string | Buffer>): string {
  const zip = new AdmZip();
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"));
  }
  return zip.toBuffer().toString("base64");
}

function makeQuizPayload(): string {
  return Buffer.from(JSON.stringify({
    d: {
      T: "Adult Echo Knowledge Check",
      sl: { g: [{ i: "review", T: "Review", S: [] }] },
      padding: "x".repeat(200),
    },
  })).toString("base64");
}

function quizMakerZipFixture(): string {
  const payload = makeQuizPayload();
  return createZipBase64({
    "imsmanifest.xml": `<?xml version="1.0"?><manifest identifier="iSpringQuiz"><resources><resource identifier="quiz" href="index.html" /></resources></manifest>`,
    "index.html": `<!-- Created with iSpring QuizMaker --><html><head><title>Adult Echo Knowledge Check</title><link rel="stylesheet" href="data/player.css" /></head><body><script src="data/player.js"></script><script>QuizPlayer.start("${payload}");</script></body></html>`,
    "data/player.js": "/* iSpring QuizMaker runtime */",
    "data/player.css": ".quiz-player { display: block; }",
    "data/quiz-assets/cover.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });
}

function flashcardPresentationZipFixture(): string {
  return createZipBase64({
    "index.html": `<!-- Created with iSpring --><html><head><title>Adult Echo Review</title><link rel="stylesheet" href="data/slide1.css" /></head><body><script src="data/player.js"></script><script>window.ispringPresentation = true; PresentationPlayer.start();</script></body></html>`,
    "data/player.js": "/* iSpring Presentation runtime */",
    "data/slide1.js": `loadHandler(0, '<span>What is RVSP?</span>');`,
    "data/slide2.js": `loadHandler(1, '<span>RVSP = 4V² + RAP</span>');`,
    "data/slide1.css": ".slide { display: block; }",
    "data/img0.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });
}

function genericScormZipFixture(): string {
  return createZipBase64({
    "imsmanifest.xml": `<?xml version="1.0"?><manifest identifier="SCORM12"><organizations default="ORG-1"><organization identifier="ORG-1"><item identifier="ITEM-1" identifierref="RES-1" /></organization></organizations><resources><resource identifier="RES-1" adlcp:scormtype="sco" href="index.html" /></resources></manifest>`,
    "index.html": "<html><head><title>Generic SCORM Lesson</title></head><body><script src=\"scormdriver.js\"></script>SCORM 1.2 learning content</body></html>",
    "scormdriver.js": "/* SCORM API adapter */",
    "content/lesson.html": "<h1>Lesson content</h1>",
  });
}

describe("loadScormImportFromBase64", () => {
  it("imports a realistic iSpring QuizMaker ZIP", async () => {
    const quizZip = quizMakerZipFixture();

    const result = await loadScormImportFromBase64(quizZip);

    expect(result.parsed.title).toBe("Adult Echo Knowledge Check");
    expect(result.zipEntries.map((entry) => entry.entryName)).toEqual(expect.arrayContaining([
      "imsmanifest.xml", "index.html", "data/player.js", "data/quiz-assets/cover.png",
    ]));
  });

  it("rejects an iSpring Presentation flashcard ZIP with an actionable error", async () => {
    const flashcardZip = flashcardPresentationZipFixture();

    await expect(loadScormImportFromBase64(flashcardZip)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/flashcard deck/i),
    } satisfies Partial<TRPCError>);
  });

  it("rejects an unsupported generic SCORM ZIP without claiming it is valid quiz data", async () => {
    const genericScormZip = genericScormZipFixture();

    await expect(loadScormImportFromBase64(genericScormZip)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/Not a valid iSpring quiz/i),
    } satisfies Partial<TRPCError>);
  });
});
