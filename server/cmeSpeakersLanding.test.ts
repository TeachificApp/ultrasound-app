import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("CME Speakers landing page", () => {
  it("seeds a published, no-navigation AAU page with the existing generic disclosure form embedded", () => {
    const migration = readProjectFile("drizzle/0092_cme_speakers_landing_page.sql");

    expect(migration).toContain("'/cme-speakers'");
    expect(migration).toContain("'aaus-net'");
    expect(migration).toContain("`hideInNavigation`");
    expect(migration).toContain("'no_header'");
    expect(migration).toContain("/cme-disclosure/generic");
    expect(migration).toContain("WHERE NOT EXISTS");
  });

  it("serves the page on Learn before the LMS navigation shell and not from the public-site funnel router", () => {
    const app = readProjectFile("client/src/App.tsx");
    const pageRoute = app.indexOf('<Route path="/cme-speakers">');
    const lmsLayout = app.indexOf("<LMSLayout>", pageRoute);

    expect(pageRoute).toBeGreaterThan(-1);
    expect(lmsLayout).toBeGreaterThan(pageRoute);
    expect(app.slice(pageRoute, lmsLayout)).toContain('tenantKey="aaus-net"');
    expect(app.slice(pageRoute, lmsLayout)).toContain('canonicalOrigin="https://learn.allaboutultrasound.com"');
    expect(app).not.toContain('<Route path="/cme-speakers" component={PublicMarketingSitePage} />');
  });

  it("keeps the public-site visual editor capable of file-download blocks", () => {
    const builder = readProjectFile("client/src/pages/admin/PublicSitePageBuilder.tsx");
    const catalog = readProjectFile("client/src/pages/admin/LandingPageBuilder.tsx");

    expect(builder).toContain("BlockSettings");
    expect(catalog).toContain('type: "file_download"');
    expect(catalog).toContain("File Download");
  });
});
