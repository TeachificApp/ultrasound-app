import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const router = readFileSync(`${root}/server/routers/quickfireRouter.ts`, "utf8");
const dailySet = readFileSync(`${root}/server/lib/quickfireDailySet.ts`, "utf8");
const page = readFileSync(`${root}/client/src/pages/DailyChallenge.tsx`, "utf8");

describe("Daily Challenge eligibility", () => {
  it("keeps quickReview flashcards out of new, recycled, and legacy daily challenge selections", () => {
    expect(dailySet).toContain("firstChallengeArchiveQuestion");
    expect(dailySet).toContain("quickfireQuestions.type} != 'quickReview'");
    expect(router).toContain("legacyFlashcardEntries");
    expect(router).toContain("Flashcards belong only to the Flashcards experience");
    expect(router).toContain("liveQuestionTypes.get(ids[0]) === \"quickReview\"");
  });

  it("reuses an app's own archived challenge questions even after scheduling marks them inactive", () => {
    const archiveResolver = dailySet.slice(
      dailySet.indexOf("async function firstChallengeArchiveQuestion"),
      dailySet.indexOf("/**\n * Ensure a daily set"),
    );
    expect(archiveResolver).not.toContain("quickfireQuestions.isActive");
    expect(dailySet).toContain("eq(quickfireChallenges.brand, brand)");
    expect(dailySet).toContain("eq(quickfireChallenges.status, \"archived\")");
  });

  it("continues to render Daily Challenge answer feedback only after a real challenge attempt", () => {
    expect(router).toContain("correctAnswer: attempted ? q.correctAnswer : null");
    expect(router).toContain("explanation: attempted ? q.explanation : null");
    expect(page).toContain("SCENARIO / IMAGE (MCQ)");
    expect(page).toContain("Explanation");
  });
});
