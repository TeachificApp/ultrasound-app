import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("selected-brand tool routing", () => {
  it("maps per-brand tool destinations to selected application hosts and route tags", () => {
    const urls = readProjectFile("client/src/lib/perBrandUrls.ts");
    const presentation = readProjectFile("client/src/lib/brandToolPresentation.ts");
    const brands = readProjectFile("shared/brands.ts");

    expect(urls).toContain("withBrandTag(path, brand)");
    expect(urls).toContain("IHEARTECHO_APP_URL");
    expect(urls).toContain("perBrandAdminUrl");
    expect(urls).toContain('path === "/platform-admin"');
    expect(presentation).toContain("iheartecho");
    expect(presentation).toContain("getBrandDisplayConfig");
    expect(brands).toContain("app.iheartecho.net");
  });

  it("keeps Challenge Cards on app hosts while Social output uses public marketing hosts", () => {
    const challengeCards = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const socialContent = readProjectFile("client/src/pages/SocialContentGenerator.tsx");
    const socialRouter = readProjectFile("server/routers/socialContentRouter.ts");
    const platformAdmin = readProjectFile("client/src/pages/PlatformAdmin.tsx");

    for (const source of [challengeCards, socialContent]) {
      expect(source).toContain("resolveToolBrand(location, window.location.hostname)");
      expect(source).toContain("getBrandToolPresentation");
      expect(source).toContain("perBrandAdminUrl(\"/platform-admin\", presentation.brand)");
    }
    expect(challengeCards).toContain("presentation.challengeLabel");
    expect(challengeCards).toContain("presentation.appHost");
    expect(socialContent).toContain("presentation.publicHost");
    expect(socialContent).toContain("STANDARD_SOCIAL_HASHTAGS");
    expect(socialContent).toContain("presentation.logoUrl");
    expect(socialRouter).toContain("ctx.brand");
    expect(platformAdmin).toContain('perBrandAdminUrl("/admin/engagement", "iheartecho")');
    expect(platformAdmin).toContain('perBrandAdminUrl("/image-quality-review", "iheartecho")');
  });

  it("keeps the active selector authoritative and renders paired clinical question-and-answer cards", () => {
    const platformAdmin = readProjectFile("client/src/pages/PlatformAdmin.tsx");
    const challengeCards = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");
    const clinicalCards = readProjectFile("client/src/components/social/ClinicalQuizCard.tsx");

    expect(platformAdmin).toContain('dualBrand === "iheartecho" && (isIHE || isPlatformAdminOrOwner)');
    expect(challengeCards).toContain("const contextLabel = q.category?.trim() || category");
    expect(challengeCards).toContain('variant="answer"');
    expect(challengeCards).toContain("template={template}");
    expect(clinicalCards).toContain("function ClinicalQuizAnswerCard");
    expect(clinicalCards).toContain("function getQuestionFit");
    expect(clinicalCards).toContain("function getAnswerFit");
    expect(clinicalCards).toContain('const OPTION_LETTERS = ["A", "B", "C", "D", "E"]');
    expect(clinicalCards).toContain("DAILY CLINICAL CHALLENGE");
    expect(clinicalCards).toContain(">ANSWER<");
    expect(platformAdmin).toContain('label: "Quiz Card Generator"');
  });

  it("registers selected-brand Engagement URLs and carries A–D labels into public-host Question Bank Social Card captions", () => {
    const app = readProjectFile("client/src/App.tsx");
    const socialCards = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(app).toContain('{ base: "/admin/engagement", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EngagementDashboard /></RoleGuard> }');
    expect(socialCards).toContain('const OPTION_LETTERS = ["A", "B", "C", "D"]');
    expect(socialCards).toContain('`${OPTION_LETTERS[index] ?? String.fromCharCode(65 + index)}. ${stripHtml(option.text)}`');
    expect(socialCards).toContain('perBrandAdminUrl("/platform-admin", routePresentation.brand)');
    expect(socialCards).toContain("presentation.publicHost");
    expect(socialCards).not.toContain("presentation.challengeLabel");
  });
});
