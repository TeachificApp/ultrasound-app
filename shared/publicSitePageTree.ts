export type PublicSitePageTreeSource = {
  id: number;
  parentId?: number | null;
  sortOrder?: number | null;
  title?: string | null;
  path?: string | null;
};

export type PublicSitePageTreeNode<T extends PublicSitePageTreeSource> = T & {
  children: PublicSitePageTreeNode<T>[];
  depth: number;
};

/**
 * Builds a resilient page tree from flat tenant pages. Orphaned or circular
 * references remain visible at the root so no page disappears from admin view.
 */
export function buildPublicSitePageTree<T extends PublicSitePageTreeSource>(pages: T[]): PublicSitePageTreeNode<T>[] {
  const sorted = [...pages].sort((a, b) =>
    Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    || String(a.title ?? a.path ?? "").localeCompare(String(b.title ?? b.path ?? "")),
  );
  const byId = new Map<number, PublicSitePageTreeNode<T>>();
  for (const page of sorted) byId.set(page.id, { ...page, children: [], depth: 0 });

  const roots: PublicSitePageTreeNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (!parent || parent.id === node.id) {
      roots.push(node);
      continue;
    }
    // Reject cycles before they enter the tree.
    let cursor: PublicSitePageTreeNode<T> | undefined = parent;
    const visited = new Set<number>([node.id]);
    let cyclic = false;
    while (cursor) {
      if (visited.has(cursor.id)) { cyclic = true; break; }
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    if (cyclic) roots.push(node);
    else parent.children.push(node);
  }

  const applyDepth = (nodes: PublicSitePageTreeNode<T>[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      applyDepth(node.children, depth + 1);
    }
  };
  applyDepth(roots, 0);
  return roots;
}

export function flattenPublicSitePageTree<T extends PublicSitePageTreeSource>(nodes: PublicSitePageTreeNode<T>[]): PublicSitePageTreeNode<T>[] {
  return nodes.flatMap((node) => [node, ...flattenPublicSitePageTree(node.children)]);
}

/** Creates a stable depth-first page order suitable for the persisted sortOrder field. */
export function pageTreeOrder<T extends PublicSitePageTreeSource>(nodes: PublicSitePageTreeNode<T>[]): number[] {
  return flattenPublicSitePageTree(nodes).map((node) => node.id);
}
