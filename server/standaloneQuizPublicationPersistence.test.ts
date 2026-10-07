import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(import.meta.dirname, "../client/src/pages/admin/QuizCreatorAdmin.tsx"),
  "utf8",
);
const standaloneQuizRouter = fs.readFileSync(
  path.resolve(import.meta.dirname, "routers/standaloneQuizRouter.ts"),
  "utf8",
);
const quizMakerRouter = fs.readFileSync(
  path.resolve(import.meta.dirname, "routers/quizMakerRouter.ts"),
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
    expect(source).toContain("trpc.standaloneQuizAdmin.setPublicationStatus.useMutation");
    expect(source).toContain("publicationMutation.mutate(");
    expect(source).toContain("setSettings((current: any) => current ? { ...current, status } : current);");
    expect(source).toContain("onClick={() => updatePublicationStatus(quiz.status === \"published\" ? \"draft\" : \"published\")}");
  });

  it("allows only the dedicated publication action to change standalone quiz status", () => {
    expect(standaloneQuizRouter).toContain('quizSettingsInput.omit({ status: true }).partial()');
    expect(standaloneQuizRouter).toContain("setPublicationStatus: protectedProcedure");
    expect(standaloneQuizRouter).toContain('status: z.enum(["draft", "published"])');
    expect(standaloneQuizRouter).toContain(".set({ status: input.status, updatedAt: new Date() })");
  });

  it("keeps Visual Builder and Question Bank synchronization from mutating publication status", () => {
    expect(quizMakerRouter).toContain("function metaToQuizSettings(meta: QuizFile[\"meta\"])");
    const mapper = quizMakerRouter.slice(
      quizMakerRouter.indexOf("function metaToQuizSettings"),
      quizMakerRouter.indexOf("function parseJson"),
    );
    expect(mapper).not.toContain("status:");
    expect(quizMakerRouter).toContain("...settings,");
    expect(quizMakerRouter).toContain("builderConfig: serializeBuilderConfig({ meta, questions: synchronized.questions })");
  });
});
