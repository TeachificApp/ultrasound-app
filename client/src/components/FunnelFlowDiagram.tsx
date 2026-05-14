/**
 * FunnelFlowDiagram.tsx
 * Visual flow diagram for funnel pages and branch rules.
 * Renders pages as nodes and connections as labeled arrows using pure SVG.
 * Supports pan/zoom and node click to navigate to the page editor.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchCondition {
  id: number;
  variable: string;
  operator: string;
  value: string;
}

interface BranchRule {
  id: number;
  name: string;
  isActive: boolean;
  targetPageId: number | null;
  targetUrl: string | null;
  matchMode: string;
  conditions: BranchCondition[];
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

// ─── Layout Constants ─────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 72;
const H_GAP = 80;   // horizontal gap between columns
const V_GAP = 40;   // vertical gap between nodes in same column
const CANVAS_PAD = 60;

// ─── Page Type Colors ─────────────────────────────────────────────────────────

const PAGE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  landing:   { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", badge: "#3b82f6" },
  checkout:  { bg: "#f0fdf4", border: "#22c55e", text: "#15803d", badge: "#22c55e" },
  upsell:    { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", badge: "#a855f7" },
  downsell:  { bg: "#fff7ed", border: "#f97316", text: "#c2410c", badge: "#f97316" },
  thank_you: { bg: "#f0fdfa", border: "#14b8a6", text: "#0f766e", badge: "#14b8a6" },
  custom:    { bg: "#f9fafb", border: "#6b7280", text: "#374151", badge: "#6b7280" },
};

const PAGE_LABELS: Record<string, string> = {
  landing: "Landing", checkout: "Checkout", upsell: "Upsell",
  downsell: "Downsell", thank_you: "Thank You", custom: "Custom",
};

// ─── Edge Label Colors ────────────────────────────────────────────────────────

const BRANCH_COLORS = [
  "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f97316", "#6366f1",
];

// ─── Layout Algorithm ─────────────────────────────────────────────────────────
// Simple top-down layered layout (Sugiyama-style, single pass)

interface LayoutNode {
  id: number;
  x: number;
  y: number;
  page: DiagramPage;
}

interface LayoutEdge {
  fromId: number;
  toId: number;
  label: string;
  color: string;
  isDashed: boolean; // dashed = default next, solid = branch rule
  ruleId?: number;
}

function computeLayout(pages: DiagramPage[]): { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number } {
  if (pages.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const pageMap = new Map(pages.map(p => [p.id, p]));

  // Assign layers using BFS from pages with no incoming default edges
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

  // BFS layering
  const layer = new Map<number, number>();
  const queue: number[] = [];
  pages.forEach(p => {
    if ((inDegree.get(p.id) ?? 0) === 0) { layer.set(p.id, 0); queue.push(p.id); }
  });
  // Fallback: if all have in-degree > 0 (cycle), start from first page
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

  // Assign pages without layer (disconnected)
  let maxLayer = 0;
  layer.forEach(l => { if (l > maxLayer) maxLayer = l; });
  pages.forEach(p => { if (!layer.has(p.id)) { layer.set(p.id, maxLayer + 1); } });

  // Group by layer
  const layerGroups = new Map<number, number[]>();
  layer.forEach((l, id) => {
    if (!layerGroups.has(l)) layerGroups.set(l, []);
    layerGroups.get(l)!.push(id);
  });

  // Compute positions
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

  // Build edges
  const edges: LayoutEdge[] = [];
  pages.forEach(p => {
    // Default next-page edge (dashed)
    if (p.nextPageId && pageMap.has(p.nextPageId)) {
      edges.push({
        fromId: p.id,
        toId: p.nextPageId,
        label: "Default",
        color: "#94a3b8",
        isDashed: true,
      });
    }
    // Branch rule edges (solid, colored)
    p.branchRules.forEach((rule, ri) => {
      if (rule.targetPageId && pageMap.has(rule.targetPageId)) {
        const color = BRANCH_COLORS[ri % BRANCH_COLORS.length];
        const condSummary = rule.conditions.length > 0
          ? rule.conditions.slice(0, 2).map(c => `${c.variable.replace(/_/g, " ")} ${c.operator}`).join(", ")
          : "Always";
        edges.push({
          fromId: p.id,
          toId: rule.targetPageId,
          label: rule.name || condSummary,
          color,
          isDashed: false,
          ruleId: rule.id,
        });
      }
    });
  });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + CANVAS_PAD;
  const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + CANVAS_PAD;

  return { nodes, edges, width: maxX, height: maxY };
}

// ─── Arrow Path ───────────────────────────────────────────────────────────────

function computeArrowPath(
  fromNode: LayoutNode,
  toNode: LayoutNode,
  edgeIndex: number,
  totalEdges: number,
): string {
  // Exit from right center of source, enter left center of target
  const fx = fromNode.x + NODE_W;
  const fy = fromNode.y + NODE_H / 2 + (edgeIndex - (totalEdges - 1) / 2) * 10;
  const tx = toNode.x;
  const ty = toNode.y + NODE_H / 2;

  if (fromNode.id === toNode.id) {
    // Self-loop
    const cx = fromNode.x + NODE_W / 2;
    const cy = fromNode.y - 40;
    return `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`;
  }

  const dx = tx - fx;
  const dy = ty - fy;
  const cx1 = fx + Math.max(40, dx * 0.4);
  const cy1 = fy;
  const cx2 = tx - Math.max(40, dx * 0.4);
  const cy2 = ty;

  return `M ${fx} ${fy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function EdgeTooltip({ rule, x, y }: { rule: BranchRule; x: number; y: number }) {
  return (
    <foreignObject x={x - 100} y={y - 10} width={200} height={120} style={{ overflow: "visible", pointerEvents: "none" }}>
      <div className="bg-gray-900 text-white text-xs rounded-lg p-2 shadow-xl max-w-[200px]">
        <div className="font-semibold mb-1">{rule.name}</div>
        {rule.conditions.length === 0 ? (
          <div className="text-gray-400">No conditions (always fires)</div>
        ) : (
          rule.conditions.slice(0, 4).map((c, i) => (
            <div key={i} className="text-gray-300">
              {c.variable.replace(/_/g, " ")} <span className="text-yellow-400">{c.operator}</span> {c.value}
            </div>
          ))
        )}
        {rule.conditions.length > 4 && <div className="text-gray-500">+{rule.conditions.length - 4} more</div>}
      </div>
    </foreignObject>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface FunnelFlowDiagramProps {
  funnelId: number;
  onEditPage: (funnelId: number, pageId: number) => void;
}

export function FunnelFlowDiagram({ funnelId, onEditPage }: FunnelFlowDiagramProps) {
  const { data: pages, isLoading, refetch } = trpc.funnel.getFlowDiagram.useQuery({ funnelId });

  // Pan/zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Hover state for edge tooltips
  const [hoveredEdge, setHoveredEdge] = useState<{ edge: LayoutEdge; mx: number; my: number } | null>(null);

  const layout = useMemo(() => {
    if (!pages) return { nodes: [], edges: [], width: 800, height: 400 };
    return computeLayout(pages as DiagramPage[]);
  }, [pages]);

  // Edge grouping for parallel edges (same source)
  const edgesBySource = useMemo(() => {
    const map = new Map<number, LayoutEdge[]>();
    layout.edges.forEach(e => {
      if (!map.has(e.fromId)) map.set(e.fromId, []);
      map.get(e.fromId)!.push(e);
    });
    return map;
  }, [layout.edges]);

  const nodeMap = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout.nodes]);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || layout.nodes.length === 0) return;
    const svgW = svgRef.current.clientWidth;
    const svgH = svgRef.current.clientHeight;
    const scaleX = svgW / (layout.width + 20);
    const scaleY = svgH / (layout.height + 20);
    const newZoom = Math.min(scaleX, scaleY, 1.5);
    setZoom(newZoom);
    setPan({ x: (svgW - layout.width * newZoom) / 2, y: (svgH - layout.height * newZoom) / 2 });
  }, [layout]);

  useEffect(() => {
    if (layout.nodes.length > 0) {
      setTimeout(handleFitView, 50);
    }
  }, [layout.nodes.length, handleFitView]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest("[data-node]")) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading diagram...
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
        <div className="text-4xl">🗺️</div>
        <p className="text-sm">No pages yet. Add pages to see the flow diagram.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl border border-gray-200 bg-gray-50 overflow-hidden" style={{ height: 520 }}>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1.5">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleFitView}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Fit view"
        >
          <Maximize2 size={14} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button
          onClick={() => refetch()}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
        <span className="text-xs text-gray-400 ml-1">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-white/90 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
          Default next
        </span>
        <span className="flex items-center gap-1">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#f59e0b" strokeWidth="2" /></svg>
          Branch rule
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border border-gray-300 bg-gray-100 opacity-50" />
          Hidden
        </span>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          {/* Arrow markers for each color */}
          {["#94a3b8", ...BRANCH_COLORS].map(color => (
            <marker
              key={color}
              id={`arrow-${color.replace("#", "")}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          ))}
          {/* Dot pattern background */}
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#e2e8f0" />
          </pattern>
        </defs>

        {/* Background dots */}
        <rect width="100%" height="100%" fill="url(#dots)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* ── Edges ── */}
          {layout.edges.map((edge, ei) => {
            const fromNode = nodeMap.get(edge.fromId);
            const toNode = nodeMap.get(edge.toId);
            if (!fromNode || !toNode) return null;

            const sourceEdges = edgesBySource.get(edge.fromId) ?? [];
            const edgeIndexInSource = sourceEdges.indexOf(edge);
            const path = computeArrowPath(fromNode, toNode, edgeIndexInSource, sourceEdges.length);

            // Midpoint for label
            const mx = (fromNode.x + NODE_W + toNode.x) / 2;
            const my = (fromNode.y + NODE_H / 2 + toNode.y + NODE_H / 2) / 2;

            // Find the rule for tooltip
            const rule = edge.ruleId
              ? (pages as DiagramPage[]).flatMap(p => p.branchRules).find(r => r.id === edge.ruleId)
              : null;

            return (
              <g key={`edge-${ei}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={edge.isDashed ? 1.5 : 2}
                  strokeDasharray={edge.isDashed ? "5,4" : undefined}
                  markerEnd={`url(#arrow-${edge.color.replace("#", "")})`}
                  opacity={0.8}
                />
                {/* Edge label */}
                <g
                  style={{ cursor: rule ? "pointer" : "default" }}
                  onMouseEnter={rule ? (e) => setHoveredEdge({ edge, mx, my }) : undefined}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  <rect
                    x={mx - 40}
                    y={my - 9}
                    width={80}
                    height={18}
                    rx={9}
                    fill="white"
                    stroke={edge.color}
                    strokeWidth={1}
                    opacity={0.95}
                  />
                  <text
                    x={mx}
                    y={my + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={edge.color}
                    fontWeight={edge.isDashed ? "normal" : "600"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {edge.label.length > 14 ? edge.label.slice(0, 13) + "…" : edge.label}
                  </text>
                </g>
                {/* Tooltip */}
                {hoveredEdge?.edge === edge && rule && (
                  <EdgeTooltip rule={rule} x={mx} y={my - 30} />
                )}
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {layout.nodes.map(node => {
            const p = node.page;
            const colors = PAGE_COLORS[p.pageType] ?? PAGE_COLORS.custom;
            const label = PAGE_LABELS[p.pageType] ?? "Page";
            const ruleCount = p.branchRules.filter(r => r.isActive).length;
            const isHidden = p.isHidden;
            const isStandalone = p.isStandaloneLanding;

            return (
              <g
                key={node.id}
                data-node="true"
                style={{ cursor: "pointer" }}
                onClick={() => onEditPage(funnelId, node.id)}
              >
                {/* Shadow */}
                <rect
                  x={node.x + 2}
                  y={node.y + 3}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill="rgba(0,0,0,0.06)"
                />
                {/* Node background */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={isHidden ? "#f8fafc" : colors.bg}
                  stroke={colors.border}
                  strokeWidth={isHidden ? 1 : 2}
                  strokeDasharray={isHidden ? "5,3" : undefined}
                  opacity={isHidden ? 0.7 : 1}
                />
                {/* Page type badge */}
                <rect
                  x={node.x + 10}
                  y={node.y + 10}
                  width={label.length * 6 + 12}
                  height={16}
                  rx={8}
                  fill={colors.badge}
                  opacity={0.15}
                />
                <text
                  x={node.x + 16}
                  y={node.y + 21}
                  fontSize={9}
                  fontWeight="700"
                  fill={colors.badge}
                  style={{ userSelect: "none" }}
                >
                  {label.toUpperCase()}
                </text>
                {/* Title */}
                <text
                  x={node.x + 10}
                  y={node.y + 44}
                  fontSize={11}
                  fontWeight="600"
                  fill={colors.text}
                  style={{ userSelect: "none" }}
                >
                  {p.title.length > 22 ? p.title.slice(0, 21) + "…" : p.title}
                </text>
                {/* Stats row */}
                <text
                  x={node.x + 10}
                  y={node.y + 60}
                  fontSize={9}
                  fill="#94a3b8"
                  style={{ userSelect: "none" }}
                >
                  {p.views} views
                  {ruleCount > 0 ? ` · ${ruleCount} rule${ruleCount > 1 ? "s" : ""}` : ""}
                  {isHidden ? " · hidden" : ""}
                  {isStandalone ? " · standalone" : ""}
                </text>
                {/* Branch rule indicator dot */}
                {ruleCount > 0 && (
                  <circle cx={node.x + NODE_W - 14} cy={node.y + 14} r={7} fill="#f59e0b" />
                )}
                {ruleCount > 0 && (
                  <text
                    x={node.x + NODE_W - 14}
                    y={node.y + 18}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight="700"
                    fill="white"
                    style={{ userSelect: "none" }}
                  >
                    {ruleCount}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
