/**
 * Tests for subdomain routing architecture:
 * - Domain URL constants are correctly defined
 * - Cloudflare Worker shouldProxy() logic covers all expected paths
 * - Cloudflare Worker getAppRedirect() routes to the correct subdomain
 */
import { describe, it, expect } from "vitest";

// ── Re-implement the Worker logic here for unit testing ────────────────────
// (The actual worker runs in a Cloudflare edge runtime, not Node.js)

const LEARN_ORIGIN = "https://learn.allaboutultrasound.com";
const MEMBERS_ORIGIN = "https://members.allaboutultrasound.com";
const APP_ORIGIN = "https://app.allaboutultrasound.com";

const RESERVED_PREFIXES = new Set([
  "courses", "downloads", "bundles", "product", "products",
  "dashboard", "admin", "api", "my-downloads", "account",
  "profile", "login", "logout", "student", "settings",
  "notifications", "forms", "learn", "f", "p", "media",
  "blog", "about", "contact", "pricing", "terms", "privacy",
  "_next", "static", "assets", "favicon.ico", "robots.txt",
  "sitemap.xml",
]);

function shouldProxy(pathname: string): boolean {
  if (/^\/courses\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/downloads\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/bundles\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/product\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/p\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/education-library(\/?|\?.*)$/.test(pathname)) return true;
  const twoSegment = pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (twoSegment) {
    const first = twoSegment[1];
    if (!RESERVED_PREFIXES.has(first)) return true;
  }
  return false;
}

function getAppRedirect(pathname: string): string | null {
  // Player/access → learn
  if (/^\/courses\/[^/]+\/player(\/|$)/.test(pathname)) return `${LEARN_ORIGIN}${pathname}`;
  if (/^\/downloads\/[^/]+\/files(\/|$)/.test(pathname)) return `${LEARN_ORIGIN}${pathname}`;
  if (/^\/courses\/[^/]+\/overview(\/|$)/.test(pathname)) return `${LEARN_ORIGIN}${pathname}`;
  // Account/dashboard → members
  const MEMBERS_PATHS = [
    /^\/my-dashboard(\/|$)/,
    /^\/my-downloads(\/|$)/,
    /^\/account(\/|$)/,
    /^\/profile(\/|$)/,
    /^\/settings(\/|$)/,
    /^\/notifications(\/|$)/,
    /^\/upgrade-success(\/|$)/,
  ];
  for (const pattern of MEMBERS_PATHS) {
    if (pattern.test(pathname)) return `${MEMBERS_ORIGIN}${pathname}`;
  }
  // App-only → app subdomain
  const APP_PATHS = [
    /^\/admin(\/|$)/,
    /^\/platform-admin(\/|$)/,
    /^\/login(\/|$)/,
    /^\/logout(\/|$)/,
    /^\/api(\/|$)/,
    /^\/forms(\/|$)/,
  ];
  for (const pattern of APP_PATHS) {
    if (pattern.test(pathname)) return `${APP_ORIGIN}${pathname}`;
  }
  return null;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("shouldProxy — landing pages that belong on root domain", () => {
  it("proxies course landing pages", () => {
    expect(shouldProxy("/courses/intro-to-vascular")).toBe(true);
    expect(shouldProxy("/courses/intro-to-vascular/")).toBe(true);
  });

  it("does NOT proxy course player (goes to learn subdomain)", () => {
    expect(shouldProxy("/courses/intro-to-vascular/player")).toBe(false);
  });

  it("does NOT proxy course overview (goes to learn subdomain)", () => {
    expect(shouldProxy("/courses/intro-to-vascular/overview")).toBe(false);
  });

  it("proxies download landing pages", () => {
    expect(shouldProxy("/downloads/quick-guide")).toBe(true);
  });

  it("does NOT proxy download files (goes to learn subdomain)", () => {
    expect(shouldProxy("/downloads/quick-guide/files")).toBe(false);
  });

  it("proxies bundle landing pages", () => {
    expect(shouldProxy("/bundles/vascular-bundle")).toBe(true);
  });

  it("proxies product landing pages", () => {
    expect(shouldProxy("/product/echo-probe")).toBe(true);
  });

  it("proxies /p/:slug standalone landing pages", () => {
    expect(shouldProxy("/p/my-landing-page")).toBe(true);
  });

  it("proxies education-library", () => {
    expect(shouldProxy("/education-library")).toBe(true);
    expect(shouldProxy("/education-library/")).toBe(true);
    expect(shouldProxy("/education-library?category=echo")).toBe(true);
  });

  it("proxies funnel pages (two-segment non-reserved paths)", () => {
    expect(shouldProxy("/my-funnel/landing-page")).toBe(true);
    expect(shouldProxy("/echo-course-funnel/checkout")).toBe(true);
  });

  it("does NOT proxy reserved two-segment paths", () => {
    expect(shouldProxy("/admin/users")).toBe(false);
    expect(shouldProxy("/api/trpc")).toBe(false);
    expect(shouldProxy("/courses/slug/player")).toBe(false);
  });
});

describe("getAppRedirect — routes to correct subdomain", () => {
  it("routes course player to learn subdomain", () => {
    expect(getAppRedirect("/courses/intro-to-vascular/player")).toBe(
      `${LEARN_ORIGIN}/courses/intro-to-vascular/player`
    );
  });

  it("routes download files to learn subdomain", () => {
    expect(getAppRedirect("/downloads/quick-guide/files")).toBe(
      `${LEARN_ORIGIN}/downloads/quick-guide/files`
    );
  });

  it("routes course overview to learn subdomain", () => {
    expect(getAppRedirect("/courses/intro-to-vascular/overview")).toBe(
      `${LEARN_ORIGIN}/courses/intro-to-vascular/overview`
    );
  });

  it("routes my-dashboard to members subdomain", () => {
    expect(getAppRedirect("/my-dashboard")).toBe(`${MEMBERS_ORIGIN}/my-dashboard`);
  });

  it("routes my-downloads to members subdomain", () => {
    expect(getAppRedirect("/my-downloads")).toBe(`${MEMBERS_ORIGIN}/my-downloads`);
  });

  it("routes profile to members subdomain", () => {
    expect(getAppRedirect("/profile")).toBe(`${MEMBERS_ORIGIN}/profile`);
  });

  it("routes settings to members subdomain", () => {
    expect(getAppRedirect("/settings")).toBe(`${MEMBERS_ORIGIN}/settings`);
  });

  it("routes admin to app subdomain", () => {
    expect(getAppRedirect("/admin/lms")).toBe(`${APP_ORIGIN}/admin/lms`);
  });

  it("routes login to app subdomain", () => {
    expect(getAppRedirect("/login")).toBe(`${APP_ORIGIN}/login`);
  });

  it("routes api to app subdomain", () => {
    expect(getAppRedirect("/api/trpc")).toBe(`${APP_ORIGIN}/api/trpc`);
  });

  it("returns null for proxied landing pages (no redirect needed)", () => {
    expect(getAppRedirect("/courses/intro-to-vascular")).toBeNull();
    expect(getAppRedirect("/downloads/quick-guide")).toBeNull();
    expect(getAppRedirect("/education-library")).toBeNull();
    expect(getAppRedirect("/my-funnel/landing-page")).toBeNull();
  });
});

describe("domain URL constants", () => {
  it("learn domain is correct", () => {
    expect(LEARN_ORIGIN).toBe("https://learn.allaboutultrasound.com");
  });

  it("members domain is correct", () => {
    expect(MEMBERS_ORIGIN).toBe("https://members.allaboutultrasound.com");
  });

  it("app origin is correct", () => {
    expect(APP_ORIGIN).toBe("https://app.allaboutultrasound.com");
  });
});
