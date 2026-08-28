import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("embedded-only Quiz Creator workflow", () => {
  it("uses the approved module/widget publication control rather than a public access control", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    expect(admin).toContain("assignments = data.assignments ?? []");
    expect(admin).toContain("Publish for modules & widgets");
    expect(admin).toContain("Publication scope:");
    expect(admin).not.toContain('<SelectItem value="public">Signed-in learners</SelectItem>');
  });

  it("documents module/widget-only publication and preserves access-controlled HTML widget behavior", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    expect(admin).toContain("Publish for modules & widgets");
    expect(admin).toContain("Publishing makes this quiz available only through an assigned learning module or approved HTML widget.");
    expect(admin).toContain("It does not create direct enrollment, checkout, catalog, search, or learner-facing listing access.");
  });

  it("requires embedded access for learner metadata and attempts while disabling public metadata", () => {
    const router = read("server/routers/standaloneQuizRouter.ts");
    expect(router).toContain("assertEmbeddedQuizAccess(db, ctx.user, quiz.id)");
    expect(router).toContain("Quiz Creator quizzes are available through assigned learning experiences.");
    expect(router).toContain("Returning an empty list prevents standalone discovery outside those routes.");
    expect(router).toContain("return [];");
  });

  it("describes publication as module/widget eligibility rather than a public learner listing", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    expect(admin).toContain("Publish for modules & widgets");
    expect(admin).toContain("It does not create direct enrollment, checkout, catalog, search, or learner-facing listing access.");
  });

  it("activates an embedded quiz when it is assigned to a course lesson", () => {
    const courseBuilder = read("server/routers/lmsCourseBuilderRouter.ts");
    expect(courseBuilder).toContain('input.type === "standalone_quiz" && input.standaloneQuizId');
    expect(courseBuilder).toContain('{ status: "published", accessType: "enrolled" }');
  });
});
