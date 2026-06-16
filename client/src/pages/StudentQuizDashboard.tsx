/**
 * StudentQuizDashboard.tsx
 * Route: /my-quizzes
 * Shows all published quizzes the user can take, plus their attempt history.
 */
import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, BookOpen, CheckCircle, XCircle, Clock, ChevronRight, Trophy } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

function fmtScore(score: number | string | null | undefined) {
  if (score === null || score === undefined) return "—";
  return `${Number(score).toFixed(0)}%`;
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString();
}

export default function StudentQuizDashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState("available");

  const { data: available, isLoading: loadingAvail } = trpc.standaloneQuizLearner.listAvailableQuizzes.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: history, isLoading: loadingHist } = trpc.standaloneQuizLearner.getMyAttempts.useQuery(
    undefined,
    { enabled: !!user && tab === "history" }
  );

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <BookOpen className="w-12 h-12 text-teal-600" />
        <h2 className="text-xl font-bold">Sign in to access quizzes</h2>
        <Button onClick={() => window.location.href = getLoginUrl("/my-quizzes")} className="bg-teal-600 hover:bg-teal-700">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Quizzes</h1>
          <p className="text-gray-500 text-sm mt-1">Practice quizzes and mock exams</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="available">Available Quizzes</TabsTrigger>
            <TabsTrigger value="history">My Attempts</TabsTrigger>
          </TabsList>

          {/* ── Available Quizzes ── */}
          <TabsContent value="available">
            {loadingAvail ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
            ) : !available?.length ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No quizzes available yet</p>
                <p className="text-sm mt-1">Check back soon for new quizzes and mock exams</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {available.map(({ quiz, attemptCount, bestScore, lastPassed }) => (
                  <div
                    key={quiz.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:border-teal-300 transition-colors cursor-pointer"
                    onClick={() => navigate(`/quizzes/${quiz.id}`)}
                  >
                    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{quiz.title}</h3>
                        {lastPassed && <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="capitalize">{quiz.type === "mock_exam" ? "Mock Exam" : "Quiz"}</span>
                        {quiz.timeLimitMinutes && <span><Clock className="w-3 h-3 inline mr-0.5" />{quiz.timeLimitMinutes} min</span>}
                        {attemptCount > 0 && <span>{attemptCount} attempt{attemptCount !== 1 ? "s" : ""}</span>}
                        {bestScore !== null && bestScore !== undefined && (
                          <span className={`font-medium ${Number(bestScore) >= quiz.passingScore ? "text-green-600" : "text-red-500"}`}>
                            Best: {fmtScore(bestScore)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Attempt History ── */}
          <TabsContent value="history">
            {loadingHist ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : !history?.length ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No attempts yet</p>
                <p className="text-sm mt-1">Take a quiz to see your history here</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Quiz</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Result</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map(({ attempt, quizTitle }) => (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{quizTitle}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${attempt.passed ? "text-green-600" : "text-red-500"}`}>
                            {fmtScore(attempt.score)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {attempt.passed
                            ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Pass</span>
                            : <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium"><XCircle className="w-3.5 h-3.5" />Fail</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">{fmtDate(attempt.completedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => navigate(`/quizzes/${attempt.quizId}/results/${attempt.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
