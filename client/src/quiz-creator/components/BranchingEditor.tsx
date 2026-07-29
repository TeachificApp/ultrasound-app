/**
 * BranchingEditor - A panel for configuring branching/conditional logic on quiz questions.
 * Allows quiz creators to route students to different questions based on their answers.
 */
import { useState } from "react";
import { Plus, Trash2, GitBranch, ArrowRight, AlertCircle } from "lucide-react";
import type { QuizQuestion, BranchRule, BranchCondition, BranchTarget, McqData } from "../types/quiz";

interface BranchingEditorProps {
  question: QuizQuestion;
  allQuestions: QuizQuestion[];
  onUpdate: (rules: BranchRule[]) => void;
}

function generateId() {
  return `br_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const CONDITION_LABELS: Record<string, string> = {
  correct: "Answer is correct",
  incorrect: "Answer is incorrect",
  choice: "Specific choice selected",
  score_above: "Cumulative score above",
  score_below: "Cumulative score below",
  always: "Always (unconditional)",
};

const TARGET_LABELS: Record<string, string> = {
  question: "Jump to question",
  end: "End quiz",
  result: "Go to results",
  next: "Continue to next",
};

export function BranchingEditor({ question, allQuestions, onUpdate }: BranchingEditorProps) {
  const rules = question.branchRules ?? [];
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const addRule = () => {
    const newRule: BranchRule = {
      id: generateId(),
      condition: { type: "correct" },
      target: { type: "next" },
      priority: rules.length,
    };
    onUpdate([...rules, newRule]);
    setExpandedRule(newRule.id);
  };

  const removeRule = (id: string) => {
    onUpdate(rules.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, patch: Partial<BranchRule>) => {
    onUpdate(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateCondition = (id: string, condition: BranchCondition) => {
    updateRule(id, { condition });
  };

  const updateTarget = (id: string, target: BranchTarget) => {
    updateRule(id, { target });
  };

  // Get choices for MCQ-type questions
  const isMcq = question.type === "mcq" || question.type === "tf" || question.type === "image_choice";
  const mcqChoices = isMcq && question.data && "choices" in question.data
    ? (question.data as McqData).choices
    : [];

  // Get other questions for jump targets
  const otherQuestions = allQuestions.filter((q) => q.id !== question.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-700">Branching Rules</span>
        </div>
        <button
          onClick={addRule}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>No branching rules. Quiz will proceed linearly to the next question.</span>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule, idx) => (
          <div
            key={rule.id}
            className={`border rounded-lg transition-all ${
              expandedRule === rule.id ? "border-purple-200 bg-purple-50/30" : "border-gray-200 bg-white"
            }`}
          >
            {/* Rule header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
            >
              <span className="text-xs font-mono text-gray-400 w-5">#{idx + 1}</span>
              <div className="flex-1 flex items-center gap-1 text-xs text-gray-600 truncate">
                <span className="font-medium">{CONDITION_LABELS[rule.condition.type]}</span>
                <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="text-purple-600 font-medium">
                  {rule.target.type === "question"
                    ? `Q: ${otherQuestions.find((q) => q.id === (rule.target as { type: "question"; questionId: string }).questionId)?.stem.slice(0, 20) || "?"}`
                    : TARGET_LABELS[rule.target.type]}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeRule(rule.id); }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Expanded rule editor */}
            {expandedRule === rule.id && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                {/* Condition */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">If...</label>
                  <select
                    value={rule.condition.type}
                    onChange={(e) => {
                      const type = e.target.value as BranchCondition["type"];
                      if (type === "choice") updateCondition(rule.id, { type: "choice", choiceId: mcqChoices[0]?.id || "" });
                      else if (type === "score_above") updateCondition(rule.id, { type: "score_above", threshold: 50 });
                      else if (type === "score_below") updateCondition(rule.id, { type: "score_below", threshold: 50 });
                      else updateCondition(rule.id, { type } as BranchCondition);
                    }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white"
                  >
                    <option value="correct">Answer is correct</option>
                    <option value="incorrect">Answer is incorrect</option>
                    {isMcq && <option value="choice">Specific choice selected</option>}
                    <option value="score_above">Cumulative score above threshold</option>
                    <option value="score_below">Cumulative score below threshold</option>
                    <option value="always">Always (unconditional)</option>
                  </select>

                  {/* Choice selector for MCQ */}
                  {rule.condition.type === "choice" && isMcq && (
                    <select
                      value={(rule.condition as { type: "choice"; choiceId: string }).choiceId}
                      onChange={(e) => updateCondition(rule.id, { type: "choice", choiceId: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white"
                    >
                      {mcqChoices.map((c) => (
                        <option key={c.id} value={c.id}>{c.text}</option>
                      ))}
                    </select>
                  )}

                  {/* Score threshold */}
                  {(rule.condition.type === "score_above" || rule.condition.type === "score_below") && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={(rule.condition as { threshold: number }).threshold}
                        onChange={(e) =>
                          updateCondition(rule.id, {
                            type: rule.condition.type as "score_above" | "score_below",
                            threshold: Number(e.target.value),
                          })
                        }
                        className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white"
                      />
                      <span className="text-xs text-gray-500">% of total points</span>
                    </div>
                  )}
                </div>

                {/* Target */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Then go to...</label>
                  <select
                    value={rule.target.type}
                    onChange={(e) => {
                      const type = e.target.value as BranchTarget["type"];
                      if (type === "question") updateTarget(rule.id, { type: "question", questionId: otherQuestions[0]?.id || "" });
                      else updateTarget(rule.id, { type } as BranchTarget);
                    }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white"
                  >
                    <option value="next">Continue to next question</option>
                    <option value="question">Jump to specific question</option>
                    <option value="result">Go to results</option>
                    <option value="end">End quiz immediately</option>
                  </select>

                  {/* Question selector */}
                  {rule.target.type === "question" && (
                    <select
                      value={(rule.target as { type: "question"; questionId: string }).questionId}
                      onChange={(e) => updateTarget(rule.id, { type: "question", questionId: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white"
                    >
                      {otherQuestions.map((q, i) => (
                        <option key={q.id} value={q.id}>
                          Q{i + 1}: {q.stem.slice(0, 50)}{q.stem.length > 50 ? "..." : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {rules.length > 0 && (
        <p className="text-xs text-gray-400 italic">
          Rules are evaluated top-to-bottom. First matching rule determines the next question.
          If no rule matches, quiz continues to the next question.
        </p>
      )}
    </div>
  );
}
