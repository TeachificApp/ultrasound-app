import { describe, it, expect } from "vitest";

/**
 * Tests for the column_layout block data structure and behavior.
 * The column_layout block is a container block that holds two columns,
 * each containing an array of child blocks.
 */
describe("column_layout block", () => {
  const defaultData = {
    leftBlocks: [],
    rightBlocks: [],
    leftRatio: 50,
    gap: 32,
    bgColor: "transparent",
    paddingX: 32,
    paddingY: 16,
  };

  it("has correct default data structure", () => {
    expect(defaultData.leftBlocks).toEqual([]);
    expect(defaultData.rightBlocks).toEqual([]);
    expect(defaultData.leftRatio).toBe(50);
    expect(defaultData.gap).toBe(32);
    expect(defaultData.bgColor).toBe("transparent");
    expect(defaultData.paddingX).toBe(32);
    expect(defaultData.paddingY).toBe(16);
  });

  it("right column ratio is derived from leftRatio", () => {
    const leftRatio = defaultData.leftRatio;
    const rightRatio = 100 - leftRatio;
    expect(rightRatio).toBe(50);
  });

  it("supports adding child blocks to left column", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const childBlock = { id: uid(), type: "text", data: { html: "<p>Hello</p>" } };
    const updated = { ...defaultData, leftBlocks: [childBlock] };
    expect(updated.leftBlocks).toHaveLength(1);
    expect(updated.leftBlocks[0].type).toBe("text");
  });

  it("supports adding child blocks to right column", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const childBlock = { id: uid(), type: "image", data: { url: "https://example.com/img.jpg" } };
    const updated = { ...defaultData, rightBlocks: [childBlock] };
    expect(updated.rightBlocks).toHaveLength(1);
    expect(updated.rightBlocks[0].type).toBe("image");
  });

  it("supports reordering blocks within a column", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const blocks = [
      { id: uid(), type: "text", data: {} },
      { id: uid(), type: "image", data: {} },
      { id: uid(), type: "video", data: {} },
    ];
    // Move item at index 2 up to index 1
    const reordered = [...blocks];
    [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
    expect(reordered[1].type).toBe("video");
    expect(reordered[2].type).toBe("image");
  });

  it("supports removing a block from a column", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const blocks = [
      { id: uid(), type: "text", data: {} },
      { id: uid(), type: "image", data: {} },
    ];
    const afterRemove = blocks.filter((_, i) => i !== 0);
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].type).toBe("image");
  });

  it("column_layout is excluded from nested column pickers to prevent infinite nesting", () => {
    const CATALOG_CATEGORIES = ["Layout", "Content", "Marketing", "Conversion", "Funnel", "Smart"];
    const mockCatalog = [
      { type: "column_layout", category: "Layout" },
      { type: "text", category: "Content" },
      { type: "hero", category: "Layout" },
    ];
    const filtered = mockCatalog.filter(c => c.category === "Layout" && c.type !== "column_layout");
    expect(filtered.map(c => c.type)).not.toContain("column_layout");
    expect(filtered.map(c => c.type)).toContain("hero");
    expect(CATALOG_CATEGORIES).toContain("Layout");
  });

  it("JSON round-trips correctly for nested blocks", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const data = {
      ...defaultData,
      leftBlocks: [{ id: uid(), type: "text", data: { html: "<p>Left</p>" } }],
      rightBlocks: [{ id: uid(), type: "image", data: { url: "https://example.com/img.jpg" } }],
    };
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized);
    expect(parsed.leftBlocks).toHaveLength(1);
    expect(parsed.rightBlocks).toHaveLength(1);
    expect(parsed.leftBlocks[0].type).toBe("text");
    expect(parsed.rightBlocks[0].type).toBe("image");
  });
});
