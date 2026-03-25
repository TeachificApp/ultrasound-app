/**
 * SonoQuizPlay.tsx — Student-facing live quiz experience
 *
 * Access: public (anyone with the join code or QR link)
 * Route: /quiz/:joinCode
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Zap, Trophy, Clock, CheckCircle, XCircle, Users,
  Wifi, WifiOff, Star, Award,
} from "lucide-react";

// ─── Ultrasound-themed anonymous names ───────────────────────────────────────
const SONO_NAMES = [
  "SonoStar", "EchoAce", "ProbeHero", "GainMaster", "DepthSeeker",
  "FocusZone", "DopplerDash", "HarmonicHawk", "B-ModeBlaze", "ShadowHunter",
  "ArtifactAce", "FrequencyFox", "TransducerTitan", "NeedlePro", "WaveRider",
  "GrayScaleGuru", "ColorFlowKing", "PowerDopplerPro", "SectorStar", "LinearLegend",
  "CurvilinearCrew", "PhantomPhoenix", "CaliperChamp", "GainGuru", "DepthDiver",
  "FocusFalcon", "SonoSage", "EchoElite", "ProbeWizard", "UltrasoundUnicorn",
];

const ANSWER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const ANSWER_SHAPES = ["▲", "◆", "●", "■"];
const ANSWER_LABELS = ["A", "B", "C", "D"];

// ─── WebSocket hook ───────────────────────────────────────────────────────────
function useSonoQuizWS(sessionId: number | null, participantId: number | null, onMessage: (msg: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !participantId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/sonoquiz?sessionId=${sessionId}&participantId=${participantId}&role=player`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch {}
    };
    return () => ws.close();
  }, [sessionId, participantId]);

  const send = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SonoQuizPlay() {
  const [, params] = useRoute("/quiz/:joinCode");
  const joinCode = params?.joinCode?.toUpperCase() ?? "";
  const { user } = useAuth();
  

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<"join" | "lobby" | "question" | "answered" | "results" | "leaderboard" | "ended">("join");
  const [displayName, setDisplayName] = useState("");
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [quizInfo, setQuizInfo] = useState<any>(null);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const joinSession = trpc.sonoQuiz.joinSession.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setParticipantId(data.participantId);
      setQuizInfo({ title: data.quizTitle, musicTrack: data.musicTrack, theme: data.theme });
      setPhase("lobby");
    },
    onError: (err) => {
      toast.error("Could not join", { description: err.message });
    },
  });

  const submitAnswer = trpc.sonoQuiz.submitAnswer.useMutation({
    onSuccess: (data) => {
      setPointsEarned(data.pointsEarned);
      setScore(prev => (prev ?? 0) + data.pointsEarned);
      if (data.isCorrect) setStreak(s => s + 1);
      else setStreak(0);
      setPhase("answered");
    },
  });

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const { connected } = useSonoQuizWS(sessionId, participantId, (msg) => {
    switch (msg.type) {
      case "question_started":
        setCurrentQuestion(msg.question);
        setQuestionIndex(msg.questionIndex);
        setTotalQuestions(msg.totalQuestions);
        setSelectedAnswer(null);
        setCorrectAnswer(null);
        setPointsEarned(null);
        setPhase("question");
        setTimeLeft(msg.timeLimitSeconds);
        startTimer(msg.timeLimitSeconds);
        break;
      case "question_ended":
        setCorrectAnswer(msg.correctAnswer);
        stopTimer();
        if (phase !== "answered") setPhase("answered");
        break;
      case "leaderboard_update":
        setLeaderboard(msg.leaderboard);
        const myEntry = msg.leaderboard.find((e: any) => e.participantId === participantId);
        if (myEntry) setRank(myEntry.rank);
        setPhase("leaderboard");
        break;
      case "session_ended":
        setLeaderboard(msg.leaderboard ?? []);
        setPhase("ended");
        break;
      case "participant_count":
        setParticipantCount(msg.count);
        break;
    }
  });

  function startTimer(seconds: number) {
    stopTimer();
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { stopTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => () => stopTimer(), []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const themeColor = quizInfo?.theme === "purple" ? "#7c3aed"
    : quizInfo?.theme === "orange" ? "#ea580c"
    : quizInfo?.theme === "blue" ? "#2563eb"
    : quizInfo?.theme === "green" ? "#16a34a"
    : quizInfo?.theme === "rose" ? "#e11d48"
    : quizInfo?.theme === "dark" ? "#334155"
    : "#189aa1";

  function pickRandomName() {
    const name = SONO_NAMES[Math.floor(Math.random() * SONO_NAMES.length)] + Math.floor(Math.random() * 999);
    setDisplayName(name);
    setUseAnonymous(true);
  }

  function handleJoin() {
    const name = displayName.trim();
    if (!name) { toast.error("Enter a name to join"); return; }
    joinSession.mutate({
      joinCode,
      displayName: name,
      useAnonymous: false,
    });
  }

  function handleSelectAnswer(index: number) {
    if (selectedAnswer !== null || phase !== "question") return;
    setSelectedAnswer(index);
    stopTimer();
    submitAnswer.mutate({
      sessionId: sessionId!,
      participantId: participantId!,
      questionId: currentQuestion.id,
      selectedAnswer: index,
      responseTimeMs: Math.max(0, (currentQuestion.timeLimitSeconds ?? 20) * 1000 - timeLeft * 1000),
    });
  }

  const opts = currentQuestion ? JSON.parse(currentQuestion.options) : [];
  const myLeaderboardEntry = leaderboard.find(e => e.participantId === participantId);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: `linear-gradient(135deg, #0f172a 0%, ${themeColor}22 100%)` }}>
      {/* Status bar */}
      {sessionId && (
        <div className="flex items-center justify-between px-4 py-2 bg-black/30">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {connected ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
            <span>{displayName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-yellow-400"><Star className="w-3 h-3" />{score.toLocaleString()}</span>
            {streak >= 2 && <span className="text-orange-400">🔥 {streak}</span>}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-lg mx-auto w-full">

        {/* ── Join Screen ─────────────────────────────────────────────────── */}
        {phase === "join" && (
          <div className="w-full space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}>
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black text-white">SonoQuiz</h1>
              <p className="text-slate-400 mt-1">Join code: <span className="font-mono font-bold text-white">{joinCode}</span></p>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-1 block">Your Name</label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Enter your name..."
                  className="bg-slate-800 border-slate-600 text-white text-lg h-12"
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  maxLength={32}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-700" />
                <span className="text-xs text-slate-500">or</span>
                <div className="h-px flex-1 bg-slate-700" />
              </div>
              <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={pickRandomName}>
                🎲 Pick a Random Ultrasound Name
              </Button>
              {useAnonymous && displayName && (
                <p className="text-center text-sm text-teal-400">You'll join as <strong>{displayName}</strong></p>
              )}
              <Button className="w-full h-12 text-lg font-bold"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                onClick={handleJoin}
                disabled={!displayName.trim() || joinSession.isPending}>
                {joinSession.isPending ? "Joining..." : "Join Quiz"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Lobby ──────────────────────────────────────────────────────── */}
        {phase === "lobby" && (
          <div className="text-center space-y-6 w-full">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}>
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{quizInfo?.title}</h2>
              <p className="text-slate-400 mt-1">{quizInfo?.category}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6">
              <div className="flex items-center justify-center gap-2 text-slate-400 mb-2">
                <Users className="w-4 h-4" />
                <span>{participantCount} players joined</span>
              </div>
              <div className="flex items-center justify-center gap-2 animate-pulse mt-4">
                <div className="w-2 h-2 rounded-full" style={{ background: themeColor }} />
                <span className="text-slate-300">Waiting for host to start...</span>
                <div className="w-2 h-2 rounded-full" style={{ background: themeColor }} />
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 text-center">
              <p className="text-sm text-slate-400">Joined as</p>
              <p className="text-lg font-bold text-white">{displayName}</p>
            </div>
          </div>
        )}

        {/* ── Question Screen ─────────────────────────────────────────────── */}
        {phase === "question" && currentQuestion && (
          <div className="w-full space-y-4">
            {/* Progress + timer */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Q{questionIndex + 1}/{totalQuestions}</span>
              <Progress value={((questionIndex + 1) / totalQuestions) * 100} className="flex-1 h-1.5" />
              <div className={`flex items-center gap-1 font-bold text-xl ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"}`}>
                <Clock className="w-4 h-4" />
                {timeLeft}
              </div>
            </div>

            {/* Question */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 text-center">
              {currentQuestion.mediaUrl && (
                <div className="mb-3 flex justify-center">
                  {currentQuestion.mediaType === "video" ? (
                    <video src={currentQuestion.mediaUrl} className="max-h-40 rounded-xl" autoPlay muted loop />
                  ) : (
                    <img src={currentQuestion.mediaUrl} alt="" className="max-h-40 rounded-xl object-contain" />
                  )}
                </div>
              )}
              <p className="text-lg font-bold text-white">{currentQuestion.question}</p>
              <p className="text-xs text-slate-400 mt-1">{currentQuestion.points} points</p>
            </div>

            {/* Answer buttons */}
            <div className="grid grid-cols-2 gap-3">
              {opts.map((opt: string, i: number) => (
                <button key={i}
                  onClick={() => handleSelectAnswer(i)}
                  disabled={selectedAnswer !== null}
                  className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${selectedAnswer === i ? "scale-95 opacity-80" : "hover:scale-102"}`}
                  style={{
                    background: ANSWER_COLORS[i] + "33",
                    borderColor: ANSWER_COLORS[i] + "88",
                  }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-black" style={{ color: ANSWER_COLORS[i] }}>{ANSWER_SHAPES[i]}</span>
                    <span className="text-xs font-bold text-white">{ANSWER_LABELS[i]}</span>
                  </div>
                  <p className="text-sm text-white font-medium leading-snug">{opt}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Answered Screen ─────────────────────────────────────────────── */}
        {phase === "answered" && (
          <div className="text-center space-y-6 w-full">
            {correctAnswer !== null ? (
              selectedAnswer === correctAnswer ? (
                <div>
                  <div className="w-20 h-20 rounded-full bg-green-900/50 border-2 border-green-500 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                  <h2 className="text-3xl font-black text-green-400">Correct!</h2>
                  {pointsEarned !== null && (
                    <p className="text-xl text-white mt-1">+{pointsEarned} points</p>
                  )}
                  {streak >= 2 && (
                    <p className="text-orange-400 font-bold mt-1">🔥 {streak} in a row!</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="w-20 h-20 rounded-full bg-red-900/50 border-2 border-red-500 flex items-center justify-center mx-auto mb-3">
                    <XCircle className="w-10 h-10 text-red-400" />
                  </div>
                  <h2 className="text-3xl font-black text-red-400">Incorrect</h2>
                  {selectedAnswer === null && (
                    <p className="text-slate-400 mt-1">Time ran out</p>
                  )}
                  <p className="text-slate-300 mt-2 text-sm">
                    Correct: <span className="font-bold" style={{ color: ANSWER_COLORS[correctAnswer] }}>
                      {ANSWER_SHAPES[correctAnswer]} {opts[correctAnswer]}
                    </span>
                  </p>
                </div>
              )
            ) : (
              <div>
                <div className="w-20 h-20 rounded-full border-2 border-teal-500 flex items-center justify-center mx-auto mb-3 animate-pulse"
                  style={{ background: themeColor + "22" }}>
                  <CheckCircle className="w-10 h-10" style={{ color: themeColor }} />
                </div>
                <h2 className="text-2xl font-bold text-white">Answer Submitted!</h2>
                <p className="text-slate-400 mt-1 animate-pulse">Waiting for host to reveal...</p>
              </div>
            )}

            {/* Explanation */}
            {correctAnswer !== null && currentQuestion?.explanation && (
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 text-left">
                <p className="text-xs text-slate-400 mb-1">Explanation</p>
                <p className="text-sm text-white">{currentQuestion.explanation}</p>
              </div>
            )}

            {/* Score */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400">Score</p>
                <p className="text-xl font-black" style={{ color: themeColor }}>{score.toLocaleString()}</p>
              </div>
              {rank && (
                <div className="text-center">
                  <p className="text-xs text-slate-400">Rank</p>
                  <p className="text-xl font-black text-white">#{rank}</p>
                </div>
              )}
            </div>

            <p className="text-slate-500 text-sm animate-pulse">Waiting for next question...</p>
          </div>
        )}

        {/* ── Leaderboard ─────────────────────────────────────────────────── */}
        {(phase === "leaderboard" || phase === "ended") && (
          <div className="w-full space-y-4">
            <div className="text-center">
              <Trophy className="w-12 h-12 mx-auto mb-2" style={{ color: "#f39c12" }} />
              <h2 className="text-2xl font-black text-white">{phase === "ended" ? "Final Results" : "Leaderboard"}</h2>
            </div>

            {/* My position */}
            {myLeaderboardEntry && (
              <div className="border-2 rounded-xl p-4 text-center"
                style={{ borderColor: themeColor, background: themeColor + "22" }}>
                <p className="text-slate-300 text-sm">Your Position</p>
                <p className="text-4xl font-black text-white">#{myLeaderboardEntry.rank}</p>
                <p className="text-lg font-bold mt-1" style={{ color: themeColor }}>{myLeaderboardEntry.totalScore.toLocaleString()} pts</p>
              </div>
            )}

            {/* Top 10 */}
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div key={entry.participantId}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${entry.participantId === participantId ? "border-teal-500/50" : "border-slate-700"} ${i === 0 ? "bg-yellow-900/20" : "bg-slate-900/60"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-slate-400 text-black" : i === 2 ? "bg-orange-700 text-white" : "bg-slate-700 text-white"}`}>
                    {i + 1}
                  </div>
                  <span className="flex-1 text-white font-medium truncate">{entry.displayName}</span>
                  {entry.participantId === participantId && <Badge className="text-xs" style={{ background: themeColor + "44", color: themeColor }}>You</Badge>}
                  <span className="font-bold" style={{ color: themeColor }}>{entry.totalScore.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {phase === "ended" && (
              <Button className="w-full mt-2 border-slate-600 text-slate-300" variant="outline"
                onClick={() => window.location.href = "/"}>
                Back to Home
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
