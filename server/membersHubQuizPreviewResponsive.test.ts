import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const membersHub = readFileSync(resolve(process.cwd(), "client/src/pages/admin/MembersHub.tsx"), "utf8");
const accessCatalog = readFileSync(resolve(process.cwd(), "client/src/components/admin/MemberAccessCatalogList.tsx"), "utf8");
const quizPreview = readFileSync(resolve(process.cwd(), "client/src/quiz-creator/components/QuizPreview.tsx"), "utf8");

describe("Responsive member access and Quiz Preview workflows", () => {
  it("keeps the direct member access search and catalog usable in a single responsive column", () => {
    expect(membersHub).toContain("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between");
    expect(membersHub).toContain("w-full sm:w-80");
    expect(accessCatalog).toContain("max-h-[52vh] overflow-y-auto");
    expect(accessCatalog).toContain("min-w-0 flex-1");
  });

  it("keeps the preview modal, answer rows, feedback media, and navigation within narrow viewports", () => {
    expect(quizPreview).toContain("inset-0 z-50 flex items-center justify-center p-4");
    expect(quizPreview).toContain("w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]");
    expect(quizPreview).toContain("w-full flex items-center gap-3");
    expect(quizPreview).toContain("max-h-64 rounded-lg object-contain");
    expect(quizPreview).toContain("max-h-64 w-full rounded-lg bg-black");
  });
});
