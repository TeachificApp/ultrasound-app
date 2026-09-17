import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Challenge Card selected-brand contracts", () => {
  it("filters card-generator queue and dated data by the request-selected brand", () => {
    const router = readProjectFile("server/routers/quickfireRouter.ts");

    expect(router).toContain("adminGetCardGeneratorData: adminProcedure.query(async ({ ctx })");
    expect(router).toContain('const brand = ctx.brand === "iheartecho" ? "iheartecho" : "aaus"');
    expect(router).toContain("const categories = getBrandCategoryConfig(brand).categories");
    expect(router).toContain("eq(quickfireChallenges.brand, brand)");
    expect(router).toContain("eq(quickfireDailySets.brand, brand)");
  });

  it("keeps the clinical template choices available in the generator source", () => {
    const generator = readProjectFile("client/src/pages/ChallengeCardGenerator.tsx");

    expect(generator).toContain("Clinical White");
    expect(generator).toContain("Clinical Aqua");
    expect(generator).toContain("Clinical Teal");
    expect(generator).toContain("Clinical Dark");
  });

  it("classifies mock attempts through the deployed standalone quiz type column", () => {
    const router = readProjectFile("server/routers/adminUserRouter.ts");

    expect(router).toContain("q.type AS quizType");
    expect(router).toContain('String(r.quizType) === "mock_exam"');
    expect(router).not.toContain("q.is_mock_exam AS isMockExam");
  });
});
