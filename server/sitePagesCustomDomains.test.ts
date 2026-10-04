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

  it("lets an admin choose the published domain when creating a page and preserves it for previews", () => {
    const manager = read("client/src/pages/admin/SitePagesAdmin.tsx");
    const builder = read("client/src/pages/admin/SitePageBuilder.tsx");
    const tree = read("server/lib/sitePageTree.ts");

    expect(manager).toContain("Published domain");
    expect(manager).toContain("createPage.mutate({");
    expect(manager).toContain("domain: newPageDomain");
    expect(manager).toContain("/edit?domain=${encodeURIComponent(newPageDomain)}");
    expect(builder).toContain("https://${page.domain}/${page.slug}");
    expect(tree).toContain("https://${row.domain}/${row.slug}");
  });
});
