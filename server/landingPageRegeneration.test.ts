import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");
const procedureSlice = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe("landing page regeneration", () => {
  it("keeps regenerated course, product, download, and webinar pages as reviewable drafts", () => {
    const courseRouter = readProjectFile("server/routers/lmsQuizLandingRouter.ts");
    const productRouter = readProjectFile("server/routers/productsRouter.ts");
    const downloadRouter = readProjectFile("server/routers/downloadsRouter.ts");
    const webinarRouter = readProjectFile("server/routers/webinarRouter.ts");

    const courseProcedure = procedureSlice(courseRouter, "aiGenerateLandingPage:", "// ── Saved Page Templates");
    const productProcedure = procedureSlice(productRouter, "aiGenerateLandingPage:", "// ─── After Purchase Workflow");
    const downloadProcedure = procedureSlice(downloadRouter, "aiGenerateLandingPage:", "/** List all buyers/access holders");
    const webinarProcedure = procedureSlice(webinarRouter, "aiGenerateLandingPage:", "delete: protectedProcedure");

    [courseProcedure, productProcedure, downloadProcedure, webinarProcedure].forEach((procedure) => {
      expect(procedure).toContain("draftBlocks");
      expect(procedure).toContain("blocks: draftBlocks");
      expect(procedure).not.toContain("landingBlocks: blocksJson");
      expect(procedure).not.toContain("landingPageBlocks: JSON.stringify(blocks)");
    });
  });

  it("offers a regenerate control inside every requested landing page builder", () => {
    const builders = [
      "client/src/pages/admin/LandingPageBuilder.tsx",
      "client/src/pages/admin/ProductLandingPageBuilder.tsx",
      "client/src/pages/admin/DownloadLandingPageBuilder.tsx",
      "client/src/pages/admin/WebinarLandingPageBuilder.tsx",
    ].map(readProjectFile);

    builders.forEach((builder) => {
      expect(builder).toContain("Regenerate with AI");
      expect(builder).toContain("AI draft loaded for review.");
      expect(builder).toContain("Save Page");
    });
  });

  it("generates webinar copy from current factual details without inventing social proof", () => {
    const router = readProjectFile("server/routers/webinarRouter.ts");
    const procedure = procedureSlice(router, "aiGenerateLandingPage:", "delete: protectedProcedure");

    expect(procedure).toContain("webinar.title");
    expect(procedure).toContain("webinar.description");
    expect(procedure).toContain("webinar.scheduledAt");
    expect(procedure).toContain("Never invent testimonials, reviews, ratings");
    expect(procedure).toContain("parseLandingBlocks");
  });
});
