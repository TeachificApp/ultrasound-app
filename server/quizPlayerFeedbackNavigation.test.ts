import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("standalone quiz feedback navigation", () => {
  it("uses the feedback Next action to close feedback and move to the next question", () => {
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(player).toContain("function handleFeedbackAdvance()");
    expect(player).toContain("setFeedbackPopup(null);");
    expect(player).toContain("handleNext();");
    expect(player).toContain('advanceLabel={currentIdx < questions.length - 1 ? "Next" : "Finish quiz"}');
  });

  it("keeps the last feedback action connected to the existing submit path", () => {
    const player = read("client/src/pages/StandaloneQuizPlayer.tsx");
    expect(player).toContain("handleSubmit();");
  });
});
