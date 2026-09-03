import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const courseSettingsStart = source.indexOf("function CourseSettingsForm(");
const courseSettingsSource = source.slice(courseSettingsStart);

describe("LMS Course Editor Manager state", () => {
  it("defines restricted-Manager state within Course Settings before using it", () => {
    expect(courseSettingsStart).toBeGreaterThan(-1);
    expect(courseSettingsSource).toContain("const { user } = useAuth();");
    expect(courseSettingsSource).toContain('const isRestrictedManager = (user?.appRoles ?? []).includes("platform_manager")');
    expect(courseSettingsSource.indexOf("const isRestrictedManager")).toBeLessThan(courseSettingsSource.indexOf("!isRestrictedManager &&"));
  });

  it("continues to hide pricing controls for restricted Managers", () => {
    expect(courseSettingsSource).toContain("{!isRestrictedManager && (");
  });
});
