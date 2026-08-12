import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("lesson quiz media reuse interaction", () => {
  it("saves a pasted Media Repository URL into the lesson question image field", async () => {
    const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url: "http://localhost" });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("navigator", dom.window.navigator);
    vi.stubGlobal("localStorage", dom.window.localStorage);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    dom.window.prompt = vi.fn(() => " https://media.example/lesson-question.png ");
    cleanup = () => { vi.unstubAllGlobals(); dom.window.close(); };

    const { LessonQuizQuestionEditor } = await import("../client/src/components/LessonQuizBlockEditor");
    const onSave = vi.fn();
    const container = dom.window.document.getElementById("app")!;
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(LessonQuizQuestionEditor, {
        question: { type: "mcq", question: "Lesson question", options: ["A", "B"], correctAnswer: 0 },
        index: 0,
        isNew: false,
        handleFileUpload: async () => null,
        onSave,
        onCancel: vi.fn(),
      }));
    });
    const reuseButton = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Use URL");
    expect(reuseButton).toBeTruthy();
    await act(async () => { reuseButton!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    const saveButton = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Save Changes");
    expect(saveButton).toBeTruthy();
    await act(async () => { saveButton!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].imageUrl).toBe("https://media.example/lesson-question.png");
    await act(async () => { root.unmount(); });
  });
});
