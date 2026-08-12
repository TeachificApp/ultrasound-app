import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("Visual Builder media reuse interaction", () => {
  it("updates the active question image when an administrator uses a Media Repository URL", async () => {
    const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url: "http://localhost" });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("navigator", dom.window.navigator);
    vi.stubGlobal("localStorage", dom.window.localStorage);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    dom.window.prompt = vi.fn(() => " https://media.example/question.png ");
    cleanup = () => { vi.unstubAllGlobals(); dom.window.close(); };

    const { QuestionEditor } = await import("../client/src/quiz-creator/components/QuestionEditor");
    const { useQuizStore } = await import("../client/src/quiz-creator/store/quizStore");
    useQuizStore.setState({
      quiz: {
        meta: { title: "Media test", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        questions: [{
          id: "media-question",
          type: "mcq",
          order: 1,
          points: 1,
          required: true,
          stem: "Question with reusable media",
          image: null,
          explanation: "",
          data: { choices: [{ id: "a", text: "A", correct: true }], multiSelect: false },
        }],
      } as any,
      activeQuestionId: "media-question",
      activeSlide: null,
      isDirty: false,
    });

    const container = dom.window.document.getElementById("app")!;
    const root = createRoot(container);
    await act(async () => { root.render(createElement(QuestionEditor)); });
    const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Use image URL");
    expect(button).toBeTruthy();
    await act(async () => { button!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });

    expect(useQuizStore.getState().quiz.questions[0].image?.url).toBe("https://media.example/question.png");
    await act(async () => { root.unmount(); });
  });
});
