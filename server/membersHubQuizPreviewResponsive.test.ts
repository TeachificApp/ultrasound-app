import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const membersHub = readFileSync(resolve(process.cwd(), "client/src/pages/admin/MembersHub.tsx"), "utf8");
const accessCatalog = readFileSync(resolve(process.cwd(), "client/src/components/admin/MemberAccessCatalogList.tsx"), "utf8");
const quizPreview = readFileSync(resolve(process.cwd(), "client/src/quiz-creator/components/QuizPreview.tsx"), "utf8");
const quizResults = readFileSync(resolve(process.cwd(), "client/src/pages/StandaloneQuizResults.tsx"), "utf8");
const salesDashboard = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminSalesDashboard.tsx"), "utf8");
const adminUserDetail = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminUserDetailPage.tsx"), "utf8");
const sonoTravelers = readFileSync(resolve(process.cwd(), "client/src/pages/SonoTravelers.tsx"), "utf8");

describe("Responsive member access and Quiz Preview workflows", () => {
  it("keeps the direct member access search and catalog usable in a single responsive column", () => {
    expect(membersHub).toContain("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4");
    expect(membersHub).toContain("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between");
    expect(membersHub).toContain("w-full sm:w-80");
    expect(membersHub).toContain('aria-label="Filter access catalog by type"');
    expect(membersHub).toContain("[\"courses\", \"Courses\"]");
    expect(membersHub).toContain("[\"memberships\", \"Memberships\"]");
    expect(accessCatalog).toContain("max-h-[52vh] overflow-y-auto");
    expect(accessCatalog).toContain("min-w-0 flex-1");
    expect(membersHub).toContain("flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 sm:flex-nowrap");
  });

  it("keeps the preview modal, answer rows, feedback media, and navigation within narrow viewports", () => {
    expect(quizPreview).toContain("inset-0 z-50 flex items-center justify-center p-4");
    expect(quizPreview).toContain("w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]");
    expect(quizPreview).toContain("w-full flex items-center gap-3");
    expect(quizPreview).toContain("max-h-64 rounded-lg object-contain");
    expect(quizPreview).toContain("max-h-64 w-full rounded-lg bg-black");
  });

  it("stacks standalone quiz result metrics and answer comparisons before restoring desktop columns", () => {
    expect(quizResults).toContain("grid grid-cols-1 gap-3 mt-6 text-sm sm:grid-cols-3 sm:gap-4");
    expect(quizResults).toContain("flex flex-wrap justify-center gap-3 mt-6");
    expect(quizResults).toContain("grid grid-cols-1 gap-3 text-sm sm:grid-cols-2");
  });

  it("stacks Sales Dashboard loading metrics and custom date fields before desktop widths", () => {
    expect(salesDashboard).toContain("flex flex-wrap items-center gap-2");
    expect(salesDashboard).toContain("w-full sm:w-36 h-8 text-sm");
    expect(salesDashboard).toContain("grid grid-cols-1 gap-4 sm:grid-cols-3");
  });

  it("stacks member-detail stats, membership rows, edit fields, and toggles on narrow screens", () => {
    expect(adminUserDetail).toContain("grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-center sm:grid-cols-3");
    expect(adminUserDetail).toContain("flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between");
    expect(adminUserDetail).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2");
    expect(adminUserDetail).toContain("flex flex-wrap items-center gap-4 pt-1");
  });

  it("stacks public Sono Travelers benefit cards before restoring three columns", () => {
    expect(sonoTravelers).toContain("mt-8 grid grid-cols-1 gap-4 text-center sm:grid-cols-3");
  });
});
