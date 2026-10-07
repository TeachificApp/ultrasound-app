import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(import.meta.dirname, "../client/src/pages/admin/QuizCreatorAdmin.tsx"),
  "utf8",
);

describe("Quiz Creator publication persistence", () => {
  it("keeps publication changes separate from general settings saves", () => {
    expect(source).toContain("const saveSettings = () => {");
    expect(source).toContain("const { status: _status, id: _settingsId, ...editableSettings } = settings;");
    expect(source).toContain("updateMutation.mutate({ id: quiz.id, ...editableSettings });");
    expect(source).toContain("onClick={saveSettings}");
  });

  it("updates the current editor snapshot after an explicit publish or unpublish action", () => {
    expect(source).toContain("const updatePublicationStatus = (status: \"draft\" | \"published\") => {");
    expect(source).toContain("setSettings((current: any) => current ? { ...current, status } : current);");
    expect(source).toContain("onClick={() => updatePublicationStatus(quiz.status === \"published\" ? \"draft\" : \"published\")}");
  });
});
