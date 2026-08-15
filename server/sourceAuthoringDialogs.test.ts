// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

const mocks = vi.hoisted(() => ({ courseGenerate: vi.fn(), questionGenerate: vi.fn() }));
const query = { data: [], isLoading: false };
const mutation = (mutate: any = vi.fn()) => ({ mutate, mutateAsync: vi.fn(), isPending: false });
vi.mock("@/lib/trpc", () => ({
  trpc: {
    lmsAdmin: { createCourse: { useMutation: () => mutation() }, aiGenerateCourse: { useMutation: () => mutation(mocks.courseGenerate) }, aiCommitCourse: { useMutation: () => mutation() } },
    questionBank: {
      listQuestions: { useQuery: () => ({ data: { questions: [], total: 0 }, isLoading: false }) }, listFolders: { useQuery: () => query }, listTags: { useQuery: () => query }, listMediaLibraryQuizFiles: { useQuery: () => query },
      aiGenerateToBank: { useMutation: () => mutation(mocks.questionGenerate) }, confirmScormImport: { useMutation: () => mutation() }, importCsvToBank: { useMutation: () => mutation() },
    },
    quizMaker: { getQuiz: { useQuery: () => ({ data: null, isLoading: false }) }, addQuestionBankQuestions: { useMutation: () => mutation() } },
    standaloneQuizAdmin: { addQuestions: { useMutation: () => mutation() } },
  },
}));
vi.mock("@/components/BlockPreview", () => ({ BlockPreview: () => null }));
vi.mock("@/pages/admin/OrderBumpsAdmin", () => ({ OrderBumpsAdmin: () => null }));

import { CreateCourseDialog } from "../client/src/pages/admin/LMSAdmin";
import { AddQuestionsDialog } from "../client/src/pages/admin/QuizCreatorAdmin";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sourceResponse = (name: string, mimeType: string) => ({ ok: true, json: async () => ({ sourceFile: { url: `https://files.example/${name}`, mimeType, name } }) });

describe("source authoring dialogs", () => {
  let host: HTMLDivElement;
  let root: Root;
  const originalFetch = globalThis.fetch;

  const mount = async (component: React.ReactElement) => {
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(component));
  };
  const upload = async (files: File[]) => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: files });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  };
  afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); globalThis.fetch = originalFetch; vi.clearAllMocks(); });

  it("submits the Course Builder's remaining reviewed sources as a sourceFiles array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(sourceResponse("one.pdf", "application/pdf")).mockResolvedValueOnce(sourceResponse("two.png", "image/png")) as any;
    await mount(createElement(CreateCourseDialog, { open: true, onClose: vi.fn(), onCreated: vi.fn() }));
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("AI Generate"))?.click());
    await upload([new File(["one"], "one.pdf", { type: "application/pdf" }), new File(["two"], "two.png", { type: "image/png" })]);
    await act(async () => (document.querySelector('[aria-label="Remove one.pdf"]') as HTMLButtonElement).click());
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Generate Preview"))?.click());
    expect(mocks.courseGenerate).toHaveBeenCalledWith(expect.objectContaining({ sourceFiles: [{ url: "https://files.example/two.png", mimeType: "image/png", name: "two.png" }] }));
  });

  it("submits the Quiz Creator's remaining reviewed sources as a sourceFiles array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(sourceResponse("one.pdf", "application/pdf")).mockResolvedValueOnce(sourceResponse("two.png", "image/png")) as any;
    await mount(createElement(AddQuestionsDialog, { open: true, onClose: vi.fn(), quizId: 5, existingQuestionIds: [], onAdded: vi.fn(), initialTab: "ai" }));
    await upload([new File(["one"], "one.pdf", { type: "application/pdf" }), new File(["two"], "two.png", { type: "image/png" })]);
    await act(async () => (document.querySelector('[aria-label="Remove two.png"]') as HTMLButtonElement).click());
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Generate Questions"))?.click());
    expect(mocks.questionGenerate).toHaveBeenCalledWith(expect.objectContaining({ sourceFiles: [{ url: "https://files.example/one.pdf", mimeType: "application/pdf", name: "one.pdf" }] }));
  });
});
