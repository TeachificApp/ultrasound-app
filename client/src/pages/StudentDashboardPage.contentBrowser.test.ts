import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "StudentDashboardPage.tsx"), "utf8");

describe("learner My Content browser", () => {
  it("defaults to cards and provides accessible list-mode controls", () => {
    expect(source).toContain('useState<ContentDisplayMode>("cards")');
    expect(source).toContain('aria-label="Content display mode"');
    expect(source).toContain('aria-pressed={contentDisplayMode === "cards"}');
    expect(source).toContain('aria-pressed={contentDisplayMode === "list"}');
    expect(source).toContain('onClick={() => setContentDisplayMode("list")}');
    expect(source).toContain('displayMode={contentDisplayMode}');
    expect(source).toContain('isList ? "flex-row min-h-32" : "flex-col"');
  });

  it("filters only the signed-in learner content already returned by the dashboard contract", () => {
    expect(source).toContain('trpc.dashboard.getMyContent.useQuery()');
    expect(source).toContain('function itemMatchesContentSearch');
    expect(source).toContain('aria-label="Search visible content"');
    expect(source).toContain('title="No matching content"');
    expect(source).toContain('data?.courses.filter');
    expect(source).toContain('data?.quizzes.filter');
    expect(source).toContain('data?.downloads.filter');
    expect(source).toContain('data?.communities.filter');
  });
});
