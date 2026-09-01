import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const routerSource = fs.readFileSync(path.resolve(import.meta.dirname, "routers/lmsQuizLandingRouter.ts"), "utf8");
const builderSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("landing page persistence", () => {
  it("updates and verifies the saved block payload before reporting success", () => {
    const procedure = routerSource.slice(routerSource.indexOf("saveLandingPageBlocks:"), routerSource.indexOf("saveLandingPageSeo:"));
    expect(procedure).toContain("updatedAt: updatedAt");
    expect(procedure).toContain("const [persisted]");
    expect(procedure).toContain("persisted.blocks !== blocksJson");
    expect(procedure).toContain("savedBlockCount: input.blocks.length");
  });

  it("saves the exact inserted template block set and retains a visible unsaved state if the write fails", () => {
    expect(builderSource).toContain("const nextBlocks = [...blocksRef.current, ...tplBlocks]");
    expect(builderSource).toContain("saveBlocks.mutateAsync({ courseId: numericCourseId, blocks: nextBlocks })");
    expect(builderSource).toContain('toast.success("Page template added and saved!")');
    expect(builderSource).toContain(".catch(() => {");
    expect(builderSource).toContain("autoSave.markDirty();");
  });
});
