/**
 * QuizResultsAdmin.tsx
 * Admin panel for viewing and exporting quiz/survey results.
 * Accessible from the LMS Admin → Quiz Results tab.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart2, Download, FileText, ChevronRight, ChevronLeft,
  CheckCircle, XCircle, Search, RefreshCw, Eye, Users,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const SURVEY_TYPES = ["likert", "star_rating", "open_text"];

// ─── Attempt Detail Dialog ─────────────────────────────────────────────────────

function AttemptDetailDialog({
  attemptId,
  userName,
  onClose,
}: { attemptId: number; userName: string; onClose: () => void }) {
  const { data: answers, isLoading } = trpc.quizResults.getAttemptAnswers.useQuery({ attemptId });
  const generatePdf = trpc.quizResults.generateUserPdf.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(`PDF error: ${e.message}`),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Attempt Detail — {userName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-end mb-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={() => generatePdf.mutate({ attemptId })}
            disabled={generatePdf.isPending}
          >
            {generatePdf.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Download PDF Report
          </Button>
        </div>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading answers…</div>
        ) : !answers?.length ? (
          <div className="py-8 text-center text-sm text-gray-400">No per-question detail available for this attempt.</div>
        ) : (
          <div className="space-y-3">
            {answers.map((a, i) => {
              const isSurvey = SURVEY_TYPES.includes(a.questionType);
              return (
                <div key={a.id} className={`border rounded-lg p-3 text-sm ${isSurvey ? "bg-gray-50" : a.isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="font-semibold text-gray-800 mb-1">{i + 1}. {a.questionText}</div>
                  <div className="text-gray-600 mb-1">
                    <span className="font-medium">Answer:</span> {a.answerValue || <span className="italic text-gray-400">(no answer)</span>}
                  </div>
                  {isSurvey ? (
                    <Badge variant="outline" className="text-[10px] text-gray-500">Survey response</Badge>
                  ) : a.isCorrect ? (
                    <span className="flex items-center gap-1 text-green-700 text-xs font-semibold"><CheckCircle className="w-3 h-3" /> Correct</span>
                  ) : (
                    <div>
                      <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><XCircle className="w-3 h-3" /> Incorrect</span>
                      {a.correctAnswer && <div className="text-xs text-gray-500 mt-0.5">Correct: <strong>{a.correctAnswer}</strong></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Quiz Attempts Table ───────────────────────────────────────────────────────

function QuizAttemptsTable({ lessonId, lessonTitle }: { lessonId: number; lessonTitle: string }) {
  const [page, setPage] = useState(1);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");

  const { data, isLoading } = trpc.quizResults.getQuizAttempts.useQuery({ lessonId, page, pageSize: 50 });
  const exportCsv = trpc.quizResults.exportQuizCsv.useMutation({
    onSuccess: (d) => { window.open(d.url, "_blank"); toast.success("CSV ready — opening in new tab"); },
    onError: (e) => toast.error(`Export error: ${e.message}`),
  });

  const attempts = data?.attempts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{total} attempt{total !== 1 ? "s" : ""}</div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => exportCsv.mutate({ lessonId })}
          disabled={exportCsv.isPending}
        >
          {exportCsv.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-gray-400">Loading…</div>
      ) : attempts.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">No attempts yet.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Correct</TableHead>
                <TableHead>Time</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map(a => {
                const _raw = a.userName ?? `${a.userFirstName ?? ""} ${a.userLastName ?? ""}`.trim();
                const name = _raw || a.userEmail || `User #${a.userId}`;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-gray-400">{a.userEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtDate(a.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`font-bold text-sm ${a.score >= 70 ? "text-green-600" : "text-red-500"}`}>{a.score}%</span>
                    </TableCell>
                    <TableCell>
                      {a.passed
                        ? <Badge className="bg-green-100 text-green-700 text-[10px]">Passed</Badge>
                        : <Badge className="bg-red-100 text-red-600 text-[10px]">Not Passed</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{a.correctAnswers}/{a.totalQuestions}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtTime(a.timeTakenSec)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-teal-600 hover:bg-teal-50"
                        onClick={() => { setSelectedAttemptId(a.id); setSelectedUserName(name); }}
                      >
                        <Eye className="w-3 h-3 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-3 h-3" /> Prev
          </Button>
          <span>Page {page} of {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}

      {selectedAttemptId && (
        <AttemptDetailDialog
          attemptId={selectedAttemptId}
          userName={selectedUserName}
          onClose={() => setSelectedAttemptId(null)}
        />
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function QuizResultsAdmin() {
  const [search, setSearch] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedLessonTitle, setSelectedLessonTitle] = useState("");
  const [bulkFromDate, setBulkFromDate] = useState("");
  const [bulkToDate, setBulkToDate] = useState("");

  const { data: quizzes, isLoading } = trpc.quizResults.listQuizzesWithResults.useQuery();
  const exportAll = trpc.quizResults.exportAllCsv.useMutation({
    onSuccess: (d) => { window.open(d.url, "_blank"); toast.success(`Bulk export ready — ${d.count} attempts`); },
    onError: (e) => toast.error(`Export error: ${e.message}`),
  });

  const filtered = (quizzes ?? []).filter(q =>
    !search || q.lessonTitle.toLowerCase().includes(search.toLowerCase()) || q.courseTitle.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedLessonId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSelectedLessonId(null)} className="gap-1 text-xs">
            <ChevronLeft className="w-3 h-3" /> Back to all quizzes
          </Button>
          <span className="text-sm font-semibold text-gray-700">{selectedLessonTitle}</span>
        </div>
        <QuizAttemptsTable lessonId={selectedLessonId} lessonTitle={selectedLessonTitle} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-semibold text-gray-800">Quiz & Survey Results</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={bulkFromDate}
            onChange={e => setBulkFromDate(e.target.value)}
            className="h-8 text-xs w-36"
            placeholder="From"
          />
          <Input
            type="date"
            value={bulkToDate}
            onChange={e => setBulkToDate(e.target.value)}
            className="h-8 text-xs w-36"
            placeholder="To"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8"
            onClick={() => exportAll.mutate({ fromDate: bulkFromDate || undefined, toDate: bulkToDate || undefined })}
            disabled={exportAll.isPending}
          >
            {exportAll.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Bulk Export CSV
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by quiz or course name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Quiz list */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading results…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          {quizzes?.length === 0 ? "No quiz attempts recorded yet." : "No quizzes match your search."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz / Lesson</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead className="text-center">Avg Score</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(q => (
                <TableRow key={q.lessonId} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedLessonId(q.lessonId); setSelectedLessonTitle(q.quizTitle || q.lessonTitle); }}>
                  <TableCell>
                    <div className="font-medium text-sm text-gray-900">{q.quizTitle || q.lessonTitle}</div>
                    <div className="text-xs text-gray-400">Lesson #{q.lessonId}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{q.courseTitle}</TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-sm text-gray-700">
                      <Users className="w-3 h-3 text-gray-400" />{q.attemptCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {q.avgScore != null ? (
                      <span className={`font-semibold text-sm ${q.avgScore >= (q.passingScore ?? 70) ? "text-green-600" : "text-amber-600"}`}>
                        {q.avgScore}%
                      </span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-teal-600 hover:bg-teal-50">
                      View <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
