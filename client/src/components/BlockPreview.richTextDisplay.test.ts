import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const preview = readFileSync(resolve(process.cwd(), "client/src/components/BlockPreview.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("lesson rich-text display style parity", () => {
  it("uses the dedicated parity renderer instead of generic prose styling", () => {
    const textCase = preview.match(/case "text":[\s\S]*?case "ai_image":/)?.[0] ?? "";
    expect(textCase).toContain('className="rich-text-display"');
    expect(textCase).not.toContain('className="prose"');
  });

  it("matches the editor defaults while allowing imported inline styles to win", () => {
    expect(css).toContain(".rich-text-display h3");
    expect(css).toContain("color: #0e4a50;");
    expect(css).toContain(".rich-text-display table th");
    expect(css).toContain("background-color: #f0fdfa;");
    expect(css).toContain(".rich-text-display img");
    expect(css).not.toContain(".rich-text-display h3 {\n  font-size: 0.95rem !important");
  });
});
