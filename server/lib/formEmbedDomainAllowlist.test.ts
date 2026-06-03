import { describe, it, expect } from "vitest";
import { domainMatchesPattern, isDomainAllowed, normalizeDomain } from "./formEmbedDomainAllowlist";

describe("formEmbedDomainAllowlist", () => {
  it("normalizes domains", () => {
    expect(normalizeDomain("https://WWW.Example.com:443/path")).toBe("example.com");
  });

  it("matches wildcard domains", () => {
    expect(domainMatchesPattern("learn.allaboutultrasound.com", "*.allaboutultrasound.com")).toBe(true);
    expect(domainMatchesPattern("allaboutultrasound.com", "*.allaboutultrasound.com")).toBe(true);
    expect(domainMatchesPattern("evil.com", "*.allaboutultrasound.com")).toBe(false);
  });

  it("allowlist mode blocks unauthorized hosts", () => {
    expect(isDomainAllowed("iheartecho.com", "allowlist", ["allaboutultrasound.com"])).toBe(false);
    expect(isDomainAllowed("learn.allaboutultrasound.com", "allowlist", ["*.allaboutultrasound.com"])).toBe(true);
    expect(isDomainAllowed("anywhere.com", "all", [])).toBe(true);
  });
});
