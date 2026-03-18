/**
 * AdminCaseManagement.tsx — Admin panel for reviewing and approving/rejecting user-submitted cases.
 *
 * Shows pending submissions by default, with a tab to browse all cases.
 * Admins can preview case details (including media carousel and MCQ questions),
 * approve, or reject with a reason — all from within the preview modal.
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  PlayCircle,
  Shield,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  Tag,
  BookOpen,
  Stethoscope,
  Sparkles,
  Loader2,
  Pencil,
  UserCheck,
  Link2,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import CaseEditorDialog from "@/components/CaseEditorDialog";
import { formatViewCount } from "@/lib/caseViewCount";

type TabType = "pending" | "all" | "analytics";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-50 text-emerald-600",
  intermediate: "bg-blue-50 text-blue-600",
  advanced: "bg-purple-50 text-purple-600",
};

const MODALITY_COLORS: Record<string, string> = {
  TTE: "bg-blue-100 text-blue-700",
  TEE: "bg-purple-100 text-purple-700",
  Stress: "bg-orange-100 text-orange-700",
  Pediatric: "bg-pink-100 text-pink-700",
  Fetal: "bg-rose-100 text-rose-700",
  POCUS: "bg-teal-100 text-teal-700",
  Other: "bg-gray-100 text-gray-600",
};

/** Fetch full case detail (with media + questions) for the preview modal */
function CasePreviewModal({
  caseId,
  open,
  onClose,
  onApprove,
  onReject,
  isApproving,
}: {
  caseId: number | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number, title: string) => void;
  isApproving: boolean;
}) {
  const [mediaIdx, setMediaIdx] = useState(0);

  const { data: caseData, isLoading } = trpc.caseLibrary.getCase.useQuery(
    { id: caseId! },
    { enabled: open && caseId !== null }
  );

  // Reset media index when case changes
  const handleClose = () => {
    setMediaIdx(0);
    onClose();
  };

  const media = caseData?.media ?? [];
  const questions = caseData?.questions ?? [];
  const teachingPoints: string[] = caseData?.teachingPoints ?? [];
  const tags: string[] = caseData?.tags ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading || !caseData ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-[#189aa1] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-snug pr-6" style={{ fontFamily: "Merriweather, serif" }}>
                {caseData.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 text-sm">
              {/* Status + meta badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[caseData.status] ?? ""}`}>
                  {caseData.status.charAt(0).toUpperCase() + caseData.status.slice(1)}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODALITY_COLORS[caseData.modality] ?? "bg-gray-100 text-gray-600"}`}>
                  {caseData.modality}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[caseData.difficulty] ?? ""}`}>
                  {caseData.difficulty}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Stethoscope className="w-3 h-3" /> by {(caseData as any).submitterName ?? "Unknown"}
                </span>
                <span className="text-xs text-gray-400">
                  · {formatDistanceToNow(new Date(caseData.submittedAt), { addSuffix: true })}
                </span>
                {/* Credit attribution in preview modal */}
                {((caseData as any).submitterCreditName || (caseData as any).submitterLinkedIn) && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <UserCheck className="w-3.5 h-3.5" style={{ color: "#189aa1" }} />
                    {(caseData as any).submitterCreditName && (
                      <span className="text-gray-700 font-medium">{(caseData as any).submitterCreditName}</span>
                    )}
                    {(caseData as any).submitterLinkedIn && (
                      <a
                        href={(caseData as any).submitterLinkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 hover:underline"
                        style={{ color: "#189aa1" }}
                      >
                        <Link2 className="w-3 h-3" /> LinkedIn
                      </a>
                    )}
                  </span>
                )}
              </div>

              {/* -- Media Carousel ------------------------------------------- */}
              {media.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Media ({media.length} file{media.length !== 1 ? "s" : ""})
                  </p>
                  <div className="relative bg-black rounded-xl overflow-hidden" style={{ minHeight: 220 }}>
                    {media[mediaIdx]?.type === "video" ? (
                      <video
                        src={media[mediaIdx].url}
                        controls
                        className="w-full max-h-72 object-contain"
                      />
                    ) : (
                      <img
                        src={media[mediaIdx]?.url}
                        alt={media[mediaIdx]?.caption || `Media ${mediaIdx + 1}`}
                        className="w-full max-h-72 object-contain"
                      />
                    )}
                    {/* Nav arrows */}
                    {media.length > 1 && (
                      <>
                        <button
                          onClick={() => setMediaIdx((i) => Math.max(0, i - 1))}
                          disabled={mediaIdx === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 disabled:opacity-30 transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setMediaIdx((i) => Math.min(media.length - 1, i + 1))}
                          disabled={mediaIdx === media.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 disabled:opacity-30 transition-all"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {/* Dot indicators */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {media.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setMediaIdx(i)}
                              className={`w-2 h-2 rounded-full transition-all ${i === mediaIdx ? "bg-white" : "bg-white/40"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Thumbnail strip */}
                  {media.length > 1 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                      {media.map((m, i) => (
                        <button
                          key={i}
                          onClick={() => setMediaIdx(i)}
                          className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                            i === mediaIdx ? "border-[#189aa1]" : "border-transparent"
                          }`}
                        >
                          {m.type === "video" ? (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <PlayCircle className="w-5 h-5 text-white" />
                            </div>
                          ) : (
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {media[mediaIdx]?.caption && (
                    <p className="text-xs text-gray-500 mt-1 italic">{media[mediaIdx].caption}</p>
                  )}
                </div>
              )}

              {/* -- Case Text ------------------------------------------------ */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Summary</p>
                <RichTextDisplay html={caseData.summary} />
              </div>

              {caseData.clinicalHistory && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Clinical History</p>
                  <p className="text-gray-700 leading-relaxed">{caseData.clinicalHistory}</p>
                </div>
              )}

              {caseData.diagnosis && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Diagnosis</p>
                  <p className="text-gray-700 font-medium">{caseData.diagnosis}</p>
                </div>
              )}

              {teachingPoints.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Teaching Points
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {teachingPoints.map((pt: string, i: number) => (
                      <li key={i} className="text-gray-700 text-xs">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <Tag className="w-3.5 h-3.5 text-gray-400 self-center" />
                  {tags.map((t: string) => (
                    <span key={t} className="text-xs bg-[#189aa1]/10 text-[#189aa1] px-2 py-0.5 rounded-full">#{t}</span>
                  ))}
                </div>
              )}

              {/* -- MCQ Questions -------------------------------------------- */}
              {questions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> Self-Assessment Questions ({questions.length})
                  </p>
                  <div className="space-y-3">
                    {questions.map((q: any, qi: number) => (
                      <div key={q.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Q{qi + 1}. {q.question}</p>
                        <div className="space-y-1">
                          {(q.options as string[]).map((opt: string, oi: number) => (
                            <div
                              key={oi}
                              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                                oi === q.correctAnswer
                                  ? "bg-green-100 text-green-700 font-semibold"
                                  : "text-gray-600"
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                oi === q.correctAnswer ? "border-green-500 bg-green-500 text-white" : "border-gray-300"
                              }`}>
                                {oi === q.correctAnswer ? "✓" : String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <p className="text-xs text-gray-500 mt-2 italic border-t border-gray-200 pt-2">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* -- Rejection reason (if rejected) --------------------------- */}
              {caseData.status === "rejected" && caseData.rejectionReason && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Rejection Reason</p>
                    <p>{caseData.rejectionReason}</p>
                  </div>
                </div>
              )}

              {/* -- Inline approve/reject (pending only) --------------------- */}
              {caseData.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white gap-2"
                    onClick={() => {
                      onApprove(caseData.id);
                      handleClose();
                    }}
                    disabled={isApproving}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Publish
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 gap-2"
                    onClick={() => {
                      handleClose();
                      onReject(caseData.id, caseData.title);
                    }}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Analytics Component ─────────────────────────────────────────────────────
function CaseViewAnalytics() {
  const [weeks, setWeeks] = useState<12 | 26 | 52>(12);
  const { data, isLoading } = trpc.caseLibrary.getViewTrends.useQuery({ weeks });

  // Build chart data: one row per week
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.weekLabels.map((label, i) => ({
      week: label,
      total: data.totalByWeek[i],
    }));
  }, [data]);

  // Per-case line chart data
  const lineData = useMemo(() => {
    if (!data) return [];
    return data.weekLabels.map((label, i) => {
      const row: Record<string, string | number> = { week: label };
      for (const c of data.cases) {
        row[c.title.length > 28 ? c.title.slice(0, 28) + "…" : c.title] = c.viewsByWeek[i];
      }
      return row;
    });
  }, [data]);

  const COLORS = [
    "#189aa1", "#4ad9e0", "#f59e0b", "#6366f1", "#ec4899",
    "#10b981", "#f97316", "#8b5cf6", "#14b8a6", "#ef4444",
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" style={{ color: "#189aa1" }} />
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            Case View Analytics
          </h2>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([12, 26, 52] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                weeks === w ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {w === 12 ? "12 wks" : w === 26 ? "6 mo" : "1 yr"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#189aa1" }} />
        </div>
      ) : !data || data.cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No view data yet</p>
          <p className="text-gray-400 text-sm mt-1">
            View events are recorded when members open a case. Data will appear here as cases are viewed.
          </p>
        </div>
      ) : (
        <>
          {/* Total views bar chart */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">Total Case Views per Week</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="total" fill="#189aa1" radius={[4, 4, 0, 0]} name="Views" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-case line chart */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Views by Case — Top {data.cases.length} (last {weeks} weeks)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {data.cases.map((c, i) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.title.length > 28 ? c.title.slice(0, 28) + "…" : c.title}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per-case summary table */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Case View Summary</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500">Case</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">Views (period)</th>
                    <th className="text-right py-2 pl-2 text-xs font-semibold text-gray-500">Avg / week</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cases.map((c, i) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-700 font-medium line-clamp-1">{c.title}</span>
                        </div>
                      </td>
                      <td className="text-right py-2 px-2 text-gray-600 font-mono">{c.totalViews.toLocaleString()}</td>
                      <td className="text-right py-2 pl-2 text-gray-500 font-mono">
                        {(c.totalViews / weeks).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminCaseManagement() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<TabType>("pending");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [modalityFilter, setModalityFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [mediaFilter, setMediaFilter] = useState<"all" | "has_media" | "no_media">("all");

  // Preview dialog
  const [previewCaseId, setPreviewCaseId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Editor dialog
  const [editorCaseId, setEditorCaseId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<{ id: number; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // AI case generator
  const [aiCaseOpen, setAiCaseOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModality, setAiModality] = useState<string>("TTE");
  const [aiDifficulty, setAiDifficulty] = useState<string>("intermediate");
  const [aiQCount, setAiQCount] = useState(3);
  const [aiCasePreview, setAiCasePreview] = useState<any | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  // Pending cases
  const pendingQuery = trpc.caseLibrary.listPendingCases.useQuery(undefined, {
    enabled: tab === "pending",
  });

  // All cases
  const allQuery = trpc.caseLibrary.listAllCases.useQuery(
    {
      page,
      limit: 20,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
      tag: tagFilter || undefined,
      modality: (modalityFilter === "all" ? undefined : modalityFilter) as any,
      difficulty: (difficultyFilter === "all" ? undefined : difficultyFilter) as any,
      mediaFilter: mediaFilter === "all" ? undefined : mediaFilter,
    },
    { enabled: tab === "all" }
  );

  const approveMutation = trpc.caseLibrary.approveCase.useMutation({
    onSuccess: () => {
      toast.success("Case approved and published.");
      utils.caseLibrary.listPendingCases.invalidate();
      utils.caseLibrary.listAllCases.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to approve case."),
  });

  const rejectMutation = trpc.caseLibrary.rejectCase.useMutation({
    onSuccess: () => {
      toast.success("Case rejected.");
      setRejectTarget(null);
      setRejectReason("");
      utils.caseLibrary.listPendingCases.invalidate();
      utils.caseLibrary.listAllCases.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to reject case."),
  });

  const aiGenerateCaseMutation = trpc.caseLibrary.aiGenerateCase.useMutation({
    onSuccess: (data: any) => {
      setAiCasePreview(data);
      toast.success("Case generated — review below and save to library.");
    },
    onError: (err: any) => toast.error(err.message || "AI generation failed."),
  });
  const adminCreateCaseMutation = trpc.caseLibrary.adminCreateCase.useMutation({
    onSuccess: () => {
      toast.success("Case saved to library.");
      utils.caseLibrary.listAllCases.invalidate();
      setAiCaseOpen(false);
      setAiCasePreview(null);
      setAiPrompt("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save case."),
  });
  const deleteMutation = trpc.caseLibrary.adminDeleteCase.useMutation({
    onSuccess: () => {
      toast.success("Case deleted.");
      utils.caseLibrary.listAllCases.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete case."),
  });

  // Guard: admin only
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-2 font-semibold">Admin Access Required</p>
          <p className="text-sm text-gray-400">You must be an admin to view this page.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/case-library")}>
            Back to Case Library
          </Button>
        </div>
      </Layout>
    );
  }

  const pendingCases = pendingQuery.data ?? [];
  const allCases = allQuery.data?.cases ?? [];
  const totalPages = Math.ceil((allQuery.data?.total ?? 0) / 20);

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id });
  };

  const handleRejectSubmit = () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 5) {
      toast.error("Please provide a rejection reason (at least 5 characters).");
      return;
    }
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setTagFilter(tagInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setTagFilter("");
    setTagInput("");
    setModalityFilter("all");
    setDifficultyFilter("all");
    setStatusFilter("all");
    setMediaFilter("all");
    setPage(1);
  };

  const hasActiveFilters = search || tagFilter || modalityFilter !== "all" || difficultyFilter !== "all" || statusFilter !== "all" || mediaFilter !== "all";

  const CaseRow = ({ c, showActions = true }: { c: any; showActions?: boolean }) => (
    <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#189aa1]/30 transition-all">
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
        {c.mediaCount > 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-[#189aa1]/10">
            <ImageIcon className="w-6 h-6 text-[#189aa1]/60" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-300" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm leading-snug truncate">{c.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? ""}`}>
                {c.status}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODALITY_COLORS[c.modality] ?? "bg-gray-100 text-gray-600"}`}>
                {c.modality}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[c.difficulty] ?? ""}`}>
                {c.difficulty}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.summary}</p>
        {/* Clickable tag chips */}
        {Array.isArray(c.tags) && c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {c.tags.slice(0, 6).map((tag: string) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  setTagInput(tag);
                  setTagFilter(tag);
                  setPage(1);
                }}
                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                  tagFilter === tag
                    ? "bg-[#189aa1] text-white border-[#189aa1]"
                    : "bg-[#189aa1]/5 text-[#189aa1]/80 border-[#189aa1]/20 hover:bg-[#189aa1]/15 hover:border-[#189aa1]/40"
                }`}
              >
                {tag}
              </button>
            ))}
            {c.tags.length > 6 && (
              <span className="text-xs text-gray-400 self-center">+{c.tags.length - 6} more</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
          <span>By {c.submitterName}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(c.submittedAt), { addSuffix: true })}</span>
          {c.mediaCount > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <ImageIcon className="w-3 h-3" /> {c.mediaCount}
              </span>
            </>
          )}
          {c.status === "approved" && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-[#189aa1]/80" title="Actual views (true count)">
                <Eye className="w-3 h-3" /> {formatViewCount(c.viewCount ?? 0)} actual views
              </span>
            </>
          )}
        </div>
        {/* Credit attribution */}
        {(c.submitterCreditName || c.submitterLinkedIn) && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <UserCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#189aa1" }} />
            {c.submitterCreditName && (
              <span className="text-xs text-gray-600 font-medium">{c.submitterCreditName}</span>
            )}
            {c.submitterLinkedIn && (
              <a
                href={c.submitterLinkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline flex items-center gap-0.5"
                style={{ color: "#189aa1" }}
                onClick={(e) => e.stopPropagation()}
              >
                <Link2 className="w-3 h-3" /> LinkedIn
              </a>
            )}
          </div>
        )}
        {c.rejectionReason && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
            Rejection reason: {c.rejectionReason}
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-gray-400 hover:text-[#189aa1]"
            onClick={() => { setPreviewCaseId(c.id); setPreviewOpen(true); }}
            title="Preview full case"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-gray-400 hover:text-purple-600"
            onClick={() => { setEditorCaseId(c.id); setEditorOpen(true); }}
            title="Edit case"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {c.status === "pending" && (
            <>
              <Button
                size="sm"
                className="h-8 px-3 text-xs bg-green-500 hover:bg-green-600 text-white gap-1"
                onClick={() => handleApprove(c.id)}
                disabled={approveMutation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1"
                onClick={() => { setRejectTarget({ id: c.id, title: c.title }); setRejectReason(""); }}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          {c.status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1"
              onClick={() => {
                if (confirm(`Delete "${c.title}"? This cannot be undone.`)) {
                  deleteMutation.mutate({ id: c.id });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <XCircle className="w-3.5 h-3.5" /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/case-library")} className="text-gray-400 hover:text-[#189aa1] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                Case Management
              </h1>
              <p className="text-xs text-gray-400">Review and approve member-submitted echo cases</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-purple-400 text-purple-600"
              onClick={() => { setAiCasePreview(null); setAiCaseOpen(true); }}
            >
              <Sparkles className="w-4 h-4" /> AI Generate Case
            </Button>
            {pendingCases.length > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                {pendingCases.length} pending
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {(["pending", "all", "analytics"] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "pending" && "Pending Review"}
              {t === "all" && "All Cases"}
              {t === "analytics" && <><BarChart3 className="w-3.5 h-3.5" /> Analytics</>}
              {t === "pending" && pendingCases.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pendingCases.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* -- Pending Tab ---------------------------------------------------- */}
        {tab === "pending" && (
          <div>
            {pendingQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : pendingCases.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="text-gray-500 font-medium">No pending submissions</p>
                <p className="text-sm text-gray-400 mt-1">All cases have been reviewed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCases.map((c: any) => (
                  <CaseRow key={c.id} c={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* -- All Cases Tab --------------------------------------------------- */}
        {tab === "all" && (
          <div>
            {/* Filters */}
            <div className="space-y-2 mb-4">
              {/* Row 1: Search + Tag + Search button */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by title, diagnosis, or tag…"
                    className="pl-9"
                  />
                </div>
                <div className="relative w-48">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Filter by tag…"
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={handleSearch} className="gap-1.5">
                  <Search className="w-4 h-4" /> Search
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => utils.caseLibrary.listAllCases.invalidate()}
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                </Button>
              </div>
              {/* Row 2: Status + Modality + Difficulty + Clear */}
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={modalityFilter} onValueChange={(v) => { setModalityFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Modalities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modalities</SelectItem>
                    <SelectItem value="TTE">TTE</SelectItem>
                    <SelectItem value="TEE">TEE</SelectItem>
                    <SelectItem value="Stress">Stress</SelectItem>
                    <SelectItem value="Pediatric">Pediatric</SelectItem>
                    <SelectItem value="Fetal">Fetal</SelectItem>
                    <SelectItem value="HOCM">HOCM</SelectItem>
                    <SelectItem value="POCUS">POCUS</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={difficultyFilter} onValueChange={(v) => { setDifficultyFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mediaFilter} onValueChange={(v) => { setMediaFilter(v as any); setPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Media" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Media</SelectItem>
                    <SelectItem value="has_media">Has Media</SelectItem>
                    <SelectItem value="no_media">No Media</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-gray-400 hover:text-gray-600 gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Clear filters
                  </Button>
                )}
                {(tagFilter) && (
                  <div className="flex items-center gap-1 text-xs bg-[#189aa1]/10 text-[#189aa1] px-2 py-1 rounded-full">
                    <Tag className="w-3 h-3" />
                    Tag: <span className="font-semibold">{tagFilter}</span>
                  </div>
                )}
              </div>
            </div>

            {allQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : allCases.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No cases found</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {allCases.map((c: any) => (
                    <CaseRow key={c.id} c={c} />
                  ))}
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
         {/* -- Analytics Tab --------------------------------------------------- */}
        {tab === "analytics" && <CaseViewAnalytics />}
      </div>
      {/* -- Full Case Preview Modal -------------------------------------------- */}
      <CasePreviewModal
        caseId={previewCaseId}
        open={previewOpen}
        onClose={() => { setPreviewOpen(false); setPreviewCaseId(null); }}
        onApprove={handleApprove}
        onReject={(id, title) => { setRejectTarget({ id, title }); setRejectReason(""); }}
        isApproving={approveMutation.isPending}
      />

      {/* -- AI Case Generator Dialog ----------------------------------------- */}
      <Dialog open={aiCaseOpen} onOpenChange={(o) => { setAiCaseOpen(o); if (!o) { setAiCasePreview(null); setAiPrompt(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" /> AI Echo Case Generator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Describe a clinical scenario and the AI will generate a complete echo case with clinical history, diagnosis, teaching points, and MCQs. Review the output before saving to the library.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Clinical Scenario <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-400 mb-2">Quick topic starters — click to pre-fill, then customise:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: "HOCM", prompt: "Patient with hypertrophic obstructive cardiomyopathy — LVOT obstruction, SAM of the mitral valve, provocable gradient, management options" },
                    { label: "Strain / GLS", prompt: "Patient referred for LV global longitudinal strain assessment — reduced GLS in the context of preserved EF, subclinical dysfunction" },
                    { label: "Diastolic Dysfunction", prompt: "Patient with exertional dyspnoea and preserved LVEF — grading diastolic dysfunction using ASE 2025 criteria, E/A, E/e\u2019, LAVI, TR velocity" },
                    { label: "Dilated CM", prompt: "Patient with dilated cardiomyopathy — severely reduced EF, functional MR, LV dyssynchrony, CRT candidacy assessment" },
                    { label: "Restrictive CM", prompt: "Patient with suspected cardiac amyloidosis — restrictive filling pattern, speckled myocardium, biatrial enlargement, low-voltage ECG" },
                    { label: "Constrictive Pericarditis", prompt: "Patient with constrictive pericarditis — septal bounce, respiratory variation in mitral/tricuspid inflow, annulus reversus, hepatic vein expiratory diastolic reversal" },
                    { label: "Tamponade", prompt: "Patient with large pericardial effusion and haemodynamic compromise — cardiac tamponade, chamber collapse, IVC plethora, respiratory variation" },
                    { label: "Pulmonary HTN", prompt: "Patient with pulmonary arterial hypertension — elevated RVSP, RV remodeling, TR velocity, PA acceleration time, ASE 2025 PH guidelines" },
                    { label: "Pulmonary Embolism", prompt: "Patient with acute massive pulmonary embolism — RV strain, McConnell sign, D-sign, IVC dilation, risk stratification by echo" },
                    { label: "Aortic Stenosis", prompt: "Patient with severe aortic stenosis — AVA calculation, mean gradient, low-flow low-gradient AS, dobutamine stress echo, TAVR planning" },
                    { label: "Mitral Regurgitation", prompt: "Patient with severe primary mitral regurgitation — vena contracta, EROA, regurgitant volume, LV remodeling, surgical timing" },
                  ].map(({ label, prompt }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAiPrompt(prompt)}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                        aiPrompt === prompt
                          ? "border-purple-500 bg-purple-500 text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-purple-400 hover:text-purple-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <RichTextEditor
                  value={aiPrompt}
                  onChange={setAiPrompt}
                  placeholder="e.g. 72-year-old male with exertional dyspnea, systolic murmur, and syncope. Describe the echo findings and management..."
                  minHeight={80}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Modality</label>
                  <Select value={aiModality} onValueChange={setAiModality}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["TTE","TEE","Stress","Pediatric","Fetal","POCUS","Other"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Difficulty</label>
                  <Select value={aiDifficulty} onValueChange={setAiDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">MCQ Count (1–5)</label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={aiQCount}
                    onChange={(e) => setAiQCount(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
              </div>
            </div>
            <Button
              className="w-full gap-2 text-white"
              style={{ background: "#7c3aed" }}
              onClick={() => aiGenerateCaseMutation.mutate({ prompt: aiPrompt, modality: aiModality as any, difficulty: aiDifficulty as any, questionCount: aiQCount })}
              disabled={!aiPrompt.trim() || aiGenerateCaseMutation.isPending}
            >
              {aiGenerateCaseMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> Generate Case</>}
            </Button>
            {aiCasePreview && (
              <div className="space-y-3 border border-purple-200 rounded-xl p-4 bg-purple-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-purple-800">Preview — review before saving</p>
                  <Button
                    size="sm"
                    className="gap-1.5 text-white"
                    style={{ background: "#189aa1" }}
                    disabled={aiSaving || adminCreateCaseMutation.isPending}
                    onClick={async () => {
                      setAiSaving(true);
                      try {
                        await adminCreateCaseMutation.mutateAsync({
                          title: aiCasePreview.title,
                          summary: aiCasePreview.summary,
                          clinicalHistory: aiCasePreview.clinicalHistory,
                          diagnosis: aiCasePreview.diagnosis,
                          teachingPoints: aiCasePreview.teachingPoints,
                          modality: aiCasePreview.modality,
                          difficulty: aiCasePreview.difficulty,
                          tags: aiCasePreview.tags ?? [],
                          hipaaAcknowledged: true,
                          media: [],
                          questions: aiCasePreview.questions.map((q: any, i: number) => ({
                            question: q.question,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            explanation: q.explanation,
                            sortOrder: i,
                          })),
                        });
                      } finally {
                        setAiSaving(false);
                      }
                    }}
                  >
                    {aiSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Save to Library</>}
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Title</p>
                    <p className="text-sm font-bold text-gray-800">{aiCasePreview.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Summary</p>
                    <p className="text-sm text-gray-700">{aiCasePreview.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Clinical History</p>
                    <p className="text-sm text-gray-700">{aiCasePreview.clinicalHistory}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Diagnosis</p>
                    <p className="text-sm font-semibold text-[#189aa1]">{aiCasePreview.diagnosis}</p>
                  </div>
                  {aiCasePreview.teachingPoints?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Teaching Points</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {aiCasePreview.teachingPoints.map((tp: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700">{tp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiCasePreview.questions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">MCQ Questions ({aiCasePreview.questions.length})</p>
                      <div className="space-y-2">
                        {aiCasePreview.questions.map((q: any, qi: number) => (
                          <div key={qi} className="bg-white rounded-lg p-2.5 border border-gray-100">
                            <p className="text-xs font-medium text-gray-800 mb-1.5">Q{qi + 1}. {q.question}</p>
                            {q.options?.map((opt: string, oi: number) => (
                              <p key={oi} className={`text-xs ${oi === q.correctAnswer ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                                {oi === q.correctAnswer ? "✓" : "○"} {opt}
                              </p>
                            ))}
                            {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiCasePreview.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiCasePreview.tags.map((tag: string) => (
                        <span key={tag} className="text-xs bg-white border border-purple-200 text-purple-600 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAiCaseOpen(false); setAiCasePreview(null); setAiPrompt(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- Case Editor Dialog ------------------------------------------- */}
      <CaseEditorDialog
        caseId={editorCaseId}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditorCaseId(null); }}
        onSaved={() => {
          utils.caseLibrary.listAllCases.invalidate();
          utils.caseLibrary.listPendingCases.invalidate();
        }}
      />

      {/* -- Reject Dialog ------------------------------------------------ */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Reject Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              You are rejecting: <strong className="text-gray-800">{rejectTarget?.title}</strong>
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={rejectReason}
                onChange={setRejectReason}
                placeholder="Explain why this case is being rejected (e.g. contains PHI, insufficient de-identification, incomplete information)…"
                minHeight={80}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white gap-2"
              onClick={handleRejectSubmit}
              disabled={rejectMutation.isPending || rejectReason.trim().length < 5}
            >
              <XCircle className="w-4 h-4" />
              {rejectMutation.isPending ? "Rejecting…" : "Reject Case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
