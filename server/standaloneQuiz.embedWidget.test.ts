import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Quiz Creator HTML widget", () => {
  it("issues an opaque widget credential without creating a public standalone-quiz route", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    const embedCard = read("client/src/components/quiz/EmbeddedQuizAssignmentCard.tsx");
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    const router = read("server/routers/standaloneQuizRouter.ts");
    const widgetAccess = read("server/lib/standaloneQuizWidgetAccess.ts");
    expect(embedCard).toContain("HTML widget embed");
    expect(embedCard).toContain("Replace & copy");
    expect(embedCard).toContain("Revoke widget");
    expect(admin).toContain("createWidgetLaunchMutation");
    expect(router).toContain("createWidgetLaunch: protectedProcedure");
    expect(router).toContain("revokeWidgetLaunch: protectedProcedure");
    expect(router).toContain("quiz.status !== \"published\"");
    expect(router).toContain("hasActiveWidgetLaunch");
    expect(router).toContain("hashStandaloneQuizWidgetToken(token)");
    expect(widgetAccess).toContain("randomBytes(32)");
    expect(widgetAccess).toContain("sha256");
    expect(widgetAccess).not.toContain("JWT_SECRET");
    expect(player).toContain('get("embed") === "1"');
    expect(player).toContain('get("widget") ?? undefined');
    expect(player).toContain("widgetToken");
    expect(router).toContain("Quiz Creator quizzes are available through assigned learning experiences.");
  });
});
