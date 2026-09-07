import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SCORM Question Bank save contract", () => {
  it("persists the parsed native question type and does not coerce SCORM questions to flashcards", () => {
    const source = readFileSync("server/routers/questionBankRouter.ts", "utf8");
    const confirmSection = source.slice(source.indexOf("confirmScormImport:"), source.indexOf("// ─── Folder CRUD"));

    expect(confirmSection).toContain("type: q.type");
    expect(confirmSection).not.toContain('type: "flashcard"');
  });
});
