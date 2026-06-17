/**
 * Tests for server-side brand meta tag injection (vite.ts injectBrandMeta).
 * Social crawlers don't execute JS, so OG tags must be correct in the raw HTML.
 */
import { describe, it, expect } from "vitest";

// Inline the logic under test so we can unit-test it without importing the full vite module
const BRAND_META: Record<string, { title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; ogUrl: string; themeColor: string; appTitle: string }> = {
  iheartecho: {
    title: "iHeartEcho — Echocardiography Clinical Intelligence",
    description: "iHeartEcho — Echocardiography clinical intelligence for cardiac ultrasound students, sonographers, echocardiographers, and cardiologists.",
    ogTitle: "iHeartEcho — Echocardiography Clinical Intelligence",
    ogDescription: "Real-time echo interpretation and measurement assistant for cardiac ultrasound professionals.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-512_79ee0572.png",
    ogUrl: "https://app.iheartecho.com",
    themeColor: "#0e1e2e",
    appTitle: "iHeartEcho",
  },
  "learn.allaboutultrasound": {
    title: "All About Ultrasound | iHeartEcho",
    description: "All About Ultrasound | iHeartEcho — General, Vascular & Cardiac Ultrasound Clinical Intelligence.",
    ogTitle: "All About Ultrasound | iHeartEcho",
    ogDescription: "General, Vascular & Cardiac Ultrasound Clinical Intelligence learning platform.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
    ogUrl: "https://learn.allaboutultrasound.com",
    themeColor: "#189aa1",
    appTitle: "AAUS | iHeartEcho",
  },
  "app.allaboutultrasound": {
    title: "All About Ultrasound | iHeartEcho",
    description: "All About Ultrasound | iHeartEcho — General, Vascular & Cardiac Ultrasound Clinical Intelligence.",
    ogTitle: "All About Ultrasound | iHeartEcho",
    ogDescription: "General, Vascular & Cardiac Ultrasound Clinical Intelligence learning platform.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
    ogUrl: "https://app.allaboutultrasound.com",
    themeColor: "#189aa1",
    appTitle: "AAUS | iHeartEcho",
  },
  "members.allaboutultrasound": {
    title: "All About Ultrasound | iHeartEcho",
    description: "All About Ultrasound | iHeartEcho — General, Vascular & Cardiac Ultrasound Clinical Intelligence.",
    ogTitle: "All About Ultrasound | iHeartEcho",
    ogDescription: "General, Vascular & Cardiac Ultrasound Clinical Intelligence learning platform.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
    ogUrl: "https://members.allaboutultrasound.com",
    themeColor: "#189aa1",
    appTitle: "AAUS | iHeartEcho",
  },
};

function injectBrandMeta(html: string, host: string): string {
  const brandKey = Object.keys(BRAND_META).find(k => host.includes(k));
  if (!brandKey) return html;
  const m = BRAND_META[brandKey];
  let result = html
    .replace(/<title>[^<]*<\/title>/, `<title>${m.title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${m.description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${m.ogTitle}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${m.ogDescription}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${m.ogImage}$2`)
    .replace(/(<meta\s+name="theme-color"\s+content=")[^"]*(")/, `$1${m.themeColor}$2`)
    .replace(/(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/, `$1${m.appTitle}$2`);
  const ogUrlTag = `<meta property="og:url" content="${m.ogUrl}" />`;
  if (result.includes('property="og:url"')) {
    result = result.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${m.ogUrl}$2`);
  } else if (result.includes('property="og:type"')) {
    result = result.replace(/(<meta\s+property="og:type"[^>]*>)/, `$1\n    ${ogUrlTag}`);
  } else {
    result = result.replace(/<\/head>/, `    ${ogUrlTag}\n  </head>`);
  }
  return result;
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>UltrasoundAssist™ — Clinical Ultrasound App</title>
  <meta name="description" content="UltrasoundAssist default description." />
  <meta property="og:title" content="UltrasoundAssist™ — Clinical Ultrasound App" />
  <meta property="og:description" content="All About Ultrasound clinical companion." />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://example.com/aaus_logo.png" />
  <meta name="theme-color" content="#189aa1" />
  <meta name="apple-mobile-web-app-title" content="UltrasoundAssist™" />
</head>
<body><div id="root"></div></body>
</html>`;

describe("injectBrandMeta", () => {
  it("returns unchanged HTML for non-branded hosts", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "someother.example.com");
    expect(result).toBe(SAMPLE_HTML);
  });

  it("returns unchanged HTML for empty host", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "");
    expect(result).toBe(SAMPLE_HTML);
  });

  it("injects iHeartEcho OG tags for app.iheartecho.com", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "app.iheartecho.com");
    expect(result).toContain("<title>iHeartEcho — Echocardiography Clinical Intelligence</title>");
    expect(result).toContain('property="og:title" content="iHeartEcho — Echocardiography Clinical Intelligence"');
    expect(result).toContain('property="og:description" content="Real-time echo interpretation and measurement assistant for cardiac ultrasound professionals."');
    expect(result).toContain('property="og:image" content="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-512_79ee0572.png"');
    expect(result).toContain('name="theme-color" content="#0e1e2e"');
    expect(result).toContain('name="apple-mobile-web-app-title" content="iHeartEcho"');
    // og:type should be untouched
    expect(result).toContain('property="og:type" content="website"');
  });

  it("injects iHeartEcho OG tags for accreditation.iheartecho.com", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "accreditation.iheartecho.com");
    expect(result).toContain("<title>iHeartEcho — Echocardiography Clinical Intelligence</title>");
    expect(result).toContain('property="og:title" content="iHeartEcho — Echocardiography Clinical Intelligence"');
  });

  it("does NOT inject UltrasoundAssist branding for iheartecho host", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "app.iheartecho.com");
    expect(result).not.toContain("UltrasoundAssist");
  });

  it("injects og:url after og:type when og:url is absent", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "app.iheartecho.com");
    expect(result).toContain('<meta property="og:url" content="https://app.iheartecho.com" />');
    // og:url should appear after og:type
    const typeIdx = result.indexOf('property="og:type"');
    const urlIdx = result.indexOf('property="og:url"');
    expect(urlIdx).toBeGreaterThan(typeIdx);
  });

  it("replaces existing og:url when already present", () => {
    const htmlWithOgUrl = SAMPLE_HTML.replace(
      '<meta property="og:type" content="website" />',
      '<meta property="og:type" content="website" />\n  <meta property="og:url" content="https://old-url.com" />'
    );
    const result = injectBrandMeta(htmlWithOgUrl, "app.iheartecho.com");
    expect(result).toContain('content="https://app.iheartecho.com"');
    expect(result).not.toContain('content="https://old-url.com"');
    // Should not duplicate the tag
    const count = (result.match(/property="og:url"/g) || []).length;
    expect(count).toBe(1);
  });

  it("does not inject og:url for completely unbranded hosts", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "someother.example.com");
    expect(result).not.toContain('property="og:url"');
  });

  it("injects AAUS OG tags and og:url for learn.allaboutultrasound.com", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "learn.allaboutultrasound.com");
    expect(result).toContain("<title>All About Ultrasound | iHeartEcho</title>");
    expect(result).toContain('property="og:title" content="All About Ultrasound | iHeartEcho"');
    expect(result).toContain('property="og:url" content="https://learn.allaboutultrasound.com"');
    expect(result).toContain('name="theme-color" content="#189aa1"');
    expect(result).toContain('name="apple-mobile-web-app-title" content="AAUS | iHeartEcho"');
  });

  it("injects AAUS OG tags and og:url for app.allaboutultrasound.com", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "app.allaboutultrasound.com");
    expect(result).toContain("<title>All About Ultrasound | iHeartEcho</title>");
    expect(result).toContain('property="og:url" content="https://app.allaboutultrasound.com"');
  });

  it("injects AAUS OG tags and og:url for members.allaboutultrasound.com", () => {
    const result = injectBrandMeta(SAMPLE_HTML, "members.allaboutultrasound.com");
    expect(result).toContain("<title>All About Ultrasound | iHeartEcho</title>");
    expect(result).toContain('property="og:url" content="https://members.allaboutultrasound.com"');
  });

  it("iheartecho key takes priority over allaboutultrasound for iheartecho hosts", () => {
    // app.iheartecho.com should match iheartecho key, not any AAUS key
    const result = injectBrandMeta(SAMPLE_HTML, "app.iheartecho.com");
    expect(result).toContain("<title>iHeartEcho \u2014 Echocardiography Clinical Intelligence</title>");
    expect(result).toContain('property="og:url" content="https://app.iheartecho.com"');
  });
});
