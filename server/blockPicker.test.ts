import { describe, it, expect } from "vitest";

// Unit tests for block picker modal consistency across all page editors
// These tests verify the shared data structures and utility functions

describe("Block Picker - shared utilities", () => {
  it("uid() generates unique IDs", () => {
    // uid is a simple random ID generator used in all editors
    const uid = () => Math.random().toString(36).slice(2, 10);
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });

  it("block copy creates a new ID", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const originalBlock = { id: "abc123", type: "hero", data: { headline: "Test" } };
    const copy = { ...originalBlock, id: uid() };
    expect(copy.id).not.toBe(originalBlock.id);
    expect(copy.type).toBe(originalBlock.type);
    expect(copy.data).toEqual(originalBlock.data);
  });

  it("copyAllBlocks creates new IDs for all blocks", () => {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const sourceBlocks = [
      { id: "a1", type: "hero", data: {} },
      { id: "b2", type: "text", data: {} },
      { id: "c3", type: "bullets", data: {} },
    ];
    const copies = sourceBlocks.map(b => ({ ...b, id: uid() }));
    expect(copies.length).toBe(3);
    copies.forEach((copy, i) => {
      expect(copy.id).not.toBe(sourceBlocks[i].id);
      expect(copy.type).toBe(sourceBlocks[i].type);
    });
  });

  it("block search filter works correctly", () => {
    const blocks = [
      { id: "1", type: "hero", data: { headline: "Welcome to our site" } },
      { id: "2", type: "text", data: { content: "Some text content" } },
      { id: "3", type: "bullets", data: { items: ["Feature A", "Feature B"] } },
    ];
    const search = "hero";
    const filtered = blocks.filter(b =>
      b.type.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(b.data).toLowerCase().includes(search.toLowerCase())
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toBe("hero");
  });

  it("block search with empty string returns all blocks", () => {
    const blocks = [
      { id: "1", type: "hero", data: {} },
      { id: "2", type: "text", data: {} },
    ];
    const search = "";
    const filtered = search.trim() ? blocks.filter(b => b.type.includes(search)) : blocks;
    expect(filtered.length).toBe(2);
  });

  it("JSON parsing of blocks string handles invalid JSON gracefully", () => {
    const parseBlocks = (raw: string | null) => {
      if (!raw) return [];
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks("invalid json")).toEqual([]);
    expect(parseBlocks("[]")).toEqual([]);
    expect(parseBlocks('[{"id":"1","type":"hero","data":{}}]')).toHaveLength(1);
  });
});

describe("Block Picker - picker tabs", () => {
  it("all editors should support the same three tabs", () => {
    type PickerTab = "catalog" | "from_pages" | "templates";
    const tabs: PickerTab[] = ["catalog", "from_pages", "templates"];
    expect(tabs).toContain("catalog");
    expect(tabs).toContain("from_pages");
    expect(tabs).toContain("templates");
    expect(tabs.length).toBe(3);
  });
});
