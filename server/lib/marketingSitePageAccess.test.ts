import { describe, expect, it } from "vitest";
import { createPublicPageAccessCookie, hasPublicPageAccess, publicPageAccessCookieHeader } from "./marketingSitePageAccess";

describe("marketingSitePageAccess", () => {
  it("accepts only the matching signed page and tenant access cookie", () => {
    const token = createPublicPageAccessCookie(42, "aaus-net");
    expect(hasPublicPageAccess(`public_site_page_access=${token}`, 42, "aaus-net")).toBe(true);
    expect(hasPublicPageAccess(`public_site_page_access=${token}`, 43, "aaus-net")).toBe(false);
    expect(hasPublicPageAccess(`public_site_page_access=${token}`, 42, "iheartecho-net")).toBe(false);
  });

  it("rejects a tampered access token and emits an HTTP-only cookie", () => {
    const token = createPublicPageAccessCookie(42, "aaus-net");
    const tampered = `${token.slice(0, -1)}x`;
    expect(hasPublicPageAccess(`public_site_page_access=${tampered}`, 42, "aaus-net")).toBe(false);
    expect(publicPageAccessCookieHeader(token)).toContain("HttpOnly");
    expect(publicPageAccessCookieHeader(token)).toContain("SameSite=Lax");
  });
});
