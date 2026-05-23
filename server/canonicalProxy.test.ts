/**
 * canonicalProxy.test.ts
 * Validates that the canonical URL helper correctly resolves the root domain
 * from the x-canonical-host header (Cloudflare Worker signal) and falls back
 * to the CANONICAL_ROOT_DOMAIN env var.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ── Replicate the getCanonicalHost logic from funnelOgMeta.ts ──────────────
// We test the logic directly without spinning up Express.

interface MockRequest {
  headers: Record<string, string | undefined>;
  get: (name: string) => string | undefined;
  protocol: string;
  originalUrl: string;
}

function getCanonicalHost(
  req: MockRequest,
  canonicalRootDomain: string
): string {
  const cfHeader = req.headers["x-canonical-host"];
  if (cfHeader && typeof cfHeader === "string" && cfHeader.trim()) {
    return cfHeader.trim();
  }
  if (canonicalRootDomain) {
    return canonicalRootDomain;
  }
  return req.get("host") ?? "";
}

function buildCanonicalUrl(
  req: MockRequest,
  canonicalRootDomain: string,
  pathOverride?: string
): string {
  const host = getCanonicalHost(req, canonicalRootDomain);
  const actualPath = pathOverride ?? req.originalUrl;
  return `https://${host}${actualPath}`;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Canonical URL resolution", () => {
  const ENV_DOMAIN = "allaboutultrasound.com";

  function makeReq(overrides: Partial<MockRequest> = {}): MockRequest {
    return {
      headers: {},
      get: (name: string) => (name === "host" ? "app.allaboutultrasound.com" : undefined),
      protocol: "https",
      originalUrl: "/courses/intro-to-vascular",
      ...overrides,
    };
  }

  describe("getCanonicalHost", () => {
    it("uses x-canonical-host header when present (Cloudflare Worker path)", () => {
      const req = makeReq({ headers: { "x-canonical-host": "allaboutultrasound.com" } });
      expect(getCanonicalHost(req, ENV_DOMAIN)).toBe("allaboutultrasound.com");
    });

    it("trims whitespace from x-canonical-host header", () => {
      const req = makeReq({ headers: { "x-canonical-host": "  allaboutultrasound.com  " } });
      expect(getCanonicalHost(req, ENV_DOMAIN)).toBe("allaboutultrasound.com");
    });

    it("falls back to CANONICAL_ROOT_DOMAIN env var when header is absent", () => {
      const req = makeReq();
      expect(getCanonicalHost(req, ENV_DOMAIN)).toBe("allaboutultrasound.com");
    });

    it("falls back to CANONICAL_ROOT_DOMAIN env var when header is empty string", () => {
      const req = makeReq({ headers: { "x-canonical-host": "" } });
      expect(getCanonicalHost(req, ENV_DOMAIN)).toBe("allaboutultrasound.com");
    });

    it("falls back to request host when no header and no env var", () => {
      const req = makeReq();
      expect(getCanonicalHost(req, "")).toBe("app.allaboutultrasound.com");
    });
  });

  describe("buildCanonicalUrl", () => {
    it("builds correct canonical URL for a course page via Cloudflare proxy", () => {
      const req = makeReq({
        headers: { "x-canonical-host": "allaboutultrasound.com" },
        originalUrl: "/courses/intro-to-vascular",
      });
      expect(buildCanonicalUrl(req, ENV_DOMAIN)).toBe(
        "https://allaboutultrasound.com/courses/intro-to-vascular"
      );
    });

    it("builds correct canonical URL for a funnel page via Cloudflare proxy", () => {
      const req = makeReq({
        headers: { "x-canonical-host": "allaboutultrasound.com" },
        originalUrl: "/my-funnel/landing-page",
      });
      expect(buildCanonicalUrl(req, ENV_DOMAIN)).toBe(
        "https://allaboutultrasound.com/my-funnel/landing-page"
      );
    });

    it("builds correct canonical URL using env var fallback (no proxy header)", () => {
      const req = makeReq({ originalUrl: "/downloads/vascular-guide" });
      expect(buildCanonicalUrl(req, ENV_DOMAIN)).toBe(
        "https://allaboutultrasound.com/downloads/vascular-guide"
      );
    });

    it("preserves query strings in canonical URL", () => {
      const req = makeReq({
        headers: { "x-canonical-host": "allaboutultrasound.com" },
        originalUrl: "/courses/intro-to-vascular?ref=email",
      });
      expect(buildCanonicalUrl(req, ENV_DOMAIN)).toBe(
        "https://allaboutultrasound.com/courses/intro-to-vascular?ref=email"
      );
    });

    it("uses pathOverride when provided", () => {
      const req = makeReq({
        headers: { "x-canonical-host": "allaboutultrasound.com" },
        originalUrl: "/p/standalone-page",
      });
      expect(buildCanonicalUrl(req, ENV_DOMAIN, "/p/standalone-page")).toBe(
        "https://allaboutultrasound.com/p/standalone-page"
      );
    });
  });

  describe("CANONICAL_ROOT_DOMAIN env var", () => {
    it("env var is set to allaboutultrasound.com", () => {
      // This validates that the secret was correctly injected into the environment.
      const envValue = process.env.CANONICAL_ROOT_DOMAIN;
      expect(envValue).toBe("allaboutultrasound.com");
    });
  });
});
