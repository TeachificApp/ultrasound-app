/**
 * Tests for the funnel flow diagram layout algorithm.
 * These tests verify the layout computation logic extracted from FunnelFlowDiagram.tsx.
 */
import { describe, it, expect } from "vitest";

// ─── Replicated layout types and constants (mirrors FunnelFlowDiagram.tsx) ───

const NODE_W = 200;
const NODE_H = 72;
const H_GAP = 80;
const V_GAP = 40;
const CANVAS_PAD = 60;

interface BranchRule {
  id: number;
  name: string;
  isActive: boolean;
  targetPageId: number | null;
  targetUrl: string | null;
  matchMode: string;
  conditions: { id: number; variable: string; operator: string; value: string }[];
}

interface DiagramPage {
  id: number;
  title: string;
  pageType: string;
  slug: string;
  nextPageId: number | null;
  isHidden: boolean;
  isStandaloneLanding: boolean;
  isActive: boolean;
  views: number;
  conversions: number;
  branchRules: BranchRule[];
}

interface LayoutNode { id: number; x: number; y: number; page: DiagramPage; }
interface LayoutEdge { fromId: number; toId: number; label: string; color: string; isDashed: boolean; ruleId?: number; }

const BRANCH_COLORS = ["#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f97316", "#6366f1"];

function computeLayout(pages: DiagramPage[]): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  if (pages.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const pageMap = new Map(pages.map(p => [p.id, p]));

  const inDegree = new Map<number, number>();
  pages.forEach(p => inDegree.set(p.id, 0));
  pages.forEach(p => {
    if (p.nextPageId && pageMap.has(p.nextPageId)) {
      inDegree.set(p.nextPageId, (inDegree.get(p.nextPageId) ?? 0) + 1);
    }
    p.branchRules.forEach(r => {
      if (r.targetPageId && pageMap.has(r.targetPageId)) {
        inDegree.set(r.targetPageId, (inDegree.get(r.targetPageId) ?? 0) + 1);
      }
    });
  });

  const layer = new Map<number, number>();
  const queue: number[] = [];
  pages.forEach(p => {
    if ((inDegree.get(p.id) ?? 0) === 0) { layer.set(p.id, 0); queue.push(p.id); }
  });
  if (queue.length === 0 && pages.length > 0) {
    layer.set(pages[0].id, 0);
    queue.push(pages[0].id);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const p = pageMap.get(id)!;
    const currentLayer = layer.get(id) ?? 0;
    const targets: number[] = [];
    if (p.nextPageId && pageMap.has(p.nextPageId)) targets.push(p.nextPageId);
    p.branchRules.forEach(r => { if (r.targetPageId && pageMap.has(r.targetPageId)) targets.push(r.targetPageId); });
    targets.forEach(tid => {
      const existing = layer.get(tid);
      if (existing === undefined || existing < currentLayer + 1) {
        layer.set(tid, currentLayer + 1);
        queue.push(tid);
      }
    });
  }

  let maxLayer = 0;
  layer.forEach(l => { if (l > maxLayer) maxLayer = l; });
  pages.forEach(p => { if (!layer.has(p.id)) { layer.set(p.id, maxLayer + 1); } });

  const layerGroups = new Map<number, number[]>();
  layer.forEach((l, id) => {
    if (!layerGroups.has(l)) layerGroups.set(l, []);
    layerGroups.get(l)!.push(id);
  });

  const nodes: LayoutNode[] = [];
  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
  let maxNodesInLayer = 0;
  sortedLayers.forEach(l => { const cnt = layerGroups.get(l)!.length; if (cnt > maxNodesInLayer) maxNodesInLayer = cnt; });

  sortedLayers.forEach(l => {
    const ids = layerGroups.get(l)!;
    const totalH = ids.length * NODE_H + (ids.length - 1) * V_GAP;
    const startY = CANVAS_PAD + (maxNodesInLayer * (NODE_H + V_GAP) - totalH) / 2;
    ids.forEach((id, i) => {
      nodes.push({
        id,
        x: CANVAS_PAD + l * (NODE_W + H_GAP),
        y: startY + i * (NODE_H + V_GAP),
        page: pageMap.get(id)!,
      });
    });
  });

  const edges: LayoutEdge[] = [];
  pages.forEach(p => {
    if (p.nextPageId && pageMap.has(p.nextPageId)) {
      edges.push({ fromId: p.id, toId: p.nextPageId, label: "Default", color: "#94a3b8", isDashed: true });
    }
    p.branchRules.forEach((rule, ri) => {
      if (rule.targetPageId && pageMap.has(rule.targetPageId)) {
        const color = BRANCH_COLORS[ri % BRANCH_COLORS.length];
        const condSummary = rule.conditions.length > 0
          ? rule.conditions.slice(0, 2).map(c => `${c.variable.replace(/_/g, " ")} ${c.operator}`).join(", ")
          : "Always";
        edges.push({ fromId: p.id, toId: rule.targetPageId, label: rule.name || condSummary, color, isDashed: false, ruleId: rule.id });
      }
    });
  });

  const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + CANVAS_PAD;
  const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + CANVAS_PAD;

  return { nodes, edges, width: maxX, height: maxY };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePage(id: number, nextPageId: number | null = null, branchRules: BranchRule[] = []): DiagramPage {
  return {
    id, title: `Page ${id}`, pageType: "landing", slug: `page-${id}`,
    nextPageId, isHidden: false, isStandaloneLanding: false, isActive: true,
    views: 0, conversions: 0, branchRules,
  };
}

function makeRule(id: number, targetPageId: number | null, name = "Rule"): BranchRule {
  return { id, name, isActive: true, targetPageId, targetUrl: null, matchMode: "all", conditions: [] };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeLayout", () => {
  it("returns empty layout for empty pages array", () => {
    const { nodes, edges, width, height } = computeLayout([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
    expect(width).toBe(0);
    expect(height).toBe(0);
  });

  it("places a single page at the canvas padding offset", () => {
    const { nodes } = computeLayout([makePage(1)]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].x).toBe(CANVAS_PAD);
    expect(nodes[0].y).toBe(CANVAS_PAD);
  });

  it("assigns sequential layers for a linear chain", () => {
    // 1 → 2 → 3
    const pages = [makePage(1, 2), makePage(2, 3), makePage(3)];
    const { nodes } = computeLayout(pages);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    expect(nodeMap.get(1)!.x).toBe(CANVAS_PAD);
    expect(nodeMap.get(2)!.x).toBe(CANVAS_PAD + (NODE_W + H_GAP));
    expect(nodeMap.get(3)!.x).toBe(CANVAS_PAD + 2 * (NODE_W + H_GAP));
  });

  it("creates a default edge for nextPageId connections", () => {
    const pages = [makePage(1, 2), makePage(2)];
    const { edges } = computeLayout(pages);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ fromId: 1, toId: 2, isDashed: true, label: "Default" });
  });

  it("creates a solid edge for branch rule connections", () => {
    const rule = makeRule(10, 2, "VIP Path");
    const pages = [makePage(1, null, [rule]), makePage(2)];
    const { edges } = computeLayout(pages);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ fromId: 1, toId: 2, isDashed: false, label: "VIP Path", ruleId: 10 });
  });

  it("creates both default and branch edges when both are present", () => {
    const rule = makeRule(10, 3, "Upsell");
    const pages = [makePage(1, 2, [rule]), makePage(2), makePage(3)];
    const { edges } = computeLayout(pages);
    expect(edges).toHaveLength(2);
    const dashed = edges.find(e => e.isDashed);
    const solid = edges.find(e => !e.isDashed);
    expect(dashed).toBeDefined();
    expect(solid).toBeDefined();
    expect(dashed!.toId).toBe(2);
    expect(solid!.toId).toBe(3);
  });

  it("places branch target on a deeper layer than the source", () => {
    const rule = makeRule(10, 3, "Skip");
    const pages = [makePage(1, 2, [rule]), makePage(2), makePage(3)];
    const { nodes } = computeLayout(pages);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    expect(nodeMap.get(1)!.x).toBeLessThan(nodeMap.get(3)!.x);
  });

  it("handles multiple branch rules from the same page", () => {
    const rules = [makeRule(10, 2, "Rule A"), makeRule(11, 3, "Rule B"), makeRule(12, 4, "Rule C")];
    const pages = [makePage(1, null, rules), makePage(2), makePage(3), makePage(4)];
    const { edges } = computeLayout(pages);
    expect(edges).toHaveLength(3);
    // Each rule gets a different color
    const colors = edges.map(e => e.color);
    expect(new Set(colors).size).toBe(3);
  });

  it("assigns 'Always' label for rules with no conditions", () => {
    const rule: BranchRule = { id: 1, name: "", isActive: true, targetPageId: 2, targetUrl: null, matchMode: "all", conditions: [] };
    const pages = [makePage(1, null, [rule]), makePage(2)];
    const { edges } = computeLayout(pages);
    expect(edges[0].label).toBe("Always");
  });

  it("uses rule name as edge label when name is provided", () => {
    const rule = makeRule(1, 2, "My Custom Rule");
    const pages = [makePage(1, null, [rule]), makePage(2)];
    const { edges } = computeLayout(pages);
    expect(edges[0].label).toBe("My Custom Rule");
  });

  it("generates condition summary label when rule has no name but has conditions", () => {
    const rule: BranchRule = {
      id: 1, name: "", isActive: true, targetPageId: 2, targetUrl: null, matchMode: "all",
      conditions: [{ id: 1, variable: "product_purchased", operator: "equals", value: "123" }],
    };
    const pages = [makePage(1, null, [rule]), makePage(2)];
    const { edges } = computeLayout(pages);
    expect(edges[0].label).toContain("product purchased");
  });

  it("ignores branch rules targeting pages not in the funnel", () => {
    const rule = makeRule(10, 999, "External"); // page 999 not in funnel
    const pages = [makePage(1, 2, [rule]), makePage(2)];
    const { edges } = computeLayout(pages);
    // Only the default edge to page 2 should exist
    expect(edges).toHaveLength(1);
    expect(edges[0].isDashed).toBe(true);
  });

  it("handles disconnected pages (no in-edges) by placing them in layer 0", () => {
    // Pages 1 and 2 are both roots (no incoming edges)
    const pages = [makePage(1, 3), makePage(2, 3), makePage(3)];
    const { nodes } = computeLayout(pages);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    // Both 1 and 2 should be in layer 0 (same x)
    expect(nodeMap.get(1)!.x).toBe(nodeMap.get(2)!.x);
    expect(nodeMap.get(3)!.x).toBeGreaterThan(nodeMap.get(1)!.x);
  });

  it("produces non-overlapping y positions for nodes in the same layer", () => {
    const pages = [makePage(1, 3), makePage(2, 3), makePage(3)];
    const { nodes } = computeLayout(pages);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const y1 = nodeMap.get(1)!.y;
    const y2 = nodeMap.get(2)!.y;
    expect(Math.abs(y1 - y2)).toBeGreaterThanOrEqual(NODE_H + V_GAP);
  });

  it("produces positive width and height for non-empty layouts", () => {
    const pages = [makePage(1, 2), makePage(2, 3), makePage(3)];
    const { width, height } = computeLayout(pages);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("handles a cycle (page pointing back to itself) without infinite loop", () => {
    // Page 1 → 2 → 1 (cycle)
    const pages = [makePage(1, 2), makePage(2, 1)];
    expect(() => computeLayout(pages)).not.toThrow();
    const { nodes } = computeLayout(pages);
    expect(nodes).toHaveLength(2);
  });

  it("handles a funnel with only one page and no connections", () => {
    const { nodes, edges } = computeLayout([makePage(42)]);
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
    expect(nodes[0].id).toBe(42);
  });

  it("assigns branch rule colors cycling through BRANCH_COLORS", () => {
    const rules = Array.from({ length: 8 }, (_, i) => makeRule(i + 1, i + 2, `Rule ${i}`));
    const targets = Array.from({ length: 8 }, (_, i) => makePage(i + 2));
    const pages = [makePage(1, null, rules), ...targets];
    const { edges } = computeLayout(pages);
    expect(edges[0].color).toBe(BRANCH_COLORS[0]);
    expect(edges[7].color).toBe(BRANCH_COLORS[7 % BRANCH_COLORS.length]);
  });
});
