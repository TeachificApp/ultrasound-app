import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));
vi.mock("./db", async () => {
  const actual = await vi.importActual<any>("./db");
  return { ...actual, getDb: mocks.getDb };
});

import { lmsEnrollmentAdminRouter } from "./routers/lmsEnrollmentAdminRouter";
import { questionBankRouter } from "./routers/questionBankRouter";

const adminContext = { user: { id: 17, role: "admin" } } as any;
const sourceFile = { url: "https://files.example/source.pdf", mimeType: "application/pdf" as const, name: "source.pdf" };

function createInsertDb() {
  const writes: any[] = [];
  let id = 1;
  return {
    writes,
    insert: (table: unknown) => ({ values: (values: any) => { writes.push({ table, values }); return { $returningId: async () => [{ id: id++ }] }; } }),
  };
}

describe("source-file generation routers", () => {
  it("passes an uploaded PDF to lmsAdmin.aiGenerateCourse and commits its final course assessment", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ title: "Source Course", subtitle: "From PDF", sections: [], courseQuiz: { title: "Final", questions: [{ question: "Q", options: ["A", "B", "C", "D"], correctAnswer: "B", explanation: "Because B" }] } }) } }] });
    const generateCaller = lmsEnrollmentAdminRouter.createCaller(adminContext);
    const generated = await generateCaller.aiGenerateCourse({ topics: "Uploaded source", productType: "course", moduleCount: 3, lessonsPerModule: 3, sourceFiles: [sourceFile, { ...sourceFile, url: "https://files.example/second.png", mimeType: "image/png", name: "second.png" }], generateCourseQuiz: true });
    expect(generated.generated.courseQuiz.title).toBe("Final");
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3-flash-preview" }));
    expect((mocks.invokeLLM.mock.calls[0][0].messages[1].content as any)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file_url" }), expect.objectContaining({ type: "image_url" })]));

    const db = createInsertDb();
    mocks.getDb.mockResolvedValueOnce(db);
    const commitCaller = lmsEnrollmentAdminRouter.createCaller(adminContext);
    await commitCaller.aiCommitCourse({ courseId: 99, productType: "course", generated: generated.generated });
    expect(db.writes.map(write => write.values.title)).toEqual(expect.arrayContaining(["Course Assessment", "Final"]));
    expect(db.writes.find(write => write.values.question === "Q")?.values).toMatchObject({ correctAnswer: "B", explanation: "Because B" });
  });

  it("passes an uploaded source to Question Bank generation and persists explanation and every option feedback", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ questions: [{ question: "Source question", type: "mcq", options: ["A", "B", "C", "D"], correctAnswer: "B", correctAnswers: [], optionFeedback: ["A no", "B yes", "C no", "D no"], matchingPairs: [], explanation: "B is correct" }] }) } }] });
    const db = createInsertDb();
    mocks.getDb.mockResolvedValueOnce(db);
    const caller = questionBankRouter.createCaller(adminContext);
    const result = await caller.aiGenerateToBank({ topic: "Source image", count: 1, sourceFiles: [{ ...sourceFile, mimeType: "image/png", url: "https://files.example/source.png", name: "source.png" }, { ...sourceFile, url: "https://files.example/reference.pdf", name: "reference.pdf" }] });
    expect(result.inserted).toBe(1);
    expect(mocks.invokeLLM).toHaveBeenLastCalledWith(expect.objectContaining({ model: "gemini-3-flash-preview" }));
    expect((mocks.invokeLLM.mock.calls.at(-1)![0].messages[1].content as any)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image_url" }), expect.objectContaining({ type: "file_url" })]));
    const values = db.writes[0].values;
    expect(values.explanation).toBe("B is correct");
    expect(JSON.parse(values.options)).toEqual(expect.arrayContaining([{ text: "A", feedback: "A no" }, { text: "B", feedback: "B yes" }]));
  });

  it("creates a 350-question source set in seven 50-question batches that can be added to the active quiz", async () => {
    const batchQuestions = Array.from({ length: 50 }, (_, index) => ({ question: `Large-set question ${index + 1}`, type: "mcq", options: ["A", "B", "C", "D"], correctAnswer: "B", correctAnswers: [], optionFeedback: ["A no", "B yes", "C no", "D no"], matchingPairs: [], explanation: "B is correct" }));
    mocks.invokeLLM.mockClear();
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ questions: batchQuestions }) } }] });
    const db = createInsertDb();
    mocks.getDb.mockResolvedValueOnce(db);
    const caller = questionBankRouter.createCaller(adminContext);
    const result = await caller.aiGenerateToBank({ topic: "Large source set", count: 350, sourceFiles: [sourceFile] });
    expect(result.inserted).toBe(350);
    expect(result.ids).toHaveLength(350);
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(7);
    expect(mocks.invokeLLM.mock.calls.every(([call]) => call.messages[1].content[0].text.includes("Generate 50 unique questions"))).toBe(true);
    expect(db.writes).toHaveLength(350);
  });
});
