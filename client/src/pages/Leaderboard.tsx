import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Trophy, Zap, Info, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Category = "overall" | "challenge" | "cases" | "flashcards";
type Period = "all" | "month" | "week";

const CATEGORY_TABS: { value: Category; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "challenge", label: "Daily Challenge" },
  { value: "cases", label: "Cases" },
  { value: "flashcards", label: "Flashcards" },
];

const PERIOD_TABS: { value: Period; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

// Points rules for the "How Points Work" sidebar
const HOW_POINTS_WORK = [
  {
    category: "Daily Challenge",
    color: "#f59e0b",
    items: [
      { label: "Correct answer", pts: "+10 pts" },
      { label: "Streak bonus (per day)", pts: "+5 pts" },
    ],
  },
  {
    category: "Cases",
    color: "#10b981",
    items: [
      { label: "Case submitted", pts: "+25 pts" },
      { label: "Case approved", pts: "+50 pts" },
    ],
  },
  {
    category: "Flashcards",
    color: "#6366f1",
    items: [
      { label: "Card viewed", pts: "+1 pt" },
      { label: "Session completed (~20 cards)", pts: "+5 pts" },
    ],
  },
];

// Rank circle colors for top 3
const RANK_COLORS = [
  { bg: "#FFD700", text: "#7a5c00", shadow: "0 0 0 3px rgba(255,215,0,0.3)" },   // Gold
  { bg: "#C0C0C0", text: "#4a4a4a", shadow: "0 0 0 3px rgba(192,192,192,0.3)" }, // Silver
  { bg: "#CD7F32", text: "#fff", shadow: "0 0 0 3px rgba(205,127,50,0.3)" },     // Bronze
];

const TEAL = "#179ca3";

export default function Leaderboard() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>("overall");
  const [period, setPeriod] = useState<Period>("all");
  const [showHowPoints, setShowHowPoints] = useState(false);

  const leaderboardQuery = trpc.quickfire.getLeaderboard.useQuery({ category, period });
  const entries = leaderboardQuery.data?.entries ?? [];
  const currentUserRank = leaderboardQuery.data?.currentUserRank ?? null;

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Hero header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `url("/manus-storage/ihe-daily-challenge-hero_6384adcf.webp")`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 py-5">
          <Link href="/" className="flex items-center gap-1 text-white/70 text-sm mb-3 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <Trophy size={20} className="text-yellow-300" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                Leaderboard
              </h1>
              <p className="text-white/70 text-xs">Top performers across the community</p>
            </div>
            {currentUserRank && (
              <div
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <Zap size={11} className="text-yellow-300" />
                Your rank: #{currentUserRank.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* ── Main leaderboard panel ── */}
          <div className="flex-1 min-w-0">
            {/* Category tabs */}
            <div className="flex gap-1 mb-3 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
              {CATEGORY_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setCategory(tab.value)}
                  className="flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all"
                  style={
                    category === tab.value
                      ? { background: TEAL, color: "white" }
                      : { color: "#6b7280" }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Period tabs */}
            <div className="flex gap-2 mb-4">
              {PERIOD_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setPeriod(tab.value)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all border"
                  style={
                    period === tab.value
                      ? { background: TEAL, color: "white", borderColor: "transparent" }
                      : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Leaderboard list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  {CATEGORY_TABS.find(t => t.value === category)?.label} &mdash; {PERIOD_TABS.find(t => t.value === period)?.label}
                </span>
                {leaderboardQuery.isLoading && (
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <div className="divide-y divide-gray-50">
                {leaderboardQuery.isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    <Trophy size={28} className="mx-auto mb-2 text-gray-200" />
                    No entries yet. Be the first to earn points!
                  </div>
                ) : (
                  entries.map((entry: any, idx: number) => {
                    const isCurrentUser = entry.isCurrentUser || String(entry.userId) === String(user?.id);
                    const rank = entry.rank ?? idx + 1;
                    const isTop3 = rank <= 3;
                    const rankColor = isTop3 ? RANK_COLORS[rank - 1] : null;

                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          isCurrentUser
                            ? "bg-teal-50 border-l-4"
                            : isTop3
                              ? "bg-amber-50/40"
                              : "hover:bg-gray-50"
                        }`}
                        style={isCurrentUser ? { borderLeftColor: TEAL } : {}}
                      >
                        {/* Rank circle */}
                        <div className="w-8 flex-shrink-0 flex items-center justify-center">
                          {isTop3 ? (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                              style={{
                                background: rankColor!.bg,
                                color: rankColor!.text,
                                boxShadow: rankColor!.shadow,
                              }}
                            >
                              {rank}
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-gray-400 w-7 text-center">
                              {rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div
                          className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white text-sm font-bold"
                          style={{ background: isTop3 ? rankColor!.bg : "linear-gradient(135deg, #179ca3, #0e4a50)" }}
                        >
                          {entry.avatarUrl ? (
                            <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span style={{ color: isTop3 ? rankColor!.text : "white" }}>
                              {(entry.displayName ?? "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Name + credential */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800 truncate">
                              {entry.displayName ?? "Anonymous"}
                            </span>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-[10px] border-teal-400 text-teal-600 px-1.5 py-0">
                                You
                              </Badge>
                            )}
                          </div>
                          {entry.credentials && (
                            <div className="text-[11px] text-gray-400 truncate">{entry.credentials}</div>
                          )}
                          {!entry.credentials && entry.city && (
                            <div className="text-[11px] text-gray-400 truncate">{entry.city}</div>
                          )}
                        </div>

                        {/* Points */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-base font-black text-gray-800">
                            {Number(entry.points ?? 0).toLocaleString()}
                            <span className="text-[11px] font-normal text-gray-400 ml-0.5">pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-3 pb-2">
              Rankings update in real time as members earn points. Updated daily.
            </p>
          </div>

          {/* ── How Points Work sidebar ── */}
          <div className="lg:w-72 flex-shrink-0">
            {/* Mobile: collapsible */}
            <div className="lg:hidden mb-3">
              <button
                onClick={() => setShowHowPoints(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm text-sm font-semibold text-gray-700"
              >
                <div className="flex items-center gap-2">
                  <Info size={15} style={{ color: TEAL }} />
                  How Points Work
                </div>
                {showHowPoints ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showHowPoints && <HowPointsPanel />}
            </div>

            {/* Desktop: always visible */}
            <div className="hidden lg:block">
              <HowPointsPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowPointsPanel() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-2 lg:mt-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Info size={15} style={{ color: TEAL }} />
        <span className="text-sm font-bold text-gray-700">How Points Work</span>
      </div>
      <div className="p-4 space-y-4">
        {HOW_POINTS_WORK.map(section => (
          <div key={section.category}>
            <div
              className="text-xs font-bold uppercase tracking-wider mb-2"
              style={{ color: section.color }}
            >
              {section.category}
            </div>
            <div className="space-y-1.5">
              {section.items.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span
                    className="text-xs font-bold rounded-full px-2 py-0.5"
                    style={{ background: section.color + "18", color: section.color }}
                  >
                    {item.pts}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Points accumulate across all activities. The Overall leaderboard shows your combined score from Daily Challenges, Cases, and Flashcards.
          </p>
        </div>
      </div>
    </div>
  );
}
