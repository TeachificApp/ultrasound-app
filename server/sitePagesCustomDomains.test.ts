import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Site Builder custom domain support", () => {
  it("lists configured custom domains alongside the built-in site domains", () => {
    const router = read("server/routers/sitePagesRouter.ts");
    expect(router).toContain("platformSettings.customDomains");
    expect(router).toContain("Custom domain — ${domain}");
    expect(router).toContain("configuredDomains");
  });

  it("routes the Platform Admin Site Builder card to the domain-selecting editor", () => {
    const admin = read("client/src/pages/PlatformAdmin.tsx");
    expect(admin).toContain('href: getAdminUrl("/admin/lms/site-pages")');
    expect(admin).toContain("any configured custom domain");
  });
});
