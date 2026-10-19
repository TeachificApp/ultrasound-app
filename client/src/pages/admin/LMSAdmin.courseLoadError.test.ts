import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const courseEditorStart = source.indexOf("function CourseEditor(");
const courseEditorSource = source.slice(courseEditorStart);

describe("LMS course editor load failures", () => {
  it("shows a retryable load error before falling back to an actual not-found state", () => {
    expect(courseEditorStart).toBeGreaterThan(-1);
    expect(courseEditorSource).toContain("error: courseLoadError");
    expect(courseEditorSource).toContain('role="alert"');
    expect(courseEditorSource).toContain("Retry loading course");
    expect(courseEditorSource.indexOf("if (courseLoadError)")).toBeLessThan(courseEditorSource.indexOf("if (!course)"));
  });
});
