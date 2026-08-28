import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { transformAnalyticsIndexHtml, UMAMI_ANALYTICS_SCRIPT_RE } from "../vite.config";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("production build safety", () => {
  it("strips umami placeholders when analytics env is unset", () => {
    const html = `<!doctype html><head></head><body>
    <script defer src="%VITE_ANALYTICS_ENDPOINT%/umami" data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"></script>
    </body>`;
    const prev = { ...process.env };
    delete process.env.VITE_ANALYTICS_ENDPOINT;
    delete process.env.VITE_ANALYTICS_WEBSITE_ID;
    const out = transformAnalyticsIndexHtml(html);
    process.env.VITE_ANALYTICS_ENDPOINT = prev.VITE_ANALYTICS_ENDPOINT;
    process.env.VITE_ANALYTICS_WEBSITE_ID = prev.VITE_ANALYTICS_WEBSITE_ID;
    expect(out).not.toContain("%VITE_ANALYTICS_ENDPOINT%");
    expect(out).not.toMatch(UMAMI_ANALYTICS_SCRIPT_RE);
  });

  it("source sw.js uses v9 cache and has no fetch handler", () => {
    const sw = fs.readFileSync(path.join(ROOT, "client/public/sw.js"), "utf8");
    expect(sw).toContain('CACHE_VERSION = "v9"');
    expect(sw).not.toContain('addEventListener("fetch"');
  });

  it("ErrorBoundary treats Safari Can't find variable as stale bundle recovery", () => {
    const boundary = fs.readFileSync(path.join(ROOT, "client/src/components/ErrorBoundary.tsx"), "utf8");
    expect(boundary).toContain("Can't find variable:");
    expect(boundary).toContain("isStaleReferenceError");
  });
});
