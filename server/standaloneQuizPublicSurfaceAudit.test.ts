import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("standalone quiz public-surface audit", () => {
  it("keeps standalone quiz records out of public education-library catalog and search sources", () => {
    const lmsRouter = read("server/routers/lmsRouter.ts");
    const educationLibrary = read("client/src/pages/EducationLibrary.tsx");
    const lmsHome = read("client/src/pages/LMSHome.tsx");

    expect(lmsRouter).not.toContain("standaloneQuizzes");
    expect(educationLibrary).not.toContain("standaloneQuiz");
    expect(lmsHome).not.toContain("standaloneQuiz");
  });

  it("does not offer standalone quizzes through checkout, waitlist, campaign, or community discovery", () => {
    const funnelRouter = read("server/routers/funnelRouter.ts");
    const availabilityRouter = read("server/routers/contentAvailabilityRouter.ts");
    const campaignRouter = read("server/routers/emailCampaignRouter.ts");
    const communityRouter = read("server/routers/communityRouter.ts");

    expect(funnelRouter).not.toContain("standaloneQuizzes");
    expect(availabilityRouter).not.toContain('"quiz"');
    expect(availabilityRouter).not.toContain("standaloneQuizzes");
    expect(campaignRouter).not.toContain("standaloneQuizzes");
    expect(communityRouter).not.toContain("standaloneQuizList");
  });

  it("keeps learner dashboard quiz cards within their enrolled course and preserves the approved widget path", () => {
    const dashboardRouter = read("server/routers/dashboardRouter.ts");
    const studentDashboard = read("client/src/pages/StudentDashboardPage.tsx");
    const coursePlayer = read("client/src/pages/CoursePlayer.tsx");
    const quizPlayer = read("client/src/pages/StandaloneQuizPlayer.tsx");
    const learnerRouter = read("server/routers/standaloneQuizRouter.ts");

    expect(dashboardRouter).toContain("courseSlug");
    expect(studentDashboard).toContain('contentKind === "standalone_quiz"');
    expect(studentDashboard).toContain("/courses/${q.courseSlug}/player?lesson=${(q as any).lessonId}");
    expect(coursePlayer).toContain("EmbeddedQuizPlayer");
    expect(quizPlayer).toContain("widgetToken");
    expect(learnerRouter).toContain("return [];");
  });
});
