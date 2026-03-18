/**
 * FlashcardDeck.tsx
 *
 * Standalone Echo Flashcards study mode.
 * - Category filter: Adult Echo, Pediatric/Congenital Echo, Fetal Echo
 * - Spaced repetition: missed cards appear first
 * - Scoring/tracking displayed below the card
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Trophy,
  BookOpen,
  Loader2,
  RotateCw,
  Shuffle,
  ListOrdered,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Lock, Zap } from "lucide-react";
import FlashcardsBanner from "@/components/FlashcardsBanner";

type StudyMode = "sequential" | "spaced";
type EchoCategory = "all" | "acs" | "adult" | "pediatric_congenital" | "fetal" | "pocus";

const CATEGORIES: { value: EchoCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "acs", label: "ACS" },
  { value: "adult", label: "Adult Echo" },
  { value: "pediatric_congenital", label: "Pediatric Echo" },
  { value: "fetal", label: "Fetal Echo" },
  { value: "pocus", label: "POCUS" },
];

export default function FlashcardDeck() {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<EchoCategory>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<Record<number, boolean>>({});
  const [sessionComplete, setSessionComplete] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("sequential");
  // New random seed on every page visit — ensures cards never appear in the same order twice
  const [sessionSeed] = useState(() => Math.random());

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const echoCategoryParam = selectedCategory === "all" ? undefined : selectedCategory;

  const { data, isLoading, refetch } = trpc.quickfire.getFlashcardDeck.useQuery(
    { echoCategory: echoCategoryParam, limit: 100 },
    { staleTime: 30_000 }
  );

  const submitReview = trpc.quickfire.submitFlashcardReview.useMutation();
  const recordView = trpc.quickfire.recordFlashcardView.useMutation();

  // Daily limit from server
  const dailyLimit = data?.dailyLimit ?? null; // null = unlimited (premium)
  const dailySeenCount = data?.dailySeenCount ?? 0;

  // Apply study mode ordering
  const rawCards = data?.cards ?? [];
  const cards = useMemo(() => {
    if (studyMode === "spaced" && !dailyLimit) {
      // Premium spaced repetition: sort by missed-first
      return [...rawCards].sort((a, b) => {
        const aAttempts = ((a as any).gotIt ?? 0) + ((a as any).missed ?? 0);
        const bAttempts = ((b as any).gotIt ?? 0) + ((b as any).missed ?? 0);
        const aGotIt = (a as any).gotIt ?? 0;
        const bGotIt = (b as any).gotIt ?? 0;
        const aScore = aAttempts === 0 ? 0.5 : 1 - aGotIt / aAttempts;
        const bScore = bAttempts === 0 ? 0.5 : 1 - bGotIt / bAttempts;
        return bScore - aScore;
      });
    }
    // Sequential mode: shuffle using session seed so order is random on every page visit
    // (server returns date-seeded order; we re-shuffle client-side for true randomness)
    const arr = [...rawCards];
    // Fisher-Yates shuffle seeded by sessionSeed
    let seed = sessionSeed;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [rawCards, studyMode, dailyLimit, sessionSeed]);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const answeredCount = Object.keys(sessionResults).length;
  const gotItCount = Object.values(sessionResults).filter(Boolean).length;
  const missedCount = answeredCount - gotItCount;
  const sessionAccuracy = answeredCount > 0 ? Math.round((gotItCount / answeredCount) * 100) : null;
  const progressPct = totalCards > 0 ? Math.round((answeredCount / totalCards) * 100) : 0;

  // Daily limit enforcement:
  // - Authenticated free users: server tracks via DB, dailySeenCount is authoritative (no double-count)
  // - Unauthenticated users: server tracks via IP, but we add sessionAnsweredCount as a local fallback
  //   in case the IP count hasn't been incremented yet for this session
  const sessionAnsweredCount = Object.keys(sessionResults).length;
  const totalDailyUsed = isAuthenticated
    ? dailySeenCount // DB-tracked, already includes current session
    : Math.max(dailySeenCount, sessionAnsweredCount); // IP-tracked or local fallback
  const isDailyLimitReached = dailyLimit !== null && totalDailyUsed >= dailyLimit;

  function handleCategoryChange(cat: EchoCategory) {
    setSelectedCategory(cat);
    setCurrentIndex(0);
    setFlipped(false);
    setSessionResults({});
    setSessionComplete(false);
  }

  function handleModeChange(mode: StudyMode) {
    setStudyMode(mode);
    setCurrentIndex(0);
    setFlipped(false);
    setSessionResults({});
    setSessionComplete(false);
  }

  function handleFlip() {
    setFlipped((f) => !f);
  }

  function handleMark(gotIt: boolean) {
    if (!currentCard) return;
    const newResults = { ...sessionResults, [currentCard.id]: gotIt };
    setSessionResults(newResults);

    if (isAuthenticated) {
      submitReview.mutate({ questionId: currentCard.id, gotIt });
    } else {
      // Track IP-based daily count for unauthenticated users
      recordView.mutate({ count: 1 });
    }

    setFlipped(false);

    const nextIndex = cards.findIndex((c, i) => i > currentIndex && !newResults[c.id]);
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex);
    } else {
      const allAnswered = cards.every((c) => newResults[c.id] !== undefined);
      if (allAnswered) {
        setSessionComplete(true);
      } else {
        const firstUnanswered = cards.findIndex((c) => !newResults[c.id]);
        if (firstUnanswered !== -1) {
          setCurrentIndex(firstUnanswered);
        } else {
          setSessionComplete(true);
        }
      }
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setFlipped(false);
    }
  }

  function handleNext() {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  function handleRestart() {
    setCurrentIndex(0);
    setFlipped(false);
    setSessionResults({});
    setSessionComplete(false);
    refetch();
  }

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <div className="container py-16 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
          <p className="text-gray-500">Loading flashcards…</p>
        </div>
      </Layout>
    );
  }

  // ── Render: Empty State ───────────────────────────────────────────────────
  if (totalCards === 0) {
    return (
      <Layout>
        <div className="container py-16 flex flex-col items-center gap-4 text-center">
          <Layers className="w-12 h-12 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-700">No flashcards available</h2>
          <p className="text-gray-500 max-w-sm">
            {selectedCategory !== "all"
              ? "No flashcards found for this category. Try selecting a different one."
              : "Flashcards are added by admins via the AI Generate tool. Check back soon!"}
          </p>
          {selectedCategory !== "all" && (
            <Button variant="outline" onClick={() => handleCategoryChange("all")}>
              View All Categories
            </Button>
          )}
        </div>
      </Layout>
    );
  }

  // ── Render: Session Complete ──────────────────────────────────────────────
  if (sessionComplete) {
    return (
      <Layout>
        <div className="container py-12 max-w-lg mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-[#189aa1]/20">
            <Trophy className="w-14 h-14 text-[#189aa1] mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              Session Complete!
            </h2>
            <p className="text-gray-500 mb-6">You reviewed all the flashcards.</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600">{gotItCount}</div>
                <div className="text-xs text-green-700 font-medium">Got It</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-500">{missedCount}</div>
                <div className="text-xs text-red-600 font-medium">Missed</div>
              </div>
              <div className="bg-[#f0fbfc] rounded-xl p-4">
                <div className="text-2xl font-bold text-[#189aa1]">{sessionAccuracy ?? 0}%</div>
                <div className="text-xs text-[#189aa1] font-medium">Accuracy</div>
              </div>
            </div>

            {missedCount > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                Next session, the {missedCount} missed card{missedCount !== 1 ? "s" : ""} will appear first.
              </p>
            )}

            <Button
              onClick={handleRestart}
              className="w-full text-white font-bold"
              style={{ background: "#189aa1" }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Study Again
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Render: Daily Limit Gate ─────────────────────────────────────────────
  if (isDailyLimitReached) {
    return (
      <Layout>
        <div className="container py-12 max-w-lg mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-[#189aa1]/20">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              Daily Limit Reached
            </h2>
            <p className="text-gray-500 mb-2">
              You've reviewed <strong>{dailyLimit} flashcards</strong> today — great work!
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Free members get {dailyLimit} flashcards per day. Come back tomorrow for a fresh set, or upgrade to Premium for unlimited access.
            </p>
            <div className="bg-gradient-to-br from-[#0e1e2e] to-[#0e4a50] rounded-xl p-5 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#4ad9e0]" />
                <span className="text-xs font-bold text-[#4ad9e0] uppercase tracking-wider">Premium Membership</span>
              </div>
              <p className="text-white font-bold text-sm mb-1">Unlimited Echo Flashcards</p>
              <p className="text-white/60 text-xs">Study as many flashcards as you want, every day — plus spaced repetition, all categories, and the full iHeartEcho clinical suite.</p>
            </div>
            <Link href="/premium">
              <Button className="w-full text-white font-bold mb-3" style={{ background: "#189aa1" }}>
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </Link>
            <p className="text-xs text-gray-400">Your daily limit resets at midnight UTC. Come back tomorrow for {dailyLimit} new cards!</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Render: Main Deck ─────────────────────────────────────────────────────
  const alreadyAnswered = currentCard ? sessionResults[currentCard.id] !== undefined : false;
  const thisResult = currentCard ? sessionResults[currentCard.id] : undefined;

  return (
    <Layout>
      {/* Full-width hero banner */}
      <FlashcardsBanner
        streak={data?.userStats ? (data.userStats as any).streak ?? 0 : 0}
        totalCards={data?.totalCards ?? 0}
        isPremium={dailyLimit === null}
      />
      <div className="container py-4 max-w-2xl mx-auto">
        {/* Header — compact */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#189aa1]" />
            <h1 className="text-lg font-black text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              Echo Flashcards
            </h1>
          </div>
          {/* Daily usage indicator for free users */}
          {dailyLimit !== null && (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={totalDailyUsed >= dailyLimit * 0.8 ? "text-orange-500" : "text-gray-400"}>
                {totalDailyUsed}/{dailyLimit} today
              </span>
              {totalDailyUsed >= dailyLimit * 0.8 && (
                <Link href="/premium">
                  <span className="text-[#189aa1] underline cursor-pointer">Upgrade</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleCategoryChange(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedCategory === value
                  ? "bg-[#189aa1] text-white border-[#189aa1]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Study Mode Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => handleModeChange("sequential")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
                studyMode === "sequential"
                  ? "bg-[#189aa1] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Sequential
            </button>
            <button
              onClick={() => handleModeChange("spaced")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all border-l border-gray-200 ${
                studyMode === "spaced"
                  ? "bg-[#189aa1] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              Spaced
            </button>
          </div>
        </div>

        {/* Flip Card */}
        {currentCard && (
          <div className="mb-4">
            <div className="flashcard-scene cursor-pointer" onClick={handleFlip}>
              <div
                className={`flashcard-card${flipped ? " is-flipped" : ""}`}
              >
                {/* Front face */}
                <div
                  ref={frontRef}
                  className="flashcard-face flashcard-face--front"
                  style={{ background: "linear-gradient(135deg, #0e4a50 0%, #189aa1 100%)", border: "none" }}
                >
                  <p className="text-white font-bold text-lg leading-snug mb-4" style={{ fontFamily: "Merriweather, serif" }}>
                    {currentCard.question}
                  </p>
                  <div className="flex items-center gap-1.5 text-white/60 text-xs mt-auto">
                    <RotateCw className="w-3.5 h-3.5" />
                    Tap to reveal answer
                  </div>
                </div>

                {/* Back face */}
                <div
                  ref={backRef}
                  className="flashcard-face flashcard-face--back"
                  style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 100%)", border: "none" }}
                >
                  <p className="text-[#4ad9e0] font-bold text-lg leading-snug mb-3" style={{ fontFamily: "Merriweather, serif" }}>
                    {currentCard.reviewAnswer ?? currentCard.explanation ?? "No answer provided."}
                  </p>
                  {currentCard.explanation && currentCard.reviewAnswer && (
                    <p className="text-white/60 text-sm leading-relaxed mt-2">
                      {currentCard.explanation}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-white/40 text-xs mt-auto">
                    <RotateCw className="w-3.5 h-3.5" />
                    Tap to flip back
                  </div>
                </div>
              </div>
            </div>

            {/* Mark Buttons — only shown when flipped and not yet answered */}
            {flipped && !alreadyAnswered && (
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={(e) => { e.stopPropagation(); handleMark(false); }}
                  variant="outline"
                  className="flex-1 border-red-200 text-red-500 hover:bg-red-50 font-bold"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Missed It
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleMark(true); }}
                  className="flex-1 text-white font-bold"
                  style={{ background: "#189aa1" }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Got It!
                </Button>
              </div>
            )}

            {/* Already answered indicator */}
            {alreadyAnswered && (
              <div className={`mt-4 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-2 ${
                thisResult ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
              }`}>
                {thisResult ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {thisResult ? "Got It" : "Missed It"}
              </div>
            )}
          </div>
        )}

        {/* Scoring / Progress — below the card */}
        {answeredCount > 0 && (
          <div className="mb-4 bg-white rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <div className="flex items-center gap-4">
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {gotItCount} Got It
                </span>
                <span className="text-red-500 font-semibold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {missedCount} Missed
                </span>
              </div>
              {sessionAccuracy !== null && (
                <span className="text-[#189aa1] font-bold">{sessionAccuracy}% accuracy</span>
              )}
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            className="gap-1 text-gray-500"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentIndex === totalCards - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* User All-Time Stats (if authenticated) */}
        {data?.userStats && (
          <div className="mt-5 bg-[#f0fbfc] rounded-xl p-4 border border-[#189aa1]/20">
            <h3 className="text-xs font-bold text-[#189aa1] uppercase tracking-wider mb-2">Your All-Time Stats</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-gray-800">{data.userStats.totalAttempts}</div>
                <div className="text-xs text-gray-500">Reviews</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">{data.userStats.totalGotIt}</div>
                <div className="text-xs text-gray-500">Got It</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#189aa1]">
                  {data.userStats.accuracy !== null ? `${data.userStats.accuracy}%` : "—"}
                </div>
                <div className="text-xs text-gray-500">Accuracy</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
