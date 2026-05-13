/**
 * Tests for brand detection, brand mode, and brand membership router.
 */
import { describe, it, expect } from "vitest";
import { detectBrandFromHostname, detectBrandMode, getBrandDisplayConfig, type BrandMode } from "../shared/brands";

describe("Brand Detection", () => {
  it("detects AAUS brand from app.allaboutultrasound.com", () => {
    expect(detectBrandFromHostname("app.allaboutultrasound.com")).toBe("aaus");
  });

  it("detects iHeartEcho brand from app.iheartecho.com", () => {
    expect(detectBrandFromHostname("app.iheartecho.com")).toBe("iheartecho");
  });

  it("detects AAUS brand from learn.allaboutultrasound.com", () => {
    expect(detectBrandFromHostname("learn.allaboutultrasound.com")).toBe("aaus");
  });

  it("detects AAUS brand from members.allaboutultrasound.com", () => {
    expect(detectBrandFromHostname("members.allaboutultrasound.com")).toBe("aaus");
  });

  it("defaults to AAUS for unknown hostnames", () => {
    expect(detectBrandFromHostname("localhost")).toBe("aaus");
    expect(detectBrandFromHostname("ultrasound-urcfdrve.manus.space")).toBe("aaus");
  });
});

describe("Brand Mode Detection", () => {
  it("returns 'aaus' mode for app.allaboutultrasound.com", () => {
    expect(detectBrandMode("app.allaboutultrasound.com")).toBe("aaus");
  });

  it("returns 'iheartecho' mode for app.iheartecho.com", () => {
    expect(detectBrandMode("app.iheartecho.com")).toBe("iheartecho");
  });

  it("returns 'combined' mode for learn.allaboutultrasound.com", () => {
    expect(detectBrandMode("learn.allaboutultrasound.com")).toBe("combined");
  });

  it("returns 'combined' mode for members.allaboutultrasound.com", () => {
    expect(detectBrandMode("members.allaboutultrasound.com")).toBe("combined");
  });

  it("returns 'combined' mode for member.allaboutultrasound.com (future)", () => {
    expect(detectBrandMode("member.allaboutultrasound.com")).toBe("combined");
  });

  it("defaults to 'aaus' for unknown hostnames", () => {
    expect(detectBrandMode("localhost")).toBe("aaus");
  });
});

describe("Brand Display Config", () => {
  it("returns AAUS config for aaus mode", () => {
    const config = getBrandDisplayConfig("aaus");
    expect(config.displayName).toBe("All About Ultrasound\u2122");
    expect(config.senderName).toContain("All About Ultrasound");
    expect(config.primaryColor).toBe("#189aa1");
  });

  it("returns iHeartEcho config for iheartecho mode", () => {
    const config = getBrandDisplayConfig("iheartecho");
    expect(config.displayName).toBe("iHeartEcho");
    expect(config.senderName).toContain("iHeartEcho");
    expect(config.primaryColor).toBe("#189aa1");
  });

  it("returns combined config for combined mode", () => {
    const config = getBrandDisplayConfig("combined");
    expect(config.displayName).toContain("All About Ultrasound");
    expect(config.displayName).toContain("iHeartEcho");
    expect(config.senderName).toContain("All About Ultrasound");
  });
});

describe("Brand Membership Router", () => {
  it("brandMembership router is registered in appRouter", async () => {
    const { appRouter } = await import("./routers");
    // Check that the brandMembership router exists
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("brandMembership."))).toBe(true);
  });

  it("brandMembership.getStatus procedure exists", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("brandMembership.getStatus");
  });

  it("brandMembership.createCheckout procedure exists", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("brandMembership.createCheckout");
  });
});
