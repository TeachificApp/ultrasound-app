import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authoredLessonFlashcardSourceKey,
  normalizeLessonFlashcardGroupDraws,
  parseLessonFlashcardSourceKey,
  questionBankLessonFlashcardSourceKey,
} from "./lib/lessonFlashcardGroupDraws";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("lesson flashcard Question Bank group draws", () => {
  it("keeps only valid unique group draw settings and caps an unsafe draw count", () => {
    expect(normalizeLessonFlashcardGroupDraws([
      { folderId: 8, folderName: "Echo", count: 12 },
      { folderId: 8, folderName: "Duplicate", count: 3 },
      { folderId: -1, folderName: "Invalid", count: 4 },
      { folderId: 12, count: 900 },
    ])).toEqual([
      { folderId: 8, folderName: "Echo", count: 12 },
      { folderId: 12, folderName: "Question Bank group 12", count: 200 },
    ]);
  });

  it("uses stable source keys for authored cards and dynamically drawn Question Bank cards", () => {
    expect(authoredLessonFlashcardSourceKey(3)).toBe("manual:3");
    expect(questionBankLessonFlashcardSourceKey(42)).toBe("bank:42");
    expect(parseLessonFlashcardSourceKey("manual:3")).toEqual({ kind: "manual", index: 3 });
    expect(parseLessonFlashcardSourceKey("bank:42")).toEqual({ kind: "bank", questionBankId: 42 });
    expect(parseLessonFlashcardSourceKey("42")).toBeNull();
  });

  it("loads group draws at learner runtime and verifies their result keys server-side", () => {
    const editor = source("client/src/components/LessonFlashcardBlockEditor.tsx");
    const player = source("client/src/pages/CoursePlayer.tsx");
    const router = source("server/routers/lmsRouter.ts");

    expect(editor).toContain("questionBankGroupDraws");
    expect(editor).toContain("Draw from a Question Bank group");
    expect(player).toContain("getInlineLessonFlashcardDeck.useQuery");
    expect(player).toContain("sourceKey: card.sourceKey ?? `manual:${sourceIndex}`");
    expect(router).toContain("getInlineLessonFlashcardDeck: protectedProcedure");
    expect(router).toContain("normalizeLessonFlashcardGroupDraws");
    expect(router).toContain("questionBankLessonFlashcardSourceKey");
    expect(router).toContain("cardKey: z.string().regex(/^(manual|bank):\\d+$/)");
  });
});
