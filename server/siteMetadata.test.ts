import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getMetadataRequestHostname,
  getSiteMetadataForHostname,
  injectSiteMetadataIntoHtml,
} from "./lib/siteMetadata";

const BASE_HTML = `<!doctype html><html><head>
  <title>UltrasoundAssist™ — Clinical Ultrasound App</title>
  <meta name="description" content="Generic description" />
  <meta property="og:title" content="UltrasoundAssist™ — Clinical Ultrasound App" />
  <meta property="og:description" content="Generic preview" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://example.test/generic.png" />
</head><body><div id="root"></div></body></html>`;

function request(hostname: string, headers: Record<string, string> = {}) {
  return {
    hostname,
    headers,
    get: (name: string) => name.toLowerCase() === "host" ? hostname : undefined,
  } as any;
}

describe("domain-specific social metadata", () => {
  it("defines a distinct preview for every requested product surface", () => {
    expect(getSiteMetadataForHostname("ultrasoundexpo.com")?.siteName).toBe("UltrasoundExpo™");
    expect(getSiteMetadataForHostname("echocardiographyexpo.com")?.siteName).toBe("EchoExpo™");
    expect(getSiteMetadataForHostname("app.allaboutultrasound.com")?.siteName).toBe("All About Ultrasound™");
    expect(getSiteMetadataForHostname("app.iheartecho.com")?.siteName).toBe("iHeartEcho™");
    expect(getSiteMetadataForHostname("learn.allaboutultrasound.com")?.title).toContain("Learn");
    expect(getSiteMetadataForHostname("learn.iheartecho.com")?.title).toContain("Learn");
    expect(getSiteMetadataForHostname("accreditation.iheartecho.com")?.title).toContain("Accreditation");
  });

  it("uses the public domain header instead of Railway's internal host", () => {
    const resolved = getMetadataRequestHostname(request("railway-internal.local", {
      "x-public-hostname": "echocardiographyexpo.com",
      "x-forwarded-host": "railway-internal.local",
    }));
    expect(resolved).toBe("echocardiographyexpo.com");
  });

  it("injects complete UltrasoundExpo metadata with a host-specific canonical URL", () => {
    const rendered = injectSiteMetadataIntoHtml(BASE_HTML, "ultrasoundexpo.com", "/exhibit");
    expect(rendered).toContain("UltrasoundExpo™ | The Annual Event for Ultrasound Professionals");
    expect(rendered).toContain('property="og:url" content="https://ultrasoundexpo.com/exhibit"');
    expect(rendered).toContain('property="og:site_name" content="UltrasoundExpo™"');
    expect(rendered).toContain('link rel="icon" href="https://files.manuscdn.com/');
    expect(rendered).toContain('name="twitter:card" content="summary_large_image"');
    expect(rendered).not.toContain("UltrasoundAssist™ — Clinical Ultrasound App");
  });

  it("injects EchoExpo's separate title, description, image, and canonical preview", () => {
    const rendered = injectSiteMetadataIntoHtml(BASE_HTML, "echocardiographyexpo.com", "/");
    expect(rendered).toContain("EchoExpo™ | The Echocardiography Experience at UltrasoundExpo™");
    expect(rendered).toContain('property="og:url" content="https://echocardiographyexpo.com/"');
    expect(rendered).toContain('property="og:site_name" content="EchoExpo™"');
    expect(rendered).toContain("echoexpo-supplied-tradeshow-hero_e230df63.png");
    expect(rendered).toContain('link rel="icon" href="https://echocardiographyexpo.com/manus-storage/echoexpo-logo_535dff69.png"');
    expect(rendered).toContain('link rel="apple-touch-icon" href="https://echocardiographyexpo.com/manus-storage/echoexpo-logo_535dff69.png"');
  });

  it("keeps app, Learn, and accreditation previews independent", () => {
    const app = injectSiteMetadataIntoHtml(BASE_HTML, "app.allaboutultrasound.com", "/");
    const ihe = injectSiteMetadataIntoHtml(BASE_HTML, "app.iheartecho.com", "/");
    const learn = injectSiteMetadataIntoHtml(BASE_HTML, "learn.allaboutultrasound.com", "/courses");
    const accreditation = injectSiteMetadataIntoHtml(BASE_HTML, "accreditation.iheartecho.com", "/");

    expect(app).toContain("UltrasoundAssist™ | All About Ultrasound™");
    expect(ihe).toContain("iHeartEcho™ | Echocardiography Clinical Intelligence");
    expect(learn).toContain("Learn | All About Ultrasound™ + iHeartEcho™");
    expect(accreditation).toContain("Accreditation | iHeartEcho™");
    expect(accreditation).toContain('property="og:url" content="https://accreditation.iheartecho.com/"');
  });

  it("sets independent browser favicon fallbacks for both Expo hosts", () => {
    const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(indexHtml).toContain("isExpo=h==='ultrasoundexpo.com'");
    expect(indexHtml).toContain("qyAMKKVMmuCLxwRU.png");
    expect(indexHtml).toContain("isEchoExpo=h==='echocardiographyexpo.com'");
    expect(indexHtml).toContain("echoexpo-logo_535dff69.png");
  });
});
