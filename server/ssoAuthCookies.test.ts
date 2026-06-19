/**
 * ssoAuthCookies.test.ts
 *
 * Validates that session cookies are scoped to the correct domain
 * depending on which hostname the request arrives on.
 *
 * Key invariants:
 *  - Requests on app.iheartecho.com → cookie domain = .iheartecho.com
 *  - Requests on app.iheartecho.net → cookie domain = .iheartecho.net
 *  - Requests on app.allaboutultrasound.com → cookie domain = .allaboutultrasound.com
 *  - Requests on learn.allaboutultrasound.com → cookie domain = .allaboutultrasound.com
 *  - Requests on accreditation.iheartecho.com → cookie domain = .iheartecho.com
 *  - Requests without a recognised host → falls back to CANONICAL_ROOT_DOMAIN
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the env module so tests don't need real env vars ───────────────────
vi.mock("./_core/env", () => ({
  env: {
    CANONICAL_ROOT_DOMAIN: "app.allaboutultrasound.com",
    IHE_CANONICAL_ROOT_DOMAIN: "app.iheartecho.com",
    NODE_ENV: "production",
    JWT_SECRET: "test-secret",
  },
}));

// ─── Import after mocking ────────────────────────────────────────────────────
import { resolveAuthHostname, getSessionCookieOptions } from "./_core/cookies";

// ─── Helper: build a minimal Express-style request object ───────────────────
function makeReq(overrides: {
  hostname?: string;
  xForwardedHost?: string;
  xAppHostname?: string;
  /** Set to true to simulate a Cloudflare/proxy HTTPS request (adds x-forwarded-proto: https) */
  isProxied?: boolean;
}) {
  return {
    hostname: overrides.hostname ?? "localhost",
    headers: {
      ...(overrides.xForwardedHost ? { "x-forwarded-host": overrides.xForwardedHost } : {}),
      ...(overrides.xAppHostname ? { "x-app-hostname": overrides.xAppHostname } : {}),
      ...(overrides.isProxied ? { "x-forwarded-proto": "https" } : {}),
    },
  } as any;
}

// ─── resolveAuthHostname ─────────────────────────────────────────────────────
describe("resolveAuthHostname", () => {
  it("returns app.iheartecho.com for x-app-hostname: app.iheartecho.com", () => {
    const req = makeReq({ xAppHostname: "app.iheartecho.com" });
    expect(resolveAuthHostname(req)).toBe("app.iheartecho.com");
  });

  it("returns app.iheartecho.net for x-app-hostname: app.iheartecho.net", () => {
    const req = makeReq({ xAppHostname: "app.iheartecho.net" });
    expect(resolveAuthHostname(req)).toBe("app.iheartecho.net");
  });

  it("returns app.allaboutultrasound.com for x-app-hostname: app.allaboutultrasound.com", () => {
    const req = makeReq({ xAppHostname: "app.allaboutultrasound.com" });
    expect(resolveAuthHostname(req)).toBe("app.allaboutultrasound.com");
  });

  it("returns learn.allaboutultrasound.com for x-app-hostname: learn.allaboutultrasound.com", () => {
    const req = makeReq({ xAppHostname: "learn.allaboutultrasound.com" });
    expect(resolveAuthHostname(req)).toBe("learn.allaboutultrasound.com");
  });

  it("returns undefined when only x-forwarded-host is set (resolveAuthHostname uses x-app-hostname or Origin)", () => {
    // resolveAuthHostname does NOT read x-forwarded-host — it uses x-app-hostname or Origin header.
    // x-forwarded-host is used by getPublicHostname for general hostname resolution.
    const req = makeReq({ xForwardedHost: "accreditation.iheartecho.com" });
    expect(resolveAuthHostname(req)).toBeUndefined();
  });

  it("returns undefined when no proxy headers are present (resolveAuthHostname requires proxy context)", () => {
    // resolveAuthHostname only resolves from Origin/x-app-hostname/x-forwarded-host.
    // When none are present it returns undefined; getPublicHostname handles the req.hostname fallback.
    const req = makeReq({ hostname: "app.iheartecho.com" });
    expect(resolveAuthHostname(req)).toBeUndefined();
  });

  it("returns the raw hostname for unknown x-app-hostname values (no filtering)", () => {
    const req = makeReq({ xAppHostname: "unknown.example.com" });
    // resolveAuthHostname passes through any non-internal hostname from x-app-hostname
    const hostname = resolveAuthHostname(req);
    expect(hostname).toBe("unknown.example.com");
  });
});

// ─── getSessionCookieOptions — domain scoping ────────────────────────────────
describe("getSessionCookieOptions — domain scoping", () => {
  it("scopes cookie to .iheartecho.com for app.iheartecho.com", () => {
    const req = makeReq({ xAppHostname: "app.iheartecho.com", isProxied: true });
    const opts = getSessionCookieOptions(req, "app.iheartecho.com");
    expect(opts.domain).toBe(".iheartecho.com");
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe("none");
  });

  it("scopes cookie to .iheartecho.net for app.iheartecho.net", () => {
    const req = makeReq({ xAppHostname: "app.iheartecho.net", isProxied: true });
    const opts = getSessionCookieOptions(req, "app.iheartecho.net");
    expect(opts.domain).toBe(".iheartecho.net");
    expect(opts.secure).toBe(true);
  });

  it("scopes cookie to .allaboutultrasound.com for app.allaboutultrasound.com", () => {
    const req = makeReq({ xAppHostname: "app.allaboutultrasound.com", isProxied: true });
    const opts = getSessionCookieOptions(req, "app.allaboutultrasound.com");
    expect(opts.domain).toBe(".allaboutultrasound.com");
    expect(opts.secure).toBe(true);
  });

  it("scopes cookie to .allaboutultrasound.com for learn.allaboutultrasound.com", () => {
    const req = makeReq({ xAppHostname: "learn.allaboutultrasound.com", isProxied: true });
    const opts = getSessionCookieOptions(req, "learn.allaboutultrasound.com");
    expect(opts.domain).toBe(".allaboutultrasound.com");
  });

  it("scopes cookie to .iheartecho.com for accreditation.iheartecho.com", () => {
    const req = makeReq({ xAppHostname: "accreditation.iheartecho.com", isProxied: true });
    const opts = getSessionCookieOptions(req, "accreditation.iheartecho.com");
    expect(opts.domain).toBe(".iheartecho.com");
  });

  it("does NOT set domain for localhost (dev mode)", () => {
    const req = makeReq({ hostname: "localhost" });
    const opts = getSessionCookieOptions(req, "localhost");
    // In dev mode the domain should be undefined/omitted so the cookie is host-only
    expect(opts.domain === undefined || opts.domain === "localhost").toBe(true);
  });

  it("sets httpOnly: true on all cookies", () => {
    const req = makeReq({ xAppHostname: "app.iheartecho.com", isProxied: true });
    const opts = getSessionCookieOptions(req, "app.iheartecho.com");
    expect(opts.httpOnly).toBe(true);
  });
});
