// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AiSourceFileReview } from "../client/src/components/admin/AiSourceFileReview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AI source file review", () => {
  let host: HTMLDivElement;
  let root: Root;

  const render = async (overrides: Partial<React.ComponentProps<typeof AiSourceFileReview>> = {}) => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(AiSourceFileReview, {
      sourceFiles: [{ url: "https://files.example/a.pdf", mimeType: "application/pdf", name: "A.pdf" }, { url: "https://files.example/b.png", mimeType: "image/png", name: "B.png" }],
      isUploading: false,
      onFiles: vi.fn(),
      onRemove: vi.fn(),
      description: "Up to three source files.",
      ...overrides,
    })));
  };

  afterEach(async () => {
    await act(async () => root?.unmount());
    host?.remove();
    vi.clearAllMocks();
  });

  it("renders a reviewed source list and removes the selected file", async () => {
    const onRemove = vi.fn();
    await render({ onRemove });
    expect(document.querySelector('[aria-label="Source review"]')?.textContent).toContain("A.pdf");
    expect(document.querySelector('[aria-label="Source review"]')?.textContent).toContain("B.png");
    await act(async () => (document.querySelector('[aria-label="Remove A.pdf"]') as HTMLButtonElement).click());
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("accepts multi-file chooser and drag-and-drop input before generation", async () => {
    const onFiles = vi.fn();
    await render({ onFiles });
    const files = [new File(["pdf"], "one.pdf", { type: "application/pdf" }), new File(["png"], "two.png", { type: "image/png" })];
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: files });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(onFiles).toHaveBeenCalledWith(files);

    const dropEvent = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvent, "dataTransfer", { configurable: true, value: { files } });
    await act(async () => host.firstElementChild?.dispatchEvent(dropEvent));
    expect(onFiles).toHaveBeenLastCalledWith(files);
  });
});
