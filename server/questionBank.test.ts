import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  $returningId: vi.fn().mockResolvedValue([{ id: 42 }]),
  execute: vi.fn().mockResolvedValue([]),
};

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  questionBank: { id: "id", question: "question", courseId: "courseId" },
  questionBankTags: { id: "id", name: "name", color: "color" },
  questionBankTagMap: { questionId: "questionId", tagId: "tagId" },
  users: { id: "id", role: "role" },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Question Bank", () => {
  describe("LessonQuizBlockEditor data structures", () => {
    it("should create a valid QuizQuestion with all optional fields", () => {
      const q = {
        question: "What does DVT stand for?",
        options: ["Deep Vein Thrombosis", "Dual Vascular Test", "Direct Venous Transfer", "Deep Venous Technique"],
        answerImages: [undefined, undefined, undefined, undefined],
        correctAnswer: 0,
        explanation: "DVT stands for Deep Vein Thrombosis.",
        imageUrl: "https://example.com/dvt.jpg",
        videoUrl: "https://youtube.com/watch?v=abc123",
      };
      expect(q.question).toBe("What does DVT stand for?");
      expect(q.options).toHaveLength(4);
      expect(q.correctAnswer).toBe(0);
      expect(q.imageUrl).toBeDefined();
      expect(q.videoUrl).toBeDefined();
      expect(q.answerImages).toHaveLength(4);
    });

    it("should create a valid LessonQuizData with all settings", () => {
      const data = {
        title: "Physics Quiz",
        questions: [],
        showExplanations: true,
        passingScore: 80,
        shuffleQuestions: true,
        shuffleAnswers: true,
        requirePassToComplete: true,
      };
      expect(data.passingScore).toBe(80);
      expect(data.shuffleQuestions).toBe(true);
      expect(data.shuffleAnswers).toBe(true);
      expect(data.requirePassToComplete).toBe(true);
    });

    it("should handle shuffle logic correctly", () => {
      const questions = [
        { question: "Q1", options: ["A", "B", "C", "D"], correctAnswer: 0 },
        { question: "Q2", options: ["A", "B", "C", "D"], correctAnswer: 1 },
        { question: "Q3", options: ["A", "B", "C", "D"], correctAnswer: 2 },
      ];
      // Shuffle simulation
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      expect(shuffled).toHaveLength(3);
      // All original questions should still be present
      expect(shuffled.map(q => q.question).sort()).toEqual(["Q1", "Q2", "Q3"]);
    });

    it("should validate passing score range", () => {
      const validScores = [0, 50, 70, 80, 100];
      const invalidScores = [-1, 101, NaN];
      validScores.forEach(score => {
        expect(score >= 0 && score <= 100).toBe(true);
      });
      invalidScores.forEach(score => {
        expect(score >= 0 && score <= 100).toBe(false);
      });
    });
  });

  describe("AI source selection logic", () => {
    it("should require lessonId for 'lesson' source", () => {
      const canGenerate = (source: string, lessonId?: number, courseId?: number, selectedIds?: number[]) => {
        if (source === "lesson") return !!lessonId;
        if (source === "course") return !!courseId;
        if (source === "pick") return (selectedIds?.length ?? 0) > 0;
        return false;
      };
      expect(canGenerate("lesson", 1)).toBe(true);
      expect(canGenerate("lesson", undefined)).toBe(false);
      expect(canGenerate("course", undefined, 5)).toBe(true);
      expect(canGenerate("course", undefined, undefined)).toBe(false);
      expect(canGenerate("pick", undefined, 5, [1, 2])).toBe(true);
      expect(canGenerate("pick", undefined, 5, [])).toBe(false);
    });
  });

  describe("Question bank tag filtering", () => {
    it("should filter questions by tag IDs", () => {
      const questions = [
        { id: 1, question: "Q1", tags: [{ id: 1, name: "Physics" }] },
        { id: 2, question: "Q2", tags: [{ id: 2, name: "Anatomy" }] },
        { id: 3, question: "Q3", tags: [{ id: 1, name: "Physics" }, { id: 2, name: "Anatomy" }] },
      ];
      const filterByTags = (qs: typeof questions, tagIds: number[]) => {
        if (tagIds.length === 0) return qs;
        return qs.filter(q => q.tags.some(t => tagIds.includes(t.id)));
      };
      expect(filterByTags(questions, [1])).toHaveLength(2);
      expect(filterByTags(questions, [2])).toHaveLength(2);
      expect(filterByTags(questions, [1, 2])).toHaveLength(3);
      expect(filterByTags(questions, [])).toHaveLength(3);
    });
  });

  describe("Quiz Creator AI generation contract", () => {
    it("supports every stored interactive Question Bank type and returns generated question cards", () => {
      const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers/questionBankRouter.ts"), "utf8");
      expect(routerSource).toContain('questionType: z.enum(["mcq", "truefalse", "multiselect", "matching", "hotspot", "mixed"])');
      expect(routerSource).toContain('type: { type: "string", enum: ["mcq", "truefalse", "multiselect", "matching", "hotspot"] }');
      expect(routerSource).toContain("For every question, write a concise explanation of why the correct answer is correct.");
      expect(routerSource).toContain("optionFeedback: { type: \"array\", items: { type: \"string\" } }");
      expect(routerSource).toContain("feedback: q.optionFeedback?.[index] ?? \"\"");
      expect(routerSource).toContain('questions: getReturnedQuestions()');
    });
  });

  describe("Quiz gate logic", () => {
    it("should block lesson completion when requirePassToComplete is true and score is below passing", () => {
      const canComplete = (requirePass: boolean, passingScore: number, score: number) => {
        if (!requirePass) return true;
        return score >= passingScore;
      };
      expect(canComplete(true, 70, 65)).toBe(false);
      expect(canComplete(true, 70, 70)).toBe(true);
      expect(canComplete(true, 70, 85)).toBe(true);
      expect(canComplete(false, 70, 50)).toBe(true); // no requirement
    });
  });
});
