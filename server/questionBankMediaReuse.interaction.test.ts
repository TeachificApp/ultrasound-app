import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("Question Bank media reuse interaction", () => {
  it("updates the question media field when an administrator uses a Media Repository URL", async () => {
    const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", { url: "http://localhost" });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("navigator", dom.window.navigator);
    vi.stubGlobal("localStorage", dom.window.localStorage);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    dom.window.prompt = vi.fn(() => " https://media.example/question.mp4 ");
    cleanup = () => { vi.unstubAllGlobals(); dom.window.close(); };

    const { MediaPicker } = await import("../client/src/components/QuestionBankMediaEditorDialog");
    const onChange = vi.fn();
    const container = dom.window.document.getElementById("app")!;
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(MediaPicker, {
        label: "Question video",
        field: "questionVideoUrl",
        value: "",
        onChange,
      }));
    });
    const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Use URL");
    expect(button).toBeTruthy();
    await act(async () => { button!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith("https://media.example/question.mp4");
    await act(async () => { root.unmount(); });
  });
});
