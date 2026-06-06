import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { transformAnalyticsIndexHtml } from "../vite.config";

const clientIndexPath = path.resolve(process.cwd(), "client", "index.html");

describe("transformAnalyticsIndexHtml", () => {
  const savedEndpoint = process.env.VITE_ANALYTICS_ENDPOINT;
  const savedWebsiteId = process.env.VITE_ANALYTICS_WEBSITE_ID;

  beforeEach(() => {
    delete process.env.VITE_ANALYTICS_ENDPOINT;
    delete process.env.VITE_ANALYTICS_WEBSITE_ID;
  });

  afterEach(() => {
    if (savedEndpoint === undefined) delete process.env.VITE_ANALYTICS_ENDPOINT;
    else process.env.VITE_ANALYTICS_ENDPOINT = savedEndpoint;
    if (savedWebsiteId === undefined) delete process.env.VITE_ANALYTICS_WEBSITE_ID;
    else process.env.VITE_ANALYTICS_WEBSITE_ID = savedWebsiteId;
  });

  it("keeps #root and main entry when analytics env vars are missing", () => {
    const html = fs.readFileSync(clientIndexPath, "utf-8");
    const out = transformAnalyticsIndexHtml(html);

    expect(out).toContain('id="root"');
    expect(out).toContain('src="/src/main.tsx"');
    expect(out).toContain("Brand-aware meta swap");
    expect(out).not.toContain("%VITE_ANALYTICS_ENDPOINT%");
  });

  it("substitutes analytics placeholders when env vars are set", () => {
    process.env.VITE_ANALYTICS_ENDPOINT = "https://analytics.example.com";
    process.env.VITE_ANALYTICS_WEBSITE_ID = "site-123";

    const html = fs.readFileSync(clientIndexPath, "utf-8");
    const out = transformAnalyticsIndexHtml(html);

    expect(out).toContain('src="https://analytics.example.com/umami"');
    expect(out).toContain('data-website-id="site-123"');
    expect(out).toContain('id="root"');
  });
});
