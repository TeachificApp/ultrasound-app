/**
 * Tests for per-request brand detection via X-App-Brand header.
 *
 * The X-App-Brand header is sent by the frontend headers() callback on every
 * tRPC request, so navigating between -aaus and -ihe admin pages sends the
 * correct brand without a full page reload.
 */
import { describe, it, expect } from "vitest";

/**
 * Inline replica of the brand-detection logic from server/_core/context.ts.
 * Keep in sync if the production logic changes.
 */
function detectEffectiveBrand(
  appBrandHeader: string,
  brandQueryParam: string,
  hostname: string,
): "iheartecho" | "aaus" {
  const effectiveBrandSignal = appBrandHeader || brandQueryParam;
  if (effectiveBrandSignal === "iheartecho") return "iheartecho";
  if (effectiveBrandSignal === "aaus") return "aaus";
  // Hostname fallback
  const h = hostname.toLowerCase();
  if (h.includes("iheartecho")) return "iheartecho";
  if (h.includes("allaboutultrasound") || h.includes("aaus")) return "aaus";
  return "aaus"; // default
}

describe("Brand detection — X-App-Brand header (per-request)", () => {
  it("X-App-Brand=iheartecho overrides _brand=aaus query param", () => {
    expect(detectEffectiveBrand("iheartecho", "aaus", "app.allaboutultrasound.com")).toBe("iheartecho");
  });

  it("X-App-Brand=aaus overrides _brand=iheartecho query param", () => {
    expect(detectEffectiveBrand("aaus", "iheartecho", "app.iheartecho.com")).toBe("aaus");
  });

  it("Falls back to _brand query param when X-App-Brand is absent", () => {
    expect(detectEffectiveBrand("", "iheartecho", "app.allaboutultrasound.com")).toBe("iheartecho");
  });

  it("Falls back to hostname when both header and query param are absent", () => {
    expect(detectEffectiveBrand("", "", "app.iheartecho.com")).toBe("iheartecho");
  });

  it("Defaults to aaus when no signal is present", () => {
    expect(detectEffectiveBrand("", "", "localhost")).toBe("aaus");
  });

  it("X-App-Brand=iheartecho on /admin/quickfire-ihe path resolves correctly", () => {
    // Simulates an admin on app.allaboutultrasound.com navigating to /admin/quickfire-ihe
    // The headers() callback sends X-App-Brand=iheartecho for that path
    expect(detectEffectiveBrand("iheartecho", "aaus", "app.allaboutultrasound.com")).toBe("iheartecho");
  });
});
