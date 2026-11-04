import React, { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteMetadataForHostname, injectSiteMetadataIntoHtml, getMetadataRequestHostname } from "./lib/siteMetadata";
import { renderSiteMetadataBootstrap } from "../shared/siteMetadataBootstrap";
import { applySeoHead, useSeoHead, type SeoHeadOptions } from "../client/src/hooks/useSeoHead";
import { injectPageSeoIntoHtml } from "./routes/funnelOgMeta";

const shell = `<!doctype html><html><head><title>UltrasoundAssist™ — Clinical Ultrasound App</title><meta name="description" content="App description"><meta property="og:title" content="App title"><meta property="og:image" content="https://example.test/app.png"><meta name="twitter:site" content="@allaboutultrasound"><link rel="canonical" href="https://app.allaboutultrasound.com/"></head><body><div id="root"></div></body></html>`;
const hosts = ["ultrasoundexpo.com", "www.ultrasoundexpo.com", "echocardiographyexpo.com", "www.echocardiographyexpo.com", "echoexpo.iheartecho.com", "learn.allaboutultrasound.com", "learn.iheartecho.com", "app.iheartecho.com", "app.iheartecho.net"];
const doms: JSDOM[] = [];
function domFor(host: string, html = shell) {
  const dom = new JSDOM(html, { url: `https://${host}/`, runScripts: "outside-only" });
  doms.push(dom);
  return dom;
}
function content(dom: JSDOM, key: string) {
  return dom.window.document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.getAttribute("content");
}
afterEach(() => {
  vi.unstubAllGlobals();
  doms.splice(0).forEach(dom => dom.window.close());
});

describe("domain identity across crawler and browser metadata lifecycles", () => {
  it.each(hosts)("serves %s its own title, description, image and canonical without JavaScript", host => {
    const defaults = getSiteMetadataForHostname(host)!;
    const dom = domFor(host, injectSiteMetadataIntoHtml(shell, host));
    expect(dom.window.document.title).toBe(defaults.title);
    expect(content(dom, "og:title")).toBe(defaults.title);
    expect(content(dom, "og:description")).toBe(defaults.description);
    expect(content(dom, "og:image")).toBe(defaults.image);
    expect(content(dom, "twitter:image")).toBe(defaults.image);
    expect(content(dom, "og:url")).toBe(`https://${host}/`);
    expect(content(dom, "og:site_name")).toBe(defaults.siteName);
    expect(defaults.title).not.toContain("UltrasoundAssist");
  });

  it.each(hosts)("initializes the complete browser preview for %s before React", host => {
    const dom = domFor(host);
    dom.window.eval(renderSiteMetadataBootstrap());
    const defaults = getSiteMetadataForHostname(host)!;
    expect(dom.window.document.title).toBe(defaults.title);
    expect(content(dom, "twitter:title")).toBe(defaults.title);
    expect(content(dom, "twitter:image")).toBe(defaults.image);
    expect(content(dom, "og:image")).toBe(defaults.image);
    expect(content(dom, "og:site_name")).toBe(defaults.siteName);
    expect(dom.window.document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`https://${host}/`);
  });

  it("preserves the saved per-page Learn SEO even when the hostname contains iHeartEcho", () => {
    const host = "learn.iheartecho.com";
    const req = { hostname: "internal.local", protocol: "http", path: "/courses/saved", originalUrl: "/courses/saved", headers: { "x-public-hostname": host }, get: () => "internal.local" } as any;
    const html = injectPageSeoIntoHtml(injectSiteMetadataIntoHtml(shell, host, req.path), { title: "Saved authored course", description: "Saved education description", image: "/manus-storage/saved.png", keywords: "saved keywords" }, req);
    const dom = domFor(host, html);
    dom.window.eval(renderSiteMetadataBootstrap());
    expect(dom.window.document.title).toBe("Saved authored course");
    expect(content(dom, "og:title")).toBe("Saved authored course");
    expect(content(dom, "og:url")).toBe(`https://${host}/courses/saved`);
    expect(content(dom, "og:image")).toBe(`https://${host}/manus-storage/saved.png`);
    expect(content(dom, "twitter:title")).toBe("Saved authored course");
    expect(dom.window.document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it("injects Learn identity on the early crawler page route without a prior host HTML transform", () => {
    const host = "learn.iheartecho.com";
    const req = { hostname: host, protocol: "https", path: "/courses/saved", originalUrl: "/courses/saved", headers: { host }, get: () => host } as any;
    const dom = domFor(host, injectPageSeoIntoHtml(shell, { title: "Authored course", description: "Course description" }, req));
    expect(content(dom, "og:site_name")).toBe(getSiteMetadataForHostname(host)!.siteName);
    expect(content(dom, "og:image")).toBe(getSiteMetadataForHostname(host)!.image);
    expect(content(dom, "twitter:image")).toBe(getSiteMetadataForHostname(host)!.image);
    expect(content(dom, "og:title")).toBe("Authored course");
    expect(content(dom, "keywords")).not.toContain("ScanCoach");
  });

  it("keeps public marketing CMS metadata unchanged in the browser bootstrap", () => {
    const dom = domFor("www.iheartecho.com", shell.replace("App title", "Saved public SEO"));
    dom.window.eval(renderSiteMetadataBootstrap());
    expect(content(dom, "og:title")).toBe("Saved public SEO");
  });

  it.each(["echocardiographyexpo.com", "learn.iheartecho.com", "app.iheartecho.net"])("restores host defaults, not UltrasoundAssist, after a %s page unmounts", async host => {
    const dom = domFor(host);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const root = createRoot(dom.window.document.getElementById("root")!);
    function Page({ opts }: { opts: SeoHeadOptions }) { useSeoHead(opts); return createElement("div"); }
    await act(async () => root.render(createElement(Page, { opts: { title: "Saved page", description: "Saved description", image: "/manus-storage/saved-page.png", appendSiteName: false } })));
    expect(content(dom, "og:image")).toBe(`https://${host}/manus-storage/saved-page.png`);
    expect(content(dom, "twitter:title")).toBe("Saved page");
    await act(async () => root.unmount());
    const defaults = getSiteMetadataForHostname(host)!;
    expect(dom.window.document.title).toBe(defaults.title);
    expect(content(dom, "og:title")).toBe(defaults.title);
    expect(content(dom, "og:image")).toBe(defaults.image);
    expect(content(dom, "twitter:image")).toBe(defaults.image);
    expect(content(dom, "og:site_name")).toBe(defaults.siteName);
    expect(content(dom, "og:url")).toBe(`https://${host}/`);
    expect(dom.window.document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it("deduplicates generated canonical and social tags without dropping the saved action image", () => {
    const dom = domFor("learn.allaboutultrasound.com", shell.replace("</head>", '<link rel="canonical" href="https://old.test"><meta property="og:title" content="Duplicate"></head>'));
    vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document);
    applySeoHead({ title: "Course", image: "https://cdn.example.com/course.jpg" });
    expect(dom.window.document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(dom.window.document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(content(dom, "og:image")).toBe("https://cdn.example.com/course.jpg");
    expect(content(dom, "og:image:width")).toBeUndefined();
  });

  it("handles recognized public proxy headers and alias hosts rather than internal service names", () => {
    const req = { hostname: "internal.local", headers: { "x-forwarded-host": "www.echocardiographyexpo.com, internal.local" }, get: () => "internal.local" } as any;
    expect(getMetadataRequestHostname(req)).toBe("www.echocardiographyexpo.com");
    expect(injectSiteMetadataIntoHtml(shell, getMetadataRequestHostname(req))).toContain("EchoExpo™");
  });

  it("gives Learn and EchoAssist independent optimized public JPG graphics and correct dimensions", () => {
    const learn = getSiteMetadataForHostname("learn.allaboutultrasound.com")!;
    const echo = getSiteMetadataForHostname("app.iheartecho.com")!;
    expect(learn.image).not.toBe(echo.image);
    for (const m of [learn, echo]) {
      expect(m.image).toMatch(/^https:\/\/files\.manuscdn\.com\/.*\.jpg$/);
      expect(m.imageWidth).toBe(1200); expect(m.imageHeight).toBe(675);
    }
  });
});
