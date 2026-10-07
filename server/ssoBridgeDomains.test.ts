import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  getSsoBridgeOrigins,
  hostnameNeedsSsoBridge,
  SSO_BRIDGE_ORIGINS,
} from "../shared/ssoBridgeDomains";

describe("ssoBridgeDomains", () => {
  it("tries learn before app.allaboutultrasound.com", () => {
    expect(SSO_BRIDGE_ORIGINS[0]).toBe("https://learn.allaboutultrasound.com");
    expect(SSO_BRIDGE_ORIGINS[1]).toBe("https://learn.iheartecho.com");
    expect(SSO_BRIDGE_ORIGINS[2]).toBe("https://app.allaboutultrasound.com");
  });

  it("bridges app.allaboutultrasound.com from learn only (not self)", () => {
    expect(getSsoBridgeOrigins("app.allaboutultrasound.com")).toEqual([
      "https://learn.allaboutultrasound.com",
    ]);
    expect(hostnameNeedsSsoBridge("app.allaboutultrasound.com")).toBe(true);
  });

  it("bridges iHeartEcho from its matching Learn mirror, then the shared Learn and app fallbacks", () => {
    expect(getSsoBridgeOrigins("app.iheartecho.com")).toEqual([
      "https://learn.iheartecho.com",
      "https://learn.allaboutultrasound.com",
      "https://app.allaboutultrasound.com",
    ]);
    expect(hostnameNeedsSsoBridge("app.iheartecho.com")).toBe(true);
  });

  it("does not bridge from learn (learn is a bridge host)", () => {
    expect(hostnameNeedsSsoBridge("learn.allaboutultrasound.com")).toBe(false);
    expect(getSsoBridgeOrigins("learn.allaboutultrasound.com")).toEqual([
      "https://app.allaboutultrasound.com",
    ]);
  });

  it("uses the existing AAUS Learn session before the app fallback on iHeart Learn", () => {
    expect(hostnameNeedsSsoBridge("learn.iheartecho.com")).toBe(true);
    expect(getSsoBridgeOrigins("learn.iheartecho.com")).toEqual([
      "https://learn.allaboutultrasound.com",
      "https://app.allaboutultrasound.com",
    ]);
  });

  it("includes iHeart Learn in the silent SSO broadcast targets", () => {
    const source = readFileSync("client/src/hooks/useCrossDomainSso.ts", "utf8");
    expect(source).toContain('"https://learn.iheartecho.com"');
  });
});
