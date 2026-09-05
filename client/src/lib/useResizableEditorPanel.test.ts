import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("useResizableEditorPanel", () => {
  it("tracks manual resize separately from one-time converted-block auto expand", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/useResizableEditorPanel.ts"), "utf8");
    expect(source).toContain("userResizedRef");
    expect(source).toContain("maybeExpandForConvertedDocument");
    expect(source).toContain("panelWidthRef.current = panelWidth");
    expect(source).toContain("dragRef.current.startWidth + delta");
  });
});
