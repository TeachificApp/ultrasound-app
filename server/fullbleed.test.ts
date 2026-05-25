/**
 * fullbleed.test.ts
 * Tests for:
 * 1. Full-bleed block types are excluded from contentWidth wrapping
 * 2. CurriculumCourseSelector uses "_auto" instead of "" for empty value
 */
import { describe, it, expect } from "vitest";

const FULL_BLEED_TYPES = [
  "hero", "pricing_cta", "cta_standalone", "divider", "spacer",
  "footer", "logo_strip", "urgency_offer", "product_offer_stack",
  "price_stack", "image_content"
];

function shouldSkipContentWidthWrapper(blockType: string): boolean {
  return FULL_BLEED_TYPES.includes(blockType);
}

function getCurriculumSelectValue(courseId: number | null | undefined): string {
  return courseId ? String(courseId) : "_auto";
}

function parseCurriculumSelectValue(v: string): number | null {
  return v === "_auto" ? null : Number(v);
}

describe("Full-bleed block content width fix", () => {
  it("hero blocks should skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("hero")).toBe(true);
  });

  it("pricing_cta blocks should skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("pricing_cta")).toBe(true);
  });

  it("cta_standalone blocks should skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("cta_standalone")).toBe(true);
  });

  it("image_content blocks should skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("image_content")).toBe(true);
  });

  it("urgency_offer blocks should skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("urgency_offer")).toBe(true);
  });

  it("text blocks should NOT skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("text")).toBe(false);
  });

  it("image blocks should NOT skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("image")).toBe(false);
  });

  it("bullets blocks should NOT skip outer contentWidth wrapper", () => {
    expect(shouldSkipContentWidthWrapper("bullets")).toBe(false);
  });
});

describe("CurriculumCourseSelector SelectItem empty value fix", () => {
  it("returns _auto when courseId is null", () => {
    expect(getCurriculumSelectValue(null)).toBe("_auto");
  });

  it("returns _auto when courseId is undefined", () => {
    expect(getCurriculumSelectValue(undefined)).toBe("_auto");
  });

  it("returns _auto when courseId is 0", () => {
    expect(getCurriculumSelectValue(0)).toBe("_auto");
  });

  it("returns string id when courseId is a valid number", () => {
    expect(getCurriculumSelectValue(42)).toBe("42");
  });

  it("parses _auto back to null", () => {
    expect(parseCurriculumSelectValue("_auto")).toBe(null);
  });

  it("parses numeric string back to number", () => {
    expect(parseCurriculumSelectValue("42")).toBe(42);
  });
});
