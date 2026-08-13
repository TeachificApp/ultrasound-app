import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers/lmsCourseBuilderRouter.ts"), "utf8");

describe("copied lesson publication safety", () => {
  it("creates a direct copied lesson as Draft instead of inheriting publication status", () => {
    const copyLessonSource = routerSource.slice(routerSource.indexOf("copyLesson: protectedProcedure"), routerSource.indexOf("copyModule: protectedProcedure"));
    expect(copyLessonSource).toContain('status: "draft"');
  });

  it("creates every lesson copied through a module as Draft", () => {
    const copyModuleSource = routerSource.slice(routerSource.indexOf("copyModule: protectedProcedure"));
    expect(copyModuleSource).toContain('status: "draft"');
  });
});
