import React, { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteMetadataForHostname } from "../shared/siteMetadata";
import type { SeoHeadOptions } from "../client/src/hooks/useSeoHead";

// Isolate page SEO from hook internals and all network, auth, and database access.
const mocks = vi.hoisted(() => ({ seo: vi.fn(), pageSeo: vi.fn() }));
vi.mock("@/hooks/useSeoHead", () => ({ useSeoHead: mocks.seo }));
vi.mock("@/lib/trpc", () => {
  const query = { useQuery: () => ({ data: undefined, isLoading: false }) };
  return { trpc: {
    lms: { listFeatured: query, listCollections: query, getCollection: query },
    downloads: { list: query },
    sitePages: { admin: { getPublicPageZones: query } },
    stats: { userCount: query },
  } };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@/hooks/usePremium", () => ({ usePremium: () => ({ isPremium: false }) }));
vi.mock("@/const", () => ({ getLoginUrl: () => "/login" }));
vi.mock("@/components/Layout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/components/MobileAppDashboard", () => ({ default: () => null }));
vi.mock("@/components/ExpoAccountMenu", () => ({ ExpoAccountMenu: () => null, ExpoMobileAccountLinks: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, size, variant, ...props }: any) => asChild ? children : createElement("button", props, children),
}));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: any) => createElement("span", null, children) }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null }));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => createElement("a", { href, ...props }, children),
  useLocation: () => [window.location.pathname, vi.fn()],
}));
vi.mock("@shared/ultrasoundExpo", async importOriginal => {
  const actual = await importOriginal<typeof import("../shared/ultrasoundExpo")>();
  return { ...actual, getUltrasoundExpoPageSeo: mocks.pageSeo };
});

import LMSHome from "../client/src/pages/LMSHome";
import IHeartEchoHome from "../client/src/pages/iheartecho/IHeartEchoHome";
import EchoExpoSite from "../client/src/pages/EchoExpoSite";
import UltrasoundExpoRegister from "../client/src/pages/UltrasoundExpoRegister";
import { getUltrasoundExpoEditorPage } from "../shared/ultrasoundExpo";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pageSeo.mockImplementation((slug: string) => getUltrasoundExpoEditorPage(slug)!.seo);
  vi.stubGlobal("React", React); // Match the test runner's classic JSX transform.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network is forbidden in page metadata regressions"); }));
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

function renderPage(Page: ComponentType, url: string) {
  vi.stubGlobal("window", { location: new URL(url) });
  const markup = renderToStaticMarkup(createElement(Page));
  expect(mocks.seo).toHaveBeenCalledTimes(1);
  return { markup, seo: mocks.seo.mock.calls[0][0] as SeoHeadOptions };
}

function expectSharedDefaults(seo: SeoHeadOptions, hostname: string) {
  const defaults = getSiteMetadataForHostname(hostname)!;
  expect(seo).toMatchObject({
    title: defaults.title,
    description: defaults.description,
    image: defaults.image,
    siteName: defaults.siteName,
    keywords: defaults.keywords,
    appendSiteName: false,
  });
  expect(seo.image).toMatch(/^https:\/\//);
  expect(seo.title).not.toContain("UltrasoundAssist");
}

describe("Learn home metadata", () => {
  it.each(["learn.allaboutultrasound.com", "learn.iheartecho.com", "preview.example.test"])(
    "uses Learn defaults and preserves the active %s origin", hostname => {
      const { seo } = renderPage(LMSHome, `https://${hostname}/?utm_source=test`);
      expectSharedDefaults(seo, "learn.allaboutultrasound.com");
      expect(seo.canonical).toBe(`https://${hostname}/`);
    },
  );
});

describe("EchoAssist home metadata", () => {
  it.each(["app.iheartecho.com", "app.iheartecho.net", "preview.example.test"])(
    "sets full EchoAssist defaults and preserves the %s origin and path", hostname => {
      const { seo } = renderPage(IHeartEchoHome, `https://${hostname}/?utm_source=test`);
      expectSharedDefaults(seo, "app.iheartecho.com");
      expect(seo.canonical).toBe(`https://${hostname}/`);
    },
  );
  it("retains a routed path without a tracking query", () => {
    const { seo } = renderPage(IHeartEchoHome, "https://app.iheartecho.net/home?utm_source=test");
    expect(seo.canonical).toBe("https://app.iheartecho.net/home");
  });
});

describe("EchoExpo public page metadata", () => {
  it.each(["echocardiographyexpo.com", "www.echocardiographyexpo.com", "echoexpo.iheartecho.com"])(
    "uses dated homepage metadata and approved preview artwork on %s", hostname => {
      const { seo, markup } = renderPage(EchoExpoSite, `https://${hostname}/?utm_source=test`);
      expectSharedDefaults(seo, "echocardiographyexpo.com");
      expect(seo.description).toContain("January 14–16, 2028");
      expect(seo.canonical).toBe(`https://${hostname}/`);
      expect(markup).toContain("Registration opens soon");
    },
  );
  it.each(["echocardiographyexpo.com", "www.echocardiographyexpo.com", "echoexpo.iheartecho.com"])(
    "preserves page-specific metadata and the %s canonical host", hostname => {
      const { seo } = renderPage(EchoExpoSite, `https://${hostname}/program?utm_source=test`);
      const defaults = getSiteMetadataForHostname("echocardiographyexpo.com")!;
      expect(seo.title).toBe("The EchoExpo™ program | EchoExpo™");
      expect(seo.description).toContain("The developing EchoExpo™ program");
      expect(seo.image).toBe(defaults.image);
      expect(seo.siteName).toBe(defaults.siteName);
      expect(seo.canonical).toBe(`https://${hostname}/program`);
    },
  );
});

describe("shared Expo registration metadata and coming-soon safety", () => {
  it.each(["echocardiographyexpo.com", "www.echocardiographyexpo.com", "echoexpo.iheartecho.com"])(
    "uses EchoExpo registration identity on %s without opening registration", hostname => {
      const { seo, markup } = renderPage(UltrasoundExpoRegister, `https://${hostname}/register?event=echoexpo&utm_source=test`);
      const defaults = getSiteMetadataForHostname("echocardiographyexpo.com")!;
      expect(seo.title).toBe(`${defaults.siteName} Attendee Registration Coming Soon`);
      expect(seo.description).toContain("EchoExpo™");
      expect(seo.description).toContain("January 14–16, 2028");
      expect(seo.image).toBe(defaults.image);
      expect(seo.siteName).toBe(defaults.siteName);
      expect(seo.canonical).toBe(`https://${hostname}/register`);
      expect(mocks.pageSeo).not.toHaveBeenCalled();
      expect(markup).toContain("EchoExpo™ attendee registration coming soon");
      expect(markup).not.toContain("<form");
    },
  );
  it.each(["ultrasoundexpo.com", "www.ultrasoundexpo.com"])(
    "honors event=echoexpo on %s and retains its identity query in the canonical", hostname => {
      const { seo, markup } = renderPage(UltrasoundExpoRegister, `https://${hostname}/register?utm_source=test&event=echoexpo`);
      expect(seo.siteName).toBe("EchoExpo™");
      expect(seo.title).toContain("EchoExpo™");
      expect(seo.image).toBe(getSiteMetadataForHostname("echocardiographyexpo.com")!.image);
      expect(seo.canonical).toBe(`https://${hostname}/register?event=echoexpo`);
      expect(mocks.pageSeo).not.toHaveBeenCalled();
      expect(markup).toContain("EchoExpo™ attendee registration coming soon");
      expect(markup).not.toContain("<form");
    },
  );
  it.each(["ultrasoundexpo.com", "www.ultrasoundexpo.com"])(
    "preserves existing UltrasoundExpo registration defaults on %s", hostname => {
      const { seo, markup } = renderPage(UltrasoundExpoRegister, `https://${hostname}/register?event=ultrasoundexpo&utm_source=test`);
      expect(mocks.pageSeo).toHaveBeenCalledWith("register");
      expect(seo).toMatchObject(getUltrasoundExpoEditorPage("register")!.seo);
      expect(seo.siteName).toBe("UltrasoundExpo™");
      expect(seo.canonical).toBe(`https://${hostname}/register`);
      expect(markup).toContain("UltrasoundExpo™ attendee registration coming soon");
      expect(markup).not.toContain("<form");
    },
  );
  it("keeps the existing UltrasoundExpo SEO provider's authored values authoritative", () => {
    const savedSeo = { title: "Saved UltrasoundExpo registration title", description: "Saved registration description", image: "https://cdn.example.test/saved-preview.jpg" };
    mocks.pageSeo.mockReturnValue(savedSeo);
    const { seo } = renderPage(UltrasoundExpoRegister, "https://ultrasoundexpo.com/register");
    expect(seo).toMatchObject(savedSeo);
  });
});
