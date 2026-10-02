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

  it("routes the single-segment page before the funnel catch-all", () => {
    const app = readProjectFile("client/src/App.tsx");
    const pageRoute = app.indexOf('<Route path="/cme-speakers" component={PublicMarketingSitePage} />');
    const funnelRoute = app.indexOf('<Route path="/:slug" component={FunnelRootRedirect} />', pageRoute);

    expect(pageRoute).toBeGreaterThan(-1);
    expect(funnelRoute).toBeGreaterThan(pageRoute);
  });

  it("keeps the public-site visual editor capable of file-download blocks", () => {
    const builder = readProjectFile("client/src/pages/admin/PublicSitePageBuilder.tsx");
    const catalog = readProjectFile("client/src/pages/admin/LandingPageBuilder.tsx");

    expect(builder).toContain("BlockSettings");
    expect(catalog).toContain('type: "file_download"');
    expect(catalog).toContain("File Download");
  });
});
