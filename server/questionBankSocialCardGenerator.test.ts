import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Question Bank social-card generation", () => {
  it("uses Question Bank media first and preserves a no-media variant", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(page).toContain("function getQuestionMedia");
    expect(page).toContain("question.questionVideoUrl");
    expect(page).toContain("question.questionImageUrl");
    expect(page).toContain("setMedia(getQuestionMedia(question))");
    expect(page).toContain('setMedia({ kind: "none" })');
  });

  it("keeps source questions unchanged while offering approved Media Repository selection, upload, PNG, and MP4 output", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const renderer = readProjectFile("client/src/components/social/ClinicalQuizCard.tsx");

    expect(page).toContain("trpc.questionBank.listQuestions.useQuery");
    expect(page).toContain("trpc.mediaRepo.listAssets.useQuery");
    expect(page).toContain("uploadFileToMediaRepository");
    expect(page).toContain("brand: presentation.brand");
    expect(page).toContain("renderClinicalQuizCardToPng");
    expect(page).toContain("exportClinicalVideoCardAsMp4");
    expect(page).toContain("source questions remain unchanged");
    expect(renderer).toContain("kind: \"none\"");
    expect(renderer).toContain("Mp4OutputFormat");
    expect(renderer).toContain("Conversion.init");
  });

  it("retains an allowlisted selected brand for approved media uploads", () => {
    const uploadClient = readProjectFile("client/src/lib/mediaRepoUpload.ts");
    const uploadServer = readProjectFile("server/routes/uploadMediaRepo.ts");

    expect(uploadClient).toContain('"X-App-Brand": options.brand');
    expect(uploadServer).toContain('requestedBrand === "aaus" || requestedBrand === "iheartecho"');
  });

  it("registers the selected-brand tool only behind the existing effective Platform Admin route guard", () => {
    const app = readProjectFile("client/src/App.tsx");
    const platformAdmin = readProjectFile("client/src/pages/PlatformAdmin.tsx");

    expect(app).toContain("QuestionBankSocialCardGenerator");
    expect(app).toContain('base: "/admin/question-bank-social-cards"');
    expect(app).toContain('RoleGuard roles={["platform_admin"]} allowAdmin={true}');
    expect(platformAdmin).toContain('id: "question-bank-social-cards"');
  });
});
