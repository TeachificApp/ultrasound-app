import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions, resolveAuthHostname } from "./_core/cookies";

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    protocol: "https",
    hostname: "internal.run.app",
  } as Request;
}

describe("SSO cookie hostname resolution", () => {
  it("scopes cookies to .iheartecho.com when X-App-Hostname is app.iheartecho.com", () => {
    const req = mockReq({ "x-app-hostname": "app.iheartecho.com" });
    const host = resolveAuthHostname(req);
    expect(host).toBe("app.iheartecho.com");
    const opts = getSessionCookieOptions(req, host);
    expect(opts.domain).toBe(".iheartecho.com");
    expect(opts.sameSite).toBe("none");
    expect(opts.secure).toBe(true);
  });

  it("scopes cookies to .allaboutultrasound.com for learn domain", () => {
    const req = mockReq({ "x-app-hostname": "learn.allaboutultrasound.com" });
    const host = resolveAuthHostname(req);
    expect(host).toBe("learn.allaboutultrasound.com");
    const opts = getSessionCookieOptions(req, host);
    expect(opts.domain).toBe(".allaboutultrasound.com");
  });

  it("uses explicit host param for magic-link GET redirects", () => {
    const req = mockReq({});
    const host = resolveAuthHostname(req, "app.iheartecho.com");
    const opts = getSessionCookieOptions(req, host);
    expect(opts.domain).toBe(".iheartecho.com");
  });

  it("falls back to Origin for password login POST", () => {
    const req = mockReq({ origin: "https://app.iheartecho.com" });
    const host = resolveAuthHostname(req);
    expect(host).toBe("app.iheartecho.com");
  });
});
