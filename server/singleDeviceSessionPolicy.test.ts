import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const policySource = source("server/lib/singleDeviceSession.ts");
const passwordSource = source("server/routes/authLogin.ts");
const loginSource = source("client/src/pages/Login.tsx");
const magicSource = source("client/src/pages/MagicLinkCallback.tsx");
const accessSource = source("client/src/pages/AccessLinkCallback.tsx");
const ssoRouteSource = source("server/routes/ssoAuto.ts");
const ssoExchangeSource = source("server/lib/ssoExchange.ts");
const sdkSource = source("server/_core/sdk.ts");

describe("single active device policy", () => {
  it("keeps one opaque active session per ordinary user and exempts Platform Admins", () => {
    expect(policySource).toContain("userActiveSessions");
    expect(policySource).toContain("eq(userActiveSessions.userId, user.id)");
    expect(policySource).toContain('eq(userRoles.role, "platform_admin")');
    expect(policySource).toContain('user.role === "admin"');
    expect(policySource).toContain("isPlatformAdminUser");
  });

  it("requires user confirmation before password, magic-link, or access-link replacement", () => {
    expect(passwordSource).toContain("prepareUserSession");
    expect(passwordSource).toContain('app.post("/api/auth/confirm-session-replacement"');
    expect(passwordSource).toContain("requiresSessionReplacement");
    expect(passwordSource).toContain('session_replace');
    expect(loginSource).toContain("Choose your active device");
    expect(loginSource).toContain("Stay signed in there");
    expect(loginSource).toContain("Log out other device and sign in here");
    expect(magicSource).toContain("getOrCreateDeviceId");
    expect(accessSource).toContain("getOrCreateDeviceId");
  });

  it("invalidates only a replaced session and releases only the matching logged-out device", () => {
    expect(policySource).toContain("active.sessionId === sessionId");
    expect(policySource).toContain("releaseAuthenticatedSession");
    expect(policySource).toContain("eq(userActiveSessions.sessionId, sessionId)");
  });

  it("preserves an approved session identifier during first-party SSO", () => {
    expect(sdkSource).toContain("sessionId: options.sessionId ??");
    expect(ssoRouteSource).toContain("sessionId: session.sessionId ?? null");
    expect(ssoRouteSource).toContain("sessionId: row.sessionId");
    expect(ssoExchangeSource).toContain("sessionId: row.sessionId");
    expect(ssoExchangeSource).toContain("redeemed.sessionId");
  });
});
