import { describe, it, expect } from "vitest";
import {
  collectDescendantFolderIds,
  flattenQuestionBankFolderTree,
  questionBankFolderOptionLabel,
  scormImportQuestionTagIds,
} from "../shared/questionBankFolders";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("questionBankFolders helpers", () => {
  it("flattens nested folders depth-first with sort order", () => {
    const flat = flattenQuestionBankFolderTree([
      { id: 2, name: "Child", parentId: 1, sortOrder: 0 },
      { id: 1, name: "Parent", parentId: null, sortOrder: 0 },
      { id: 3, name: "Other root", parentId: null, sortOrder: 1 },
    ]);
    expect(flat.map((f) => `${f.depth}:${f.name}`)).toEqual([
      "0:Parent",
      "1:Child",
      "0:Other root",
    ]);
  });

  it("formats indented folder labels", () => {
    expect(questionBankFolderOptionLabel("Echo", 0)).toBe("Echo");
    expect(questionBankFolderOptionLabel("Adult", 2)).toBe("— — Adult");
  });

  it("does not auto-create SCORM tags from group names", () => {
    expect(scormImportQuestionTagIds(undefined)).toEqual([]);
    expect(scormImportQuestionTagIds([4, 9])).toEqual([4, 9]);
  });

  it("uses each imported SCORM group as a created or reused subfolder", () => {
    const source = readFileSync(resolve(import.meta.dirname, "routers/questionBankRouter.ts"), "utf8");
    expect(source).toContain("const groupFolderId = existingGroupFolder?.id ?? await insertQuestionBankFolder");
    expect(source).toContain("parentId: resolvedFolderId");
    expect(source).toContain("folderId: groupFolderId");
  });

  it("collects descendant folder ids for subtree filtering", () => {
    const folders = [
      { id: 1, name: "Parent", parentId: null },
      { id: 2, name: "Child", parentId: 1 },
      { id: 3, name: "Grandchild", parentId: 2 },
      { id: 4, name: "Other", parentId: null },
    ];
    expect(collectDescendantFolderIds(folders, 1)).toEqual([1, 2, 3]);
  });

  it("filters Question Bank questions when an administrator opens a folder", () => {
    const source = readFileSync(resolve(import.meta.dirname, "routers/questionBankRouter.ts"), "utf8");
    expect(source).toContain("collectDescendantFolderIds(allFolders, input.folderId)");
    expect(source).toContain("if (input.isPreset !== undefined) conditions.push(eq(questionBank.isPreset, input.isPreset));");
    const ui = readFileSync(resolve(import.meta.dirname, "../client/src/pages/admin/LMSAdmin.tsx"), "utf8");
    expect(ui).toContain("QuestionBankFolderTree");
    expect(ui).toContain("folderId: selectedFolderId");
  });
});
