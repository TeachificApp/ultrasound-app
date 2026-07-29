import { useMemo } from "react";
import { useQuizStore } from "../store/quizStore";
import { X, GitBranch, ArrowRight, CheckCircle2, XCircle, Flag } from "lucide-react";
import type { QuizQuestion, BranchRule } from "../types/quiz";

interface Props {
  onClose: () => void;
  onSelectQuestion?: (questionId: string) => void;
}

interface FlowNode {
  id: string;
  label: string;
  order: number;
  type: "question" | "end" | "result";
  x: number;
  y: number;
  hasBranching: boolean;
}

interface FlowEdge {
  from: string;
  to: string;
  label: string;
  color: string;
}

const CONDITION_LABELS: Record<string, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  choice: "Choice",
  score_above: "Score >",
  score_below: "Score <",
  always: "Always",
};

const CONDITION_COLORS: Record<string, string> = {
  correct: "#22c55e",
  incorrect: "#ef4444",
  choice: "#6366f1",
  score_above: "#f97316",
  score_below: "#eab308",
  always: "#6b7280",
};

export function BranchingFlowVisualizer({ onClose, onSelectQuestion }: Props) {
  const { quiz, setActiveQuestion } = useQuizStore();
  const questions = quiz.questions;

  const { nodes, edges } = useMemo(() => {
    const nodeMap: FlowNode[] = [];
    const edgeList: FlowEdge[] = [];

    // Layout: simple grid layout with questions in rows
    const COL_WIDTH = 220;
    const ROW_HEIGHT = 100;
    const COLS = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(questions.length))));

    questions.forEach((q, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      nodeMap.push({
        id: q.id,
        label: `Q${q.order}`,
        order: q.order,
        type: "question",
        x: 60 + col * COL_WIDTH,
        y: 60 + row * ROW_HEIGHT,
        hasBranching: !!(q.branchRules && q.branchRules.length > 0),
      });
    });

    // Add end/result nodes
    const endNodeId = "__end__";
    const resultNodeId = "__result__";
    const lastRow = Math.floor((questions.length - 1) / COLS) + 1;
    nodeMap.push({
      id: endNodeId,
      label: "End",
      order: 0,
      type: "end",
      x: 60 + 0 * COL_WIDTH,
      y: 60 + lastRow * ROW_HEIGHT,
      hasBranching: false,
    });
    nodeMap.push({
      id: resultNodeId,
      label: "Result",
      order: 0,
      type: "result",
      x: 60 + 1 * COL_WIDTH,
      y: 60 + lastRow * ROW_HEIGHT,
      hasBranching: false,
    });

    // Build edges from branch rules
    questions.forEach((q) => {
      if (!q.branchRules || q.branchRules.length === 0) {
        // Default: linear flow to next question
        const nextQ = questions.find((qq) => qq.order === q.order + 1);
        if (nextQ) {
          edgeList.push({
            from: q.id,
            to: nextQ.id,
            label: "",
            color: "#d1d5db",
          });
        }
        return;
      }

      q.branchRules.forEach((rule) => {
        let targetId = "";
        if (rule.target.type === "question") {
          targetId = rule.target.questionId;
        } else if (rule.target.type === "end") {
          targetId = endNodeId;
        } else if (rule.target.type === "result") {
          targetId = resultNodeId;
        }

        if (targetId) {
          const condLabel = CONDITION_LABELS[rule.condition.type] || rule.condition.type;
          edgeList.push({
            from: q.id,
            to: targetId,
            label: condLabel,
            color: CONDITION_COLORS[rule.condition.type] || "#6b7280",
          });
        }
      });

      // If no "always" rule, add a default "next" edge
      const hasAlways = q.branchRules.some((r) => r.condition.type === "always");
      if (!hasAlways) {
        const nextQ = questions.find((qq) => qq.order === q.order + 1);
        if (nextQ) {
          edgeList.push({
            from: q.id,
            to: nextQ.id,
            label: "Default",
            color: "#d1d5db",
          });
        }
      }
    });

    return { nodes: nodeMap, edges: edgeList };
  }, [questions]);

  const svgWidth = Math.max(600, nodes.reduce((max, n) => Math.max(max, n.x + 200), 0));
  const svgHeight = Math.max(400, nodes.reduce((max, n) => Math.max(max, n.y + 80), 0));

  const getNodeCenter = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: node.x + 75, y: node.y + 25 };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Branching Flow Visualizer</h2>
              <p className="text-xs text-gray-400">Visual map of question branching paths</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-4 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">Correct</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Incorrect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-gray-600">Choice</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-gray-600">Score Above</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-600">Score Below</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-gray-600">Default/Always</span>
          </div>
        </div>

        {/* Flow diagram */}
        <div className="flex-1 overflow-auto p-4">
          {!quiz.meta.branchingEnabled ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Branching is not enabled</p>
                <p className="text-xs mt-1">Enable branching in Quiz Settings &gt; Navigation to use this visualizer.</p>
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p className="text-sm">No questions to visualize.</p>
            </div>
          ) : (
            <svg width={svgWidth} height={svgHeight} className="mx-auto">
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
                {Object.entries(CONDITION_COLORS).map(([key, color]) => (
                  <marker key={key} id={`arrow-${key}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={color} />
                  </marker>
                ))}
              </defs>

              {/* Edges */}
              {edges.map((edge, i) => {
                const from = getNodeCenter(edge.from);
                const to = getNodeCenter(edge.to);
                if (from.x === 0 && from.y === 0) return null;
                if (to.x === 0 && to.y === 0) return null;

                // Simple curved path
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const midX = from.x + dx * 0.5;
                const midY = from.y + dy * 0.5;
                const curvature = Math.abs(dx) > 150 ? 20 : 0;
                const path = `M ${from.x} ${from.y} Q ${midX} ${midY - curvature} ${to.x} ${to.y}`;

                const condType = Object.keys(CONDITION_COLORS).find((k) => CONDITION_LABELS[k] === edge.label || k === edge.label.toLowerCase());
                const markerId = condType ? `arrow-${condType}` : "arrowhead";

                return (
                  <g key={i}>
                    <path
                      d={path}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={2}
                      strokeDasharray={edge.color === "#d1d5db" ? "4 2" : "none"}
                      markerEnd={`url(#${markerId})`}
                    />
                    {edge.label && (
                      <text
                        x={midX}
                        y={midY - curvature - 6}
                        textAnchor="middle"
                        className="text-[10px] fill-gray-500 font-medium"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => (
                <g
                  key={node.id}
                  className={node.type === "question" ? "cursor-pointer" : ""}
                  onClick={() => {
                    if (node.type === "question") {
                      setActiveQuestion(node.id);
                      if (onSelectQuestion) onSelectQuestion(node.id);
                      onClose();
                    }
                  }}
                >
                  {node.type === "question" ? (
                    <>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={150}
                        height={50}
                        rx={12}
                        fill={node.hasBranching ? "#f3e8ff" : "#f9fafb"}
                        stroke={node.hasBranching ? "#a855f7" : "#e5e7eb"}
                        strokeWidth={node.hasBranching ? 2 : 1}
                        className="hover:stroke-indigo-500 hover:stroke-[2.5px] transition-all"
                      />
                      <text
                        x={node.x + 75}
                        y={node.y + 22}
                        textAnchor="middle"
                        className="text-xs font-bold fill-gray-700 pointer-events-none"
                      >
                        {node.label}
                      </text>
                      <text
                        x={node.x + 75}
                        y={node.y + 38}
                        textAnchor="middle"
                        className="text-[10px] fill-gray-400 pointer-events-none"
                      >
                        {(() => {
                          const q = questions.find((qq) => qq.id === node.id);
                          return q ? (q.stem || "Untitled").slice(0, 20) + (q.stem && q.stem.length > 20 ? "..." : "") : "";
                        })()}
                      </text>
                      {node.hasBranching && (
                        <circle cx={node.x + 140} cy={node.y + 10} r={6} fill="#a855f7" className="pointer-events-none" />
                      )}
                    </>
                  ) : (
                    <>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={120}
                        height={40}
                        rx={20}
                        fill={node.type === "end" ? "#fef2f2" : "#f0fdf4"}
                        stroke={node.type === "end" ? "#ef4444" : "#22c55e"}
                        strokeWidth={2}
                      />
                      <text
                        x={node.x + 60}
                        y={node.y + 24}
                        textAnchor="middle"
                        className={`text-xs font-bold ${node.type === "end" ? "fill-red-600" : "fill-green-600"}`}
                      >
                        {node.label}
                      </text>
                    </>
                  )}
                </g>
              ))}
            </svg>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-400">
            {questions.filter((q) => q.branchRules && q.branchRules.length > 0).length} question{questions.filter((q) => q.branchRules && q.branchRules.length > 0).length !== 1 ? "s" : ""} with branching rules
            <span className="ml-3 text-indigo-500">Click a question node to jump to it in the editor</span>
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
