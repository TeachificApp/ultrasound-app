/**
 * Tests for server-side brand meta tag injection (vite.ts injectBrandMeta).
 * Social crawlers don't execute JS, so OG tags must be correct in the raw HTML.
 */
import { describe, it, expect } from "vitest";

// Inline the logic under test so we can unit-test it without importing the full vite module
const BRAND_META: Record<string, { title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; themeColor: string; appTitle: string }> = {
  iheartecho: {
    title: "iHeartEcho — Echocardiography Clinical Intelligence",
    description: "iHeartEcho — Echocardiography clinical intelligence for cardiac ultrasound students, sonographers, echocardiographers, and cardiologists.",
    ogTitle: "iHeartEcho — Echocardiography Clinical Intelligence",
    ogDescription: "Real-time echo interpretation and measurement assistant for cardiac ultrasound professionals.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-512_79ee0572.png",
    themeColor: "#0e1e2e",
    appTitle: "iHeartEcho",
  },
};

function injectBrandMeta(html: string, host: string): string {
  const brandKey = Object.keys(BRAND_META).find(k => host.includes(k));
  if (!brandKey) return html;
  const m = BRAND_META[brandKey];
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${m.title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${m.description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${m.ogTitle}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${m.ogDescription}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${m.ogImage}$2`)
    .replace(/(<meta\s+name="theme-color"\s+content=")[^"]*(")/, `$1${m.themeColor}$2`)
    .replace(/(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/, `$1${m.appTitle}$2`);
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
    const result = injectBrandMeta(SAMPLE_HTML, "app.allaboutultrasound.com");
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
});
