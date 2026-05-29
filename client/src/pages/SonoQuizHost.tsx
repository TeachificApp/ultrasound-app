/**
 * SonoQuizHost.tsx — Host Dashboard for a live SonoQuiz session
 *
 * Access: platform admin only
 * Route: /admin/sonoquiz/host/:sessionId
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Users, Play, ChevronRight, Trophy, Clock, CheckCircle,
  XCircle, Zap, StopCircle, BarChart2, Eye, EyeOff, Copy,
  ChevronLeft, Wifi, WifiOff,
} from "lucide-react";

const ANSWER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const ANSWER_LABELS = ["A", "B", "C", "D"];
const ANSWER_SHAPES = ["▲", "◆", "●", "■"];

// ─── WebSocket hook ───────────────────────────────────────────────────────────
function useSonoQuizWS(sessionId: number | null, onMessage: (msg: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/sonoquiz?sessionId=${sessionId}&role=host`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch {}
    };
    return () => ws.close();
  }, [sessionId]);

  const send = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SonoQuizHost() {
  const [, params] = useRoute("/admin/sonoquiz/host/:sessionId");
  const sessionId = params?.sessionId ? parseInt(params.sessionId) : null;
  const { user } = useAuth();
  
  const utils = trpc.useUtils();

  const [phase, setPhase] = useState<"lobby" | "question" | "results" | "leaderboard" | "ended">("lobby");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [answerCounts, setAnswerCounts] = useState<number[]>([0, 0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>("waiting");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: sessionData, isLoading } = trpc.sonoQuiz.getSession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const startSession = trpc.sonoQuiz.startSession.useMutation({
    onSuccess: () => utils.sonoQuiz.getSession.invalidate({ sessionId: sessionId! }),
  });
  const nextQuestion = trpc.sonoQuiz.advanceQuestion.useMutation();
  const endSession = trpc.sonoQuiz.endSession.useMutation({
    onSuccess: () => {
      setPhase("ended");
      utils.sonoQuiz.getSession.invalidate({ sessionId: sessionId! });
    },
  });

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const { connected, send } = useSonoQuizWS(sessionId, (msg) => {
    switch (msg.type) {
      case "participant_joined":
        setParticipants(prev => {
          if (prev.find(p => p.id === msg.participant.id)) return prev;
          return [...prev, msg.participant];
        });
        break;
      case "participant_left":
        setParticipants(prev => prev.filter(p => p.id !== msg.participantId));
        break;
      case "answer_submitted":
        setAnswerCounts(prev => {
          const next = [...prev];
          if (msg.answerIndex >= 0 && msg.answerIndex < 4) next[msg.answerIndex]++;
          return next;
        });
        break;
      case "question_started":
        setCurrentQuestion(msg.question);
        setQuestionIndex(msg.questionIndex);
        setTotalQuestions(msg.totalQuestions);
        setAnswerCounts([0, 0, 0, 0]);
        setShowAnswers(false);
        setPhase("question");
        setTimeLeft(msg.timeLimitSeconds);
        startTimer(msg.timeLimitSeconds);
        break;
      case "question_ended":
        setShowAnswers(true);
        setPhase("results");
        stopTimer();
        break;
      case "leaderboard_update":
        setLeaderboard(msg.leaderboard);
        setPhase("leaderboard");
        break;
      case "session_ended":
        setPhase("ended");
        setLeaderboard(msg.leaderboard ?? []);
        break;
      case "participants_list":
        setParticipants(msg.participants);
        break;
    }
  });

  function startTimer(seconds: number) {
    stopTimer();
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => stopTimer(), []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const sessionRow = sessionData?.session;
  const quizSnapshot = sessionRow?.quizSnapshot ? (() => { try { return JSON.parse(sessionRow.quizSnapshot); } catch { return null; } })() : null;
  const quizMeta = quizSnapshot?.quiz ?? null;
  const joinUrl = sessionRow ? `${window.location.origin}/quiz/${sessionRow.joinCode}` : "";
  const totalAnswers = answerCounts.reduce((a, b) => a + b, 0);
  const themeColor = quizMeta?.theme === "teal" ? "#7c3aed"
    : quizMeta?.theme === "orange" ? "#ea580c"
    : quizMeta?.theme === "blue" ? "#2563eb"
    : quizMeta?.theme === "green" ? "#16a34a"
    : quizMeta?.theme === "rose" ? "#e11d48"
    : quizMeta?.theme === "dark" ? "#334155"
    : "#189aa1";

  function handleStartSession() {
    if (!sessionId) return;
    startSession.mutate({ sessionId });
    send({ type: "host_start" });
    setPhase("lobby");
    setSessionStatus("active");
  }

  function handleNextQuestion() {
    if (!sessionId) return;
    nextQuestion.mutate({ sessionId }, {
      onSuccess: (data: any) => {
        send({ type: "host_next_question", questionIndex: data.questionIndex });
      },
    });
  }

  function handleRevealAnswers() {
    send({ type: "host_reveal_answers" });
    setShowAnswers(true);
    setPhase("results");
    stopTimer();
  }

  function handleShowLeaderboard() {
    send({ type: "host_show_leaderboard" });
    setPhase("leaderboard");
  }

  function handleEndSession() {
    if (!sessionId) return;
    if (!confirm("End this session? This cannot be undone.")) return;
    endSession.mutate({ sessionId });
    send({ type: "host_end_session" });
  }

  function copyJoinCode() {
    navigator.clipboard.writeText(sessionRow?.joinCode ?? "");
    toast("Join code copied!");
  }

  function copyJoinUrl() {
    navigator.clipboard.writeText(joinUrl);
    toast("Join link copied!");
  }

  if (!user) return null;
  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Loading session...</div>
    </div>
  );
  if (!sessionData) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Session not found</div>
    </div>
  );

  const opts = currentQuestion ? JSON.parse(currentQuestion.options) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white"
            onClick={() => window.location.href = "/admin/sonoquiz"}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-white truncate">{quizMeta?.title}</h1>
              <p className="text-xs text-slate-400">Host Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected ? (
              <Badge className="bg-green-900/50 text-green-400 border-green-700/50 gap-1">
                <Wifi className="w-3 h-3" /> Live
              </Badge>
            ) : (
              <Badge className="bg-red-900/50 text-red-400 border-red-700/50 gap-1">
                <WifiOff className="w-3 h-3" /> Offline
              </Badge>
            )}
            <Badge variant="outline" className="border-slate-600 text-slate-400 gap-1">
              <Users className="w-3 h-3" /> {participants.length}
            </Badge>
            {phase !== "ended" && (
              <Button size="sm" variant="outline" className="border-red-700/50 text-red-400 hover:bg-red-900/20"
                onClick={handleEndSession}>
                <StopCircle className="w-3 h-3 mr-1" /> End
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">

        {/* ── Lobby ──────────────────────────────────────────────────────────── */}
        {phase === "lobby" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* QR + join info */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
                <QRCodeSVG value={joinUrl} size={200} level="H" />
                <div className="text-center">
                  <p className="text-slate-600 text-sm">Scan to join or visit</p>
                  <p className="text-slate-800 font-mono text-sm break-all">{joinUrl}</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm mb-1">Join Code</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-5xl font-black tracking-widest" style={{ color: themeColor }}>
                    {sessionRow?.joinCode}
                  </span>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={copyJoinCode}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="mt-2 border-slate-600 text-slate-300" onClick={copyJoinUrl}>
                  <Copy className="w-3 h-3 mr-1" /> Copy Link
                </Button>
              </div>
            </div>

            {/* Participants + controls */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: themeColor }} />
                    Participants ({participants.length})
                  </h3>
                  {participants.length === 0 && (
                    <span className="text-xs text-slate-500 animate-pulse">Waiting for players...</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: themeColor }}>
                        {p.displayName[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-white truncate">{p.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Quiz Info</h3>
                <div className="space-y-2 text-sm text-slate-400">
                  <div className="flex justify-between">
                    <span>Questions</span>
                    <span className="text-white">{quizMeta?.questionCount ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default time</span>
                    <span className="text-white">{quizMeta?.timeLimitSeconds}s per question</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Music</span>
                    <span className="text-white">{quizMeta?.musicTrack ?? "None"}</span>
                  </div>
                </div>
              </div>

              <Button className="w-full h-14 text-lg font-bold"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                onClick={handleStartSession}
                disabled={startSession.isPending}>
                <Play className="w-5 h-5 mr-2" />
                {sessionRow?.status === "lobby" ? "Start Quiz" : "Continue Quiz"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Question Phase ─────────────────────────────────────────────────── */}
        {phase === "question" && currentQuestion && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Q{questionIndex + 1}/{totalQuestions}</span>
              <Progress value={((questionIndex + 1) / totalQuestions) * 100} className="flex-1 h-2" />
              <div className={`flex items-center gap-1 text-lg font-bold ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"}`}>
                <Clock className="w-4 h-4" />
                {timeLeft}
              </div>
            </div>

            {/* Question card */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center">
              {currentQuestion.mediaUrl && (
                <div className="mb-4 flex justify-center">
                  {currentQuestion.mediaType === "video" ? (
                    <video src={currentQuestion.mediaUrl} className="max-h-48 rounded-xl" autoPlay muted loop />
                  ) : (
                    <img src={currentQuestion.mediaUrl} alt="" className="max-h-48 rounded-xl object-contain" />
                  )}
                </div>
              )}
              <h2 className="text-2xl font-bold text-white mb-2">{currentQuestion.question}</h2>
              <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{currentQuestion.points} pts</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{totalAnswers} answered</span>
              </div>
            </div>

            {/* Answer options */}
            <div className="grid grid-cols-2 gap-3">
              {opts.map((opt: string, i: number) => (
                <div key={i} className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: ANSWER_COLORS[i] + "22", border: `2px solid ${ANSWER_COLORS[i]}44` }}>
                  <span className="text-2xl font-black" style={{ color: ANSWER_COLORS[i] }}>{ANSWER_SHAPES[i]}</span>
                  <span className="text-white font-medium flex-1">{opt}</span>
                  <Badge className="ml-auto" style={{ background: ANSWER_COLORS[i] + "44", color: ANSWER_COLORS[i] }}>
                    {answerCounts[i]}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button className="flex-1" variant="outline" style={{ borderColor: themeColor, color: themeColor }}
                onClick={handleRevealAnswers}>
                <Eye className="w-4 h-4 mr-1" /> Reveal Answers
              </Button>
              <Button className="flex-1" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                onClick={handleNextQuestion}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Results Phase ──────────────────────────────────────────────────── */}
        {phase === "results" && currentQuestion && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center">
              <h2 className="text-xl font-bold text-white mb-1">{currentQuestion.question}</h2>
              {currentQuestion.explanation && (
                <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">{currentQuestion.explanation}</p>
              )}
            </div>

            {/* Answer bars */}
            <div className="space-y-3">
              {opts.map((opt: string, i: number) => {
                const count = answerCounts[i];
                const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                const isCorrect = i === currentQuestion.correctAnswer;
                return (
                  <div key={i} className={`rounded-xl p-4 border-2 transition-all ${isCorrect ? "border-green-500" : "border-slate-700"}`}
                    style={{ background: isCorrect ? "#16a34a22" : ANSWER_COLORS[i] + "11" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl font-black" style={{ color: ANSWER_COLORS[i] }}>{ANSWER_SHAPES[i]}</span>
                      <span className={`font-medium flex-1 ${isCorrect ? "text-green-300" : "text-white"}`}>{opt}</span>
                      {isCorrect ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-slate-600" />}
                      <span className="text-white font-bold">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: isCorrect ? "#16a34a" : ANSWER_COLORS[i] }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button className="flex-1 border-slate-600 text-slate-300" variant="outline"
                onClick={handleShowLeaderboard}>
                <Trophy className="w-4 h-4 mr-1" /> Leaderboard
              </Button>
              <Button className="flex-1" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                onClick={handleNextQuestion}>
                Next Question <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Leaderboard Phase ──────────────────────────────────────────────── */}
        {(phase === "leaderboard" || phase === "ended") && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <Trophy className="w-12 h-12 mx-auto mb-2" style={{ color: "#f39c12" }} />
              <h2 className="text-3xl font-black text-white">{phase === "ended" ? "Final Results" : "Leaderboard"}</h2>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No scores yet</div>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={entry.participantId}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${i === 0 ? "border-yellow-500/50 bg-yellow-900/20" : i === 1 ? "border-slate-400/50 bg-slate-800/50" : i === 2 ? "border-orange-700/50 bg-orange-900/20" : "border-slate-700 bg-slate-900"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-slate-400 text-black" : i === 2 ? "bg-orange-700 text-white" : "bg-slate-700 text-white"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{entry.displayName}</p>
                      <p className="text-xs text-slate-400">{entry.correctAnswers} correct</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black" style={{ color: themeColor }}>{entry.totalScore.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {phase === "leaderboard" && (
              <div className="flex gap-3 mt-4">
                <Button className="flex-1 border-slate-600 text-slate-300" variant="outline"
                  onClick={handleEndSession}>
                  <StopCircle className="w-4 h-4 mr-1" /> End Session
                </Button>
                <Button className="flex-1" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                  onClick={handleNextQuestion}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {phase === "ended" && (
              <Button className="w-full mt-4" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                onClick={() => window.location.href = "/admin/sonoquiz"}>
                Back to Quiz Library
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
