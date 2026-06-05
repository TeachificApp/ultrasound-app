import { describe, expect, it } from "vitest";
import {
  detectBrandFromPath,
  stripBrandTag,
  withBrandTag,
  PER_BRAND_ADMIN_BASE_PATHS,
} from "@shared/brandScopedRoutes";

describe("brandScopedRoutes", () => {
  it("appends brand tags to admin paths", () => {
    expect(withBrandTag("/admin/quickfire", "aaus")).toBe("/admin/quickfire-aaus");
    expect(withBrandTag("/admin/quickfire", "iheartecho")).toBe("/admin/quickfire-ihe");
    expect(withBrandTag("/admin/cases-aaus", "iheartecho")).toBe("/admin/cases-ihe");
  });

  it("detects brand from path suffix", () => {
    expect(detectBrandFromPath("/admin/quickfire-ihe")).toBe("iheartecho");
    expect(detectBrandFromPath("/quickfire-aaus")).toBe("aaus");
    expect(detectBrandFromPath("/admin/cases")).toBeNull();
  });

  it("strips brand tags", () => {
    expect(stripBrandTag("/admin/navigator-ihe")).toBe("/admin/navigator");
    expect(stripBrandTag("/soundbytes-aaus")).toBe("/soundbytes");
  });

  it("lists all per-brand admin tools", () => {
    expect(PER_BRAND_ADMIN_BASE_PATHS).toContain("/admin/quickfire");
    expect(PER_BRAND_ADMIN_BASE_PATHS).toContain("/admin/soundbytes");
  });
});
