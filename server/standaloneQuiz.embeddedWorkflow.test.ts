import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("embedded-only Quiz Creator workflow", () => {
  it("lists assigned learning experiences instead of standalone status and public access controls", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    expect(admin).toContain("Assigned learning experiences");
    expect(admin).toContain("Manage assignments");
    expect(admin).toContain("assignments = data.assignments ?? []");
    expect(admin).toContain("Open course");
    expect(admin).toContain("Standalone Quiz / Mock Exam");
    expect(admin).not.toContain('<SelectItem value="public">Signed-in learners</SelectItem>');
  });

  it("documents current course delivery and preserves access-controlled HTML widget behavior", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    expect(admin).toContain("Course lessons are the current learner-delivery assignment context");
    expect(admin).toContain("SonoQuiz can use this content as a question source");
    expect(admin).toContain("Learners must sign in and have access through an assigned learning experience.");
  });

  it("requires embedded access for learner metadata and attempts while disabling public metadata", () => {
    const router = read("server/routers/standaloneQuizRouter.ts");
    expect(router).toContain("assertEmbeddedQuizAccess(db, ctx.user, quiz.id)");
    expect(router).toContain("Quiz Creator quizzes are available through assigned learning experiences.");
  });

  it("activates an embedded quiz when it is assigned to a course lesson", () => {
    const courseBuilder = read("server/routers/lmsCourseBuilderRouter.ts");
    expect(courseBuilder).toContain('input.type === "standalone_quiz" && input.standaloneQuizId');
    expect(courseBuilder).toContain('{ status: "published", accessType: "enrolled" }');
  });
});
