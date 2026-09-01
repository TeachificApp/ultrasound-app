import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Platform Admin Question Bank route parity", () => {
  const appSource = readFileSync(resolve(import.meta.dirname, "App.tsx"), "utf8");
  const platformAdminSource = readFileSync(resolve(import.meta.dirname, "pages/PlatformAdmin.tsx"), "utf8");

  it("redirects both legacy Question Bank routes to the active LMS Question Bank tab", () => {
    expect(appSource).toContain('import { Redirect, Route, Switch, useLocation, useParams } from "wouter";');
    expect(appSource.match(/<Redirect to="\/admin\/lms\?tab=question_bank" \/>/g)).toHaveLength(2);
  });

  it("makes the Platform Admin tile use the active LMS Question Bank tab", () => {
    expect(platformAdminSource).toContain('href: getAdminUrl("/admin/lms?tab=question_bank")');
  });
});
