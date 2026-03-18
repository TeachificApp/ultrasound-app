/**
 * CaseDetail.tsx — Single Echo Case View
 *
 * Displays full case details: clinical history, images/video, embedded MCQ questions,
 * teaching points, diagnosis, and submitter info.
 */

import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import Layout from "@/components/Layout";
import { RichTextDisplay } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChevronLeft,
  Eye,
  PlayCircle,
  ImageIcon,
  BookOpen,
  Stethoscope,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon,
  Lightbulb,
  User,
  Calendar,
  Tag,
  AlertTriangle,
  UserCheck,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { formatViewCount, getDisplayViewCount } from "@/lib/caseViewCount";

const MODALITY_COLORS: Record<string, string> = {
  TTE: "bg-blue-100 text-blue-700",
  TEE: "bg-purple-100 text-purple-700",
  Stress: "bg-orange-100 text-orange-700",
  Pediatric: "bg-pink-100 text-pink-700",
  Fetal: "bg-rose-100 text-rose-700",
  HOCM: "bg-red-100 text-red-700",
  POCUS: "bg-teal-100 text-teal-700",
  Other: "bg-gray-100 text-gray-600",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
};

type AnswerMap = Record<number, number>; // questionId -> selectedAnswer index

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const caseId = parseInt(id ?? "0", 10);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: caseData, isLoading, error } = trpc.caseLibrary.getCase.useQuery(
    { id: caseId },
    { enabled: !!caseId }
  );

  // Stabilize caseTags with useMemo to prevent infinite re-fetches from new array references on every render
  const caseTags: string[] = useMemo(
    () => (caseData ? ((caseData as any).tags ?? []) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caseData?.id, (caseData as any)?.tags?.join(",")]
  );

  const { data: relatedCases } = trpc.caseLibrary.getRelatedCases.useQuery(
    { caseId, tags: caseTags, limit: 4 },
    { enabled: !!caseId && caseTags.length > 0 }
  );

  const submitAttemptMutation = trpc.caseLibrary.submitAttempt.useMutation({
    onSuccess: () => {
      utils.caseLibrary.getCase.invalidate({ id: caseId });
      toast.success("Answers submitted!");
    },
    onError: () => toast.error("Failed to submit answers."),
  });

  const [mediaIndex, setMediaIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-16 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#189aa1] border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm">Loading case…</p>
        </div>
      </Layout>
    );
  }

  if (error || !caseData) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-gray-500">Case not found or unavailable.</p>
          <Link href="/case-library">
            <Button variant="outline" className="mt-4">Back to Library</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const {
    title, summary, clinicalHistory, diagnosis, teachingPoints,
    modality, difficulty, tags, media, questions, submitterName,
    submittedAt, viewCount, userAttempt,
    submitterCreditName, submitterLinkedIn,
  } = caseData as any;

  const images = media.filter((m: any) => m.type === "image");
  const videos = media.filter((m: any) => m.type === "video");
  const allMedia = media; // already sorted by sortOrder
  const currentMedia = allMedia[mediaIndex];

  // Auth gate: unauthenticated users see blurred overlay (don't gate while auth is still loading)
  if (!authLoading && !isAuthenticated) {
    return (
      <Layout>
        <BlurredOverlay type="login" featureName="Echo Case Library">
          <div className="container py-8">
            <div className="max-w-4xl mx-auto">
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-8" />
              <div className="h-64 bg-gray-100 rounded-xl mb-6" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-5/6" />
                <div className="h-4 bg-gray-100 rounded w-4/6" />
              </div>
            </div>
          </div>
        </BlurredOverlay>
      </Layout>
    );
  }

  const alreadyAttempted = !!userAttempt || submitted;

  const handleSelectAnswer = (questionId: number, answerIdx: number) => {
    if (alreadyAttempted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answerIdx }));
  };

  const handleSubmitAnswers = async () => {
    if (!isAuthenticated) {
      toast.error("Sign in to submit your answers.");
      return;
    }
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      toast.error(`Please answer all ${questions.length} question${questions.length !== 1 ? "s" : ""} before submitting.`);
      return;
    }
    setSubmitted(true);
    await submitAttemptMutation.mutateAsync({
      caseId,
      answers,
    });
  };

  // Calculate score for display
  const score = submitted || userAttempt
    ? questions.reduce((acc: number, q: any) => {
        const userAns = userAttempt?.answers?.[q.id] ?? answers[q.id];
        return acc + (userAns === q.correctAnswer ? 1 : 0);
      }, 0)
    : null;

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        {/* Back */}
        <Link href="/case-library">
          <button className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#189aa1] mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Case Library
          </button>
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODALITY_COLORS[modality] ?? "bg-gray-100 text-gray-600"}`}>
              {modality}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[difficulty] ?? ""}`}>
              {difficulty}
            </span>
            {images.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                <ImageIcon className="w-3 h-3" /> {images.length} Image{images.length !== 1 ? "s" : ""}
              </span>
            )}
            {videos.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                <PlayCircle className="w-3 h-3" /> {videos.length} Video{videos.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            {title}
          </h1>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> {formatViewCount(getDisplayViewCount(caseData.id, viewCount ?? 0, submittedAt))} views
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: media + questions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Media viewer */}
            {allMedia.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-black relative">
                  {currentMedia?.type === "video" ? (
                    <video
                      src={currentMedia.url}
                      controls
                      controlsList="nodownload"
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full max-h-80 object-contain"
                    />
                  ) : (
                    <img
                      src={currentMedia?.url}
                      alt={currentMedia?.caption ?? "Echo image"}
                      className="w-full max-h-80 object-contain"
                    />
                  )}
                  {/* Navigation arrows */}
                  {allMedia.length > 1 && (
                    <>
                      <button
                        onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                        disabled={mediaIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/70 transition"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMediaIndex((i) => Math.min(allMedia.length - 1, i + 1))}
                        disabled={mediaIndex === allMedia.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/70 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                {/* Thumbnails */}
                {allMedia.length > 1 && (
                  <div className="flex gap-2 p-3 bg-gray-50 overflow-x-auto">
                    {allMedia.map((m: any, i: number) => (
                      <button
                        key={m.id}
                        onClick={() => setMediaIndex(i)}
                        className={`w-14 h-14 rounded flex-shrink-0 overflow-hidden border-2 transition ${i === mediaIndex ? "border-[#189aa1]" : "border-transparent"}`}
                      >
                        {m.type === "video" ? (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <PlayCircle className="w-6 h-6 text-gray-500" />
                          </div>
                        ) : (
                          <img src={m.url} alt="" className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {currentMedia?.caption && (
                  <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                    {currentMedia.caption}
                  </div>
                )}
              </Card>
            )}

            {/* Summary */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-[#189aa1]" /> Case Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RichTextDisplay html={summary} className="text-sm" />
              </CardContent>
            </Card>

            {/* Clinical History */}
            {clinicalHistory && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#189aa1]" /> Clinical History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{clinicalHistory}</p>
                </CardContent>
              </Card>
            )}

            {/* Questions */}
            {questions.length > 0 && (
              <div>
                <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#189aa1]" />
                  Self-Assessment Questions
                  {score !== null && (
                    <span className="ml-auto text-xs font-normal text-gray-400">
                      Score: {score}/{questions.length}
                    </span>
                  )}
                </h2>
                <div className="space-y-4">
                  {questions.map((q: any, qi: number) => {
                    const userAns = userAttempt?.answers?.[q.id] ?? answers[q.id];
                    const isAnswered = alreadyAttempted || userAns !== undefined;
                    return (
                      <Card key={q.id} className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                          <p className="text-sm font-semibold text-gray-800 mb-3">
                            {qi + 1}. {q.question}
                          </p>
                          <div className="space-y-2">
                            {q.options.map((opt: string, idx: number) => {
                              const isSelected = userAns === idx;
                              const isCorrect = idx === q.correctAnswer;
                              let cls = "w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ";
                              if (!isAnswered) {
                                cls += isSelected
                                  ? "border-[#189aa1] bg-[#189aa1]/10 text-[#189aa1]"
                                  : "border-gray-200 hover:border-[#189aa1]/50 text-gray-700";
                              } else if (isCorrect) {
                                cls += "border-green-500 bg-green-50 text-green-800";
                              } else if (isSelected && !isCorrect) {
                                cls += "border-red-400 bg-red-50 text-red-700";
                              } else {
                                cls += "border-gray-100 bg-gray-50 text-gray-400";
                              }
                              return (
                                <button
                                  key={idx}
                                  className={cls}
                                  onClick={() => handleSelectAnswer(q.id, idx)}
                                  disabled={alreadyAttempted}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs flex-shrink-0"
                                      style={
                                        isAnswered && isCorrect
                                          ? { borderColor: "#16a34a", background: "#16a34a", color: "white" }
                                          : isAnswered && isSelected && !isCorrect
                                          ? { borderColor: "#ef4444", background: "#ef4444", color: "white" }
                                          : { borderColor: "#d1d5db" }
                                      }
                                    >
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    {opt}
                                    {isAnswered && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto flex-shrink-0" />}
                                    {isAnswered && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-red-400 ml-auto flex-shrink-0" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {isAnswered && q.explanation && (
                            <div className="mt-3 p-3 rounded-lg bg-[#189aa1]/8 border border-[#189aa1]/20">
                              <p className="text-xs font-semibold text-[#189aa1] mb-1">Explanation</p>
                              <p className="text-xs text-gray-700 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {!alreadyAttempted && questions.length > 0 && (
                  <Button
                    className="w-full mt-4 text-white"
                    style={{ background: "#189aa1" }}
                    onClick={handleSubmitAnswers}
                    disabled={submitAttemptMutation.isPending || Object.keys(answers).length < questions.length}
                  >
                    {submitAttemptMutation.isPending ? "Submitting…" : "Submit Answers"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Diagnosis (reveal on click) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-700">Diagnosis</CardTitle>
              </CardHeader>
              <CardContent>
                {!showDiagnosis ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-[#189aa1] text-[#189aa1]"
                    onClick={() => setShowDiagnosis(true)}
                  >
                    Reveal Diagnosis
                  </Button>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">{diagnosis ?? "Not specified"}</p>
                )}
              </CardContent>
            </Card>

            {/* Teaching Points */}
            {teachingPoints.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" /> Teaching Points
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {teachingPoints.map((pt: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="w-4 h-4 rounded-full bg-[#189aa1]/15 text-[#189aa1] flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" /> Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag: string) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Case Contributor credit */}
            {(submitterCreditName || submitterLinkedIn) && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" style={{ color: "#189aa1" }} /> Case Contributor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {submitterCreditName && (
                    <p className="text-sm font-medium text-gray-800">{submitterCreditName}</p>
                  )}
                  {submitterLinkedIn && (
                    <a
                      href={submitterLinkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                      style={{ color: "#189aa1" }}
                    >
                      <Link2 className="w-3.5 h-3.5" /> View LinkedIn Profile
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Score card if attempted */}
            {score !== null && (
              <Card className="border-0 shadow-sm" style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-white/60 mb-1">Your Score</p>
                  <div className="text-3xl font-black text-white mb-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {score}/{questions.length}
                  </div>
                  <p className="text-xs text-[#4ad9e0]">
                    {Math.round((score / questions.length) * 100)}% correct
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Related Cases */}
        {relatedCases && relatedCases.length > 0 && (
          <div className="mt-10">
            <h2 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
              <BookOpen className="w-4 h-4 text-[#189aa1]" />
              Related Cases
              <span className="text-xs font-normal text-gray-400 ml-1">based on shared tags</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedCases.map((rc: any) => (
                <Link key={rc.id} href={`/case-library/${rc.id}`}>
                  <div className="group bg-white rounded-xl border border-gray-100 hover:border-[#189aa1]/40 hover:shadow-md transition-all p-4 h-full flex flex-col cursor-pointer">
                    {/* Modality + difficulty badges */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODALITY_COLORS[rc.modality] ?? "bg-gray-100 text-gray-600"}`}>
                        {rc.modality}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[rc.difficulty] ?? ""}`}>
                        {rc.difficulty}
                      </span>
                    </div>
                    {/* Title */}
                    <h3 className="text-sm font-semibold text-gray-800 leading-snug mb-2 group-hover:text-[#189aa1] transition-colors line-clamp-2" style={{ fontFamily: "Merriweather, serif" }}>
                      {rc.title}
                    </h3>
                    {/* Summary */}
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1">{rc.summary}</p>
                    {/* Shared tags */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {rc.tags
                        .filter((t: string) => caseTags.map((ct) => ct.toLowerCase()).includes(t.toLowerCase()))
                        .slice(0, 3)
                        .map((t: string) => (
                          <span key={t} className="text-xs bg-[#189aa1]/10 text-[#189aa1] px-1.5 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      {rc.matchCount > 3 && (
                        <span className="text-xs text-gray-400">+{rc.matchCount - 3} more</span>
                      )}
                    </div>
                    {/* View count */}
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <Eye className="w-3 h-3" />
                      {formatViewCount(rc.viewCount)} views
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
