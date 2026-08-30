/* @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MathContent } from "./MathContent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MathContent", () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    act(() => {
      roots.splice(0).forEach(root => root.unmount());
    });
    document.body.replaceChildren();
  });

  it("renders inline and display equation placeholders into KaTeX output", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(React.createElement(MathContent, {
        html: '<p>Velocity: <span data-type="inline-math" data-latex="v = d/t"></span></p><div data-type="block-math" data-latex="CO = SV \\times HR"></div>',
      }));
    });

    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.textContent).toContain("Velocity:");
  });
});
