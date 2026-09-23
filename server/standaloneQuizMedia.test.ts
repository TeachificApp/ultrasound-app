import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("protected native quiz media", () => {
  const route = source("server/routes/standaloneQuizMedia.ts");
  const player = source("client/src/components/quiz/StandaloneQuestionMedia.tsx");
  const standalonePlayer = source("client/src/pages/StandaloneQuizPlayer.tsx");

  it("requires the signed-in attempt owner before streaming question or feedback media", () => {
    expect(route).toContain("sdk.authenticateRequest(req)");
    expect(route).toContain("eq(standaloneQuizAttempts.userId, user.id)");
    expect(route).toContain("/api/standalone-quiz-media/:attemptId/:questionBankId/:kind");
    expect(route).toContain('res.setHeader("Cache-Control", "private, no-store, max-age=0")');
  });

  it("keeps feedback media unavailable until an explanation-bearing quiz response", () => {
    expect(route).toContain('kind.startsWith("feedback-")');
    expect(route).toContain('media.quizType !== "quiz" || !media.showExplanations');
  });

  it("suppresses browser download affordances while retaining native playback controls", () => {
    expect(player).toContain('controlsList="nodownload noplaybackrate"');
    expect(player).toContain("disablePictureInPicture");
    expect(player).toContain("onContextMenu={preventMediaContextMenu}");
    expect(standalonePlayer).toContain("standalone-quiz-media");
  });

  it("uses inherited Question Bank folder branding for native questions while retaining Quiz Builder override behavior", () => {
    const router = source("server/routers/standaloneQuizRouter.ts");
    const admin = source("client/src/pages/admin/LMSAdmin.tsx");
    const schema = source("drizzle/schema.ts");
    const migration = source("drizzle/0079_question_bank_folder_quiz_logo.sql");

    expect(router).toContain("resolveInheritedQuestionBankFolderQuizLogo");
    expect(router).toContain("folderQuizLogoUrl");
    expect(standalonePlayer).toContain("folderQuizLogoUrl");
    expect(standalonePlayer).toContain("if (isBuilderMode &&");
    expect(standalonePlayer).toContain("Clinical question");
    expect(schema).toContain('quizLogoUrl: text("quiz_logo_url")');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS `quiz_logo_url`");
    expect(admin).toContain("Native quiz folder logo");
    expect(admin).toContain("Quiz Builder design branding takes precedence.");
  });
});
