import { describe, expect, it } from "vitest";
import { buildPublicSitePageTree, flattenPublicSitePageTree, pageTreeOrder } from "../shared/publicSitePageTree";

describe("publicSitePageTree", () => {
  it("creates an ordered hierarchy and preserves depth-first persistence order", () => {
    const tree = buildPublicSitePageTree([
      { id: 4, parentId: 1, sortOrder: 1, title: "Child B" },
      { id: 2, parentId: null, sortOrder: 2, title: "Second root" },
      { id: 1, parentId: null, sortOrder: 0, title: "First root" },
      { id: 3, parentId: 1, sortOrder: 0, title: "Child A" },
    ]);
    expect(tree.map((node) => node.id)).toEqual([1, 2]);
    expect(tree[0]?.children.map((node) => node.id)).toEqual([3, 4]);
    expect(flattenPublicSitePageTree(tree).map((node) => `${node.id}:${node.depth}`)).toEqual(["1:0", "3:1", "4:1", "2:0"]);
    expect(pageTreeOrder(tree)).toEqual([1, 3, 4, 2]);
  });

  it("keeps orphaned and circular references visible without recursive failure", () => {
    const tree = buildPublicSitePageTree([
      { id: 1, parentId: 2, sortOrder: 0, title: "Cycle A" },
      { id: 2, parentId: 1, sortOrder: 1, title: "Cycle B" },
      { id: 3, parentId: 999, sortOrder: 2, title: "Orphan" },
    ]);
    expect(new Set(flattenPublicSitePageTree(tree).map((node) => node.id))).toEqual(new Set([1, 2, 3]));
  });
});
