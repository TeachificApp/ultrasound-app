import { useState, useMemo, useRef, useEffect } from "react";
import { useQuizStore } from "../store/quizStore";
import { X, ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { QuizQuestion, McqData, TfData, MatchingData, HotspotData, FillBlankData, ShortAnswerData, ImageChoiceData, OrderingData, DragWordsData, DropdownData, NumericData, LikertData, EssayData, DrawConfig } from "../types/quiz";
import { DndOrdering, DndDragWords } from "./DndQuizInteractions";

interface Props {
  onClose: () => void;
}

type Answer = string | boolean | string[] | Record<string, string>;

function McqQuestion({ q, answer, setAnswer, shuffleChoices }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; shuffleChoices?: boolean }) {
  const data = q.data as McqData;
  const choices = useMemo(() => {
    if (shuffleChoices && !q.lockAnswerOrder) {
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
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => toggle(c.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
            selected.includes(c.id) ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selected.includes(c.id) ? "border-teal-500 bg-teal-500" : "border-gray-300"
          }`}>
            {selected.includes(c.id) && <span className="w-2 h-2 rounded-full bg-white" />}
          </span>
          <span className="text-sm text-gray-700">{c.text}</span>
        </button>
      ))}
    </div>
  );
}

function TfQuestion({ answer, setAnswer }: { answer: Answer; setAnswer: (a: Answer) => void }) {
  return (
    <div className="flex gap-4">
      {[true, false].map((val) => (
        <button
          key={String(val)}
          onClick={() => setAnswer(val)}
          className={`flex-1 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
            answer === val ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          {val ? "✓ True" : "✗ False"}
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

function ImageChoiceQuestion({ q, answer, setAnswer, shuffleChoices }: { q: QuizQuestion; answer: Answer; setAnswer: (a: Answer) => void; shuffleChoices?: boolean }) {
  const data = q.data as ImageChoiceData;
  const choices = useMemo(() => {
    if (shuffleChoices && !q.lockAnswerOrder) {
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
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => toggle(c.id)}
          className={`border-2 rounded-xl overflow-hidden text-left transition-all ${
            selected.includes(c.id) ? "border-teal-500" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          {c.imageUrl && <img src={c.imageUrl} alt={c.label} className="w-full h-28 object-cover" />}
          <div className="p-2 text-xs text-gray-700 text-center">{c.label}</div>
        </button>
      ))}
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

export function QuizPreview({ onClose }: Props) {
  const { quiz } = useQuizStore();

  // Pool/Draw mode + shuffle
  const questions = useMemo(() => {
    let qs = [...quiz.questions];
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
  }, [quiz.questions.length, quiz.meta.shuffleQuestions, quiz.meta.drawConfig?.enabled]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [questionPath, setQuestionPath] = useState<string[]>([]);
  const branchingEnabled = questions.some((qq) => qq.branchRules && qq.branchRules.length > 0);

  const q = questions[currentIdx];
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
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

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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

          {q.type === "mcq" && <McqQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} shuffleChoices={quiz.meta.shuffleAnswers} />}
          {q.type === "tf" && <TfQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "matching" && <MatchingQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "hotspot" && (q.data as HotspotData).imageUrl && <HotspotQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "fill_blank" && <FillBlankQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "short_answer" && <ShortAnswerQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "image_choice" && <ImageChoiceQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} shuffleChoices={quiz.meta.shuffleAnswers} />}
          {q.type === "ordering" && <OrderingQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "numeric" && <NumericQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} data={q.data as NumericData} />}
          {q.type === "dropdown" && <DropdownQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "drag_words" && <DragWordsQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "likert" && <LikertQuestion q={q} answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} />}
          {q.type === "essay" && <EssayQuestion answer={answers[q.id]} setAnswer={(a) => setAnswers((p) => ({ ...p, [q.id]: a }))} data={q.data as EssayData} />}
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
