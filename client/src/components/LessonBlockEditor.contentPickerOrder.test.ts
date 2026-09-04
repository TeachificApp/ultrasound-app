import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "LessonBlockEditor.tsx"), "utf8");

describe("lesson Content picker order", () => {
  it("uses the shared runtime catalog ordering and places Convert File after File Download", () => {
    expect(source).toContain("getCatalogItemsForCategory(activeCategory)");
    expect(source).toContain('b.type === "file_download"');
    expect(source).toContain('key="convert_document"');
    expect(source).toContain("Convert File");
  });
});
