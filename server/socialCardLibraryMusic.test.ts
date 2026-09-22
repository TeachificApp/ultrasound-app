import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const exporter = readFileSync(`${root}/client/src/components/social/SocialCardExport.tsx`, "utf8");
const quiz = readFileSync(`${root}/client/src/pages/QuestionBankSocialCardGenerator.tsx`, "utf8");
const social = readFileSync(`${root}/client/src/pages/SocialContentGenerator.tsx`, "utf8");
const challenge = readFileSync(`${root}/client/src/pages/ChallengeCardGenerator.tsx`, "utf8");
const router = readFileSync(`${root}/server/routers/quizCardLibraryRouter.ts`, "utf8");
const migration = readFileSync(`${root}/drizzle/0072_quiz_card_library.sql`, "utf8");

describe("card music, combined exports, and Quiz Card Library", () => {
  it("offers direct audio upload in the shared exporter for each brand", () => {
    expect(exporter).toContain("Upload audio");
    expect(exporter).toContain("uploadFileToMediaRepository");
    expect(exporter).toContain("musicUploadBrand");
    expect(exporter).toContain("Sample:");
    expect(exporter).toContain("<audio ref={musicPreviewRef} controls");
    expect(exporter).toContain("Preview plays in this browser only");
    for (const page of [quiz, social, challenge]) expect(page).toContain("musicUploadBrand={presentation.brand}");
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
    expect(quiz).toContain("outroHost: presentation.publicHost");
    expect(social).toContain("outroHost: presentation.publicHost");
    expect(challenge).toContain("outroHost: presentation.appHost");
  });

  it("persists shared Quiz Card snapshots with moderation actions", () => {
    expect(migration).toContain("quiz_card_library");
    for (const action of ["save", "publish", "flag", "resolveFlag", "delete"]) expect(router).toContain(`${action}: platformAdminProcedure`);
    expect(quiz).toContain("Shared Quiz Card Library");
    expect(quiz).toContain("Save to library");
  });
});
