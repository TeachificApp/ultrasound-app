import { describe, it, expect } from "vitest";
import {
  flattenQuestionBankFolderTree,
  questionBankFolderOptionLabel,
  scormImportQuestionTagIds,
} from "../shared/questionBankFolders";

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
});
