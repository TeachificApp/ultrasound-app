import { describe, it, expect } from "vitest";
import {
  getSsoBridgeOrigins,
  hostnameNeedsSsoBridge,
  SSO_BRIDGE_ORIGINS,
} from "../shared/ssoBridgeDomains";

describe("ssoBridgeDomains", () => {
  it("tries learn before app.allaboutultrasound.com", () => {
    expect(SSO_BRIDGE_ORIGINS[0]).toBe("https://learn.allaboutultrasound.com");
    expect(SSO_BRIDGE_ORIGINS[1]).toBe("https://app.allaboutultrasound.com");
  });

  it("bridges app.allaboutultrasound.com from learn only (not self)", () => {
    expect(getSsoBridgeOrigins("app.allaboutultrasound.com")).toEqual([
      "https://learn.allaboutultrasound.com",
    ]);
    expect(hostnameNeedsSsoBridge("app.allaboutultrasound.com")).toBe(true);
  });

  it("bridges iHeartEcho from learn then AAU app", () => {
    expect(getSsoBridgeOrigins("app.iheartecho.com")).toEqual([
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
});
