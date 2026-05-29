/**
 * SonoQuizCreator.tsx — Admin-only quiz creation and management
 *
 * Access: platform admin only (no public navigation links)
 * Route: /admin/sonoquiz
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Play, GripVertical, Image, Video, Music,
  ChevronLeft, CheckCircle, Circle, Clock, Zap, ArrowUp, ArrowDown,
  BookOpen, Upload, Link2, X, Eye
} from "lucide-react";

// ─── Music tracks ─────────────────────────────────────────────────────────────
const MUSIC_TRACKS = [
  { id: "none", label: "No Music", emoji: "🔇" },
  { id: "upbeat", label: "Upbeat Pop", emoji: "🎵" },
  { id: "electronic", label: "Electronic Beat", emoji: "🎛️" },
  { id: "jazz", label: "Smooth Jazz", emoji: "🎷" },
  { id: "classical", label: "Classical Focus", emoji: "🎻" },
  { id: "lofi", label: "Lo-Fi Chill", emoji: "🎧" },
  { id: "rock", label: "Energetic Rock", emoji: "🎸" },
];

// ─── Themes ───────────────────────────────────────────────────────────────────
const THEMES = [
  { id: "teal", label: "Teal", color: "#189aa1" },
  { id: "teal", label: "Purple", color: "#7c3aed" },
  { id: "orange", label: "Orange", color: "#ea580c" },
  { id: "blue", label: "Ocean Blue", color: "#2563eb" },
  { id: "green", label: "Forest Green", color: "#16a34a" },
  { id: "rose", label: "Rose", color: "#e11d48" },
  { id: "dark", label: "Dark Mode", color: "#1e293b" },
];

const CATEGORIES = [
  "Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester",
  "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular",
  "MSK", "POCUS", "Physics", "General",
];

const ANSWER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const ANSWER_LABELS = ["A", "B", "C", "D"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuizForm {
  title: string;
  description: string;
  timeLimitSeconds: number;
  musicTrack: string;
  theme: string;
  category: string;
  coverImageUrl: string;
}

interface QuestionForm {
  question: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "gif" | "";
  timeLimitSeconds: number | null;
  points: number;
}

const defaultQuizForm = (): QuizForm => ({
  title: "",
  description: "",
  timeLimitSeconds: 20,
  musicTrack: "none",
  theme: "teal",
  category: "General",
  coverImageUrl: "",
});

const defaultQuestionForm = (): QuestionForm => ({
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  mediaUrl: "",
  mediaType: "",
  timeLimitSeconds: null,
  points: 100,
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SonoQuizCreator() {
  const { user } = useAuth();
  
  const utils = trpc.useUtils();

  const [view, setView] = useState<"list" | "edit" | "questions">("list");
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [quizForm, setQuizForm] = useState<QuizForm>(defaultQuizForm());
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(defaultQuestionForm());
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [mediaInputMode, setMediaInputMode] = useState<"url" | "upload">("url");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: quizzes, isLoading: quizzesLoading } = trpc.sonoQuiz.listQuizzes.useQuery();
  const { data: quizDetail, isLoading: questionsLoading } = trpc.sonoQuiz.getQuiz.useQuery(
    { quizId: selectedQuizId! },
    { enabled: !!selectedQuizId && view === "questions" }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createQuiz = trpc.sonoQuiz.createQuiz.useMutation({
    onSuccess: () => {
      utils.sonoQuiz.listQuizzes.invalidate();
      setShowQuizDialog(false);
      setQuizForm(defaultQuizForm());
      toast("Quiz created!");
    },
  });

  const updateQuiz = trpc.sonoQuiz.updateQuiz.useMutation({
    onSuccess: () => {
      utils.sonoQuiz.listQuizzes.invalidate();
      if (selectedQuizId) utils.sonoQuiz.getQuiz.invalidate({ quizId: selectedQuizId });
      setShowQuizDialog(false);
      toast("Quiz updated!");
    },
  });

  const deleteQuiz = trpc.sonoQuiz.deleteQuiz.useMutation({
    onSuccess: () => {
      utils.sonoQuiz.listQuizzes.invalidate();
      toast("Quiz deleted");
    },
  });

  const upsertQuestion = trpc.sonoQuiz.upsertQuestion.useMutation({
    onSuccess: () => {
      if (selectedQuizId) utils.sonoQuiz.getQuiz.invalidate({ quizId: selectedQuizId });
      utils.sonoQuiz.listQuizzes.invalidate();
      setShowQuestionDialog(false);
      setQuestionForm(defaultQuestionForm());
      setEditingQuestionId(null);
      toast(editingQuestionId ? "Question updated!" : "Question added!");
    },
  });

  const deleteQuestion = trpc.sonoQuiz.deleteQuestion.useMutation({
    onSuccess: () => {
      if (selectedQuizId) utils.sonoQuiz.getQuiz.invalidate({ quizId: selectedQuizId });
      utils.sonoQuiz.listQuizzes.invalidate();
      toast("Question deleted");
    },
  });

  const reorderQuestions = trpc.sonoQuiz.reorderQuestions.useMutation();

  const createSession = trpc.sonoQuiz.createSession.useMutation({
    onSuccess: (data) => {
      toast(`Session created! Join code: ${data.joinCode}`);
      // Navigate to host dashboard
      window.location.href = `/admin/sonoquiz/host/${data.sessionId}`;
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openCreateQuiz() {
    setEditingQuizId(null);
    setQuizForm(defaultQuizForm());
    setShowQuizDialog(true);
  }

  function openEditQuiz(quiz: any) {
    setEditingQuizId(quiz.id);
    setQuizForm({
      title: quiz.title,
      description: quiz.description ?? "",
      timeLimitSeconds: quiz.timeLimitSeconds,
      musicTrack: quiz.musicTrack ?? "none",
      theme: quiz.theme ?? "teal",
      category: quiz.category,
      coverImageUrl: quiz.coverImageUrl ?? "",
    });
    setShowQuizDialog(true);
  }

  function submitQuizForm() {
    if (!quizForm.title.trim()) return;
    if (editingQuizId) {
      updateQuiz.mutate({ quizId: editingQuizId, ...quizForm, musicTrack: quizForm.musicTrack === "none" ? undefined : quizForm.musicTrack });
    } else {
      createQuiz.mutate({ ...quizForm, musicTrack: quizForm.musicTrack === "none" ? undefined : quizForm.musicTrack });
    }
  }

  function openQuestions(quizId: number) {
    setSelectedQuizId(quizId);
    setView("questions");
  }

  function openAddQuestion() {
    setEditingQuestionId(null);
    setQuestionForm(defaultQuestionForm());
    setShowQuestionDialog(true);
  }

  function openEditQuestion(q: any) {
    setEditingQuestionId(q.id);
    const opts = JSON.parse(q.options);
    setQuestionForm({
      question: q.question,
      options: [opts[0] ?? "", opts[1] ?? "", opts[2] ?? "", opts[3] ?? ""],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? "",
      mediaUrl: q.mediaUrl ?? "",
      mediaType: q.mediaType ?? "",
      timeLimitSeconds: q.timeLimitSeconds ?? null,
      points: q.points,
    });
    setShowQuestionDialog(true);
  }

  function submitQuestionForm() {
    if (!questionForm.question.trim()) return;
    if (questionForm.options.filter(o => o.trim()).length < 2) {
      toast.error("At least 2 answer options required");
      return;
    }
    upsertQuestion.mutate({
      questionId: editingQuestionId ?? undefined,
      quizId: selectedQuizId!,
      question: questionForm.question,
      options: questionForm.options.filter(o => o.trim()) as any,
      correctAnswer: questionForm.correctAnswer,
      explanation: questionForm.explanation || undefined,
      mediaUrl: questionForm.mediaUrl || undefined,
      mediaType: (questionForm.mediaType || undefined) as any,
      timeLimitSeconds: questionForm.timeLimitSeconds ?? undefined,
      points: questionForm.points,
      sortOrder: editingQuestionId ? undefined as any : (quizDetail?.questions.length ?? 0),
    });
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    if (!quizDetail) return;
    const qs = [...quizDetail.questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= qs.length) return;
    [qs[index], qs[targetIndex]] = [qs[targetIndex], qs[index]];
    reorderQuestions.mutate({
      quizId: selectedQuizId!,
      order: qs.map((q, i) => ({ questionId: q.id, sortOrder: i })),
    });
  }

  function handleLaunchSession(quizId: number) {
    createSession.mutate({ quizId, allowAnonymous: true, showLeaderboard: true });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!user) return null;

  const themeColor = THEMES.find(t => t.id === (quizDetail?.quiz.theme ?? "teal"))?.color ?? "#189aa1";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {view !== "list" && (
            <Button variant="ghost" size="sm" onClick={() => setView("list")} className="text-slate-400 hover:text-white">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">SonoQuiz</h1>
              <p className="text-xs text-slate-400">
                {view === "list" ? "Quiz Library" : view === "questions" ? quizDetail?.quiz.title ?? "Questions" : "Edit Quiz"}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">Admin Only</Badge>
            {view === "list" && (
              <Button size="sm" onClick={openCreateQuiz} style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                <Plus className="w-4 h-4 mr-1" /> New Quiz
              </Button>
            )}
            {view === "questions" && (
              <Button size="sm" onClick={openAddQuestion} style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                <Plus className="w-4 h-4 mr-1" /> Add Question
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Quiz List View ─────────────────────────────────────────────────── */}
        {view === "list" && (
          <div>
            {quizzesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl bg-slate-800 animate-pulse" />)}
              </div>
            ) : !quizzes?.length ? (
              <div className="text-center py-24 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No quizzes yet</p>
                <p className="text-sm mt-1">Create your first SonoQuiz to get started</p>
                <Button className="mt-4" onClick={openCreateQuiz} style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                  <Plus className="w-4 h-4 mr-1" /> Create Quiz
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizzes.map(quiz => {
                  const theme = THEMES.find(t => t.id === quiz.theme) ?? THEMES[0];
                  const music = MUSIC_TRACKS.find(m => m.id === (quiz.musicTrack ?? "none")) ?? MUSIC_TRACKS[0];
                  return (
                    <Card key={quiz.id} className="bg-slate-900 border-slate-700 overflow-hidden hover:border-slate-500 transition-colors">
                      {/* Color bar */}
                      <div className="h-2" style={{ background: `linear-gradient(90deg, ${theme.color}, ${theme.color}88)` }} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{quiz.title}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{quiz.category}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={quiz.status === "published" ? "border-green-500/50 text-green-400" : "border-slate-600 text-slate-400"}
                          >
                            {quiz.status}
                          </Badge>
                        </div>
                        {quiz.description && (
                          <p className="text-xs text-slate-500 mb-3 line-clamp-2">{quiz.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{quiz.questionCount} questions</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{quiz.timeLimitSeconds}s</span>
                          <span>{music.emoji} {music.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                            onClick={() => openQuestions(quiz.id)}>
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button size="sm" className="flex-1"
                            style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.color}cc)` }}
                            onClick={() => handleLaunchSession(quiz.id)}
                            disabled={quiz.questionCount === 0 || createSession.isPending}>
                            <Play className="w-3 h-3 mr-1" /> Launch
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 px-2"
                            onClick={() => { if (confirm("Delete this quiz?")) deleteQuiz.mutate({ quizId: quiz.id }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Questions View ─────────────────────────────────────────────────── */}
        {view === "questions" && (
          <div>
            {/* Quiz info bar */}
            {quizDetail && (
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}>
                  {quizDetail.quiz.title[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-white">{quizDetail.quiz.title}</h2>
                  <p className="text-xs text-slate-400">{quizDetail.questions.length} questions · {quizDetail.quiz.timeLimitSeconds}s default · {quizDetail.quiz.category}</p>
                </div>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300"
                  onClick={() => openEditQuiz(quizDetail.quiz)}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit Quiz
                </Button>
                <Button size="sm" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                  onClick={() => handleLaunchSession(selectedQuizId!)}
                  disabled={quizDetail.questions.length === 0 || createSession.isPending}>
                  <Play className="w-3 h-3 mr-1" /> Launch Session
                </Button>
              </div>
            )}

            {questionsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-slate-800 animate-pulse" />)}
              </div>
            ) : !quizDetail?.questions.length ? (
              <div className="text-center py-16 text-slate-500">
                <Circle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No questions yet</p>
                <Button className="mt-3" onClick={openAddQuestion} style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                  <Plus className="w-4 h-4 mr-1" /> Add First Question
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {quizDetail.questions.map((q, i) => {
                  const opts = JSON.parse(q.options);
                  return (
                    <Card key={q.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Question number */}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium mb-2 line-clamp-2">{q.question}</p>
                            {/* Options */}
                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                              {opts.map((opt: string, oi: number) => (
                                <div key={oi} className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${oi === q.correctAnswer ? "bg-green-900/40 border border-green-700/50 text-green-300" : "bg-slate-800 text-slate-400"}`}>
                                  <span className="font-bold" style={{ color: ANSWER_COLORS[oi] }}>{ANSWER_LABELS[oi]}</span>
                                  <span className="truncate">{opt}</span>
                                  {oi === q.correctAnswer && <CheckCircle className="w-3 h-3 text-green-400 ml-auto shrink-0" />}
                                </div>
                              ))}
                            </div>
                            {/* Meta */}
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{q.points} pts</span>
                              {q.timeLimitSeconds && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{q.timeLimitSeconds}s</span>}
                              {q.mediaUrl && <span className="flex items-center gap-1"><Image className="w-3 h-3" />Media</span>}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-white"
                              onClick={() => moveQuestion(i, "up")} disabled={i === 0}>
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-white"
                              onClick={() => moveQuestion(i, "down")} disabled={i === quizDetail.questions.length - 1}>
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-teal-400"
                              onClick={() => openEditQuestion(q)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                              onClick={() => { if (confirm("Delete this question?")) deleteQuestion.mutate({ questionId: q.id, quizId: selectedQuizId! }); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Quiz Create/Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuizId ? "Edit Quiz" : "Create New Quiz"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-slate-300 text-sm">Quiz Title *</Label>
              <Input value={quizForm.title} onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Abdominal Ultrasound Fundamentals"
                className="mt-1 bg-slate-800 border-slate-600 text-white" />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Description</Label>
              <Textarea value={quizForm.description} onChange={e => setQuizForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this quiz..."
                className="mt-1 bg-slate-800 border-slate-600 text-white resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">Category</Label>
                <Select value={quizForm.category} onValueChange={v => setQuizForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Default Time Limit: {quizForm.timeLimitSeconds}s</Label>
                <div className="mt-3 px-1">
                  <Slider min={5} max={120} step={5} value={[quizForm.timeLimitSeconds]}
                    onValueChange={([v]) => setQuizForm(f => ({ ...f, timeLimitSeconds: v }))} />
                </div>
              </div>
            </div>
            {/* Theme */}
            <div>
              <Label className="text-slate-300 text-sm">Color Theme</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setQuizForm(f => ({ ...f, theme: t.id }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${quizForm.theme === t.id ? "border-white scale-110" : "border-transparent"}`}
                    style={{ background: t.color }} title={t.label} />
                ))}
              </div>
            </div>
            {/* Music */}
            <div>
              <Label className="text-slate-300 text-sm">Background Music</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {MUSIC_TRACKS.map(m => (
                  <button key={m.id} onClick={() => setQuizForm(f => ({ ...f, musicTrack: m.id }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${quizForm.musicTrack === m.id ? "border-teal-500 bg-teal-900/30 text-teal-300" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                    <span>{m.emoji}</span><span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Cover image */}
            <div>
              <Label className="text-slate-300 text-sm">Cover Image URL (optional)</Label>
              <Input value={quizForm.coverImageUrl} onChange={e => setQuizForm(f => ({ ...f, coverImageUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1 bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setShowQuizDialog(false)}>Cancel</Button>
              <Button className="flex-1" style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}
                onClick={submitQuizForm} disabled={!quizForm.title.trim() || createQuiz.isPending || updateQuiz.isPending}>
                {editingQuizId ? "Save Changes" : "Create Quiz"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Question Create/Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestionId ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Question text */}
            <div>
              <Label className="text-slate-300 text-sm">Question *</Label>
              <Textarea value={questionForm.question} onChange={e => setQuestionForm(f => ({ ...f, question: e.target.value }))}
                placeholder="Enter your question here..."
                className="mt-1 bg-slate-800 border-slate-600 text-white resize-none" rows={3} />
            </div>

            {/* Media */}
            <div>
              <Label className="text-slate-300 text-sm">Media (optional)</Label>
              <div className="flex gap-2 mt-1 mb-2">
                {(["image", "video", "gif"] as const).map(type => (
                  <button key={type} onClick={() => setQuestionForm(f => ({ ...f, mediaType: f.mediaType === type ? "" : type }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${questionForm.mediaType === type ? "border-teal-500 bg-teal-900/30 text-teal-300" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                    {type === "image" ? <Image className="w-3 h-3" /> : type === "video" ? <Video className="w-3 h-3" /> : <span>GIF</span>}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              {questionForm.mediaType && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => setMediaInputMode("url")}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${mediaInputMode === "url" ? "bg-slate-700 text-white" : "text-slate-500"}`}>
                      <Link2 className="w-3 h-3" /> URL
                    </button>
                    <button onClick={() => setMediaInputMode("upload")}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${mediaInputMode === "upload" ? "bg-slate-700 text-white" : "text-slate-500"}`}>
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                  </div>
                  {mediaInputMode === "url" ? (
                    <Input value={questionForm.mediaUrl} onChange={e => setQuestionForm(f => ({ ...f, mediaUrl: e.target.value }))}
                      placeholder={`Paste ${questionForm.mediaType} URL...`}
                      className="bg-slate-800 border-slate-600 text-white" />
                  ) : (
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-teal-500 transition-colors"
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-6 h-6 mx-auto mb-1 text-slate-500" />
                      <p className="text-xs text-slate-400">Click to upload {questionForm.mediaType}</p>
                      <input ref={fileInputRef} type="file" className="hidden"
                        accept={questionForm.mediaType === "video" ? "video/*" : "image/*"}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          // For now show a placeholder — actual upload via tRPC file upload endpoint
                          toast("Upload via URL for now", { description: "Paste the media URL directly" });
                        }} />
                    </div>
                  )}
                  {/* Preview */}
                  {questionForm.mediaUrl && (
                    <div className="relative rounded-lg overflow-hidden bg-slate-800 max-h-40">
                      {questionForm.mediaType === "video" ? (
                        <video src={questionForm.mediaUrl} className="w-full max-h-40 object-contain" controls />
                      ) : (
                        <img src={questionForm.mediaUrl} alt="Preview" className="w-full max-h-40 object-contain" />
                      )}
                      <button className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                        onClick={() => setQuestionForm(f => ({ ...f, mediaUrl: "", mediaType: "" }))}>
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Answer options */}
            <div>
              <Label className="text-slate-300 text-sm">Answer Options * (select correct answer)</Label>
              <div className="space-y-2 mt-2">
                {questionForm.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => setQuestionForm(f => ({ ...f, correctAnswer: i }))}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-colors ${questionForm.correctAnswer === i ? "border-green-500 text-white" : "border-slate-600 text-slate-400"}`}
                      style={{ background: questionForm.correctAnswer === i ? ANSWER_COLORS[i] : "transparent" }}>
                      {ANSWER_LABELS[i]}
                    </button>
                    <Input value={opt} onChange={e => {
                      const opts = [...questionForm.options] as [string, string, string, string];
                      opts[i] = e.target.value;
                      setQuestionForm(f => ({ ...f, options: opts }));
                    }}
                      placeholder={`Option ${ANSWER_LABELS[i]}${i < 2 ? " (required)" : " (optional)"}`}
                      className="bg-slate-800 border-slate-600 text-white" />
                    {questionForm.correctAnswer === i && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div>
              <Label className="text-slate-300 text-sm">Explanation (shown after answer)</Label>
              <Textarea value={questionForm.explanation} onChange={e => setQuestionForm(f => ({ ...f, explanation: e.target.value }))}
                placeholder="Explain why this is the correct answer..."
                className="mt-1 bg-slate-800 border-slate-600 text-white resize-none" rows={2} />
            </div>

            {/* Points & time limit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">Points: {questionForm.points}</Label>
                <div className="mt-3 px-1">
                  <Slider min={10} max={500} step={10} value={[questionForm.points]}
                    onValueChange={([v]) => setQuestionForm(f => ({ ...f, points: v }))} />
                </div>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">
                  Time Override: {questionForm.timeLimitSeconds ? `${questionForm.timeLimitSeconds}s` : "Use quiz default"}
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch checked={questionForm.timeLimitSeconds !== null}
                    onCheckedChange={v => setQuestionForm(f => ({ ...f, timeLimitSeconds: v ? 20 : null }))} />
                  {questionForm.timeLimitSeconds !== null && (
                    <div className="flex-1 px-1">
                      <Slider min={5} max={120} step={5} value={[questionForm.timeLimitSeconds]}
                        onValueChange={([v]) => setQuestionForm(f => ({ ...f, timeLimitSeconds: v }))} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setShowQuestionDialog(false)}>Cancel</Button>
              <Button className="flex-1" style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}
                onClick={submitQuestionForm}
                disabled={!questionForm.question.trim() || upsertQuestion.isPending}>
                {editingQuestionId ? "Save Question" : "Add Question"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
