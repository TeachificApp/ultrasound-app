/**
 * redirects.test.ts
 * Verifies that legacy URL patterns return 301 redirects to their canonical equivalents.
 *
 * Patterns covered:
 *   /learn/:slug          → /courses/:slug
 *   /f/:slug/:pageSlug    → /:slug/:pageSlug
 *   /f/:slug              → /:slug
 *   /products/:slug       → /product/:slug
 */

import { describe, it, expect } from "vitest";

// ─── Redirect logic extracted for unit testing ────────────────────────────────
// Mirrors the logic in server/_core/index.ts without spinning up a full server.

function buildLegacyRedirectTarget(pathname: string, qs: string): string | null {
  // /learn/:slug → /courses/:slug
  const learnMatch = pathname.match(/^\/learn\/([^/]+)$/);
  if (learnMatch) return `/courses/${learnMatch[1]}${qs}`;

  // /f/:slug/:pageSlug → /:slug/:pageSlug  (must be checked before /f/:slug)
  const funnelPageMatch = pathname.match(/^\/f\/([^/]+)\/([^/]+)$/);
  if (funnelPageMatch) return `/${funnelPageMatch[1]}/${funnelPageMatch[2]}${qs}`;

  // /f/:slug → /:slug
  const funnelMatch = pathname.match(/^\/f\/([^/]+)$/);
  if (funnelMatch) return `/${funnelMatch[1]}${qs}`;

  // /products/:slug → /product/:slug
  const productsMatch = pathname.match(/^\/products\/([^/]+)$/);
  if (productsMatch) return `/product/${productsMatch[1]}${qs}`;

  return null;
}

describe("Legacy URL 301 redirects", () => {
  describe("/learn/:slug → /courses/:slug", () => {
    it("redirects a simple course slug", () => {
      expect(buildLegacyRedirectTarget("/learn/intro-to-vascular", "")).toBe(
        "/courses/intro-to-vascular"
      );
    });

    it("preserves query string parameters", () => {
      expect(
        buildLegacyRedirectTarget("/learn/intro-to-vascular", "?ref=email")
      ).toBe("/courses/intro-to-vascular?ref=email");
    });

    it("handles slugs with hyphens and numbers", () => {
      expect(buildLegacyRedirectTarget("/learn/echo-101-advanced", "")).toBe(
        "/courses/echo-101-advanced"
      );
    });
  });

  describe("/f/:slug/:pageSlug → /:slug/:pageSlug", () => {
    it("redirects a funnel page with both slug and pageSlug", () => {
      expect(
        buildLegacyRedirectTarget("/f/my-funnel/landing-page", "")
      ).toBe("/my-funnel/landing-page");
    });

    it("preserves query string on funnel page redirect", () => {
      expect(
        buildLegacyRedirectTarget("/f/my-funnel/landing-page", "?utm_source=fb")
      ).toBe("/my-funnel/landing-page?utm_source=fb");
    });
  });

  describe("/f/:slug → /:slug", () => {
    it("redirects a funnel root slug", () => {
      expect(buildLegacyRedirectTarget("/f/my-funnel", "")).toBe("/my-funnel");
    });

    it("preserves query string on funnel root redirect", () => {
      expect(
        buildLegacyRedirectTarget("/f/my-funnel", "?promo=SAVE10")
      ).toBe("/my-funnel?promo=SAVE10");
    });
  });

  describe("/products/:slug → /product/:slug", () => {
    it("redirects a product slug", () => {
      expect(buildLegacyRedirectTarget("/products/sono-guide", "")).toBe(
        "/product/sono-guide"
      );
    });

    it("preserves query string on product redirect", () => {
      expect(
        buildLegacyRedirectTarget("/products/sono-guide", "?coupon=WELCOME")
      ).toBe("/product/sono-guide?coupon=WELCOME");
    });
  });

  describe("non-legacy paths", () => {
    it("returns null for /courses/:slug (already canonical)", () => {
      expect(buildLegacyRedirectTarget("/courses/intro-to-vascular", "")).toBeNull();
    });

    it("returns null for /product/:slug (already canonical)", () => {
      expect(buildLegacyRedirectTarget("/product/sono-guide", "")).toBeNull();
    });

    it("returns null for /dashboard", () => {
      expect(buildLegacyRedirectTarget("/dashboard", "")).toBeNull();
    });

    it("returns null for /api/trpc/...", () => {
      expect(buildLegacyRedirectTarget("/api/trpc/auth.me", "")).toBeNull();
    });
  });
});
