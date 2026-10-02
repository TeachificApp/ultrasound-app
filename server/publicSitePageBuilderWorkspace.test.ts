import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("public site page builder workspace", () => {
  it("uses the landing editor's expandable settings workspace", () => {
    const builder = readProjectFile(
      "client/src/pages/admin/PublicSitePageBuilder.tsx"
    );

    expect(builder).toContain("const [rightPanelWidth, setRightPanelWidth]");
    expect(builder).toContain("handleRightPanelMouseDown");
    expect(builder).toContain("Drag to resize settings panel");
    expect(builder).toContain("Math.round(window.innerWidth * 0.92)");
    expect(builder).toContain("style={{ width: rightPanelWidth }}");
  });

  it("uses shared block settings, templates, and the ordered landing catalog", () => {
    const builder = readProjectFile(
      "client/src/pages/admin/PublicSitePageBuilder.tsx"
    );

    expect(builder).toContain("BlockTemplateLibraryProvider");
    expect(builder).toContain("OpenTemplateLibraryButton");
    expect(builder).toContain("useBlockTemplateLibrary");
    expect(builder).toContain("onSaveAsTemplate={saveAsTemplate}");
    expect(builder).toContain("getCatalogItemsForCategory(activeCategory)");
    expect(builder).toContain("<BlockSettings");
  });
});
