import { trpc } from "@/lib/trpc";
import { BarChart3, Users, Clock, Award, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, XCircle, HelpCircle, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuizStore } from "../store/quizStore";

interface QuizAnalyticsPanelProps {
  quizId: number | null;
}

export default function QuizAnalyticsPanel({ quizId }: QuizAnalyticsPanelProps) {
  const [showAttempts, setShowAttempts] = useState(false);
  const [showQuestionDetails, setShowQuestionDetails] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const { quiz } = useQuizStore();
  const groups = quiz.meta.groups || [];

  const { data: analytics, isLoading: analyticsLoading } = trpc.quizMaker.getQuizAnalytics.useQuery(
    { quizId: quizId! },
    { enabled: !!quizId }
  );

  const { data: questionAnalytics, isLoading: questionLoading } = trpc.quizMaker.getQuestionAnalytics.useQuery(
    { quizId: quizId! },
    { enabled: !!quizId }
  );

  const { data: attemptsData, isLoading: attemptsLoading } = trpc.quizMaker.getAttempts.useQuery(
    { quizId: quizId!, limit: 20, offset: 0 },
    { enabled: !!quizId && showAttempts }
  );

  if (!quizId) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Save and publish your quiz to see analytics.</p>
      </div>
    );
  }

  if (analyticsLoading) {
    return (
      <div className="p-6 text-center">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium text-gray-600 mb-1">No attempts yet</p>
        <p>Publish your quiz and share the link to start collecting responses.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> Quiz Analytics
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] text-gray-500">Total Attempts</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{analytics.totalAttempts}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] text-gray-500">Avg Score</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{analytics.averageScore}%</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Award className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] text-gray-500">Pass Rate</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{analytics.passRate}%</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px] text-gray-500">Avg Time</span>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {analytics.averageTime > 60
              ? `${Math.floor(analytics.averageTime / 60)}m ${analytics.averageTime % 60}s`
              : `${analytics.averageTime}s`}
          </p>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Score Distribution</p>
        <div className="flex items-end gap-1 h-20">
          {analytics.scoreDistribution.map((bucket, i) => {
            const maxCount = Math.max(...analytics.scoreDistribution.map((b) => b.count), 1);
            const height = (bucket.count / maxCount) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(height, 2)}%`,
                    backgroundColor: bucket.count > 0 ? "#24abbc" : "#e5e7eb",
                  }}
                  title={`${bucket.range}: ${bucket.count} attempts`}
                />
                <span className="text-[9px] text-gray-400">{i * 10}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 text-center">Score %</p>
      </div>

      {/* Question-Level Analytics */}
      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowQuestionDetails(!showQuestionDetails)}
          className="flex items-center justify-between w-full text-xs font-medium text-gray-600 hover:text-gray-800"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Question Breakdown
          </span>
          {showQuestionDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showQuestionDetails && (
          <div className="mt-3 space-y-3">
            {/* Group filter */}
            {groups.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3 h-3 text-gray-400" />
                <button
                  onClick={() => setGroupFilter("all")}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    groupFilter === "all" ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGroupFilter(g.id)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                      groupFilter === g.id ? "text-white" : "text-gray-600 hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: groupFilter === g.id ? g.color : `${g.color}20`,
                      borderColor: g.color,
                    }}
                  >
                    {g.name}
                  </button>
                ))}
                <button
                  onClick={() => setGroupFilter("ungrouped")}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    groupFilter === "ungrouped" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  Ungrouped
                </button>
              </div>
            )}
            {questionLoading ? (
              <div className="text-center py-2">
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : questionAnalytics?.questions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No question data available</p>
            ) : (
              questionAnalytics?.questions
                .filter((q) => {
                  if (groupFilter === "all") return true;
                  const quizQ = quiz.questions.find((qq) => qq.id === q.id);
                  if (groupFilter === "ungrouped") return !quizQ?.groupId;
                  return quizQ?.groupId === groupFilter;
                })
                .map((q, idx) => (
                  <QuestionCard key={q.id} question={q} index={idx} />
                ))
            )}
          </div>
        )}
      </div>

      {/* Recent Attempts */}
      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowAttempts(!showAttempts)}
          className="flex items-center justify-between w-full text-xs font-medium text-gray-600 hover:text-gray-800"
        >
          <span>Recent Attempts</span>
          {showAttempts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAttempts && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {attemptsLoading ? (
              <div className="text-center py-2">
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : attemptsData?.attempts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No attempts found</p>
            ) : (
              attemptsData?.attempts.map((attempt: any) => (
                <div key={attempt.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {attempt.takerName || attempt.takerEmail || "Anonymous"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(attempt.startedAt).toLocaleDateString()} · {attempt.timeTakenSeconds ? `${Math.round(attempt.timeTakenSeconds / 60)}m` : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${attempt.isPassed ? "text-teal-600" : "text-red-500"}`}>
                      {Math.round(attempt.scorePct || 0)}%
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      attempt.isPassed ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-700"
                    }`}>
                      {attempt.isPassed ? "Pass" : "Fail"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Question Card Component ──────────────────────────────────────────────────

interface QuestionStat {
  id: string;
  stem: string;
  type: string;
  totalResponses: number;
  correctCount: number;
  incorrectCount: number;
  correctRate: number;
  optionBreakdown: { optionId: string; optionText: string; count: number; percentage: number; isCorrect: boolean }[];
}

function QuestionCard({ question, index }: { question: QuestionStat; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasOptions = question.optionBreakdown.length > 0;

  // Color based on correctRate
  const rateColor = question.correctRate >= 70 ? "text-teal-600" : question.correctRate >= 40 ? "text-amber-600" : "text-red-500";
  const rateBg = question.correctRate >= 70 ? "bg-teal-50" : question.correctRate >= 40 ? "bg-amber-50" : "bg-red-50";
  const rateBarColor = question.correctRate >= 70 ? "#24abbc" : question.correctRate >= 40 ? "#d97706" : "#ef4444";

  return (
    <div className="bg-gray-50 rounded-xl p-3">
      {/* Question Header */}
      <div
        className={`flex items-start gap-2 ${hasOptions ? "cursor-pointer" : ""}`}
        onClick={() => hasOptions && setExpanded(!expanded)}
      >
        <span className="text-[10px] font-bold text-gray-400 mt-0.5 shrink-0">Q{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 font-medium truncate">{question.stem}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400">{question.totalResponses} responses</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400 capitalize">{question.type.replace("_", " ")}</span>
          </div>
        </div>
        <div className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg ${rateBg}`}>
          {question.correctRate >= 70 ? (
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
          ) : question.correctRate >= 40 ? (
            <HelpCircle className="w-3 h-3 text-amber-600" />
          ) : (
            <XCircle className="w-3 h-3 text-red-500" />
          )}
          <span className={`text-xs font-bold ${rateColor}`}>{question.correctRate}%</span>
        </div>
      </div>

      {/* Correct/Incorrect Bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${question.correctRate}%`, backgroundColor: rateBarColor }}
          />
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-teal-600 font-medium">{question.correctCount}✓</span>
          <span className="text-red-400 font-medium">{question.incorrectCount}✗</span>
        </div>
      </div>

      {/* Option Breakdown (expanded) */}
      {expanded && hasOptions && (
        <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-2">
          <p className="text-[10px] text-gray-500 font-medium mb-1">Answer Distribution</p>
          {question.optionBreakdown.map((opt) => (
            <div key={opt.optionId} className="flex items-center gap-2">
              <div className="flex items-center gap-1 w-3 shrink-0">
                {opt.isCorrect ? (
                  <CheckCircle2 className="w-3 h-3 text-teal-500" />
                ) : (
                  <span className="w-3 h-3 rounded-full border border-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[10px] truncate max-w-[120px] ${opt.isCorrect ? "text-teal-700 font-medium" : "text-gray-600"}`}>
                    {opt.optionText}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0 ml-1">{opt.count} ({opt.percentage}%)</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${opt.percentage}%`,
                      backgroundColor: opt.isCorrect ? "#24abbc" : "#94a3b8",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expand hint */}
      {hasOptions && !expanded && (
        <p className="text-[9px] text-gray-400 mt-1.5 text-center cursor-pointer" onClick={() => setExpanded(true)}>
          Click to see answer distribution →
        </p>
      )}
    </div>
  );
}
