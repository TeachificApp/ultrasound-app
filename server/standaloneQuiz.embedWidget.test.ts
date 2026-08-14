import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Quiz Creator HTML widget", () => {
  it("provides a copyable compact iframe mode that retains sign-in and embedded access checks", () => {
    const admin = read("client/src/pages/admin/QuizCreatorAdmin.tsx");
    const embedCard = read("client/src/components/quiz/EmbeddedQuizAssignmentCard.tsx");
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(admin).toContain("?embed=1");
    expect(embedCard).toContain("HTML widget embed");
    expect(embedCard).toContain("Copy widget");
    expect(player).toContain('get("embed") === "1"');
    expect(player).toContain('getLoginUrl(`/quizzes/${qId}${isEmbedWidget ? "?embed=1" : ""}`)');
  });
});
