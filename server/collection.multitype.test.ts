/**
 * collection.multitype.test.ts
 * Tests for the multi-type collection item resolution logic
 */
import { describe, it, expect } from "vitest";

// ─── Helpers under test (extracted from lmsRouter getCollection) ──────────────

function extractLowestPrice(pricingOptionsJson: string | null | undefined): number {
  try {
    const opts = JSON.parse(pricingOptionsJson ?? "[]");
    return Array.isArray(opts) && opts.length > 0
      ? Math.min(...opts.map((o: any) => Number(o.price || 0)))
      : 0;
  } catch {
    return 0;
  }
}

function mapItemType(itemType: string): string {
  const typeToPath: Record<string, string> = {
    course: "/courses/",
    quiz: "/courses/",
    download: "/downloads/",
    physical: "/product/",
    webinar: "/webinar/",
    bundle: "/bundle/",
    membership: "/membership/",
  };
  return typeToPath[itemType] ?? "/courses/";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Collection multi-type: extractLowestPrice", () => {
  it("returns 0 for null input", () => {
    expect(extractLowestPrice(null)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(extractLowestPrice("[]")).toBe(0);
  });

  it("returns 0 for invalid JSON", () => {
    expect(extractLowestPrice("not-json")).toBe(0);
  });

  it("returns the single price for a single-option array", () => {
    const opts = JSON.stringify([{ id: "opt1", price: 99, label: "Standard" }]);
    expect(extractLowestPrice(opts)).toBe(99);
  });

  it("returns the minimum price for multiple options", () => {
    const opts = JSON.stringify([
      { id: "opt1", price: 199, label: "Premium" },
      { id: "opt2", price: 49, label: "Basic" },
      { id: "opt3", price: 99, label: "Standard" },
    ]);
    expect(extractLowestPrice(opts)).toBe(49);
  });

  it("treats missing price field as 0", () => {
    const opts = JSON.stringify([{ id: "opt1", label: "Free tier" }]);
    expect(extractLowestPrice(opts)).toBe(0);
  });
});

describe("Collection multi-type: mapItemType to URL path", () => {
  it("maps course to /courses/", () => {
    expect(mapItemType("course")).toBe("/courses/");
  });

  it("maps quiz to /courses/", () => {
    expect(mapItemType("quiz")).toBe("/courses/");
  });

  it("maps download to /downloads/", () => {
    expect(mapItemType("download")).toBe("/downloads/");
  });

  it("maps physical to /product/", () => {
    expect(mapItemType("physical")).toBe("/product/");
  });

  it("maps webinar to /webinar/", () => {
    expect(mapItemType("webinar")).toBe("/webinar/");
  });

  it("maps bundle to /bundle/", () => {
    expect(mapItemType("bundle")).toBe("/bundle/");
  });

  it("maps membership to /membership/", () => {
    expect(mapItemType("membership")).toBe("/membership/");
  });

  it("falls back to /courses/ for unknown types", () => {
    expect(mapItemType("unknown_type")).toBe("/courses/");
  });
});

describe("Collection multi-type: item card label derivation", () => {
  const TYPE_LABELS: Record<string, string> = {
    course: "Course",
    quiz: "Quiz",
    download: "Download",
    physical: "Product",
    webinar: "Webinar",
    bundle: "Bundle",
    membership: "Membership",
  };

  it("all known item types have a label", () => {
    const knownTypes = ["course", "quiz", "download", "physical", "webinar", "bundle", "membership"];
    for (const t of knownTypes) {
      expect(TYPE_LABELS[t]).toBeDefined();
      expect(TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
});
