import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "StudentDashboardPage.tsx"), "utf8");
const layoutSource = readFileSync(resolve(import.meta.dirname, "../components/LMSLayout.tsx"), "utf8");

describe("My Content quiz-results navigation", () => {
  it("keeps Quizzes in My Content and renders My Quiz Results only for completed standalone-system quiz attempts", () => {
    expect(source).toContain('key: "quizzes",      label: "Quizzes"');
    expect(source).toContain("hasStandaloneSystemQuizAttempts");
    expect(source).toContain("<StudentQuizResultsPanel standaloneOnly />");
    expect(source).toContain('My Quiz Results');
  });

  it("does not expose Quizzes or My Quiz Results in the shared top/profile layout", () => {
    expect(layoutSource).toContain("removeQuizNavigationItems(managedHeaderNavItems)");
    expect(layoutSource).toContain("removeQuizNavigationItems(managedProfileNavItems)");
    expect(layoutSource).not.toContain("ensureAllUserQuizzesNavigation");
    expect(layoutSource).not.toContain("showQuizResultsLink");
  });
});
