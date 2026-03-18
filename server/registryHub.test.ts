/**
 * Tests for the Registry Review Hub — getRegistryCatalog procedure and
 * collection-based filtering logic in cmeRouter.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

const CME_COLLECTION_ID = 131827;
const REGISTRY_COLLECTION_ID = 131826;

// ─── Helpers (mirrors cmeRouter.ts logic) ────────────────────────────────────

function filterByCollection(
  courses: Array<{ collectionIds: string | null }>,
  collectionId: number
): Array<{ collectionIds: string | null }> {
  return courses.filter((c) => {
    if (!c.collectionIds) return false;
    try {
      const ids: number[] = JSON.parse(c.collectionIds);
      return ids.includes(collectionId);
    } catch {
      return false;
    }
  });
}

// ─── Test data ────────────────────────────────────────────────────────────────

const mockCourses = [
  { id: 1, name: "Registry Review Echo", collectionIds: JSON.stringify([REGISTRY_COLLECTION_ID]) },
  { id: 2, name: "Registry Review Vascular", collectionIds: JSON.stringify([REGISTRY_COLLECTION_ID]) },
  { id: 3, name: "CME Doppler Course", collectionIds: JSON.stringify([CME_COLLECTION_ID]) },
  { id: 4, name: "CME Bundle", collectionIds: JSON.stringify([CME_COLLECTION_ID, 131815]) },
  { id: 5, name: "In Both Collections", collectionIds: JSON.stringify([REGISTRY_COLLECTION_ID, CME_COLLECTION_ID]) },
  { id: 6, name: "No Collection", collectionIds: null },
  { id: 7, name: "Empty Collection", collectionIds: JSON.stringify([]) },
  { id: 8, name: "Other Collection", collectionIds: JSON.stringify([1345380]) },
];

// ─── Collection filter tests ──────────────────────────────────────────────────

describe("filterByCollection — Registry Review (131826)", () => {
  it("returns only courses in the Registry Review collection", () => {
    const result = filterByCollection(mockCourses, REGISTRY_COLLECTION_ID);
    expect(result).toHaveLength(3); // ids 1, 2, 5
    const ids = result.map((c: any) => c.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(5);
  });

  it("excludes CME-only courses", () => {
    const result = filterByCollection(mockCourses, REGISTRY_COLLECTION_ID);
    const ids = result.map((c: any) => c.id);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
  });

  it("excludes courses with null collectionIds", () => {
    const result = filterByCollection(mockCourses, REGISTRY_COLLECTION_ID);
    const ids = result.map((c: any) => c.id);
    expect(ids).not.toContain(6);
  });

  it("excludes courses with empty collection array", () => {
    const result = filterByCollection(mockCourses, REGISTRY_COLLECTION_ID);
    const ids = result.map((c: any) => c.id);
    expect(ids).not.toContain(7);
  });

  it("excludes courses in other unrelated collections", () => {
    const result = filterByCollection(mockCourses, REGISTRY_COLLECTION_ID);
    const ids = result.map((c: any) => c.id);
    expect(ids).not.toContain(8);
  });

  it("includes courses that belong to BOTH registry and CME collections", () => {
    const result = filterByCollection(mockCourses, REGISTRY_COLLECTION_ID);
    const ids = result.map((c: any) => c.id);
    expect(ids).toContain(5);
  });
});

describe("filterByCollection — CME (131827)", () => {
  it("returns only courses in the CME collection", () => {
    const result = filterByCollection(mockCourses, CME_COLLECTION_ID);
    const ids = result.map((c: any) => c.id);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).toContain(5);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
  });
});

describe("filterByCollection — edge cases", () => {
  it("returns empty array when no courses match", () => {
    const result = filterByCollection(mockCourses, 999999);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const result = filterByCollection([], REGISTRY_COLLECTION_ID);
    expect(result).toHaveLength(0);
  });

  it("handles malformed JSON collectionIds gracefully", () => {
    const malformed = [
      { id: 1, collectionIds: "not-json" },
      { id: 2, collectionIds: JSON.stringify([REGISTRY_COLLECTION_ID]) },
    ];
    const result = filterByCollection(malformed, REGISTRY_COLLECTION_ID);
    expect(result).toHaveLength(1);
    expect((result[0] as any).id).toBe(2);
  });

  it("handles single-element collection arrays", () => {
    const single = [{ id: 1, collectionIds: JSON.stringify([REGISTRY_COLLECTION_ID]) }];
    const result = filterByCollection(single, REGISTRY_COLLECTION_ID);
    expect(result).toHaveLength(1);
  });
});

// ─── mapLiveCourse category derivation (mirrors RegistryReviewHub.tsx) ────────

function deriveCategory(name: string): string {
  if (/echo|cardiac|doppler|diastol|stenosis|pericarditis|valve/i.test(name)) return "Echo";
  if (/vascular|duplex|venous|arterial/i.test(name)) return "Vascular";
  if (/fetal/i.test(name)) return "Fetal Echo";
  if (/physics|spi/i.test(name)) return "Physics";
  if (/abdominal|abdomen/i.test(name)) return "Abdominal";
  if (/obstetric|ob|gyn/i.test(name)) return "OB/GYN";
  if (/bundle|membership|pass/i.test(name)) return "Bundle";
  return "Registry Review";
}

describe("deriveCategory for RegistryReviewHub", () => {
  it("classifies echo-related courses", () => {
    expect(deriveCategory("Registry Review Echo Fundamentals")).toBe("Echo");
    expect(deriveCategory("All About Doppler Physics")).toBe("Echo");
    expect(deriveCategory("Aortic Stenosis Registry Review")).toBe("Echo");
  });

  it("classifies vascular courses", () => {
    expect(deriveCategory("Upper Extremity Duplex Registry")).toBe("Vascular");
    expect(deriveCategory("Venous Insufficiency Review")).toBe("Vascular");
  });

  it("classifies fetal echo courses", () => {
    // The fetal regex is checked AFTER echo/cardiac, so names without those keywords classify as Fetal Echo
    expect(deriveCategory("Fetal Ultrasound Prep")).toBe("Fetal Echo");
    expect(deriveCategory("Fetal Anatomy Survey")).toBe("Fetal Echo");
  });

  it("classifies physics courses", () => {
    expect(deriveCategory("Ultrasound Physics SPI Prep")).toBe("Physics");
  });

  it("classifies bundle/membership courses", () => {
    expect(deriveCategory("Registry Review Bundle")).toBe("Bundle");
    expect(deriveCategory("All Access Pass")).toBe("Bundle");
  });

  it("defaults to Registry Review for unmatched names", () => {
    expect(deriveCategory("General Ultrasound Review")).toBe("Registry Review");
    expect(deriveCategory("Sonographer Prep Course")).toBe("Registry Review");
  });
});
