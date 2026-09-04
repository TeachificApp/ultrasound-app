/**
 * StudentQuizDashboard.tsx
 * Route: /my-quizzes
 * Native quiz results + separate mock exam analytics (visible when learner has native quiz attempts).
 */
import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, BookOpen, CheckCircle, XCircle, Clock, ChevronRight, Trophy, BarChart2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import type { QuizResultsKindAnalytics } from "@shared/quizResultsAnalytics";

function fmtScore(score: number | string | null | undefined) {
  if (score === null || score === undefined) return "—";
  return `${Number(score).toFixed(0)}%`;
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString();
}

function AnalyticsCards({ title, analytics }: { title: string; analytics: QuizResultsKindAnalytics }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-teal-600" /> {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Attempts</p>
          <p className="text-lg font-bold text-gray-900">{analytics.attemptCount}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Passed</p>
          <p className="text-lg font-bold text-emerald-600">{analytics.passedCount}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Best score</p>
          <p className="text-lg font-bold text-teal-700">{analytics.bestScore !== null ? `${analytics.bestScore}%` : "—"}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Average</p>
          <p className="text-lg font-bold text-gray-800">{analytics.averageScore !== null ? `${analytics.averageScore}%` : "—"}</p>
        </div>
      </div>
    </div>
  );
}

function AttemptHistoryTable({
  rows,
  emptyLabel,
}: {
  rows: Array<{
    attempt: { id: number; quizId?: number; score: string | null; passed: boolean | null; completedAt: Date | null };
    quizTitle: string;
    quizType?: string;
    courseSlug?: string;
    courseTitle?: string;
    lessonId?: number;
    isLessonModule?: boolean;
  }>;
  emptyLabel: string;
}) {
  const [, navigate] = useLocation();

  if (!rows.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Quiz</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Result</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Date</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ attempt, quizTitle, quizType, courseSlug, courseTitle, lessonId, isLessonModule }) => (
            <tr key={attempt.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-medium">
                <p>{quizTitle}</p>
                {courseTitle && <p className="mt-0.5 text-xs font-normal text-gray-400">{courseTitle} · Lesson module</p>}
              </td>
              <td className="px-4 py-3 text-center text-xs capitalize text-gray-500">
                {quizType === "mock_exam" ? "Mock exam" : quizType === "flashcards" ? "Flashcards" : "Quiz"}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`font-semibold ${attempt.passed ? "text-green-600" : "text-red-500"}`}>
                  {fmtScore(attempt.score)}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {quizType === "flashcards"
                  ? <span className="inline-flex items-center gap-1 text-teal-700 text-xs font-medium">Self-reported</span>
                  : attempt.passed
                  ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Pass</span>
                  : <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium"><XCircle className="w-3.5 h-3.5" />Fail</span>}
              </td>
              <td className="px-4 py-3 text-right text-gray-400">{fmtDate(attempt.completedAt ? new Date(attempt.completedAt).getTime() : null)}</td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="ghost" onClick={() => {
                  if (isLessonModule && courseSlug && lessonId) navigate(`/courses/${courseSlug}/player?lesson=${lessonId}`);
                  else if (attempt.quizId) navigate(`/quizzes/${attempt.quizId}/results/${attempt.id}`);
                }}>
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentQuizDashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState("native");

  const { data: summary, isLoading: loadingSummary } = trpc.standaloneQuizLearner.getMyQuizResultsSummary.useQuery(
    undefined,
    { enabled: !!user },
  );

  const { data: nativeHistory, isLoading: loadingNative } = trpc.standaloneQuizLearner.getMyAttempts.useQuery(
    { quizType: "quiz" },
    { enabled: !!user && !!summary?.hasNativeQuizAttempts },
  );

  const { data: mockHistory, isLoading: loadingMock } = trpc.standaloneQuizLearner.getMyAttempts.useQuery(
    { quizType: "mock_exam" },
    { enabled: !!user && !!summary?.hasMockExamAttempts && tab === "mock" },
  );
  const { data: flashcardHistory, isLoading: loadingFlashcards } = trpc.standaloneQuizLearner.getMyAttempts.useQuery(
    { quizType: "flashcards" },
    { enabled: !!user && !!summary?.hasFlashcardAttempts && tab === "flashcards" },
  );
  const { data: inlineModuleHistory, isLoading: loadingInlineModules } = trpc.lmsLearner.getMyInlineModuleAttempts.useQuery(
    undefined,
    { enabled: !!user },
  );
  const sortByCompletedAt = (rows: any[]) => [...rows].sort((a, b) => {
    const aTime = a.attempt.completedAt ? new Date(a.attempt.completedAt).getTime() : 0;
    const bTime = b.attempt.completedAt ? new Date(b.attempt.completedAt).getTime() : 0;
    return bTime - aTime;
  });
  const inlineQuizHistory = (inlineModuleHistory ?? []).filter((row: any) => row.quizType === "quiz");
  const inlineFlashcardHistory = (inlineModuleHistory ?? []).filter((row: any) => row.quizType === "flashcards");
  const allNativeHistory = sortByCompletedAt([...(nativeHistory ?? []), ...inlineQuizHistory]);
  const allFlashcardHistory = sortByCompletedAt([...(flashcardHistory ?? []), ...inlineFlashcardHistory]);

  if (authLoading || loadingSummary) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <BookOpen className="w-12 h-12 text-teal-600" />
        <h2 className="text-xl font-bold">Sign in to access quiz results</h2>
        <Button onClick={() => { window.location.href = getLoginUrl("/my-quizzes"); }} className="bg-teal-600 hover:bg-teal-700">
          Sign In
        </Button>
      </div>
    );
  }

  if (!summary?.hasNativeQuizAttempts && !summary?.hasMockExamAttempts && !summary?.hasFlashcardAttempts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-10">
          <BookOpen className="w-12 h-12 text-teal-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">No quiz results yet</h1>
          <p className="text-sm text-gray-500 mb-6">
            My Quiz Results appears after you complete a quiz, mock exam, or flashcard deck. Results are private to your signed-in account.
          </p>
          <Button onClick={() => navigate("/education-library")} className="bg-teal-600 hover:bg-teal-700">
            Browse courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Quiz Results</h1>
          <p className="text-gray-500 text-sm mt-1">Private practice quiz, mock exam, and flashcard analytics</p>
        </div>

        <div className="grid gap-4 mb-8">
          <AnalyticsCards title="Native quizzes" analytics={summary.nativeQuizzes} />
          {summary.hasMockExamAttempts && (
            <AnalyticsCards title="Mock exams" analytics={summary.mockExams} />
          )}
          {summary.hasFlashcardAttempts && <AnalyticsCards title="Flashcard decks" analytics={summary.flashcards} />}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="native">Quiz results</TabsTrigger>
            {summary.hasMockExamAttempts && (
              <TabsTrigger value="mock">Mock exam results</TabsTrigger>
            )}
            {summary.hasFlashcardAttempts && <TabsTrigger value="flashcards">Flashcard results</TabsTrigger>}
          </TabsList>

          <TabsContent value="native">
            {loadingNative || loadingInlineModules ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : (
              <AttemptHistoryTable rows={allNativeHistory} emptyLabel="No quiz attempts yet" />
            )}
          </TabsContent>

          {summary.hasMockExamAttempts && (
            <TabsContent value="mock">
              {loadingMock ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
              ) : (
                <AttemptHistoryTable rows={mockHistory ?? []} emptyLabel="No mock exam attempts yet" />
              )}
            </TabsContent>
          )}
          {summary.hasFlashcardAttempts && (
            <TabsContent value="flashcards">
              {loadingFlashcards || loadingInlineModules ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div> : <AttemptHistoryTable rows={allFlashcardHistory} emptyLabel="No flashcard deck attempts yet" />}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
