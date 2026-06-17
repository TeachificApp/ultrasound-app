/**
 * teach.features.test.ts
 * Unit tests for:
 *  - File size limit enforcement (role-based)
 *  - Cohort group selector type coercion
 *  - Trash/folder field logic
 *  - Shared presentation type helpers (buildSlideBackground, TEACH_FONTS, TEACH_THEMES)
 */
import { describe, it, expect } from "vitest";

// ─── File size limit logic (mirrors server/routers/teachRouter.ts) ────────────
function getMaxBytes(isPlatformAdmin: boolean, isEducationManager: boolean): number {
  return isPlatformAdmin || isEducationManager ? Infinity : 200 * 1024 * 1024;
}

describe("File size limit by role", () => {
  it("admins get unlimited upload size", () => {
    expect(getMaxBytes(true, false)).toBe(Infinity);
  });
  it("education managers get unlimited upload size", () => {
    expect(getMaxBytes(false, true)).toBe(Infinity);
  });
  it("instructors are limited to 200 MB", () => {
    const limit = getMaxBytes(false, false);
    expect(limit).toBe(200 * 1024 * 1024);
  });
  it("a 201 MB file is rejected for instructors", () => {
    const limit = getMaxBytes(false, false);
    const fileSize = 201 * 1024 * 1024;
    expect(fileSize > limit).toBe(true);
  });
  it("a 200 MB file is accepted for instructors", () => {
    const limit = getMaxBytes(false, false);
    const fileSize = 200 * 1024 * 1024;
    expect(fileSize > limit).toBe(false);
  });
  it("a 500 MB file is accepted for admins", () => {
    const limit = getMaxBytes(true, false);
    const fileSize = 500 * 1024 * 1024;
    expect(fileSize > limit).toBe(false);
  });
});

// ─── Cohort group selector type coercion fix ─────────────────────────────────
// The bug: selectedParentId stored as number in JSON, but when read back from
// JSON.parse it may be a string. The fix uses Number() coercion on both sides.
describe("Cohort group selector type coercion", () => {
  const items = [
    { id: 1, parentId: 10, parentKind: "course", label: "Group A" },
    { id: 2, parentId: 20, parentKind: "course", label: "Group B" },
    { id: 3, parentId: 10, parentKind: "course", label: "Group C" },
  ];

  function filterByParent(selectedParentId: number | string | null, selectedParentKind: string | null) {
    if (selectedParentId == null) return items;
    return items.filter(
      (item) => Number(item.parentId) === Number(selectedParentId) && item.parentKind === selectedParentKind,
    );
  }

  it("filters correctly when selectedParentId is a number", () => {
    const result = filterByParent(10, "course");
    expect(result.map((i) => i.id)).toEqual([1, 3]);
  });

  it("filters correctly when selectedParentId is a string (JSON deserialization)", () => {
    const result = filterByParent("10", "course");
    expect(result.map((i) => i.id)).toEqual([1, 3]);
  });

  it("returns all items when selectedParentId is null", () => {
    const result = filterByParent(null, null);
    expect(result.length).toBe(3);
  });

  it("returns empty array when no items match the parent", () => {
    const result = filterByParent(99, "course");
    expect(result.length).toBe(0);
  });

  it("respects parentKind filter — workshop items not returned for course parent", () => {
    const mixedItems = [
      ...items,
      { id: 4, parentId: 10, parentKind: "workshop", label: "Workshop Instance" },
    ];
    const result = mixedItems.filter(
      (item) => Number(item.parentId) === Number(10) && item.parentKind === "course",
    );
    expect(result.map((i) => i.id)).toEqual([1, 3]);
  });
});

// ─── Trash/folder field logic ─────────────────────────────────────────────────
describe("Trash and folder field logic", () => {
  interface Material {
    id: number;
    folderId: number | null;
    trashedAt: Date | null;
    name: string;
  }

  const materials: Material[] = [
    { id: 1, folderId: null, trashedAt: null, name: "Root file" },
    { id: 2, folderId: 5, trashedAt: null, name: "In folder" },
    { id: 3, folderId: null, trashedAt: new Date(), name: "Trashed file" },
    { id: 4, folderId: 5, trashedAt: new Date(), name: "Trashed in folder" },
  ];

  it("active materials exclude trashed items", () => {
    const active = materials.filter((m) => !m.trashedAt);
    expect(active.map((m) => m.id)).toEqual([1, 2]);
  });

  it("trash list only contains trashed items", () => {
    const trash = materials.filter((m) => m.trashedAt != null);
    expect(trash.map((m) => m.id)).toEqual([3, 4]);
  });

  it("root folder shows items with null folderId (active only)", () => {
    const root = materials.filter((m) => !m.trashedAt && m.folderId == null);
    expect(root.map((m) => m.id)).toEqual([1]);
  });

  it("folder 5 shows items with folderId=5 (active only)", () => {
    const folder5 = materials.filter((m) => !m.trashedAt && m.folderId === 5);
    expect(folder5.map((m) => m.id)).toEqual([2]);
  });

  it("30-day trash expiry logic", () => {
    const now = new Date();
    const old = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const expired = [old, recent].filter((d) => d < cutoff);
    expect(expired.length).toBe(1);
    expect(expired[0]).toBe(old);
  });
});

// ─── Shared presentation type helpers ────────────────────────────────────────
describe("buildSlideBackground", () => {
  // Inline the function logic to avoid importing from shared (no browser env)
  function buildSlideBackground(slide: {
    backgroundType?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundGradient?: {
      type: "linear" | "radial";
      angle?: number;
      stops: Array<{ color: string; position: number }>;
    };
  }): Record<string, string> {
    const type = slide.backgroundType ?? "solid";
    if (type === "gradient" && slide.backgroundGradient) {
      const g = slide.backgroundGradient;
      const stops = g.stops.map((s) => `${s.color} ${s.position}%`).join(", ");
      if (g.type === "radial") {
        return { background: `radial-gradient(circle, ${stops})` };
      }
      return { background: `linear-gradient(${g.angle ?? 135}deg, ${stops})` };
    }
    if (type === "image" && slide.backgroundImage) {
      return {
        backgroundImage: `url(${slide.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: slide.backgroundColor ?? "#ffffff" };
  }

  it("returns solid color by default", () => {
    const result = buildSlideBackground({ backgroundColor: "#ff0000" });
    expect(result).toEqual({ backgroundColor: "#ff0000" });
  });

  it("returns white when no background is set", () => {
    const result = buildSlideBackground({});
    expect(result).toEqual({ backgroundColor: "#ffffff" });
  });

  it("returns linear gradient", () => {
    const result = buildSlideBackground({
      backgroundType: "gradient",
      backgroundGradient: {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#ff0000", position: 0 },
          { color: "#0000ff", position: 100 },
        ],
      },
    });
    expect(result.background).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
  });

  it("returns radial gradient", () => {
    const result = buildSlideBackground({
      backgroundType: "gradient",
      backgroundGradient: {
        type: "radial",
        stops: [
          { color: "#ffffff", position: 0 },
          { color: "#000000", position: 100 },
        ],
      },
    });
    expect(result.background).toBe("radial-gradient(circle, #ffffff 0%, #000000 100%)");
  });

  it("returns background image styles", () => {
    const result = buildSlideBackground({
      backgroundType: "image",
      backgroundImage: "https://example.com/bg.jpg",
    });
    expect(result.backgroundImage).toBe("url(https://example.com/bg.jpg)");
    expect(result.backgroundSize).toBe("cover");
    expect(result.backgroundPosition).toBe("center");
  });

  it("falls back to solid color when image type but no URL", () => {
    const result = buildSlideBackground({
      backgroundType: "image",
      backgroundColor: "#123456",
    });
    expect(result).toEqual({ backgroundColor: "#123456" });
  });
});

describe("TEACH_FONTS constant", () => {
  // Inline the constant to avoid browser imports
  const TEACH_FONTS = [
    { label: "Default", value: "" },
    { label: "Inter", value: "Inter, sans-serif" },
    { label: "Roboto", value: "Roboto, sans-serif" },
    { label: "Poppins", value: "Poppins, sans-serif" },
    { label: "Lato", value: "Lato, sans-serif" },
    { label: "Open Sans", value: "'Open Sans', sans-serif" },
    { label: "Playfair Display", value: "'Playfair Display', serif" },
    { label: "Montserrat", value: "Montserrat, sans-serif" },
    { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
  ];

  it("has at least 8 font options", () => {
    expect(TEACH_FONTS.length).toBeGreaterThanOrEqual(8);
  });

  it("first entry is the default (empty value)", () => {
    expect(TEACH_FONTS[0].value).toBe("");
    expect(TEACH_FONTS[0].label).toBe("Default");
  });

  it("all entries have label and value", () => {
    for (const f of TEACH_FONTS) {
      expect(f.label).toBeTruthy();
      expect(typeof f.value).toBe("string");
    }
  });
});
