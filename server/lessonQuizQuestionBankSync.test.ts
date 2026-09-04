import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lmsCourses, lmsLessons, lmsQuizQuestions, lmsQuizzes, questionBank, questionBankFolders } from "../drizzle/schema";
import { syncLegacyLessonQuizQuestionToBank, syncLessonFlashcardBlocksToQuestionBank, syncLessonQuizBlocksToQuestionBank } from "./lib/lessonQuizQuestionBankSync";

const root = process.cwd();
const helperSource = readFileSync(resolve(root, "server/lib/lessonQuizQuestionBankSync.ts"), "utf8");
const courseBuilderSource = readFileSync(resolve(root, "server/routers/lmsCourseBuilderRouter.ts"), "utf8");

function createSyncDb(mode: "page" | "legacy") {
  const state = { folders: [] as any[], questions: [] as any[], folderSelects: 0, nextId: 1 };
  const pageQuestion = { id: 1, quizId: 31, question: "Legacy question", type: "mcq", options: JSON.stringify(["A", "B"]), correctAnswer: "A" };
  const selectRows = (table: any) => {
    if (table === lmsLessons) return [{ courseId: 101 }];
    if (table === lmsCourses) return [{ title: "Course Alpha" }];
    if (table === lmsQuizzes) return [{ lessonId: 22 }];
    if (table === lmsQuizQuestions) return [pageQuestion];
    if (table === questionBankFolders) {
      const root = state.folders.find(f => f.parentId == null);
      const child = state.folders.find(f => f.parentId != null);
      const result = state.folderSelects++ % 2 === 0 ? root : child;
      return result ? [{ id: result.id }] : [];
    }
    if (table === questionBank) return state.questions.length ? [{ id: state.questions[0].id }] : [];
    return [];
  };
  const db: any = {
    select: () => ({ from: (table: any) => ({ where: () => ({ limit: async () => selectRows(table) }) }) }),
    insert: (table: any) => ({ values: (values: any) => {
      if (table === questionBankFolders) {
        const record = { ...values, id: state.nextId++ };
        state.folders.push(record);
        return { $returningId: async () => [{ id: record.id }] };
      }
      if (table === questionBank) state.questions.push({ ...values, id: state.nextId++ });
      return { $returningId: async () => [{ id: state.nextId - 1 }] };
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => {
      if (table === questionBank && state.questions[0]) Object.assign(state.questions[0], values);
    } }) }),
  };
  return { db, state, mode };
}

describe("lesson quiz Question Bank synchronization", () => {
  it("uses a Lesson Quiz parent and a per-course child folder", () => {
    expect(helperSource).toContain('name: "Lesson Quiz"');
    expect(helperSource).toContain("parentId: parent.id");
    expect(helperSource).toContain("folderId");
  });

  it("uses lesson, block, and question-index source keys so repeated saves update instead of duplicate", () => {
    expect(helperSource).toContain("sourceLessonId: lessonId");
    expect(helperSource).toContain("sourceBlockId");
    expect(helperSource).toContain("sourceQuestionIndex: index");
    expect(helperSource).toContain("db.update(questionBank).set(values)");
  });

  it("runs synchronization whenever an administrator saves lesson content blocks", () => {
    expect(courseBuilderSource).toContain("syncLessonQuizBlocksToQuestionBank");
    expect(courseBuilderSource).toContain("syncLessonFlashcardBlocksToQuestionBank");
    expect(courseBuilderSource).toContain("if (input.contentBlocks !== undefined)");
  });

  it("also synchronizes legacy lesson quiz question create and update operations", () => {
    const legacyQuizRouterSource = readFileSync(resolve(root, "server/routers/lmsQuizLandingRouter.ts"), "utf8");
    expect(helperSource).toContain("syncLegacyLessonQuizQuestionToBank");
    expect(legacyQuizRouterSource).toContain("await syncLegacyLessonQuizQuestionToBank(db, result.id, ctx.user.id)");
    expect(legacyQuizRouterSource).toContain("await syncLegacyLessonQuizQuestionToBank(db, id, ctx.user.id)");
  });

  it("creates then updates page-builder quiz questions in Lesson Quiz → course folders", async () => {
    const { db, state } = createSyncDb("page");
    const blocks = JSON.stringify([{ id: "quiz-block", type: "lesson_quiz", data: { questions: [{ question: "What is Doppler?", type: "mcq", options: ["A method", "A drug"], correctAnswer: 0 }] } }]);
    expect(await syncLessonQuizBlocksToQuestionBank(db, 22, blocks, 7)).toEqual({ created: 1, updated: 0 });
    expect(state.folders.map(f => f.name)).toEqual(["Lesson Quiz", "Course Alpha"]);
    expect(state.questions[0]).toMatchObject({ question: "What is Doppler?", sourceLessonId: 22, sourceBlockId: "quiz-block", sourceQuestionIndex: 0 });

    const changed = JSON.stringify([{ id: "quiz-block", type: "lesson_quiz", data: { questions: [{ question: "What is spectral Doppler?", type: "mcq", options: ["A method", "A drug"], correctAnswer: 0 }] } }]);
    expect(await syncLessonQuizBlocksToQuestionBank(db, 22, changed, 7)).toEqual({ created: 0, updated: 1 });
    expect(state.questions).toHaveLength(1);
    expect(state.questions[0].question).toBe("What is spectral Doppler?");
  });

  it("creates legacy lesson quiz questions in the same course folder structure", async () => {
    const { db, state } = createSyncDb("legacy");
    expect(await syncLegacyLessonQuizQuestionToBank(db, 1, 7)).toEqual({ created: 1, updated: 0 });
    expect(state.folders.map(f => f.name)).toEqual(["Lesson Quiz", "Course Alpha"]);
    expect(state.questions[0]).toMatchObject({ sourceQuizQuestionId: 1, sourceQuizId: 31 });
  });

  it("creates then updates lesson flashcards in a separate per-course folder without duplicating cards", async () => {
    const { db, state } = createSyncDb("page");
    const blocks = JSON.stringify([{ id: "deck-block", type: "lesson_flashcard", data: { cards: [{ front: "What is Doppler?", back: "Frequency shift", hint: "Velocity" }] } }]);
    expect(await syncLessonFlashcardBlocksToQuestionBank(db, 22, blocks, 7)).toEqual({ created: 1, updated: 0 });
    expect(state.folders.map(f => f.name)).toEqual(["Lesson Flashcards", "Course Alpha"]);
    expect(state.questions[0]).toMatchObject({ type: "flashcard", flashcardFront: "What is Doppler?", flashcardBack: "Frequency shift", sourceLessonId: 22, sourceBlockId: "deck-block", sourceQuestionIndex: 0 });

    const changed = JSON.stringify([{ id: "deck-block", type: "lesson_flashcard", data: { cards: [{ front: "What is spectral Doppler?", back: "Frequency shift", hint: "Velocity" }] } }]);
    expect(await syncLessonFlashcardBlocksToQuestionBank(db, 22, changed, 7)).toEqual({ created: 0, updated: 1 });
    expect(state.questions).toHaveLength(1);
    expect(state.questions[0].flashcardFront).toBe("What is spectral Doppler?");
  });

  it("does not create a Flashcards Question Bank folder when the lesson has no flashcard block", async () => {
    const { db, state } = createSyncDb("page");
    expect(await syncLessonFlashcardBlocksToQuestionBank(db, 22, JSON.stringify([{ id: "text", type: "text", data: {} }]), 7)).toEqual({ created: 0, updated: 0 });
    expect(state.folders).toEqual([]);
  });
});
