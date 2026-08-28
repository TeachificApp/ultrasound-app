import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("standalone mock-exam review controls", () => {
  it("restores feedback when returning to a revealed builder question", () => {
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(player).toContain("setFeedbackPopup(getFeedbackMessage(currentQuestion, priorAnswer));");
    expect(player).toContain("revealed[currentQuestion.questionBankId]");
  });

  it("offers mock-exam flags, a review list, direct navigation, and separate scoring submission", () => {
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(player).toContain("toggleQuestionFlag");
    expect(player).toContain("Review mock exam");
    expect(player).toContain("Flagged questions");
    expect(player).toContain("Unanswered questions");
    expect(player).toContain("goToReviewQuestion(index)");
    expect(player).toContain("Submit for scoring");
  });
});
