/**
 * Builder-mode quiz player enhancements — intro slide, themed layout, feedback popups.
 */
import React from "react";
import { resolveQuizBackground } from "@shared/quizBackground";

export interface BuilderBranding {
  primaryColor?: string;
  backgroundColor?: string;
  backgroundMode?: "solid" | "image" | "gradient";
  backgroundGradient?: string;
  textColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
  backgroundOverlay?: number;
}

export interface BuilderIntroSlide {
  enabled?: boolean;
  title?: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
}

export interface BuilderResultSlide {
  enabled?: boolean;
  passTitle?: string;
  passMessage?: string;
  failTitle?: string;
  failMessage?: string;
  showScore?: boolean;
}

export function FeedbackPopup({
  type,
  message,
  imageUrl,
  videoUrl,
  onClose,
}: {
  type: "correct" | "incorrect" | "partial";
  message: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  onClose: () => void;
}) {
  const headerColor = type === "correct" ? "#22c55e" : type === "incorrect" ? "#ef4444" : "#f59e0b";
  const label = type === "correct" ? "Correct" : type === "incorrect" ? "Incorrect" : "Partial";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-24 px-4 bg-black/30">
      <div className="w-full max-w-2xl rounded-lg overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between px-4 py-2 text-white font-semibold" style={{ background: headerColor }}>
          <span>{label}</span>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">▾</button>
        </div>
        <div className="bg-white px-5 py-4 text-sm text-gray-800 leading-relaxed max-h-[60vh] overflow-y-auto">
          {message}
          {imageUrl && <img src={imageUrl} alt="Feedback" className="mt-3 max-h-56 w-full rounded border bg-gray-50 object-contain" />}
          {videoUrl && <video src={videoUrl} controls className="mt-3 max-h-56 w-full rounded bg-black" />}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="fixed bottom-6 right-6 px-6 py-2 border-2 border-white text-white font-semibold rounded hover:bg-white/10 transition-colors"
      >
        OK
      </button>
    </div>
  );
}

export function BuilderIntroScreen({
  intro,
  branding,
  quizTitle,
  questionCount,
  timeLimitMinutes,
  passingScore,
  onStart,
  disabled,
  loading,
}: {
  intro?: BuilderIntroSlide | null;
  branding?: BuilderBranding | null;
  quizTitle: string;
  questionCount: number;
  timeLimitMinutes?: number | null;
  passingScore: number;
  onStart: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const primary = branding?.primaryColor ?? "#24abbc";
  const bg = branding?.backgroundColor ?? "#0d1f3c";
  const background = resolveQuizBackground({ ...branding, backgroundColor: bg });
  const textColor = branding?.textColor ?? "#ffffff";

  if (intro?.enabled === false) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background,
        color: textColor,
        fontFamily: branding?.fontFamily,
      }}
    >
      <div className="max-w-lg w-full text-center">
        {branding?.logoUrl && <img src={branding.logoUrl} alt="" className="h-12 mx-auto mb-6 object-contain" />}
        {intro?.imageUrl && <img src={intro.imageUrl} alt="" className="w-full max-h-48 object-cover rounded-xl mb-6" />}
        <h1 className="text-3xl font-bold mb-4">{intro?.title || quizTitle}</h1>
        <p className="text-base opacity-80 mb-6">{intro?.description}</p>
        <div className="text-sm opacity-60 mb-8 space-y-1">
          <p>{questionCount} questions · Passing score: {passingScore}%</p>
          {timeLimitMinutes && <p>Time limit: {timeLimitMinutes} minutes</p>}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={disabled || loading}
          className="px-10 py-3 rounded-lg font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ background: primary }}
        >
          {loading ? "Starting..." : (intro?.buttonText || "Start Quiz")}
        </button>
      </div>
    </div>
  );
}

export function BuilderQuestionFrame({
  branding,
  question,
  children,
  footer,
}: {
  branding?: BuilderBranding | null;
  question: { backgroundColor?: string; backgroundImageUrl?: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const bg = question.backgroundColor ?? branding?.backgroundColor ?? "#0d1f3c";
  const background = resolveQuizBackground({ ...branding, backgroundColor: bg }, question);
  const textColor = branding?.textColor ?? "#ffffff";
  const primary = branding?.primaryColor ?? "#24abbc";

  return (
    <div className="min-h-screen" style={{ background: "#1a1a1a" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div
          className="relative rounded-lg overflow-hidden min-h-[70vh] flex flex-col"
          style={{
            background,
            color: textColor,
            fontFamily: branding?.fontFamily,
          }}
        >
          {branding?.logoUrl && (
            <img src={branding.logoUrl} alt="" className="absolute bottom-4 left-4 h-10 object-contain opacity-80" />
          )}
          <div className="flex-1 p-8">{children}</div>
          {footer && (
            <div className="px-8 pb-6 flex justify-end" style={{ borderTop: `1px solid ${primary}33` }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function isBuilderQuestionCorrect(q: any, givenAnswer: string): boolean {
  try {
    const given = JSON.parse(givenAnswer);
    if (q.type === "mcq" || q.type === "image_choice") {
      const data = q.data as { choices: { id: string; correct: boolean }[] };
      const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id).sort();
      const selected = (Array.isArray(given) ? given : [given]).map(String).sort();
      return JSON.stringify(correctIds) === JSON.stringify(selected);
    }
    if (q.type === "tf") {
      return given === q.data?.correct;
    }
    return false;
  } catch {
    return false;
  }
}

export function getFeedbackMessage(q: any, givenAnswer: string): { type: "correct" | "incorrect" | "partial"; message: string } {
  const correct = isBuilderQuestionCorrect(q, givenAnswer);
  const feedback = q.feedback as { correct?: string; incorrect?: string; partial?: string } | undefined;
  let selectedChoiceFeedback = "";
  if (q.type === "tf") {
    try {
      const selected = Boolean(JSON.parse(givenAnswer));
      selectedChoiceFeedback = selected ? (q.data?.trueFeedback?.trim() ?? "") : (q.data?.falseFeedback?.trim() ?? "");
    } catch {
      selectedChoiceFeedback = "";
    }
  }
  if (q.type !== "tf") {
    try {
      const selectedIds: string[] = JSON.parse(givenAnswer);
      const choices = (q.data?.choices ?? []) as { id: string; feedback?: string }[];
      const selectedFeedback = selectedIds
        .map((id) => choices.find((choice) => choice.id === id)?.feedback?.trim())
        .filter(Boolean);
      selectedChoiceFeedback = selectedFeedback.join(" ");
    } catch {
      const selected = (q.data?.choices ?? []).find((choice: { id: string }) => choice.id === givenAnswer);
      selectedChoiceFeedback = selected?.feedback?.trim() ?? "";
    }
  }
  if (correct) {
    return { type: "correct", message: selectedChoiceFeedback || feedback?.correct || q.explanation || "That's right! You answered correctly." };
  }
  return { type: "incorrect", message: selectedChoiceFeedback || feedback?.incorrect || q.explanation || "You did not choose the correct response." };
}
