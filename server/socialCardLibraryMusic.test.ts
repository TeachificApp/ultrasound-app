import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const exporter = readFileSync(`${root}/client/src/components/social/SocialCardExport.tsx`, "utf8");
const loopSynthesizer = readFileSync(`${root}/client/src/lib/aiMusicLoop.ts`, "utf8");
const quiz = readFileSync(`${root}/client/src/pages/QuestionBankSocialCardGenerator.tsx`, "utf8");
const social = readFileSync(`${root}/client/src/pages/SocialContentGenerator.tsx`, "utf8");
const challenge = readFileSync(`${root}/client/src/pages/ChallengeCardGenerator.tsx`, "utf8");
const router = readFileSync(`${root}/server/routers/quizCardLibraryRouter.ts`, "utf8");
const questionBankRouter = readFileSync(`${root}/server/routers/questionBankRouter.ts`, "utf8");
const migration = readFileSync(`${root}/drizzle/0072_quiz_card_library.sql`, "utf8");
const serverEntry = readFileSync(`${root}/server/_core/index.ts`, "utf8");

describe("card music, combined exports, and Quiz Card Library", () => {
  it("offers direct audio upload in the shared exporter for each brand", () => {
    expect(exporter).toContain("Upload audio");
    expect(exporter).toContain("uploadFileToMediaRepository");
    expect(exporter).toContain("musicUploadBrand");
    expect(exporter).toContain("Selected:");
    expect(exporter).toContain("<audio ref={musicPreviewRef} controls");
    expect(exporter).toContain("Preview plays in this browser.");
    for (const page of [quiz, social, challenge]) expect(page).toContain("musicUploadBrand={presentation.brand}");
  });

  it("uses explicit no-music, CC0-search, and upload modes with previewable catalogue results", () => {
    expect(exporter).toContain('type MusicSourceMode = "none" | "catalogue" | "upload" | "ai"');
    expect(exporter).toContain('<option value="none">No music</option>');
    expect(exporter).toContain('<option value="catalogue">Free CC0 search</option>');
    expect(exporter).toContain('<option value="ai">Generate AI beat / loop</option>');
    expect(exporter).toContain('<option value="upload">Upload audio</option>');
    expect(exporter).toContain('musicMode === "catalogue"');
    expect(exporter).toContain('setTimeout(() => setCatalogueQuery(query), 300)');
    expect(exporter).toContain('Use track');
    expect(exporter).toContain('aria-label={`Preview ${option.title}`}');
  });

  it("composes and saves an original AI music loop through the shared control", () => {
    expect(exporter).toContain("trpc.aiMusic.composeLoop.useMutation()");
    expect(exporter).toContain("renderAiMusicLoop(composition.plan, composition.durationSeconds)");
    expect(exporter).toContain('folder: "social-card-ai-music"');
    expect(exporter).toContain('source: "ai_generated"');
    expect(exporter).toContain("localBlob: wav");
    expect(exporter).toContain("Instrumental only.");
  });

  it("embeds freshly selected generated or uploaded audio from browser bytes instead of silently omitting it", () => {
    expect(exporter).toContain("musicBlob?: Blob | null");
    expect(exporter).toMatch(/musicBlob\s*\? await musicBlob\.arrayBuffer\(\)/);
    expect(exporter).toContain("The selected ${label} could not be embedded in this MP4");
    for (const page of [quiz, social, challenge]) expect(page).toContain("musicBlob: selectedMusic?.localBlob");
  });

  it("renders a layered modern instrumental mix rather than a single oscillator beat", () => {
    for (const layer of ["addModernKick", "addModernSnare", "addModernHat", "addLayeredBass", "addModernLead", "addPadChord", "createImpulseResponse", "createDrive"]) {
      expect(loopSynthesizer).toContain(layer);
    }
    expect(loopSynthesizer).toContain("createDynamicsCompressor");
    expect(loopSynthesizer).toContain("chordProgression");
  });

  it("supports question-and-answer MP4 sequences across every card generator", () => {
    expect(quiz).toContain('kind: "combined"');
    expect(social).toContain('mp4Sequence');
    expect(social).toContain('Question + answer');
    expect(challenge).toContain('kind: "combined"');
    expect(challenge).toContain('downloadCombined');
    expect(challenge).toContain('Question + answer MP4');
    expect(exporter).toContain("COMBINED_ANSWER_REVEAL_SECONDS = 7.11");
    expect(exporter).toContain("OUTRO_HOLD_SECONDS = 10");
    expect(exporter).toContain("STATIC_LABEL_TO_CONTENT_GAP_RATIO");
    expect(quiz).toContain("outroHost: presentation.publicHost");
    expect(social).toContain("outroHost: presentation.publicHost");
    expect(challenge).toContain("outroHost: presentation.appHost");
  });

  it("persists shared Quiz Card snapshots with moderation actions", () => {
    expect(migration).toContain("quiz_card_library");
    for (const action of ["save", "publish", "flag", "resolveFlag", "delete"]) expect(router).toContain(`${action}: platformAdminProcedure`);
    expect(router).toContain("Quiz Card Library save did not return a record ID");
    expect(router).toContain("Quiz Card Library save could not be verified");
    expect(router).toContain(".where(eq(quizCardLibrary.id, id))");
    expect(quiz).toContain("Shared Quiz Card Library");
    expect(quiz).toContain("Save to library");
    expect(quiz).toContain("Saved and verified in the shared Quiz Card Library.");
    expect(quiz).toContain("Quiz Card Library could not load:");
  });

  it("keeps answer-image and answer-video questions in native quizzes rather than partial Quiz Card renders", () => {
    expect(quiz).toContain("excludeAnswerMedia: true");
    expect(quiz).toContain("Quiz Cards use accessible A–D text answer rows");
    expect(questionBankRouter).toContain("excludeAnswerMedia: z.boolean().optional()");
    expect(questionBankRouter).toContain("NOT LIKE '%\"imageUrl\"%'");
    expect(questionBankRouter).toContain("NOT LIKE '%\"videoUrl\"%'");
  });

  it("does not disclose any database URL fragment from the production status probe", () => {
    expect(serverEntry).toContain('app.get("/api/debug/db-status"');
    expect(serverEntry).not.toContain("dbUrlPrefix");
  });
});
