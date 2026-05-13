/**
 * Engagement Dashboard — Platform Admin Only
 * Real usage metrics for daily challenges, flashcards, and case library.
 * Includes 30-day activity charts, per-member summary table, and drill-down modal.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Zap, BookOpen, Activity, TrendingUp, ChevronRight,
  Search, X, Award, Calendar, CheckCircle2, Star, ArrowLeft,
  Loader2, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BRAND = "#189aa1";
const BRAND_LIGHT = "#4ad9e0";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function pct(correct: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((correct / total) * 100)}%`;
}

// Fill in missing days in a 30-day series
function fillDays(rows: { day: string; total: number; correct?: number }[], days = 30) {
  const map = new Map(rows.map((r) => [r.day, r]));
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const existing = map.get(key);
    result.push({ day: label, total: existing?.total ?? 0, correct: existing?.correct ?? 0 });
  }
  return result;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? fmtNum(value) : value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Member Drill-Down Modal ──────────────────────────────────────────────────

function MemberDrilldown({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, isLoading, error } = trpc.engagement.getMemberDrilldown.useQuery({ userId });

  const challengeChart = useMemo(
    () => fillDays((data?.challengeByDay ?? []).map((r) => ({ day: r.day, total: r.total, correct: r.correct })), 30),
    [data]
  );
  const flashcardChart = useMemo(
    () => fillDays((data?.flashcardByDay ?? []).map((r) => ({ day: r.day, total: r.total, correct: r.correct })), 30),
    [data]
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: BRAND }} />
            Member Activity Drill-Down
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-500 py-8 justify-center">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load member data.</span>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Profile header */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                style={{ background: BRAND }}>
                {(data.user.name ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900">{data.user.name}</h3>
                  {data.user.isPremium && (
                    <Badge className="text-[10px] px-1.5 py-0" style={{ background: "#f59e0b", color: "#fff" }}>
                      <Star className="w-2.5 h-2.5 mr-0.5" /> Premium
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">{data.user.email}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span>Joined {fmtDate(data.user.joinedAt)}</span>
                  <span>Last seen {fmtDate(data.user.lastSignedIn)}</span>
                </div>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 text-center" style={{ background: BRAND + "10" }}>
                <p className="text-xl font-bold" style={{ color: BRAND }}>{fmtNum(data.summary.challengeAttempts)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Challenge Attempts</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: BRAND }}>
                  {pct(data.summary.challengeCorrect, data.summary.challengeAttempts)} correct
                </p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "#7c3aed10" }}>
                <p className="text-xl font-bold text-purple-600">{fmtNum(data.summary.flashcardAttempts)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Flashcard Reviews</p>
                <p className="text-xs font-semibold mt-0.5 text-purple-600">
                  {pct(data.summary.flashcardCorrect, data.summary.flashcardAttempts)} self-correct
                </p>
              </div>
              <div className="rounded-lg p-3 text-center bg-blue-50">
                <p className="text-xl font-bold text-blue-600">{fmtNum(data.summary.caseCompletions)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Cases Completed</p>
              </div>
            </div>

            {/* Challenge activity chart */}
            {data.summary.challengeAttempts > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" style={{ color: BRAND }} /> Daily Challenge Activity (last 30 days)
                </h4>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={challengeChart} barSize={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" fill={BRAND} name="Attempts" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="correct" fill={BRAND_LIGHT} name="Correct" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Flashcard activity chart */}
            {data.summary.flashcardAttempts > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-500" /> Flashcard Activity (last 30 days)
                </h4>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={flashcardChart} barSize={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" fill="#7c3aed" name="Reviews" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="correct" fill="#a78bfa" name="Self-Correct" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Case completions */}
            {data.caseCompletions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-500" /> Recent Case Completions
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {data.caseCompletions.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{c.caseTitle}</p>
                        <p className="text-[10px] text-gray-400">{c.modality} · {c.difficulty}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-700">{c.score}/{c.totalQuestions}</p>
                        <p className="text-[10px] text-gray-400">{fmtDate(c.completedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Points log */}
            {data.pointsHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-yellow-500" /> Recent Points Activity
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {data.pointsHistory.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-50 text-xs">
                      <span className="text-gray-600 truncate flex-1">{p.activityType.replace(/_/g, " ")}</span>
                      <span className={`font-bold ml-2 flex-shrink-0 ${p.points >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {p.points >= 0 ? "+" : ""}{p.points} pts
                      </span>
                      <span className="text-gray-400 ml-3 flex-shrink-0">{fmtDate(p.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EngagementDashboard() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [drilldownUserId, setDrilldownUserId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 400);
  };

  const overviewQuery = trpc.engagement.getOverview.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });

  const memberQuery = trpc.engagement.getMemberList.useQuery(
    { limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: debouncedSearch || undefined },
    { staleTime: 60_000, retry: false }
  );

  const overview = overviewQuery.data;
  const members = memberQuery.data?.members ?? [];
  const totalMembers = memberQuery.data?.total ?? 0;

  // Build combined 30-day chart data
  const combinedChart = useMemo(() => {
    if (!overview) return [];
    const challengeFilled = fillDays(overview.dailyChallenge);
    const flashcardFilled = fillDays(overview.dailyFlashcard);
    const caseViewFilled = fillDays(overview.dailyCaseViews);
    return challengeFilled.map((c, i) => ({
      day: c.day,
      challenges: c.total,
      flashcards: flashcardFilled[i]?.total ?? 0,
      caseViews: caseViewFilled[i]?.total ?? 0,
    }));
  }, [overview]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Please log in to access this page.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/platform-admin">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: BRAND }} />
            <h1 className="text-lg font-bold text-gray-900">Engagement Dashboard</h1>
          </div>
          <Badge className="text-[10px] px-2 py-0.5 ml-1" style={{ background: BRAND + "15", color: BRAND, border: "none" }}>
            Platform Admin
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Error state */}
        {overviewQuery.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Overview error: {overviewQuery.error.message}</span>
          </div>
        )}
        {memberQuery.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Member list error: {memberQuery.error.message}</span>
          </div>
        )}

        {/* KPI Cards */}
        {overviewQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm animate-pulse">
                <CardContent className="p-5 h-20 bg-gray-100 rounded-xl" />
              </Card>
            ))}
          </div>
        ) : overview ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard icon={Users} label="Active Users (ever)" value={overview.totals.uniqueActiveUsers} color={BRAND} />
            <KpiCard icon={Zap} label="Challenge Attempts" value={overview.totals.challengeAttempts} color={BRAND} />
            <KpiCard icon={Activity} label="Flashcard Reviews" value={overview.totals.flashcardAttempts} color="#7c3aed" />
            <KpiCard icon={BookOpen} label="Cases Completed" value={overview.totals.caseAttempts} color="#2563eb" />
            <KpiCard icon={TrendingUp} label="Case Views" value={overview.totals.caseViews} color="#059669" />
          </div>
        ) : null}

        {/* 30-Day Activity Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: BRAND }} />
              Platform Activity — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewQuery.isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={combinedChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="challenges" stroke={BRAND} strokeWidth={2} dot={false} name="Challenges" />
                  <Line type="monotone" dataKey="flashcards" stroke="#7c3aed" strokeWidth={2} dot={false} name="Flashcards" />
                  <Line type="monotone" dataKey="caseViews" stroke="#2563eb" strokeWidth={2} dot={false} name="Case Views" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Member Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: BRAND }} />
                Member Engagement
                {totalMembers > 0 && (
                  <span className="text-xs font-normal text-gray-400 ml-1">({fmtNum(totalMembers)} total)</span>
                )}
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Search name or email…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {search && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setSearch(""); setDebouncedSearch(""); }}>
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {memberQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No members found.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Member</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Challenges</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Accuracy</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Flashcards</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Cases</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Last Active</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500">Status</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setDrilldownUserId(m.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                style={{ background: BRAND }}>
                                {(m.name ?? "?")[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate max-w-[140px]">{m.name}</p>
                                <p className="text-gray-400 truncate max-w-[140px]">{m.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-semibold ${m.challengeAttempts > 0 ? "text-gray-800" : "text-gray-300"}`}>
                              {fmtNum(m.challengeAttempts)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={m.challengeAttempts > 0 ? "font-semibold text-green-600" : "text-gray-300"}>
                              {pct(m.challengeCorrect, m.challengeAttempts)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-semibold ${m.flashcardAttempts > 0 ? "text-purple-600" : "text-gray-300"}`}>
                              {fmtNum(m.flashcardAttempts)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-semibold ${m.caseCompletions > 0 ? "text-blue-600" : "text-gray-300"}`}>
                              {fmtNum(m.caseCompletions)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-500">
                            {fmtDate(m.lastSignedIn)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {m.isDemo ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Demo</span>
                            ) : m.isPremium ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#fef3c7", color: "#b45309" }}>Premium</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Free</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ChevronRight className="w-4 h-4 text-gray-300 mx-auto" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalMembers > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalMembers)} of {fmtNum(totalMembers)}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= totalMembers} onClick={() => setPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drill-down modal */}
      {drilldownUserId !== null && (
        <MemberDrilldown userId={drilldownUserId} onClose={() => setDrilldownUserId(null)} />
      )}
    </div>
  );
}
