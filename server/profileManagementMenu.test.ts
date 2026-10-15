import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appLayoutSource = readFileSync(resolve(process.cwd(), "client/src/components/Layout.tsx"), "utf8");
const learnLayoutSource = readFileSync(resolve(process.cwd(), "client/src/components/LMSLayout.tsx"), "utf8");

describe("profile management menus", () => {
  it("keeps the requested education and accreditation entries in the app menu", () => {
    expect(appLayoutSource).toContain("EducatorAssist™");
    expect(appLayoutSource).toContain("Lab Admin Portal");
    expect(appLayoutSource).toContain("Member Portal");
    expect(appLayoutSource).toContain("Accreditation Manager");
    expect(appLayoutSource).toContain("LMS Management");
  });

  it("shows the same management destinations in the Learn profile menu", () => {
    expect(learnLayoutSource).toContain('getAdminUrl("/educator-assist")');
    expect(learnLayoutSource).toContain('getAdminUrl("/lab-admin")');
    expect(learnLayoutSource).toContain('getAdminUrl("/diy-member")');
    expect(learnLayoutSource).toContain('getAdminUrl("/accreditation-manager")');
    expect(learnLayoutSource).toContain('getAdminUrl("/admin/lms")');
  });

  it("keeps long management menus scrollable rather than hiding lower options", () => {
    expect(appLayoutSource).toContain("max-h-[calc(100vh-5rem)] overflow-y-auto");
    expect(learnLayoutSource).toContain("max-h-[calc(100vh-5rem)] overflow-y-auto");
  });
});
