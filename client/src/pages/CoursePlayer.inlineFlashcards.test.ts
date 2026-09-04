import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "CoursePlayer.tsx"), "utf8");

describe("embedded flashcard outcomes", () => {
  it("records only a fully marked deck through the protected learner mutation and keeps admin previews out of learner history", () => {
    expect(source).toContain("submitInlineLessonFlashcards");
    expect(source).toContain("Object.keys(nextOutcomes).length === deck.length");
    expect(source).toContain("!isAdminPreview");
    expect(source).toContain('gotIt: Boolean(nextOutcomes[cardIndex])');
  });
});
