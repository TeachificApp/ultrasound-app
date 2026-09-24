import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { marketingSiteAdminRouter, marketingSitePublicRouter } from "./routers/marketingSiteRouter";
import { rewritePublicSiteLink } from "./lib/marketingSiteImport";
import {
  getPublicSiteTenant,
  getPublicSiteTenantForHost,
  isPublicSiteStagingHost,
  publicSiteOrigin,
} from "../shared/publicSiteTenants";

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

describe("dual public-site tenant architecture", () => {
  it("loads public and Platform Admin CMS routers", () => {
    expect(marketingSitePublicRouter).toBeDefined();
    expect(marketingSiteAdminRouter).toBeDefined();
  });

  it("keeps .net review hosts and .com promotion hosts distinct for both brands", () => {
    const aaus = getPublicSiteTenant("aaus-net")!;
    const ihe = getPublicSiteTenant("iheartecho-net")!;
    expect(aaus.currentHost).toBe("www.allaboutultrasound.net");
    expect(aaus.promotionHost).toBe("www.allaboutultrasound.com");
    expect(ihe.currentHost).toBe("www.iheartecho.net");
    expect(ihe.promotionHost).toBe("www.iheartecho.com");
    expect(getPublicSiteTenantForHost("www.iheartecho.net")?.key).toBe("iheartecho-net");
    expect(getPublicSiteTenantForHost("iheartecho.net")?.key).toBe("iheartecho-net");
    expect(getPublicSiteTenantForHost("www.iheartecho.com")?.key).toBe("iheartecho-net");
    expect(getPublicSiteTenantForHost("allaboutultrasound.net")?.key).toBe("aaus-net");
    expect(getPublicSiteTenantForHost("aboutultrasound.net")?.key).toBe("aaus-net");
    expect(isPublicSiteStagingHost("www.allaboutultrasound.net")).toBe(true);
    expect(isPublicSiteStagingHost("aboutultrasound.net")).toBe(true);
    expect(isPublicSiteStagingHost("www.allaboutultrasound.com")).toBe(false);
    expect(publicSiteOrigin(ihe, "promotion")).toBe("https://www.iheartecho.com");
  });

  it("rewrites verified legacy course calls-to-action to their current Learn CME destination", () => {
    const aaus = getPublicSiteTenant("aaus-net")!;
    const counts = { legacyMemberLinks: 0, sourceLinks: 0, crossBrandLinks: 0, cmeCourseLinks: 0 };
    expect(rewritePublicSiteLink("https://allaboutultrasound.teachable.com/purchase?product_id=4100340", aaus, counts))
      .toBe("https://learn.allaboutultrasound.com/courses/all-about-upper-extremity-duplex-cme");
    expect(rewritePublicSiteLink("https://member.allaboutultrasound.com/users/sign_in", aaus, counts))
      .toBe("https://learn.allaboutultrasound.com/users/sign_in");
    expect(counts).toEqual({ legacyMemberLinks: 1, sourceLinks: 0, crossBrandLinks: 0, cmeCourseLinks: 1 });
  });

  it("defines a tenant-specific migration, import, WYSIWYG editor, and public renderer", () => {
    const migration = read("drizzle/0069_dual_public_site_editor.sql");
    const importer = read("server/lib/marketingSiteImport.ts");
    const router = read("server/routers/marketingSiteRouter.ts");
    const manager = read("client/src/pages/admin/PublicSiteAdmin.tsx");
    const builder = read("client/src/pages/admin/PublicSitePageBuilder.tsx");
    const renderer = read("client/src/pages/PublicMarketingSitePage.tsx");
    const sidebarEditor = read("client/src/components/public-site/BlogSidebarBlockEditor.tsx");
    expect(migration).toContain("'aaus-net'");
    expect(migration).toContain("'iheartecho-net'");
    expect(migration).toContain("blogPublishedAt");
    expect(importer).toContain("rewritePublicSiteLink");
    expect(importer).toContain("member.allaboutultrasound.com");
    expect(importer).toContain("bulkImportPublicSite");
    expect(router).toContain("requirePlatformAdmin");
    expect(router).toContain("listBlogPosts");
    expect(router).toContain("runBulkImport");
    expect(manager).toContain("Visual editor");
    expect(manager).toContain(".net now → .com later");
    expect(builder).toContain("BlockSettings");
    expect(builder).toContain("Blog metadata");
    expect(builder).toContain("Article-specific sidebar");
    expect(manager).toContain("Brand blog sidebar");
    expect(manager).toContain("BlogSidebarBlockEditor");
    expect(sidebarEditor).toContain("SortableBlock");
    expect(renderer).toContain("BlogListing");
    expect(renderer).toContain("BlogSidebar");
    expect(renderer).toContain("Blog archive");
    expect(renderer).toContain("promotionOrigin");
    expect(renderer).toContain("PublicSiteRootFallback");
    expect(renderer).toContain('pathname === "/"');
  });

  it("routes public .net hosts ahead of the app host and provides public sitemap metadata", () => {
    const app = read("client/src/App.tsx");
    const indexHtml = read("client/index.html");
    const server = read("server/_core/index.ts");
    const sitemap = read("server/routes/sitemap.ts");
    const metadata = read("server/routes/marketingSiteRoutes.ts");
    expect(app.indexOf(") : onPublicWebsite ? (")).toBeLessThan(app.indexOf(") : onIHeartEchoSubdomain ? ("));
    expect(server).toContain("registerMarketingSiteRoutes(app)");
    expect(server).toContain("registerMarketingSiteOgMeta(app)");
    expect(sitemap).toContain("getPublicSiteTenantForHost");
    expect(metadata).toContain("isPublicSiteStagingHost");
    expect(metadata).toContain("publicSiteOrigin(tenant, \"promotion\")");
    expect(indexHtml).toContain("isPublicBrandSite");
    expect(indexHtml).toContain("www.iheartecho.com");
  });

  it("renders the lightweight CTA blocks produced by the public-site importer", () => {
    const importer = read("server/routers/pageScraperRouter.ts");
    const preview = read("client/src/components/BlockPreview.tsx");
    expect(importer).toContain('type: "cta"');
    expect(importer).toContain("buttonText: text");
    expect(preview).toContain('case "cta":');
    expect(preview).toContain("d.buttonUrl");
  });

  it("keeps mirrored source assets, blog sidebars, and both configured public tenants durable", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/0082_public_site_tenants_and_blog_sidebars.sql");
    const importer = read("server/lib/marketingSiteImport.ts");
    const router = read("server/routers/marketingSiteRouter.ts");
    expect(schema).toContain("blogSidebarBlocks");
    expect(schema).toContain("blogSidebarMode");
    expect(migration).toContain("blogExcerpt");
    expect(migration).toContain("blogSidebarMode");
    expect(importer).toContain("mirrorSourceAsset");
    expect(importer).toContain("storagePut");
    expect(importer).toContain("new URL(seo.seoImage, sourceUrl)");
    expect(importer).toContain("rewriteBareUrls");
    expect(importer).toContain('$("*").contents()');
    expect(router).toContain("saveBlogSidebar");
    expect(router).toContain("blogSidebarMode");
  });

  it("defines safe page-tree, visibility, navigation, SEO, and nested-column controls", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/0083_public_site_page_controls.sql");
    const tree = read("shared/publicSitePageTree.ts");
    const router = read("server/routers/marketingSiteRouter.ts");
    const access = read("server/lib/marketingSitePageAccess.ts");
    const manager = read("client/src/pages/admin/PublicSiteAdmin.tsx");
    const builder = read("client/src/pages/admin/PublicSitePageBuilder.tsx");
    const renderer = read("client/src/pages/PublicMarketingSitePage.tsx");
    const metadata = read("server/routes/marketingSiteRoutes.ts");
    const preview = read("client/src/components/BlockPreview.tsx");
    expect(schema).toContain("parentId");
    expect(schema).toContain("hideInNavigation");
    expect(schema).toContain("sitePasswordHash");
    expect(schema).toContain("hideFromSearch");
    expect(migration).toContain("marketing_site_pages_site_parent_order_idx");
    expect(tree).toContain("buildPublicSitePageTree");
    expect(tree).toContain("cycle");
    expect(router).toContain("savePageTree");
    expect(router).toContain("assertNoPageTreeCycles");
    expect(router).toContain("verifyPagePassword");
    expect(router).toContain("bcrypt.hash");
    expect(access).toContain("HttpOnly");
    expect(access).toContain("timingSafeEqual");
    expect(manager).toContain("Website page tree");
    expect(manager).toContain("Drop to make a subpage");
    expect(builder).toContain("Hide in navigation");
    expect(builder).toContain("Hide from search");
    expect(builder).toContain("Advanced code");
    expect(builder).toContain("onAddBlockToColumn");
    expect(renderer).toContain("listNavigation");
    expect(renderer).toContain("AccessGate");
    expect(metadata).toContain("pageNoIndex");
    expect(preview).toContain("nestingDepth >= 4");
  });
});
