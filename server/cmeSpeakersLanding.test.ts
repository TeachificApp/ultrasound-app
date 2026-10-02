import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("CME Speakers landing page", () => {
  it("seeds a published, no-navigation AAU page with the existing generic disclosure form embedded", () => {
    const migration = readProjectFile(
      "drizzle/0092_cme_speakers_landing_page.sql"
    );

    expect(migration).toContain("'/cme-speakers'");
    expect(migration).toContain("'aaus-net'");
    expect(migration).toContain("`hideInNavigation`");
    expect(migration).toContain("'no_header'");
    expect(migration).toContain("/cme-disclosure/generic");
    expect(migration).toContain("WHERE NOT EXISTS");
  });

  it("recovers the published CMS page on the serving database if an additive seed was skipped", () => {
    const router = readProjectFile("server/routers/marketingSiteRouter.ts");

    expect(router).toContain("async function ensureCmeSpeakersPage");
    expect(router).toContain(
      'input.tenantKey === "aaus-net" && path === CME_SPEAKERS_PATH'
    );
    expect(router).toContain("await ensureCmeSpeakersPage(db);");
    expect(router).toContain('embedCode: "<iframe src=/cme-disclosure/generic');
  });

  it("serves the page inside the Learn LMS layout and not from the public-site funnel router", () => {
    const app = readProjectFile("client/src/App.tsx");
    const lmsLayout = app.indexOf("<LMSLayout>");
    const pageRoute = app.indexOf(
      "<Route path={CME_SPEAKERS_PATH}>",
      lmsLayout
    );
    const homeRoute = app.indexOf(
      '<Route path="/" component={LMSHome} />',
      lmsLayout
    );

    expect(app).toContain('const CME_SPEAKERS_PATH = "/cme-speakers";');
    expect(lmsLayout).toBeGreaterThan(-1);
    expect(pageRoute).toBeGreaterThan(homeRoute);
    expect(app.slice(homeRoute, pageRoute + 450)).toContain(
      'tenantKey="aaus-net"'
    );
    expect(app.slice(homeRoute, pageRoute + 450)).toContain(
      'canonicalOrigin="https://learn.allaboutultrasound.com"'
    );
    expect(app).not.toContain(
      '<Route path="/cme-speakers" component={PublicMarketingSitePage} />'
    );
  });

  it("routes the Learn hostname before any public-site catch-all", () => {
    const app = readProjectFile("client/src/App.tsx");
    const appShell = app.slice(app.indexOf("function App()"));

    expect(appShell.indexOf(") : onLearnSubdomain ? (")).toBeGreaterThan(-1);
    expect(appShell.indexOf(") : onPublicWebsite ? (")).toBeGreaterThan(-1);
    expect(appShell.indexOf(") : onLearnSubdomain ? (")).toBeLessThan(
      appShell.indexOf(") : onPublicWebsite ? (")
    );
  });

  it("keeps the public-site visual editor capable of file-download blocks", () => {
    const builder = readProjectFile(
      "client/src/pages/admin/PublicSitePageBuilder.tsx"
    );
    const catalog = readProjectFile(
      "client/src/pages/admin/LandingPageBuilder.tsx"
    );

    expect(builder).toContain("BlockSettings");
    expect(catalog).toContain('type: "file_download"');
    expect(catalog).toContain("File Download");
  });

  it("lists the Learn-hosted CMS page in generic Site Pages and opens its canonical visual editor", () => {
    const tree = readProjectFile("server/lib/sitePageTree.ts");
    const sitePagesAdmin = readProjectFile(
      "client/src/pages/admin/SitePagesAdmin.tsx"
    );

    expect(tree).toContain('domain === "learn.allaboutultrasound.com"');
    expect(tree).toContain('eq(marketingSitePages.siteKey, "aaus-net")');
    expect(tree).toContain('eq(marketingSitePages.path, "/cme-speakers")');
    expect(tree).toContain(
      'folderNode("folder:learn-cms", "Learn CMS Pages", learnCmsChildren)'
    );
    expect(tree).toContain(
      "editorRoute: `/admin/public-site/page/${page.id}/edit-aaus`"
    );
    expect(tree).toContain(
      "previewUrl: `https://learn.allaboutultrasound.com${page.path}`"
    );
    expect(tree).toContain(
      "const webinarChildren: SitePageTreeNode[] = webinarList.map"
    );
    expect(sitePagesAdmin).toContain('"folder:learn-cms"');
  });

  it("suppresses the legacy marketing header across All About Ultrasound .net pages", () => {
    const page = readProjectFile(
      "client/src/pages/PublicMarketingSitePage.tsx"
    );

    expect(page).toContain(
      'host === "allaboutultrasound.net" || host === "www.allaboutultrasound.net"'
    );
    expect(page).toContain(
      'const showHeader = !hideMarketingNav && data.page.headerType !== "no_header";'
    );
    expect(page).toContain("hideMarketingNav={hideMarketingNav}");
  });
});
