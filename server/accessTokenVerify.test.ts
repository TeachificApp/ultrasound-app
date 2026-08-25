import { describe, expect, it } from "vitest";
import { resolveAccessRedirectUrl } from "./lib/accessTokenVerify";

describe("resolveAccessRedirectUrl", () => {
  it("defaults to my-dashboard with auth_pending", () => {
    expect(resolveAccessRedirectUrl(undefined)).toBe("/my-dashboard?auth_pending=1");
  });

  it("allows relative paths", () => {
    expect(resolveAccessRedirectUrl("/courses/foo/player")).toBe(
      "/courses/foo/player?auth_pending=1",
    );
  });

  it("allows full learn URLs from enrollment emails", () => {
    const result = resolveAccessRedirectUrl(
      "https://learn.allaboutultrasound.com/courses/abc/player",
    );
    expect(result).toBe(
      "https://learn.allaboutultrasound.com/courses/abc/player?auth_pending=1",
    );
  });

  it("rejects external URLs", () => {
    expect(resolveAccessRedirectUrl("https://evil.example/phish")).toBe(
      "/my-dashboard?auth_pending=1",
    );
  });
});
