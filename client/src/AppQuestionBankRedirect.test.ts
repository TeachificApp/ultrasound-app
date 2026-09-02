import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("standalone Question Bank route parity", () => {
  const appSource = readFileSync(resolve(import.meta.dirname, "App.tsx"), "utf8");
  const platformAdminSource = readFileSync(resolve(import.meta.dirname, "pages/PlatformAdmin.tsx"), "utf8");
  const lmsAdminSource = readFileSync(resolve(import.meta.dirname, "pages/admin/LMSAdmin.tsx"), "utf8");
  const workspaceSource = readFileSync(resolve(import.meta.dirname, "pages/QuestionBankWorkspacePage.tsx"), "utf8");

  it("renders the standalone workspace behind both protected Question Bank routes", () => {
    expect(appSource).toContain('const QuestionBankPage = lazy(() => import("./pages/QuestionBankWorkspacePage"));');
    expect(appSource.match(/<QuestionBankPage \/>/g)).toHaveLength(2);
    expect(appSource).not.toContain('<Redirect to="/admin/lms?tab=question_bank" />');
  });

  it("makes the Platform Admin tile open the standalone workspace", () => {
    expect(platformAdminSource).toContain('href: getAdminUrl("/question-bank")');
  });

  it("keeps folder controls persistent and moves legacy LMS-tab URLs safely to the standalone page", () => {
    expect(workspaceSource).toContain('<QuestionBankWorkspace standalone />');
    expect(workspaceSource).toContain('Platform Admin');
    expect(workspaceSource).toContain('LMS Admin');
    expect(lmsAdminSource).toContain('data-question-bank-sidebar={standalone ? "persistent" : "panel"}');
    expect(lmsAdminSource).toContain('onClick={() => selectFolder(f.id)}');
    expect(lmsAdminSource).toContain('title="Add subfolder"');
    expect(lmsAdminSource).toContain('onClick={() => startEditFolder(f)}');
    expect(lmsAdminSource).toContain('onClick={() => moveFolder(f.id, "up")}');
    expect(lmsAdminSource).toContain('onClick={() => moveFolder(f.id, "down")}');
    expect(lmsAdminSource).toContain('return <Redirect to={getAdminUrl("/question-bank")} />;');
    expect(lmsAdminSource).not.toContain('{ value: "question_bank",     label: "Question Bank",     icon: Database }');
  });
});
