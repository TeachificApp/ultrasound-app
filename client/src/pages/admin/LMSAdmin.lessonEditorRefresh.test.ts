import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");

describe("Lesson editor refresh restoration", () => {
  it("restores the open lesson directly to its saved editor view", () => {
    expect(source).toContain('get("editLessonTab") === "content"');
    expect(source).toContain('params.set("editLessonTab", activeTab)');
    expect(source).toContain('const [activeTab, setActiveTab] = useState<"settings" | "content">(initialEditorTab)');
  });

  it("preserves the initial lesson route marker until lesson restoration completes", () => {
    expect(source).toContain('const [urlEditLessonId] = useState<number | null>(() => {');
    expect(source).toContain('} else if (!urlEditLessonId || restoredLessonRef.current) {');
  });

  it("clears the view marker when the lesson editor closes", () => {
    expect(source).toContain('params.delete("editLessonTab")');
  });
});
