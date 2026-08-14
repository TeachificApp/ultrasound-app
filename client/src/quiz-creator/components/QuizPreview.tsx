import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuizStore } from "../store/quizStore";
import { resolveQuizBackground } from "@shared/quizBackground";
import { X, ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw, AlertTriangle } from "lucide-react";
import type { QuizQuestion, McqData, TfData, MatchingData, HotspotData, FillBlankData, ShortAnswerData, ImageChoiceData, OrderingData, DragWordsData, DropdownData, NumericData, LikertData, EssayData, DrawConfig } from "../types/quiz";
import { DndOrdering, DndDragWords } from "./DndQuizInteractions";
import { RichTextDisplay } from "@/components/RichTextEditor";

interface Props {
  onClose: () => void;
  mode?: "entire" | "current";
  currentQuestionId?: string | null;
}

type Answer = string | boolean | string[] | Record<string, string>;

export type PreviewFeedbackStatus = "correct" | "incorrect" | "partial" | "ungraded";

export function evaluatePreviewAnswer(q: QuizQuestion, answer: Answer | undefined): PreviewFeedbackStatus {
  if (answer === undefined || answer === "") return "ungraded";
  if (q.type === "mcq" || q.type === "image_choice") {
    const data = q.data as McqData | ImageChoiceData;
    const correctIds = data.choices.filter((choice) => choice.correct).map((choice) => choice.id).sort();
    const selectedIds = ((answer as string[]) ?? []).slice().sort();
    if (JSON.stringify(correctIds) === JSON.stringify(selectedIds)) return "correct";
    if (selectedIds.length > 0 && selectedIds.every((id) => correctIds.includes(id))) return "partial";
    return "incorrect";
  }
  if (q.type === "tf") return answer === (q.data as TfData).correct ? "correct" : "incorrect";
  if (q.type === "matching") {
    const selections = answer as Record<string, string>;
    return (q.data as MatchingData).pairs.every((pair) => selections?.[pair.id] === pair.id) ? "correct" : "incorrect";
  }
  if (q.type === "hotspot") {
    const data = q.data as HotspotData;
    const expected = data.regions.filter((region) => region.correct).map((region) => region.id).sort();
    const selected = ((answer as string[]) ?? []).slice().sort();
    return JSON.stringify(expected) === JSON.stringify(selected) ? "correct" : "incorrect";
  }
  if (q.type === "ordering") {
    const expected = (q.data as OrderingData).items.map((item) => item.id);
    const selected = answer as string[];
    return expected.every((id, index) => selected?.[index] === id) ? "correct" : "incorrect";
  }
  if (q.type === "fill_blank") {
    const selections = answer as Record<string, string>;
    const correct = (q.data as FillBlankData).blanks.every((blank) => blank.acceptedAnswers.some((accepted) => blank.caseSensitive ? selections?.[blank.id] === accepted : selections?.[blank.id]?.toLowerCase() === accepted.toLowerCase()));
    return correct ? "correct" : "incorrect";
  }
  if (q.type === "dropdown") {
    const selections = answer as Record<string, string>;
    return (q.data as DropdownData).blanks.every((blank) => Number(selections?.[blank.id]) === blank.correctIndex) ? "correct" : "incorrect";
  }
  if (q.type === "numeric") {
    const data = q.data as NumericData;
    const selected = Number(answer);
    const correct = data.allowRange && data.rangeMin != null && data.rangeMax != null
      ? selected >= data.rangeMin && selected <= data.rangeMax
      : Math.abs(selected - data.correctValue) <= data.tolerance;
    return correct ? "correct" : "incorrect";
  }
  return "ungraded";
}

export function getPreviewAnswerFeedbackHtml(q: QuizQuestion, answer: Answer | undefined): string {
  if (answer === undefined) return "";
  if (q.type === "mcq" || q.type === "image_choice") {
    const data = q.data as McqData | ImageChoiceData;
    return ((answer as string[]) ?? [])
      .map((id) => data.choices.find((choice) => choice.id === id)?.feedbackHtml ?? data.choices.find((choice) => choice.id === id)?.feedback ?? "")
      .filter(Boolean)
      .join("<hr />");
  }
  if (q.type === "tf") {
    const data = q.data as TfData;
    return answer === true ? data.trueFeedback ?? "" : data.falseFeedback ?? "";
  }
  return "";
}

function McqQuestion({ q, answer, setAnswer, shuffleChoices, revealed }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; shuffleChoices?: boolean; revealed: boolean }) {
  const data = q.data as McqData;
  const choices = useMemo(() => {
    if (shuffleChoices) {
      return [...data.choices].sort(() => 0.5 - Math.random());
    }
    return data.choices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);
  const selected = (answer as string[]) ?? [];
  const toggle = (id: string) => {
    if (data.multiSelect) {
      setAnswer(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    } else {
      setAnswer([id]);
    }
  };
  return (
    <div className="space-y-2">
      {choices.map((c) => {
        const isSelected = selected.includes(c.id);
        const showCorrect = revealed && c.correct;
        const showIncorrect = revealed && isSelected && !c.correct;
        return (
        <button
          key={c.id}
          onClick={() => !revealed && toggle(c.id)}
          disabled={revealed}
          data-feedback-state={showCorrect ? "correct" : showIncorrect ? "incorrect" : undefined}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
            showCorrect ? "border-emerald-500 bg-emerald-50" : showIncorrect ? "border-red-500 bg-red-50" : isSelected ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            showCorrect ? "border-emerald-500 text-emerald-600" : showIncorrect ? "border-red-500 text-red-600" : isSelected ? "border-teal-500 bg-teal-500" : "border-gray-300"
          }`}>
            {showCorrect ? <CheckCircle2 className="h-4 w-4" /> : showIncorrect ? <XCircle className="h-4 w-4" /> : isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
          </span>
          <span className="text-sm text-gray-700">{c.text}</span>
        </button>
      )})}
    </div>
  );
}

function TfQuestion({ q, answer, setAnswer, revealed }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; revealed: boolean }) {
  const correct = (q.data as TfData).correct;
  return (
    <div className="flex gap-4">
      {[true, false].map((val) => (
        <button
          key={String(val)}
          onClick={() => !revealed && setAnswer(val)}
          disabled={revealed}
          data-feedback-state={revealed && val === correct ? "correct" : revealed && answer === val ? "incorrect" : undefined}
          className={`flex-1 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
            revealed && val === correct ? "border-emerald-500 bg-emerald-50 text-emerald-700" : revealed && answer === val ? "border-red-500 bg-red-50 text-red-700" : answer === val ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          {revealed && val === correct ? <><CheckCircle2 className="mr-1 inline h-4 w-4" />{val ? "True" : "False"}</> : revealed && answer === val ? <><XCircle className="mr-1 inline h-4 w-4" />{val ? "True" : "False"}</> : val ? "✓ True" : "✗ False"}
        </button>
      ))}
    </div>
  );
}

function MatchingQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as MatchingData;
  const ans = (answer as Record<string, string>) ?? {};
  const shuffledResponses = [...data.pairs].sort(() => 0.5 - Math.random());

  return (
    <div className="space-y-3">
      {data.pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700 font-medium">
            {pair.premise}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          <select
            value={ans[pair.id] ?? ""}
            onChange={(e) => setAnswer({ ...ans, [pair.id]: e.target.value })}
            className="flex-1 px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          >
            <option value="">Select...</option>
            {data.pairs.map((p) => (
              <option key={p.id} value={p.id}>{p.response}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function HotspotQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as HotspotData;
  const selected = (answer as string[]) ?? [];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const hit = data.regions.find((r) => {
      if (r.shape === "circle" && r.radius != null) {
        const dx = xPct - r.x, dy = yPct - r.y;
        return Math.sqrt(dx * dx + dy * dy) <= r.radius;
      }
      if (r.shape === "rect" && r.width != null && r.height != null) {
        return Math.abs(xPct - r.x) <= r.width / 2 && Math.abs(yPct - r.y) <= r.height / 2;
      }
      return false;
    });

    if (!hit) return;
    if (data.multiSelect) {
      setAnswer(selected.includes(hit.id) ? selected.filter((s) => s !== hit.id) : [...selected, hit.id]);
    } else {
      setAnswer([hit.id]);
    }
  };

  return (
    <div className="relative cursor-pointer rounded-xl overflow-hidden border border-gray-200" onClick={handleClick}>
      <img src={data.imageUrl} alt={data.imageAlt} className="w-full" />
      {data.regions.map((r) => {
        const isSelected = selected.includes(r.id);
        return (
          <div
            key={r.id}
            className={`absolute rounded-full border-2 transition-all ${isSelected ? "bg-teal-400/40 border-teal-500" : "bg-transparent border-transparent hover:bg-white/20"}`}
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: r.shape === "circle" ? `${(r.radius ?? 5) * 2}%` : `${r.width ?? 10}%`,
              height: r.shape === "circle" ? `${(r.radius ?? 5) * 2}%` : `${r.height ?? 10}%`,
              transform: "translate(-50%, -50%)",
              borderRadius: r.shape === "circle" ? "50%" : "8px",
            }}
          />
        );
      })}
      <p className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md">
        Click to select region
      </p>
    </div>
  );
}

function FillBlankQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as FillBlankData;
  const ans = (answer as Record<string, string>) ?? {};
  const parts = data.template.split(/(\{\{[^}]+\}\})/g);

  return (
    <div className="text-base text-gray-700 leading-relaxed flex flex-wrap items-center gap-1">
      {parts.map((part, i) => {
        const match = part.match(/^\{\{(.+)\}\}$/);
        if (match) {
          const blankId = match[1];
          return (
            <input
              key={i}
              type="text"
              value={ans[blankId] ?? ""}
              onChange={(e) => setAnswer({ ...ans, [blankId]: e.target.value })}
              placeholder="___"
              className="inline-block w-32 px-2 py-1 border-b-2 border-teal-400 bg-teal-50/50 rounded text-sm focus:outline-none text-center"
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

function ShortAnswerQuestion({ answer, setAnswer }: { answer: Answer; setAnswer: (a: Answer) => void }) {
  return (
    <textarea
      value={(answer as string) ?? ""}
      onChange={(e) => setAnswer(e.target.value)}
      rows={4}
      placeholder="Type your answer here..."
      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
    />
  );
}

function ImageChoiceQuestion({ q, answer, setAnswer, shuffleChoices, revealed }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; shuffleChoices?: boolean; revealed: boolean }) {
  const data = q.data as ImageChoiceData;
  const choices = useMemo(() => {
    if (shuffleChoices) {
      return [...data.choices].sort(() => 0.5 - Math.random());
    }
    return data.choices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);
  const selected = (answer as string[]) ?? [];
  const toggle = (id: string) => {
    if (data.multiSelect) {
      setAnswer(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    } else {
      setAnswer([id]);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((c) => {
        const isSelected = selected.includes(c.id);
        const showCorrect = revealed && c.correct;
        const showIncorrect = revealed && isSelected && !c.correct;
        return (
        <button
          key={c.id}
          onClick={() => !revealed && toggle(c.id)}
          disabled={revealed}
          data-feedback-state={showCorrect ? "correct" : showIncorrect ? "incorrect" : undefined}
          className={`border-2 rounded-xl overflow-hidden text-left transition-all ${
            showCorrect ? "border-emerald-500 bg-emerald-50" : showIncorrect ? "border-red-500 bg-red-50" : isSelected ? "border-teal-500" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          {c.imageUrl && <img src={c.imageUrl} alt={c.label} className="w-full h-28 object-cover" />}
          <div className="flex items-center justify-center gap-1 p-2 text-xs text-gray-700 text-center">{showCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}{showIncorrect && <XCircle className="h-3.5 w-3.5 text-red-600" />}{c.label}</div>
        </button>
      )})}
    </div>
  );
}

// ─── Ordering Question ──────────────────────────────────────────────────────
function OrderingQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as OrderingData;
  const [initialized, setInitialized] = useState(false);
  const items = (answer as string[]) ?? [];

  useEffect(() => {
    if (!initialized && !answer) {
      const shuffled = [...data.items.map((i) => i.id)].sort(() => 0.5 - Math.random());
      setAnswer(shuffled);
      setInitialized(true);
    }
  }, [initialized, answer, data.items, setAnswer]);

  if (!items.length) return null;

  return (
    <DndOrdering
      items={data.items}
      currentOrder={items}
      onReorder={setAnswer}
      primaryColor="#14b8a6"
    />
  );
}

// ─── Numeric Question ────────────────────────────────────────────────────────
function NumericQuestion({ answer, setAnswer, data }: { answer: Answer; setAnswer: (a: Answer) => void; data: NumericData }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={(answer as string) ?? ""}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter a number..."
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        />
        {data.unit && <span className="text-sm text-gray-500">{data.unit}</span>}
      </div>
    </div>
  );
}

// ─── Dropdown Question ───────────────────────────────────────────────────────
function DropdownQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as DropdownData;
  const selections = (answer as Record<string, string>) ?? {};
  const parts = data.template.split(/\{\{(\w+)\}\}/);
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-700 leading-relaxed flex flex-wrap items-center gap-1">
        {parts.map((part, i) => {
          const blank = data.blanks.find((b) => b.id === part);
          if (blank) {
            return (
              <select
                key={i}
                value={selections[blank.id] ?? ""}
                onChange={(e) => setAnswer({ ...selections, [blank.id]: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-teal-400/50"
              >
                <option value="">Select...</option>
                {blank.options.map((opt, oi) => (
                  <option key={oi} value={String(oi)}>{opt}</option>
                ))}
              </select>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    </div>
  );
}

// ─── Drag Words Question ─────────────────────────────────────────────────────
function DragWordsQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as DragWordsData;
  const selections = (answer as Record<string, string>) ?? {};

  return (
    <DndDragWords
      template={data.template}
      blanks={data.blanks}
      distractorWords={data.distractorWords}
      selections={selections}
      onSelectionChange={setAnswer}
      primaryColor="#14b8a6"
    />
  );
}

// ─── Likert Question ─────────────────────────────────────────────────────────
function LikertQuestion({ q, answer, setAnswer }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void }) {
  const data = q.data as LikertData;
  const selections = (answer as Record<string, string>) ?? {};
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-xs text-gray-500">Statement</th>
              {data.scaleLabels.map((label, i) => (
                <th key={i} className="text-center px-2 py-2 text-xs text-gray-500 whitespace-nowrap">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.statements.map((stmt) => (
              <tr key={stmt.id} className="border-t border-gray-100">
                <td className="py-3 pr-4 text-gray-700">{stmt.text}</td>
                {data.scaleLabels.map((_, i) => (
                  <td key={i} className="text-center px-2 py-3">
                    <input
                      type="radio"
                      name={stmt.id}
                      checked={selections[stmt.id] === String(i)}
                      onChange={() => setAnswer({ ...selections, [stmt.id]: String(i) })}
                      className="accent-teal-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Essay Question ──────────────────────────────────────────────────────────
function EssayQuestion({ answer, setAnswer, data }: { answer: Answer; setAnswer: (a: Answer) => void; data: EssayData }) {
  const text = (answer as string) ?? "";
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={data.placeholder || "Write your answer here..."}
        rows={6}
        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"
      />
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>{wordCount} words</span>
        {data.minWords && <span>Min: {data.minWords}</span>}
        {data.maxWords && <span>Max: {data.maxWords}</span>}
      </div>
    </div>
  );
}

export function QuizPreview({ onClose, mode = "entire", currentQuestionId }: Props) {
  const { quiz } = useQuizStore();
  const branding = quiz.meta.branding;
  const previewBackground = resolveQuizBackground(branding);

  // Pool/Draw mode + shuffle
  const questions = useMemo(() => {
    let qs = mode === "current" && currentQuestionId
      ? quiz.questions.filter((question) => question.id === currentQuestionId)
      : [...quiz.questions];
    if (mode === "current") return qs;
    const drawConfig = quiz.meta.drawConfig as DrawConfig | undefined;
    if (drawConfig?.enabled) {
      const grouped: Record<string, QuizQuestion[]> = {};
      const ungrouped: QuizQuestion[] = [];
      qs.forEach((q) => {
        if (q.groupId) {
          if (!grouped[q.groupId]) grouped[q.groupId] = [];
          grouped[q.groupId].push(q);
        } else {
          ungrouped.push(q);
        }
      });
      const drawn: QuizQuestion[] = [];
      for (const gd of drawConfig.groupDraws) {
        const pool = grouped[gd.groupId] || [];
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        drawn.push(...shuffled.slice(0, gd.drawCount));
      }
      const shuffledUngrouped = [...ungrouped].sort(() => 0.5 - Math.random());
      drawn.push(...shuffledUngrouped.slice(0, drawConfig.ungroupedDrawCount));
      qs = drawn;
    }
    if (quiz.meta.shuffleQuestions) {
      return qs.sort(() => 0.5 - Math.random());
    }
    return qs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.questions, quiz.meta.shuffleQuestions, quiz.meta.drawConfig?.enabled, mode, currentQuestionId]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [feedbackRevealed, setFeedbackRevealed] = useState<Record<string, boolean>>({});
  const [questionPath, setQuestionPath] = useState<string[]>([]);
  const branchingEnabled = questions.some((qq) => qq.branchRules && qq.branchRules.length > 0);

  const q = questions[currentIdx];
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const questionPreviewBackground = resolveQuizBackground(branding, q);
  const answer = q ? answers[q.id] : undefined;
  const feedbackStatus = q ? evaluatePreviewAnswer(q, answer) : "ungraded";
  const isFeedbackRevealed = !!(q && feedbackRevealed[q.id]);
  const requiresExplicitFeedbackCheck = q && (
    (q.type === "mcq" && (q.data as McqData).multiSelect) ||
    (q.type === "image_choice" && (q.data as ImageChoiceData).multiSelect) ||
    (q.type === "matching") ||
    (q.type === "hotspot" && (q.data as HotspotData).multiSelect) ||
    (q.type === "fill_blank") ||
    (q.type === "ordering") ||
    (q.type === "drag_words") ||
    (q.type === "dropdown") ||
    (q.type === "likert") ||
    (q.type === "essay")
  );
  const setQuestionAnswer = (nextAnswer: Answer) => {
    if (!q) return;
    setAnswers((previous) => ({ ...previous, [q.id]: nextAnswer }));
    setFeedbackRevealed((previous) => ({ ...previous, [q.id]: quiz.meta.showFeedback === "immediate" && !requiresExplicitFeedbackCheck }));
  };

  const calcScore = () => {
    let earned = 0;
    questions.forEach((q) => {
      const ans = answers[q.id];
      if (q.type === "mcq" || q.type === "image_choice") {
        const data = q.data as McqData;
        const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id);
        const selected = (ans as string[]) ?? [];
        if (JSON.stringify([...correctIds].sort()) === JSON.stringify([...selected].sort())) earned += q.points;
      } else if (q.type === "tf") {
        const data = q.data as TfData;
        if (ans === data.correct) earned += q.points;
      } else if (q.type === "matching") {
        const data = q.data as MatchingData;
        const a = (ans as Record<string, string>) ?? {};
        const allCorrect = data.pairs.every((p) => a[p.id] === p.id);
        if (allCorrect) earned += q.points;
      } else if (q.type === "ordering") {
        const data = q.data as OrderingData;
        const a = (ans as string[]) ?? [];
        if (a.length === data.items.length && a.every((id, i) => id === data.items[i].id)) earned += q.points;
      } else if (q.type === "numeric") {
        const data = q.data as NumericData;
        const a = Number(ans);
        if (data.allowRange && data.rangeMin != null && data.rangeMax != null) {
          if (a >= data.rangeMin && a <= data.rangeMax) earned += q.points;
        } else {
          if (Math.abs(a - data.correctValue) <= data.tolerance) earned += q.points;
        }
      } else if (q.type === "fill_blank" || q.type === "short_answer") {
        // Simple text match for preview
        if (q.type === "fill_blank") {
          const data = q.data as FillBlankData;
          const a = (ans as Record<string, string>) ?? {};
          const allCorrect = data.blanks.every((b) => b.acceptedAnswers.some((acc) => data.blanks.length > 0 && (b.caseSensitive ? a[b.id] === acc : (a[b.id] || "").toLowerCase() === acc.toLowerCase())));
          if (allCorrect) earned += q.points;
        }
      } else if (q.type === "dropdown") {
        const data = q.data as DropdownData;
        const a = (ans as Record<string, string>) ?? {};
        const allCorrect = data.blanks.every((b) => Number(a[b.id]) === b.correctIndex);
        if (allCorrect) earned += q.points;
      }
    });
    return earned;
  };

  if (!q) return null;

  if (submitted) {
    const score = calcScore();
    const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = pct >= quiz.meta.passingScore;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? "bg-teal-100" : "bg-red-100"}`}>
            {passed ? <CheckCircle2 className="w-10 h-10 text-teal-500" /> : <XCircle className="w-10 h-10 text-red-500" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{passed ? "Quiz Passed!" : "Not Quite"}</h2>
          <p className="text-gray-500 mb-4">You scored {score}/{totalPoints} points ({pct}%)</p>
          <p className="text-sm text-gray-400 mb-6">Passing score: {quiz.meta.passingScore}%</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setSubmitted(false); setAnswers({}); setCurrentIdx(0); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: previewBackground }}>
      <div className="bg-white/95 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Preview Mode</p>
            <h2 className="text-base font-bold text-gray-800">{quiz.meta.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {currentIdx + 1} / {questions.length}
            </span>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%`, background: "#24abbc" }}
          />
        </div>

        {/* Question surface — mirrors the themed learner frame instead of only styling the modal backdrop. */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: questionPreviewBackground }}>
          <div className="rounded-xl bg-white/90 p-6 space-y-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: "#24abbc" }}>
                Q{q.order}
              </span>
              <span className="text-xs text-gray-400">{q.points} point{q.points !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-base font-medium text-gray-800">{q.stem || "(No question text)"}</p>
            {q.image && <img src={q.image.url} alt={q.image.alt} className="mt-3 rounded-xl max-h-48 object-cover" />}
          </div>

          {q.type === "mcq" && <McqQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} revealed={isFeedbackRevealed} shuffleChoices={!q.lockAnswerOrder && (q.shuffleAnswerOptions ?? quiz.meta.shuffleAnswers)} />}
          {q.type === "tf" && <TfQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} revealed={isFeedbackRevealed} />}
          {q.type === "matching" && <MatchingQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "hotspot" && (q.data as HotspotData).imageUrl && <HotspotQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "fill_blank" && <FillBlankQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "short_answer" && <ShortAnswerQuestion answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "image_choice" && <ImageChoiceQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} revealed={isFeedbackRevealed} shuffleChoices={!q.lockAnswerOrder && (q.shuffleAnswerOptions ?? quiz.meta.shuffleAnswers)} />}
          {q.type === "ordering" && <OrderingQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "numeric" && <NumericQuestion answer={answer} setAnswer={setQuestionAnswer} data={q.data as NumericData} />}
          {q.type === "dropdown" && <DropdownQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "drag_words" && <DragWordsQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "likert" && <LikertQuestion q={q} answer={answer} setAnswer={setQuestionAnswer} />}
          {q.type === "essay" && <EssayQuestion answer={answer} setAnswer={setQuestionAnswer} data={q.data as EssayData} />}
          {quiz.meta.showFeedback === "immediate" && answer !== undefined && !isFeedbackRevealed && requiresExplicitFeedbackCheck && (
            <button onClick={() => setFeedbackRevealed((previous) => ({ ...previous, [q.id]: true }))} className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Check Answer</button>
          )}
          {quiz.meta.showFeedback === "immediate" && isFeedbackRevealed && (
            <div className={`mt-4 rounded-xl border p-4 ${feedbackStatus === "correct" ? "border-emerald-200 bg-emerald-50" : feedbackStatus === "partial" ? "border-amber-200 bg-amber-50" : feedbackStatus === "incorrect" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`} data-testid="quiz-preview-feedback">
              <div className={`flex items-center gap-2 text-sm font-semibold ${feedbackStatus === "correct" ? "text-emerald-700" : feedbackStatus === "partial" ? "text-amber-800" : feedbackStatus === "incorrect" ? "text-red-700" : "text-slate-700"}`}>
                {feedbackStatus === "correct" ? <><CheckCircle2 className="h-5 w-5" />Correct</> : feedbackStatus === "partial" ? <><AlertTriangle className="h-5 w-5" />Partially correct</> : feedbackStatus === "incorrect" ? <><XCircle className="h-5 w-5" />Incorrect</> : "Answer recorded"}
              </div>
              {getPreviewAnswerFeedbackHtml(q, answer) && <RichTextDisplay html={getPreviewAnswerFeedbackHtml(q, answer)} className="mt-3" />}
              {(feedbackStatus !== "ungraded" ? q.feedback?.[feedbackStatus] : undefined) && <RichTextDisplay html={q.feedback?.[feedbackStatus] ?? ""} className="mt-3" />}
              {(q.explanationHtml || q.explanation) && <div className="mt-3 border-t border-current/10 pt-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">Explanation</p><RichTextDisplay html={q.explanationHtml ?? q.explanation} /></div>}
              {q.feedbackImage && <img src={q.feedbackImage.url} alt={q.feedbackImage.alt} className="mt-3 max-h-64 rounded-lg object-contain" />}
              {q.feedbackVideo && <video src={q.feedbackVideo.url} controls className="mt-3 max-h-64 w-full rounded-lg bg-black" />}
            </div>
          )}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              if (branchingEnabled && questionPath.length > 0) {
                const newPath = [...questionPath];
                newPath.pop();
                setQuestionPath(newPath);
                const prevId = newPath[newPath.length - 1];
                if (prevId) {
                  const prevIdx = questions.findIndex((qq) => qq.id === prevId);
                  if (prevIdx >= 0) setCurrentIdx(prevIdx);
                } else {
                  setCurrentIdx(0);
                }
              } else {
                setCurrentIdx((i) => Math.max(0, i - 1));
              }
            }}
            disabled={branchingEnabled ? questionPath.length === 0 : currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {(() => {
            const handleNext = () => {
              if (branchingEnabled && q.branchRules && q.branchRules.length > 0) {
                setQuestionPath((p) => [...p, q.id]);
                // Evaluate rules: first matching rule wins
                const ans = answers[q.id];
                for (const rule of [...q.branchRules].sort((a, b) => a.priority - b.priority)) {
                  let matches = false;
                  switch (rule.condition.type) {
                    case "correct": {
                      // Simple correctness check for MCQ/TF
                      if (q.type === "mcq" || q.type === "image_choice") {
                        const data = q.data as McqData;
                        const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id);
                        const selected = (ans as string[]) ?? [];
                        matches = JSON.stringify([...correctIds].sort()) === JSON.stringify([...selected].sort());
                      } else if (q.type === "tf") {
                        matches = ans === (q.data as TfData).correct;
                      }
                      break;
                    }
                    case "incorrect": {
                      if (q.type === "mcq" || q.type === "image_choice") {
                        const data = q.data as McqData;
                        const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id);
                        const selected = (ans as string[]) ?? [];
                        matches = JSON.stringify([...correctIds].sort()) !== JSON.stringify([...selected].sort());
                      } else if (q.type === "tf") {
                        matches = ans !== (q.data as TfData).correct;
                      }
                      break;
                    }
                    case "choice": {
                      const selected = (ans as string[]) ?? [];
                      matches = selected.includes((rule.condition as any).choiceId);
                      break;
                    }
                    case "always": matches = true; break;
                  }
                  if (matches) {
                    if (rule.target.type === "end" || rule.target.type === "result") {
                      setSubmitted(true); return;
                    }
                    if (rule.target.type === "question") {
                      const target = rule.target as { type: "question"; questionId: string };
                      const targetIdx = questions.findIndex((qq) => qq.id === target.questionId);
                      if (targetIdx >= 0) { setCurrentIdx(targetIdx); return; }
                    }
                    break;
                  }
                }
                // No rule matched: go next linearly
                if (currentIdx < questions.length - 1) setCurrentIdx((i) => i + 1);
                else setSubmitted(true);
              } else {
                if (branchingEnabled) setQuestionPath((p) => [...p, q.id]);
                setCurrentIdx((i) => i + 1);
              }
            };

            const isLast = currentIdx >= questions.length - 1;
            if (branchingEnabled) {
              return (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              );
            }
            return isLast ? (
              <button
                onClick={() => setSubmitted(true)}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
              >
                Submit Quiz
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
