import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const router = fs.readFileSync(path.resolve(import.meta.dirname, "routers/lmsQuizLandingRouter.ts"), "utf8");
const admin = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const builder = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("page regeneration draft workflow", () => {
  it("returns a reviewable draft rather than persisting generated page blocks", () => {
    const procedure = router.slice(router.indexOf("aiGenerateLandingPage:"), router.indexOf("// ── Saved Page Templates"));
    expect(procedure).toContain("return { success: true, blockCount: draftBlocks.length, blocks: draftBlocks }");
    expect(procedure).not.toContain(".set({ blocks: blocksJson");
    expect(procedure).not.toContain("realistic review");
    expect(procedure).toContain("Never invent testimonials, reviews, ratings");
  });

  it("opens the generated draft in the builder and requires an explicit save", () => {
    expect(admin).toContain("landing-page-ai-draft:${courseId}");
    expect(builder).toContain("AI draft loaded for review.");
    expect(builder).toContain("Your saved page is unchanged until you select Save Page.");
    expect(builder).toContain("if (aiDraftLoaded) return;");
    expect(builder).toContain("blocksLoadedRef.current && !aiDraftLoaded");
    expect(builder).toContain("setAiDraftLoaded(false);");
  });
});
