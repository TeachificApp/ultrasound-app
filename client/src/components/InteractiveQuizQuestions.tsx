/**
 * InteractiveQuizQuestions.tsx
 * Player and editor components for all 8 new interactive question types:
 * image_comparison, drag_sort, branching, fill_blank, annotation, flashcard,
 * plus enhanced hotspot and matching (already exist but get improved editors here).
 *
 * PLAYER: <InteractiveQuestionPlayer question={q} submitted={bool} onAnswer={fn} answer={val} />
 * EDITOR: <InteractiveQuestionEditor question={q} onChange={fn} />
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  GripVertical, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  ArrowRight, ChevronLeft, ChevronRight, Upload, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InteractiveQuestionType =
  | "image_comparison" | "drag_sort" | "branching" | "fill_blank"
  | "annotation" | "flashcard";

export interface InteractiveQuestion {
  id?: number;
  type: string;
  question?: string;
  // image_comparison
  comparisonImageA?: string | null;
  comparisonImageB?: string | null;
  comparisonLabelA?: string | null;
  comparisonLabelB?: string | null;
  // drag_sort
  dragItems?: string | null; // JSON: [{id,text,imageUrl?}]
  // branching
  branchingConfig?: string | null; // JSON: {scenario, choices:[{text,outcome,isCorrect}]}
  // fill_blank
  fillBlankTemplate?: string | null;
  fillBlankAnswers?: string | null; // JSON: string[][]
  // annotation
  annotationImageUrl?: string | null;
  annotationTargetZones?: string | null; // JSON: [{x,y,radius,label}]
  // flashcard
  flashcardFront?: string | null;
  flashcardBack?: string | null;
  // scoring
  explanation?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

// ─── IMAGE COMPARISON PLAYER ─────────────────────────────────────────────────

export function ImageComparisonPlayer({ question, submitted }: { question: InteractiveQuestion; submitted: boolean }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stop);
    };
  }, [handleMouseMove, handleTouchMove]);

  if (!question.comparisonImageA || !question.comparisonImageB) {
    return <div className="text-sm text-gray-400 italic">Images not configured.</div>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Drag the slider to compare the two images</p>
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-gray-200 select-none cursor-col-resize"
        onMouseDown={() => { dragging.current = true; }}
        onTouchStart={() => { dragging.current = true; }}
      >
        {/* Image B (right, full) */}
        <img src={question.comparisonImageB} alt={question.comparisonLabelB ?? "Image B"} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        {/* Image A (left, clipped) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img src={question.comparisonImageA} alt={question.comparisonLabelA ?? "Image A"} className="absolute inset-0 w-full h-full object-cover" style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: "none" }} draggable={false} />
        </div>
        {/* Slider handle */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md border-2 border-teal-500 flex items-center justify-center">
            <ChevronLeft className="w-3 h-3 text-teal-600" />
            <ChevronRight className="w-3 h-3 text-teal-600" />
          </div>
        </div>
        {/* Labels */}
        {question.comparisonLabelA && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{question.comparisonLabelA}</div>
        )}
        {question.comparisonLabelB && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{question.comparisonLabelB}</div>
        )}
      </div>
      {submitted && (
        <p className="text-xs text-teal-600 font-medium">✓ Image comparison reviewed</p>
      )}
    </div>
  );
}

// ─── DRAG-SORT PLAYER ────────────────────────────────────────────────────────

interface DragItem { id: string; text: string; imageUrl?: string; }

export function DragSortPlayer({
  question, submitted, onAnswer, answer,
}: {
  question: InteractiveQuestion;
  submitted: boolean;
  onAnswer: (val: string[]) => void;
  answer?: string[];
}) {
  const correctOrder: DragItem[] = safeJson(question.dragItems, []);
  const [items, setItems] = useState<DragItem[]>(() => {
    if (answer && answer.length > 0) {
      return answer.map(id => correctOrder.find(i => i.id === id) ?? { id, text: id });
    }
    return [...correctOrder].sort(() => Math.random() - 0.5);
  });
  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDrop = (idx: number) => {
    if (dragIdx.current === null || submitted) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    onAnswer(next.map(i => i.id));
    dragIdx.current = null;
  };

  const isCorrect = submitted && items.every((item, i) => item.id === correctOrder[i]?.id);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">{submitted ? "" : "Drag items into the correct order"}</p>
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const correctPos = correctOrder.findIndex(c => c.id === item.id);
          const posCorrect = submitted && idx === correctPos;
          const posWrong = submitted && idx !== correctPos;
          return (
            <div
              key={item.id}
              draggable={!submitted}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                posCorrect ? "border-green-400 bg-green-50 text-green-800" :
                posWrong ? "border-red-300 bg-red-50 text-red-700" :
                submitted ? "border-gray-200 bg-gray-50 text-gray-600" :
                "border-gray-200 bg-white text-gray-700 cursor-grab hover:border-teal-300 hover:bg-teal-50/30"
              }`}
            >
              {!submitted && <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />}
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
              {item.imageUrl && <img src={item.imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />}
              <span className="flex-1">{item.text}</span>
              {posCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              {posWrong && (
                <span className="text-xs text-red-500 shrink-0">→ #{correctPos + 1}</span>
              )}
            </div>
          );
        })}
      </div>
      {submitted && (
        <p className={`text-xs font-medium ${isCorrect ? "text-green-600" : "text-amber-600"}`}>
          {isCorrect ? "✓ Correct order!" : "Review the correct order above"}
        </p>
      )}
    </div>
  );
}

// ─── BRANCHING SCENARIO PLAYER ───────────────────────────────────────────────

interface BranchingChoice { text: string; outcome: string; isCorrect: boolean; }
interface BranchingConfig { scenario: string; choices: BranchingChoice[]; }

export function BranchingPlayer({
  question, submitted, onAnswer, answer,
}: {
  question: InteractiveQuestion;
  submitted: boolean;
  onAnswer: (val: number) => void;
  answer?: number;
}) {
  const config: BranchingConfig = safeJson(question.branchingConfig, { scenario: "", choices: [] });
  const selected = answer;

  return (
    <div className="space-y-3">
      {config.scenario && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 leading-relaxed">
          <span className="font-semibold text-blue-600 text-xs uppercase tracking-wide block mb-1">Clinical Scenario</span>
          {config.scenario}
        </div>
      )}
      <p className="text-xs text-gray-400">Choose the best course of action:</p>
      <div className="space-y-2">
        {config.choices.map((choice, idx) => {
          const isSelected = selected === idx;
          const showOutcome = submitted && isSelected;
          const isCorrect = submitted && isSelected && choice.isCorrect;
          const isWrong = submitted && isSelected && !choice.isCorrect;
          const showCorrectHint = submitted && !isSelected && choice.isCorrect;
          return (
            <div key={idx} className="space-y-1">
              <button
                disabled={submitted}
                onClick={() => !submitted && onAnswer(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-start gap-2 ${
                  isCorrect ? "border-green-400 bg-green-50 text-green-800" :
                  isWrong ? "border-red-300 bg-red-50 text-red-700" :
                  showCorrectHint ? "border-green-200 bg-green-50/50 text-green-700" :
                  isSelected ? "border-teal-400 bg-teal-50 text-teal-800" :
                  submitted ? "border-gray-200 bg-gray-50 text-gray-400" :
                  "border-gray-200 hover:border-teal-300 hover:bg-teal-50/30 text-gray-700"
                }`}
              >
                <ArrowRight className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-teal-500" : "text-gray-300"}`} />
                {choice.text}
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto shrink-0" />}
                {isWrong && <XCircle className="w-4 h-4 text-red-500 ml-auto shrink-0" />}
              </button>
              {showOutcome && choice.outcome && (
                <div className={`ml-6 px-3 py-2 rounded-lg text-xs ${isCorrect ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {choice.outcome}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FILL-IN-THE-BLANK PLAYER ────────────────────────────────────────────────

export function FillBlankPlayer({
  question, submitted, onAnswer, answer,
}: {
  question: InteractiveQuestion;
  submitted: boolean;
  onAnswer: (val: string[]) => void;
  answer?: string[];
}) {
  const template = question.fillBlankTemplate ?? "";
  const correctAnswers: string[][] = safeJson(question.fillBlankAnswers, []);
  const parts = template.split(/\{\{blank\}\}/gi);
  const blankCount = parts.length - 1;
  const [inputs, setInputs] = useState<string[]>(() => answer ?? Array(blankCount).fill(""));

  const setInput = (idx: number, val: string) => {
    const next = [...inputs];
    next[idx] = val;
    setInputs(next);
    onAnswer(next);
  };

  const isBlankCorrect = (idx: number) => {
    const correct = correctAnswers[idx] ?? [];
    const userVal = (inputs[idx] ?? "").trim().toLowerCase();
    return correct.some(c => c.trim().toLowerCase() === userVal);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Fill in each blank with the correct term</p>
      <div className="text-sm text-gray-800 leading-relaxed flex flex-wrap items-center gap-1">
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            <span>{part}</span>
            {idx < blankCount && (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  disabled={submitted}
                  value={inputs[idx] ?? ""}
                  onChange={e => setInput(idx, e.target.value)}
                  placeholder="___"
                  className={`inline-block w-28 px-2 py-0.5 rounded border-b-2 text-sm text-center font-medium outline-none transition-colors ${
                    submitted
                      ? isBlankCorrect(idx)
                        ? "border-green-400 bg-green-50 text-green-800"
                        : "border-red-300 bg-red-50 text-red-700"
                      : "border-teal-400 bg-teal-50/30 focus:bg-teal-50 text-gray-800"
                  }`}
                />
                {submitted && !isBlankCorrect(idx) && correctAnswers[idx] && (
                  <span className="text-xs text-green-600 font-medium">({correctAnswers[idx][0]})</span>
                )}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      {submitted && (
        <p className={`text-xs font-medium ${inputs.every((_, i) => isBlankCorrect(i)) ? "text-green-600" : "text-amber-600"}`}>
          {inputs.every((_, i) => isBlankCorrect(i)) ? "✓ All blanks correct!" : "Review the correct answers above"}
        </p>
      )}
    </div>
  );
}

// ─── ANNOTATION PLAYER ───────────────────────────────────────────────────────

interface AnnotationZone { x: number; y: number; radius: number; label: string; }

export function AnnotationPlayer({
  question, submitted, onAnswer, answer,
}: {
  question: InteractiveQuestion;
  submitted: boolean;
  onAnswer: (val: { x: number; y: number } | null) => void;
  answer?: { x: number; y: number } | null;
}) {
  const zones: AnnotationZone[] = safeJson(question.annotationTargetZones, []);
  const [click, setClick] = useState<{ x: number; y: number } | null>(answer ?? null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (submitted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100 * 10) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100 * 10) / 10;
    setClick({ x, y });
    onAnswer({ x, y });
  };

  const isHit = () => {
    if (!click) return false;
    return zones.some(z => Math.hypot(z.x - click.x, z.y - click.y) <= z.radius);
  };

  if (!question.annotationImageUrl) {
    return <div className="text-sm text-gray-400 italic">Image not configured.</div>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">{submitted ? "" : "Click on the image to mark your answer"}</p>
      <div
        className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-gray-200 cursor-crosshair"
        onClick={handleClick}
      >
        <img src={question.annotationImageUrl} alt="Annotation" className="w-full h-full object-cover" draggable={false} />
        {/* User click marker */}
        {click && (
          <div
            className={`absolute w-5 h-5 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 ${
              submitted ? (isHit() ? "bg-green-400/80 border-green-600" : "bg-red-400/80 border-red-600") : "bg-teal-400/80 border-teal-600"
            }`}
            style={{ left: `${click.x}%`, top: `${click.y}%` }}
          />
        )}
        {/* Show correct zones after submit */}
        {submitted && zones.map((z, i) => (
          <div
            key={i}
            className="absolute border-2 border-green-500 bg-green-400/20 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.radius * 2}%`, height: `${z.radius * 2}%` }}
          >
            <span className="text-green-700 text-xs font-bold text-center leading-tight">{z.label}</span>
          </div>
        ))}
      </div>
      {submitted && (
        <p className={`text-xs font-medium ${isHit() ? "text-green-600" : "text-amber-600"}`}>
          {!click ? "No annotation placed" : isHit() ? "✓ Correct area identified!" : "Not quite — see the highlighted correct area"}
        </p>
      )}
    </div>
  );
}

// ─── FLASHCARD PLAYER ────────────────────────────────────────────────────────

export function FlashcardPlayer({
  question, submitted, onAnswer, answer,
}: {
  question: InteractiveQuestion;
  submitted: boolean;
  onAnswer: (val: "know" | "review") => void;
  answer?: "know" | "review";
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{flipped ? "Back of card" : "Click the card to reveal the answer"}</p>
      {/* Flip card */}
      <div
        className="relative w-full min-h-[160px] cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex items-center justify-center p-6 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white text-gray-800 text-sm font-medium text-center"
            style={{ backfaceVisibility: "hidden" }}
            dangerouslySetInnerHTML={{ __html: question.flashcardFront ?? question.question ?? "" }}
          />
          {/* Back */}
          <div
            className="absolute inset-0 flex items-center justify-center p-6 rounded-2xl border-2 border-[#189aa1] bg-gradient-to-br from-[#189aa1]/10 to-white text-gray-800 text-sm text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            dangerouslySetInnerHTML={{ __html: question.flashcardBack ?? "" }}
          />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
        <RefreshCw className="w-3 h-3" /> Click to flip
      </div>
      {/* Self-assessment buttons (shown after flip) */}
      {flipped && !submitted && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={e => { e.stopPropagation(); onAnswer("review"); }}
          >
            Review Again
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={e => { e.stopPropagation(); onAnswer("know"); }}
          >
            Got It ✓
          </Button>
        </div>
      )}
      {submitted && answer && (
        <p className={`text-xs font-medium text-center ${answer === "know" ? "text-green-600" : "text-amber-600"}`}>
          {answer === "know" ? "✓ Marked as known" : "Marked for review"}
        </p>
      )}
    </div>
  );
}

// ─── UNIFIED INTERACTIVE QUESTION PLAYER ─────────────────────────────────────

export function InteractiveQuestionPlayer({
  question,
  submitted,
  onAnswer,
  answer,
}: {
  question: InteractiveQuestion;
  submitted: boolean;
  onAnswer: (val: any) => void;
  answer?: any;
}) {
  switch (question.type) {
    case "image_comparison":
      return <ImageComparisonPlayer question={question} submitted={submitted} />;
    case "drag_sort":
      return <DragSortPlayer question={question} submitted={submitted} onAnswer={onAnswer} answer={answer} />;
    case "branching":
      return <BranchingPlayer question={question} submitted={submitted} onAnswer={onAnswer} answer={answer} />;
    case "fill_blank":
      return <FillBlankPlayer question={question} submitted={submitted} onAnswer={onAnswer} answer={answer} />;
    case "annotation":
      return <AnnotationPlayer question={question} submitted={submitted} onAnswer={onAnswer} answer={answer} />;
    case "flashcard":
      return <FlashcardPlayer question={question} submitted={submitted} onAnswer={onAnswer} answer={answer} />;
    default:
      return null;
  }
}

// ─── SCORING HELPERS ─────────────────────────────────────────────────────────

/** Returns true if the student's answer is correct for the given interactive question type */
export function scoreInteractiveAnswer(question: InteractiveQuestion, answer: any): boolean {
  switch (question.type) {
    case "image_comparison":
      return true; // informational — always "correct"
    case "drag_sort": {
      const correct: DragItem[] = safeJson(question.dragItems, []);
      const ans: string[] = answer ?? [];
      return correct.length > 0 && ans.every((id, i) => id === correct[i]?.id);
    }
    case "branching": {
      const config: BranchingConfig = safeJson(question.branchingConfig, { scenario: "", choices: [] });
      const idx: number = answer ?? -1;
      return config.choices[idx]?.isCorrect === true;
    }
    case "fill_blank": {
      const correctAnswers: string[][] = safeJson(question.fillBlankAnswers, []);
      const inputs: string[] = answer ?? [];
      return correctAnswers.every((ca, i) => ca.some(c => c.trim().toLowerCase() === (inputs[i] ?? "").trim().toLowerCase()));
    }
    case "annotation": {
      const zones: AnnotationZone[] = safeJson(question.annotationTargetZones, []);
      const click: { x: number; y: number } | null = answer;
      if (!click) return false;
      return zones.some(z => Math.hypot(z.x - click.x, z.y - click.y) <= z.radius);
    }
    case "flashcard":
      return answer === "know"; // self-assessed
    default:
      return false;
  }
}

/** Returns true if the question type is "survey-like" (no correct answer, always passes) */
export function isInteractiveSurveyType(type: string): boolean {
  return type === "image_comparison" || type === "flashcard";
}
