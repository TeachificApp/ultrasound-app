import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("My Content quiz library and standalone results", () => {
  it("keeps LMS courses flagged as quizzes in the learner quiz library", () => {
    const dashboard = read("server/routers/dashboardRouter.ts");
    expect(dashboard).toContain('const quizzes = enrichedEnrollments.filter(e => e.courseType === "quiz");');
    expect(dashboard).toContain("quizzes: [...quizzes, ...standaloneQuizLibrary.values(), ...membershipQuizzes, ...bundleQuizzes]");
  });

  it("adds only enrolled-course standalone quiz assignments and completed standalone quiz records", () => {
    const dashboard = read("server/routers/dashboardRouter.ts");
    expect(dashboard).toContain('eq(lmsLessons.type, "standalone_quiz")');
    expect(dashboard).toContain("inArray(lmsLessons.courseId, activeCourseIds)");
    expect(dashboard).toContain("inArray(lmsSections.courseId, activeCourseIds)");
    expect(dashboard).toContain("eq(standaloneQuizAttempts.userId, ctx.user.id)");
    expect(dashboard).toContain('contentKind: "standalone_result" as const');
  });

  it("returns learner-only completed standalone quiz rows for the in-content results tab", () => {
    const router = read("server/routers/standaloneQuizRouter.ts");
    expect(router).toContain("getMyAttempts: protectedProcedure");
    expect(router).toContain("eq(standaloneQuizAttempts.userId, ctx.user.id)");
    expect(router).toContain("isNotNull(standaloneQuizAttempts.completedAt)");
    expect(router).toContain("if (input?.quizType) conditions.push(eq(standaloneQuizzes.type, input.quizType));");
  });

  it("uses the established standalone quiz attempt query for My Quiz Results and leaves lesson modules outside it", () => {
    const results = read("client/src/pages/StudentQuizDashboard.tsx");
    expect(results).toContain('trpc.standaloneQuizLearner.getMyAttempts.useQuery');
    expect(results).toContain('{ quizType: "quiz" }');
    expect(results).toContain("summary?.hasStandaloneSystemQuizAttempts");
    expect(results).toContain("standaloneOnly ? (nativeHistory ?? [])");
    expect(results).not.toContain("getMyStandaloneQuizResults");
  });

  it("uses dashboard-safe image assets for both brand membership cards", () => {
    const dashboard = read("server/routers/dashboardRouter.ts");
    const page = read("client/src/pages/StudentDashboardPage.tsx");
    expect(dashboard).toContain('aaus: "https://pub-1f4b81c70d1f49cb8817cc2abbb92288.r2.dev/dashboard-brand-covers/ultrasoundassist-premium.webp"');
    expect(dashboard).toContain('iheartecho: "https://pub-1f4b81c70d1f49cb8817cc2abbb92288.r2.dev/dashboard-brand-covers/echoassist-premium.webp"');
    expect(page).toContain("onError={(event) => {");
    expect(page).toContain('event.currentTarget.style.display = "none"');
  });
});
