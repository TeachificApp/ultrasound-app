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
    expect(presentation).toContain("iheartecho");
    expect(presentation).toContain("getBrandDisplayConfig");
    expect(brands).toContain("app.iheartecho.net");
  });

  it("uses route-selected presentation in Challenge Cards and Social Content for branding, filenames, captions, and return navigation", () => {
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
    expect(socialContent).toContain("presentation.socialHashtags");
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
  });
});
