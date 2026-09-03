import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const routerSource = source("server/routers.ts");
const authRouteSource = source("server/routes/authLogin.ts");
const loginSource = source("client/src/pages/Login.tsx");
const callbackSource = source("client/src/pages/MagicLinkCallback.tsx");
const cookieSource = source("server/lib/setAuthSessionCookies.ts");

describe("shared authentication domain flow", () => {
  const activeAppHosts = [
    "learn.allaboutultrasound.com",
    "members.allaboutultrasound.com",
    "app.allaboutultrasound.com",
    "app.iheartecho.com",
    "app.iheartecho.net",
    "accreditation.iheartecho.com",
  ];

  it("creates host-scoped magic links for each active application domain", () => {
    expect(routerSource).toContain("const KNOWN_APP_SUBDOMAINS = [");
    for (const host of activeAppHosts) {
      expect(routerSource).toContain(`"${host}"`);
    }
    expect(routerSource).toContain("const hostParam = `&host=${encodeURIComponent(appHostname)}`;");
    expect(routerSource).toContain("/api/auth/magic-verify?token=${token}");
  });

  it("uses full-page verification and host-aware cookie issuance for magic and access links", () => {
    expect(authRouteSource).toContain('app.get("/api/auth/magic-verify"');
    expect(authRouteSource).toContain("const cookieHostname = resolveAuthHostname(req, hostParam);");
    expect(authRouteSource).toContain("setAuthSessionCookies(req, res, sessionToken, cookieHostname);");
    expect(authRouteSource).toContain("return sendAuthRedirectHtml(res, redirectUrl);");
    expect(authRouteSource).toContain('app.get("/api/auth/access-verify"');
    expect(callbackSource).toContain("const host = window.location.hostname;");
    expect(callbackSource).toContain("const query = new URLSearchParams({ token, host });");
  });

  it("passes the current host for password login and issues compatible session cookie variants", () => {
    expect(loginSource).toContain('"X-App-Hostname": window.location.hostname');
    expect(loginSource).toContain("host: window.location.hostname");
    expect(cookieSource).toContain("getSessionCookieOptions(req, hostname)");
    expect(cookieSource).toContain("getLaxSessionCookieOptions(req, hostname)");
    expect(cookieSource).toContain("getHostOnlyLaxSessionCookieOptions(req)");
  });
});
