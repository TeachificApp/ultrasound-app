import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Medal, Trophy, Zap, Users } from "lucide-react";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

const isIHE = isIHeartEchoDomain();

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "allTime", label: "All Time" },
] as const;

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"7d" | "30d" | "allTime">("allTime");
  const leaderboardQuery = trpc.quickfire.getLeaderboard.useQuery({ period });
  const entries = leaderboardQuery.data?.entries ?? [];
  const currentUserRank = leaderboardQuery.data?.currentUserRank ?? null;

  const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];
  const medalBg = ["bg-yellow-50 border-yellow-200", "bg-gray-50 border-gray-200", "bg-amber-50 border-amber-200"];

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Brand Hero Banner */}
      <div
        style={{
          background: isIHE
            ? "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)"
            : "linear-gradient(135deg, #0e1e2e 0%, #1a3a5c 60%, #2563eb 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Link href="/" className="flex items-center gap-1 text-white/70 text-sm mb-3 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <Trophy size={20} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                Leaderboard
              </h1>
              <p className="text-white/70 text-xs">
                {isIHE
                  ? "iHeartEcho\u2122 Daily Challenge Champions"
                  : "All About Ultrasound\u2122 Daily Challenge Champions"}
              </p>
            </div>
          </div>

          {currentUserRank && (
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <Zap size={12} className="text-yellow-400" />
              Your rank: #{currentUserRank.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Period Filter + List */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-4">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                period === opt.value
                  ? "text-white border-transparent"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-600"
              }`}
              style={period === opt.value ? { background: isIHE ? "#189aa1" : "#2563eb", borderColor: "transparent" } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">
                Top Performers &mdash; {PERIOD_OPTIONS.find(o => o.value === period)?.label}
              </span>
            </div>
            {leaderboardQuery.isLoading && (
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {leaderboardQuery.isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Trophy size={28} className="mx-auto mb-2 text-gray-200" />
                No entries yet. Be the first to complete a Daily Challenge!
              </div>
            ) : (
              entries.map((entry: any, idx: number) => {
                const isCurrentUser = entry.isCurrentUser || String(entry.userId) === String(user?.id);
                const isTop3 = idx < 3;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isCurrentUser
                        ? "bg-teal-50 border-l-2 border-teal-400"
                        : isTop3
                          ? medalBg[idx] + " border-l-2"
                          : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-7 text-center flex-shrink-0">
                      {isTop3 ? (
                        <Medal size={20} className={medalColors[idx]} />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">
                          {entry.rank ?? idx + 1}
                        </span>
                      )}
                    </div>

                    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center">
                      {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-xs font-bold">
                          {(entry.displayName ?? "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {entry.displayName ?? "Anonymous"}
                        {isCurrentUser && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] border-teal-400 text-teal-600">
                            You
                          </Badge>
                        )}
                      </div>
                      {entry.city && (
                        <div className="text-[10px] text-gray-400 truncate">{entry.city}</div>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <div className="text-sm font-bold text-gray-800">
                        {Number(entry.correct).toLocaleString()}
                        <span className="text-[10px] font-normal text-gray-400 ml-0.5">correct</span>
                      </div>
                      <div
                        className="text-xs font-semibold"
                        style={{ color: isIHE ? "#189aa1" : "#2563eb" }}
                      >
                        {entry.accuracy ?? 0}%
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 pb-4">
          {isIHE
            ? "Rankings are based on iHeartEcho\u2122 Daily Challenge performance."
            : "Rankings are based on All About Ultrasound\u2122 Daily Challenge performance."}
          {" "}Updated daily.
        </p>
      </div>
    </div>
  );
}
