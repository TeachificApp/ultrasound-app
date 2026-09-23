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

  it("keeps source questions unchanged while offering approved Media Repository selection plus platform-sized PNG and MP4 output", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const exporter = readProjectFile("client/src/components/social/SocialCardExport.tsx");

    expect(page).toContain("trpc.questionBank.listQuestions.useQuery");
    expect(page).toContain("trpc.mediaRepo.listAssets.useQuery");
    expect(page).toContain("uploadFileToMediaRepository");
    expect(page).toContain("brand: presentation.brand");
    expect(page).toContain("exportSocialCard");
    expect(page).toContain("SocialExportControls");
    expect(page).toContain("source questions remain unchanged");
    expect(exporter).toContain("Mp4OutputFormat");
    expect(exporter).toContain("CanvasSource");
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

  it("uses public Challenge Classic answer rows without exposing internal MCQ labels", () => {
    const generator = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const card = readProjectFile("client/src/components/social/ClinicalQuizCard.tsx");

    expect(generator).not.toContain("title={selectedQuestion.type.toUpperCase()}");
    expect(card).toContain('border: `${px(2)}px solid ${theme.accent}66`');
    expect(card).toContain('background: theme.accent');
  });

  it("browses the full authorized Question Bank with folders, tags, media filters, and pagination without changing source records", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const router = readProjectFile("server/routers/questionBankRouter.ts");

    expect(page).toContain("trpc.questionBank.listFolders.useQuery");
    expect(page).toContain("trpc.questionBank.listTags.useQuery");
    expect(page).toContain("mediaKind: mediaFilter === \"all\" ? undefined : mediaFilter");
    expect(page).toContain("pageSize: 100");
    expect(page).toContain("Page {page} of {totalPages}");
    expect(router).toContain('mediaKind: z.enum(["image", "video"]).optional()');
    expect(router).toContain('input.mediaKind === "image"');
    expect(router).toContain('input.mediaKind === "video"');
  });

  it("makes large folder libraries and tag sets easy to scan and filter before applying Question Bank filters", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(page).toContain("flattenFolderBrowserEntries");
    expect(page).toContain("const [folderSearch, setFolderSearch]");
    expect(page).toContain("Find a folder");
    expect(page).toContain("max-h-[42vh]");
    expect(page).toContain("break-words");
    expect(page).toContain("const [tagSearch, setTagSearch]");
    expect(page).toContain("Search tags");
    expect(page).toContain("visibleTags");
    expect(page).toContain("Clear {tagIds.length}");
  });

  it("selects card identity independently and uses a public non-daily Quiz Card destination and caption", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");
    const card = readProjectFile("client/src/components/social/ClinicalQuizCard.tsx");

    expect(page).toContain('const [cardBrand, setCardBrand] = useState<"aaus" | "iheartecho">');
    expect(page).toContain('footerHost={presentation.publicHost}');
    expect(page).toContain('answerContextLabel="CLINICAL QUIZ"');
    expect(page).toContain('answerFooterMessage="Follow for clinical learning"');
    expect(page).toContain('`🩺 ${presentation.displayName} Clinical Quiz: Can you answer this clinical question?`');
    expect(page).toContain('`🔗 Explore more clinical learning at ${presentation.publicHost}`');
    expect(page).not.toContain("presentation.challengeLabel");
    expect(card).toContain('answerContextLabel = "DAILY CLINICAL CHALLENGE"');
  });

  it("supports optional display-only source-folder and custom labels on exported Quiz Cards and captions", () => {
    const page = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(page).toContain("includeSourceFolderLabel");
    expect(page).toContain("customCardLabel");
    expect(page).toContain("sourceFolderLabel");
    expect(page).toContain("Source: ${cardLabel}");
    expect(page).toContain("title={cardLabel}");
    expect(page).toContain("This changes only this exported card and caption.");
  });
});
