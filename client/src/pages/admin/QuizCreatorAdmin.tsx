/**
 * QuizCreatorAdmin.tsx
 * Admin panel for the Standalone Quiz Creator.
 * Routes:
 *   /admin/quiz-creator          — list all quizzes
 *   /admin/quiz-creator/:quizId  — edit a specific quiz (settings + questions + analytics)
 */
import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Edit2, ArrowLeft, BarChart2, Settings2, BookOpen,
  Users, CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight,
  Eye, EyeOff, Copy, Loader2, AlertTriangle, GripVertical, X,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusColor: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

function fmtScore(score: number | string | null | undefined) {
  if (score === null || score === undefined) return "—";
  return `${Number(score).toFixed(1)}%`;
}

function fmtTime(secs: number | null | undefined) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Quiz List ────────────────────────────────────────────────────────────────
function QuizList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, refetch } = trpc.standaloneQuizAdmin.listQuizzes.useQuery({
    search: search || undefined,
    status: status !== "all" ? (status as any) : undefined,
    type: type !== "all" ? (type as any) : undefined,
    page,
    pageSize: 20,
  });

  const createMutation = trpc.standaloneQuizAdmin.createQuiz.useMutation({
    onSuccess: (res) => {
      toast.success("Quiz created");
      setShowCreate(false);
      navigate(`/admin/quiz-creator/${res.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.standaloneQuizAdmin.deleteQuiz.useMutation({
    onSuccess: () => { toast.success("Quiz deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [newQuiz, setNewQuiz] = useState({ title: "", type: "quiz" as "quiz" | "mock_exam", brand: "aaus" as "aaus" | "iheartecho" });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quiz Creator</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage standalone quizzes and mock exams</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-2" /> New Quiz
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search quizzes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="quiz">Quiz</SelectItem>
              <SelectItem value="mock_exam">Mock Exam</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.quizzes.length ? (
            <div className="p-12 text-center text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No quizzes yet</p>
              <p className="text-sm mt-1">Click "New Quiz" to create your first quiz</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Questions</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Attempts</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.quizzes.map(({ quiz, questionCount, attemptCount }) => (
                  <tr key={quiz.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/quiz-creator/${quiz.id}`)}
                        className="font-medium text-gray-900 hover:text-teal-700 text-left"
                      >
                        {quiz.title}
                      </button>
                      <div className="text-xs text-gray-400 mt-0.5">{quiz.brand === "aaus" ? "All About Ultrasound" : "iHeartEcho"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-gray-700">{quiz.type === "mock_exam" ? "Mock Exam" : "Quiz"}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{Number(questionCount)}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{Number(attemptCount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[quiz.status]}`}>
                        {quiz.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/quiz-creator/${quiz.id}`)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm(`Delete "${quiz.title}"? This cannot be undone.`)) {
                              deleteMutation.mutate({ id: quiz.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>Page {page} of {totalPages} ({data?.total ?? 0} total)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Quiz</DialogTitle>
            <DialogDescription>Set the basic details — you can edit everything after creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input value={newQuiz.title} onChange={(e) => setNewQuiz(q => ({ ...q, title: e.target.value }))} placeholder="e.g. Adult Echo Registry Review Quiz" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={newQuiz.type} onValueChange={(v: any) => setNewQuiz(q => ({ ...q, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz (instant feedback)</SelectItem>
                    <SelectItem value="mock_exam">Mock Exam (submit all)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Brand</Label>
                <Select value={newQuiz.brand} onValueChange={(v: any) => setNewQuiz(q => ({ ...q, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aaus">All About Ultrasound</SelectItem>
                    <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!newQuiz.title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ title: newQuiz.title, type: newQuiz.type, brand: newQuiz.brand })}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Quiz Editor ──────────────────────────────────────────────────────────────
function QuizEditor({ quizId }: { quizId: number }) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("settings");

  const { data, isLoading, refetch } = trpc.standaloneQuizAdmin.getQuiz.useQuery({ id: quizId });
  const { data: analytics } = trpc.standaloneQuizAdmin.getAnalytics.useQuery({ quizId }, { enabled: activeTab === "analytics" });

  const updateMutation = trpc.standaloneQuizAdmin.updateQuiz.useMutation({
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const removeQMutation = trpc.standaloneQuizAdmin.removeQuestion.useMutation({
    onSuccess: () => { toast.success("Question removed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [settings, setSettings] = useState<any>(null);
  const [qSearch, setQSearch] = useState("");
  const [qPage, setQPage] = useState(1);
  const [showAddQ, setShowAddQ] = useState(false);

  useEffect(() => {
    if (data?.quiz && !settings) {
      setSettings({ ...data.quiz });
    }
  }, [data?.quiz]);

  // Question bank search for adding questions
  const { data: bankData } = trpc.questionBank.listQuestions.useQuery(
    { search: qSearch || undefined, page: qPage, pageSize: 20 },
    { enabled: showAddQ }
  );

  const addQMutation = trpc.standaloneQuizAdmin.addQuestions.useMutation({
    onSuccess: (res) => { toast.success(`${res.added} question(s) added`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [selectedBankIds, setSelectedBankIds] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        Quiz not found
      </div>
    );
  }

  const { quiz, questions } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/quiz-creator")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{quiz.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[quiz.status]}`}>{quiz.status}</span>
              <span className="text-xs text-gray-400">{quiz.type === "mock_exam" ? "Mock Exam" : "Quiz"}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">{questions.length} questions</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/quizzes/${quiz.id}`, "_blank")}
          >
            <Eye className="w-4 h-4 mr-1" /> Preview
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="settings"><Settings2 className="w-4 h-4 mr-1" />Settings</TabsTrigger>
            <TabsTrigger value="questions"><BookOpen className="w-4 h-4 mr-1" />Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-1" />Analytics</TabsTrigger>
          </TabsList>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings">
            {settings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input value={settings.title} onChange={(e) => setSettings((s: any) => ({ ...s, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={settings.description ?? ""} onChange={(e) => setSettings((s: any) => ({ ...s, description: e.target.value }))} rows={3} />
                    </div>
                    <div>
                      <Label>Instructions (shown before start)</Label>
                      <Textarea value={settings.instructions ?? ""} onChange={(e) => setSettings((s: any) => ({ ...s, instructions: e.target.value }))} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={settings.type} onValueChange={(v) => setSettings((s: any) => ({ ...s, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quiz">Quiz</SelectItem>
                            <SelectItem value="mock_exam">Mock Exam</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Brand</Label>
                        <Select value={settings.brand} onValueChange={(v) => setSettings((s: any) => ({ ...s, brand: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aaus">AAUS</SelectItem>
                            <SelectItem value="iheartecho">iHeartEcho</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Status</Label>
                        <Select value={settings.status} onValueChange={(v) => setSettings((s: any) => ({ ...s, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Access</Label>
                        <Select value={settings.accessType} onValueChange={(v) => setSettings((s: any) => ({ ...s, accessType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="enrolled">Enrolled</SelectItem>
                            <SelectItem value="members_only">Members Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Quiz Behavior</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Passing Score (%)</Label>
                      <Input
                        type="number" min={0} max={100}
                        value={settings.passingScore}
                        onChange={(e) => setSettings((s: any) => ({ ...s, passingScore: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Time Limit (minutes, blank = unlimited)</Label>
                      <Input
                        type="number" min={1}
                        value={settings.timeLimitMinutes ?? ""}
                        onChange={(e) => setSettings((s: any) => ({ ...s, timeLimitMinutes: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="No limit"
                      />
                    </div>
                    <div>
                      <Label>Max Attempts (blank = unlimited)</Label>
                      <Input
                        type="number" min={1}
                        value={settings.maxAttempts ?? ""}
                        onChange={(e) => setSettings((s: any) => ({ ...s, maxAttempts: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="Unlimited"
                      />
                    </div>
                    <div className="space-y-3 pt-2">
                      {[
                        { key: "shuffleQuestions", label: "Shuffle question order" },
                        { key: "shuffleAnswers", label: "Shuffle answer options" },
                        { key: "showResultsImmediately", label: "Show results immediately after submission" },
                        { key: "showExplanations", label: "Show explanations in results" },
                        { key: "allowRetakes", label: "Allow retakes" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="cursor-pointer">{label}</Label>
                          <Switch
                            checked={!!settings[key]}
                            onCheckedChange={(v) => setSettings((s: any) => ({ ...s, [key]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="md:col-span-2 flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate({ id: quiz.id, ...settings })}
                    disabled={updateMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Questions Tab ── */}
          <TabsContent value="questions">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{questions.length} question(s) in this quiz</p>
                <Button onClick={() => setShowAddQ(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Questions
                </Button>
              </div>

              {questions.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No questions yet</p>
                  <p className="text-sm mt-1">Add questions from the question bank</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Question</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Points</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions.map(({ sqq, qb }, idx) => (
                        <tr key={sqq.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-gray-900 line-clamp-2">{qb.question}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full capitalize">{qb.type}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{sqq.points}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm" variant="ghost"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => removeQMutation.mutate({ standaloneQuizQuestionId: sqq.id })}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add Questions Dialog */}
            <Dialog open={showAddQ} onOpenChange={(o) => { setShowAddQ(o); if (!o) { setSelectedBankIds(new Set()); setQSearch(""); setQPage(1); } }}>
              <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Add Questions from Bank</DialogTitle>
                  <DialogDescription>Search and select questions to add to this quiz.</DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Search questions..." value={qSearch} onChange={(e) => { setQSearch(e.target.value); setQPage(1); }} className="pl-9" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {bankData?.questions.map(({ question: q }) => {
                    const alreadyAdded = questions.some(({ qb }) => qb.id === q.id);
                    const selected = selectedBankIds.has(q.id);
                    return (
                      <div
                        key={q.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          alreadyAdded ? "opacity-40 cursor-not-allowed bg-gray-50" :
                          selected ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"
                        }`}
                        onClick={() => {
                          if (alreadyAdded) return;
                          setSelectedBankIds((s) => {
                            const n = new Set(s);
                            if (n.has(q.id)) n.delete(q.id); else n.add(q.id);
                            return n;
                          });
                        }}
                      >
                        <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? "bg-teal-600 border-teal-600" : "border-gray-300"}`}>
                          {selected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 line-clamp-2">{q.question}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded capitalize">{q.type}</span>
                            {alreadyAdded && <span className="text-xs text-gray-400">Already added</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {bankData && bankData.total > 20 && (
                    <div className="flex justify-center gap-2 pt-2">
                      <Button size="sm" variant="outline" disabled={qPage <= 1} onClick={() => setQPage(p => p - 1)}>Prev</Button>
                      <span className="text-sm text-gray-500 self-center">Page {qPage} of {Math.ceil(bankData.total / 20)}</span>
                      <Button size="sm" variant="outline" disabled={qPage >= Math.ceil(bankData.total / 20)} onClick={() => setQPage(p => p + 1)}>Next</Button>
                    </div>
                  )}
                </div>
                <DialogFooter className="pt-3 border-t">
                  <span className="text-sm text-gray-500 mr-auto">{selectedBankIds.size} selected</span>
                  <Button variant="outline" onClick={() => setShowAddQ(false)}>Cancel</Button>
                  <Button
                    disabled={selectedBankIds.size === 0 || addQMutation.isPending}
                    onClick={() => {
                      addQMutation.mutate(
                        { quizId: quiz.id, questionBankIds: [...selectedBankIds] },
                        { onSuccess: () => { setShowAddQ(false); setSelectedBankIds(new Set()); } }
                      );
                    }}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {addQMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add {selectedBankIds.size > 0 ? selectedBankIds.size : ""} Question(s)
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ── Analytics Tab ── */}
          <TabsContent value="analytics">
            {!analytics ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Attempts", value: analytics.overall.completedAttempts, icon: Users },
                    { label: "Pass Rate", value: `${analytics.overall.passRate}%`, icon: CheckCircle },
                    { label: "Avg Score", value: fmtScore(analytics.overall.avgScore), icon: BarChart2 },
                    { label: "Avg Time", value: fmtTime(analytics.overall.avgTimeSeconds), icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <Card key={label}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{value}</p>
                            <p className="text-xs text-gray-500">{label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Per-question stats */}
                {analytics.questionStats.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Question Performance</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.questionStats
                          .sort((a, b) => a.correctRate - b.correctRate)
                          .map((q) => (
                            <div key={q.questionId} className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 truncate">{q.questionText}</p>
                                <p className="text-xs text-gray-400">{q.totalAnswers} answers</p>
                              </div>
                              <div className="w-32 flex-shrink-0">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className={q.correctRate < 50 ? "text-red-600" : q.correctRate < 75 ? "text-yellow-600" : "text-green-600"}>
                                    {q.correctRate}%
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${q.correctRate < 50 ? "bg-red-400" : q.correctRate < 75 ? "bg-yellow-400" : "bg-green-400"}`}
                                    style={{ width: `${q.correctRate}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent attempts */}
                {analytics.recentAttempts.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Recent Attempts</CardTitle></CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">User</th>
                            <th className="pb-2 font-medium text-center">Score</th>
                            <th className="pb-2 font-medium text-center">Result</th>
                            <th className="pb-2 font-medium text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {analytics.recentAttempts.map(({ attempt, userName, userEmail }) => (
                            <tr key={attempt.id}>
                              <td className="py-2 text-gray-800">{userName || userEmail}</td>
                              <td className="py-2 text-center">{fmtScore(attempt.score)}</td>
                              <td className="py-2 text-center">
                                {attempt.passed
                                  ? <span className="text-green-600 text-xs font-medium">Pass</span>
                                  : <span className="text-red-500 text-xs font-medium">Fail</span>}
                              </td>
                              <td className="py-2 text-right text-gray-400 text-xs">
                                {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function QuizCreatorAdmin() {
  const params = useParams<{ quizId?: string }>();
  const quizId = params.quizId ? parseInt(params.quizId, 10) : null;

  if (quizId && !isNaN(quizId)) {
    return <QuizEditor quizId={quizId} />;
  }
  return <QuizList />;
}
