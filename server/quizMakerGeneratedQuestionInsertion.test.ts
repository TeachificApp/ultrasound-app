import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", async () => {
  const actual = await vi.importActual<any>("./db");
  return { ...actual, getDb: mocks.getDb };
});
vi.mock("./lib/quizBuilderConfig", async () => {
  const actual = await vi.importActual<any>("./lib/quizBuilderConfig");
  return { ...actual, builderConfigFromQuizRow: () => ({ meta: { id: "quiz-7", title: "Source Quiz" }, questions: [] }), serializeBuilderConfig: (config: any) => JSON.stringify(config) };
});

import { quizMakerRouter } from "./routers/quizMakerRouter";

function queryResult(value: any) {
  const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain, limit: async () => value, orderBy: async () => value, then: (resolve: any) => resolve(value) };
  return chain;
}

describe("Quiz Maker generated question insertion", () => {
  it("attaches selected generated question-bank items to the current quiz with their type, explanation, and option feedback", async () => {
    const linked = [
      { sqq: { questionBankId: 1001, sortOrder: 0, points: 1, shuffleAnswerOptions: false, lockAnswerOrder: false }, qb: { id: 1001, question: "Generated MCQ", type: "mcq", options: JSON.stringify([{ text: "A", feedback: "A is incorrect" }, { text: "B", feedback: "B is correct" }]), correctAnswer: "B", correctAnswers: null, matchingPairs: null, hotspotMarkers: null, explanation: "B is correct because of the source.", questionImageUrl: null, questionVideoUrl: null, feedbackImageUrl: null, feedbackVideoUrl: null } },
      { sqq: { questionBankId: 1002, sortOrder: 1, points: 1, shuffleAnswerOptions: false, lockAnswerOrder: false }, qb: { id: 1002, question: "Generated multi-select", type: "multiselect", options: JSON.stringify([{ text: "A", feedback: "A is correct" }, { text: "B", feedback: "B is correct" }, { text: "C", feedback: "C is incorrect" }]), correctAnswer: null, correctAnswers: JSON.stringify([0, 1]), matchingPairs: null, hotspotMarkers: null, explanation: "A and B are correct because of the source.", questionImageUrl: null, questionVideoUrl: null, feedbackImageUrl: null, feedbackVideoUrl: null } },
    ];
    const selectResults = [[{ id: 7, builderConfig: null }], [], [{ maxOrder: -1 }], linked];
    const inserted: any[] = [];
    let updatedConfig: any;
    const db: any = {
      select: () => queryResult(selectResults.shift()),
      insert: () => ({ values: async (values: any) => { inserted.push(values); } }),
      update: () => ({ set: (values: any) => ({ where: async () => { updatedConfig = JSON.parse(values.builderConfig); } }) }),
    };
    mocks.getDb.mockResolvedValueOnce(db);
    const caller = quizMakerRouter.createCaller({ user: { id: 17, role: "admin" } } as any);
    await expect(caller.addQuestionBankQuestions({ quizId: 7, questionBankIds: [1001, 1002] })).resolves.toEqual({ added: 2 });
    expect(inserted).toEqual([[expect.objectContaining({ quizId: 7, questionBankId: 1001 }), expect.objectContaining({ quizId: 7, questionBankId: 1002 })]]);
    expect(updatedConfig.questions).toEqual(expect.arrayContaining([
      expect.objectContaining({ stem: "Generated MCQ", type: "mcq", explanation: "B is correct because of the source.", data: expect.objectContaining({ choices: expect.arrayContaining([expect.objectContaining({ text: "A", feedback: "A is incorrect" }), expect.objectContaining({ text: "B", feedback: "B is correct", correct: true })]) }) }),
      expect.objectContaining({ stem: "Generated multi-select", type: "mcq", explanation: "A and B are correct because of the source.", data: expect.objectContaining({ multiple: true, choices: expect.arrayContaining([expect.objectContaining({ text: "A", feedback: "A is correct", correct: true }), expect.objectContaining({ text: "B", feedback: "B is correct", correct: true }), expect.objectContaining({ text: "C", feedback: "C is incorrect", correct: false })]) }) }),
    ]));
  });
});
