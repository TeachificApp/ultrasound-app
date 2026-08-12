/**
 * StandaloneQuizResults.tsx
 * Route: /quizzes/:quizId/results/:attemptId
 *
 * Respects quiz result visibility settings:
 *   showOnlyPercentage     — show only the score %, no per-question breakdown
 *   showPerQuestionResult  — show correct/incorrect per question (default true)
 *   showGroupNames         — show question group section headers (default true)
 */
import React from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, ArrowLeft, RotateCcw, BookOpen, Trophy } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

function ScoreRing({ score, passed }: { score: number; passed: boolean }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={passed ? "#16a34a" : "#dc2626"}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{score.toFixed(0)}%</span>
        <span className={`text-xs font-semibold ${passed ? "text-green-600" : "text-red-600"}`}>
          {passed ? "PASS" : "FAIL"}
        </span>
      </div>
    </div>
  );
}

export default function StandaloneQuizResults() {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data, isLoading } = trpc.standaloneQuizLearner.getAttemptResult.useQuery(
    { attemptId: parseInt(attemptId, 10) },
    { enabled: !!user }
  );

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <BookOpen className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-700">Results not found</h2>
        <Button variant="outline" onClick={() => navigate("/my-quizzes")}>My Quizzes</Button>
      </div>
    );
  }

  const { attempt, quiz, canSeeResults, answers } = data;
  const score = Number(attempt.score ?? 0);
  const passed = !!attempt.passed;

  // Visibility settings — default to showing everything if not set
  const showOnlyPercentage = !!(quiz as any).showOnlyPercentage;
  const showPerQuestionResult = showOnlyPercentage ? false : (quiz as any).showPerQuestionResult !== false;
  const showGroupNames = (quiz as any).showGroupNames !== false;

  // Group answers by groupId when showGroupNames is on
  type AnswerWithGroup = typeof answers[number] & { groupId?: number | null; groupName?: string | null };
  const groupedAnswers: { groupId: number | null; groupName: string | null; items: AnswerWithGroup[] }[] = [];
  if (showGroupNames && answers.length > 0) {
    const seen = new Map<number | null, number>();
    for (const a of answers as AnswerWithGroup[]) {
      const gid = a.groupId ?? null;
      if (!seen.has(gid)) {
        seen.set(gid, groupedAnswers.length);
        groupedAnswers.push({ groupId: gid, groupName: a.groupName ?? null, items: [] });
      }
      groupedAnswers[seen.get(gid)!].items.push(a);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-quizzes")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> My Quizzes
          </Button>
        </div>

        {/* Score card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mb-6">
          {passed ? (
            <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
              <Trophy className="w-6 h-6" />
              <span className="text-lg font-bold">Congratulations!</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
              <XCircle className="w-6 h-6" />
              <span className="text-lg font-bold">Not quite — keep practicing!</span>
            </div>
          )}

          <ScoreRing score={score} passed={passed} />

          <h2 className="text-xl font-bold text-gray-900 mt-4">{quiz.title}</h2>

          {/* Show stats only when not percentage-only */}
          {!showOnlyPercentage && (
            <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-gray-900">{attempt.correctAnswers}</p>
                <p className="text-gray-500">Correct</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-gray-900">{attempt.totalQuestions - attempt.correctAnswers}</p>
                <p className="text-gray-500">Incorrect</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-gray-900">{quiz.passingScore}%</p>
                <p className="text-gray-500">Passing</p>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 mt-6">
            {quiz.allowRetakes && (
              <Button variant="outline" onClick={() => navigate(`/quizzes/${quizId}`)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Retake
              </Button>
            )}
            <Button onClick={() => navigate("/my-quizzes")} className="bg-teal-600 hover:bg-teal-700">
              My Quizzes
            </Button>
          </div>
        </div>

        {/* Per-question breakdown */}
        {canSeeResults && showPerQuestionResult && answers.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">Question Review</h3>

            {showGroupNames && groupedAnswers.length > 0 ? (
              // Render with group section headers
              groupedAnswers.map((group, gi) => (
                <div key={group.groupId ?? `ungrouped-${gi}`} className="space-y-3">
                  {group.groupName && (
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-0.5 bg-gray-100 rounded-full">
                        {group.groupName}
                      </span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                  )}
                  {group.items.map((a: any, idx: number) => (
                    <QuestionCard key={a.id} a={a} idx={idx} />
                  ))}
                </div>
              ))
            ) : (
              // Flat list without group headers
              (answers as any[]).map((a: any, idx: number) => (
                <QuestionCard key={a.id} a={a} idx={idx} />
              ))
            )}
          </div>
        )}

        {!canSeeResults && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-800">
            <p className="font-medium">Results will be available after {quiz.showResultsAfterDate ? new Date(quiz.showResultsAfterDate).toLocaleDateString() : "the review period"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ a, idx }: { a: any; idx: number }) {
  const q = a.question;
  if (!q) return null;
  let options: { text: string }[] = [];
  try { options = JSON.parse(q.options ?? "[]"); } catch { /* ignore */ }
  let givenText = "—";
  try {
    const given = JSON.parse(a.givenAnswer ?? "null");
    if (typeof given === "number" || (typeof given === "string" && !isNaN(Number(given)))) {
      givenText = options[Number(given)]?.text ?? String(given);
    } else {
      givenText = String(given);
    }
  } catch { /* ignore */ }
  let correctText = "—";
  try {
    const ci = parseInt(q.correctAnswer, 10);
    correctText = options[ci]?.text ?? q.correctAnswer;
  } catch { /* ignore */ }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${a.isCorrect ? "bg-green-100" : "bg-red-100"}`}>
          {a.isCorrect
            ? <CheckCircle className="w-4 h-4 text-green-600" />
            : <XCircle className="w-4 h-4 text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1">Question {idx + 1}</p>
          <p className="text-gray-900 text-sm mb-3">{q.question}</p>
          {q.questionImageUrl && (
            <img src={q.questionImageUrl} alt="" className="w-full max-h-40 object-contain rounded-lg bg-gray-50 mb-3" />
          )}
          {q.questionVideoUrl && (
            <video src={q.questionVideoUrl} controls className="w-full max-h-56 rounded-lg bg-black mb-3" />
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Your answer</p>
              <p className={`font-medium ${a.isCorrect ? "text-green-700" : "text-red-600"}`}>{givenText}</p>
            </div>
            {!a.isCorrect && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Correct answer</p>
                <p className="font-medium text-green-700">{correctText}</p>
              </div>
            )}
          </div>
          {q.explanation && (
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              <strong className="block mb-1">Explanation</strong>
              {q.explanation}
            </div>
          )}
          {q.feedbackImageUrl && (
            <img src={q.feedbackImageUrl} alt="Explanation" className="mt-2 w-full max-h-40 object-contain rounded-lg bg-gray-50" />
          )}
          {q.feedbackVideoUrl && (
            <video src={q.feedbackVideoUrl} controls className="mt-2 w-full max-h-56 rounded-lg bg-black" />
          )}
        </div>
      </div>
    </div>
  );
}
