import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Quiz Card media proxy", () => {
  it("proxies only stored Question Bank media for effective Platform Admins", () => {
    const route = readProjectFile("server/routes/questionBankCardMedia.ts");
    const server = readProjectFile("server/_core/index.ts");

    expect(route).toContain("authenticatePlatformMediaAdmin(req)");
    expect(route).toContain('"question-image"');
    expect(route).toContain('"question-video"');
    expect(route).toContain('"option-image"');
    expect(route).toContain('"option-video"');
    expect(route).toContain("eq(questionBank.id, questionId)");
    expect(route).toContain('res.setHeader("Content-Disposition", "inline")');
    expect(route).toContain("Readable.fromWeb(upstream.body as never).pipe(res)");
    expect(server).toContain("registerQuestionBankCardMediaRoute(app)");
  });

  it("routes Quiz Card source and selected Media Repository media through same-origin endpoints", () => {
    const generator = readProjectFile("client/src/pages/QuestionBankSocialCardGenerator.tsx");

    expect(generator).toContain("/api/question-bank-card-media/${questionId}/${kind}");
    expect(generator).toContain("/api/media/${asset.slug}");
    expect(generator).toContain("questionVideoUrl = media.kind === \"video\"");
  });
});
