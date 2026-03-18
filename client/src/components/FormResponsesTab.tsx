/**
 * FormResponsesTab — Form Responses viewer for Reports & Analytics in Lab Admin.
 *
 * Features:
 * - Submission list with filters (form type, date range, staff, status)
 * - Quality score display with color-coded tiers
 * - Individual response detail modal
 * - Export to CSV
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  FileText,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  TrendingUp,
  Users,
  ClipboardList,
  Star,
  Calendar,
  X,
} from "lucide-react";
import { toast } from "sonner";

const BRAND = "#189aa1";
const BRAND_DARK = "#0e4a50";

// ─── Quality Score Tier Helper ─────────────────────────────────────────────────
function qsTier(score: number): { tier: string; color: string; bg: string } {
  if (score >= 90) return { tier: "Excellent", color: "#16a34a", bg: "#f0fdf4" };
  if (score >= 75) return { tier: "Good", color: "#2563eb", bg: "#eff6ff" };
  if (score >= 60) return { tier: "Acceptable", color: "#d97706", bg: "#fffbeb" };
  if (score >= 40) return { tier: "Needs Improvement", color: "#dc2626", bg: "#fef2f2" };
  return { tier: "Unacceptable", color: "#7c3aed", bg: "#faf5ff" };
}

function QualityBadge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const { tier, color, bg } = qsTier(pct);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color, background: bg }}
    >
      <Star className="w-3 h-3" />
      {pct}/100 — {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "Draft", color: "#6b7280", bg: "#f3f4f6" },
    submitted: { label: "Submitted", color: "#2563eb", bg: "#eff6ff" },
    reviewed: { label: "Reviewed", color: "#16a34a", bg: "#f0fdf4" },
  };
  const s = map[status] ?? map.submitted;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ─── FORM TYPE LABELS ─────────────────────────────────────────────────────────
const FORM_TYPE_LABELS: Record<string, string> = {
  image_quality_review: "Image Quality Review (IQR)",
  peer_review: "Sonographer Peer Review",
  physician_peer_review: "Physician / Over-Read Peer Review",
  case_mix: "Case Mix Submission",
};

// ─── RESPONSE DETAIL MODAL ────────────────────────────────────────────────────
function ResponseDetailModal({
  submissionId,
  open,
  onClose,
  onStatusChange,
}: {
  submissionId: number;
  open: boolean;
  onClose: () => void;
  onStatusChange: () => void;
}) {
  const { data: sub, isLoading } = trpc.formBuilder.getSubmissionDetails.useQuery(
    { id: submissionId },
    { enabled: open && submissionId > 0 }
  );
  const updateStatus = trpc.formBuilder.updateSubmissionStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated.");
      onStatusChange();
    },
  });

  if (!open) return null;

  const responses = sub?.responses as Record<string, string | string[]> | undefined;
  const pct = sub && sub.maxPossibleScore > 0
    ? Math.round((sub.qualityScore / sub.maxPossibleScore) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold" style={{ color: BRAND_DARK }}>
            Form Response Detail
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} />
          </div>
        ) : !sub ? (
          <p className="text-sm text-gray-500 py-6 text-center">Response not found.</p>
        ) : (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 text-xs">
              <div>
                <p className="text-gray-500 font-medium">Form Type</p>
                <p className="font-semibold text-gray-800">
                  {FORM_TYPE_LABELS[sub.formType] ?? sub.formType}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Template</p>
                <p className="font-semibold text-gray-800">{sub.templateName ?? "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Submitted By</p>
                <p className="font-semibold text-gray-800">
                  {sub.submitterDisplayName ?? sub.submitterName ?? "Unknown"}
                  {sub.submitterCredentials ? `, ${sub.submitterCredentials}` : ""}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Submitted At</p>
                <p className="font-semibold text-gray-800">
                  {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Status</p>
                <StatusBadge status={sub.status} />
              </div>
              <div>
                <p className="text-gray-500 font-medium">Quality Score</p>
                {sub.maxPossibleScore > 0 ? (
                  <QualityBadge score={sub.qualityScore} max={sub.maxPossibleScore} />
                ) : (
                  <span className="text-gray-400 text-xs">N/A</span>
                )}
              </div>
            </div>

            {/* Quality score bar */}
            {sub.maxPossibleScore > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Quality Score</span>
                  <span className="font-semibold" style={{ color: BRAND }}>
                    {pct}/100
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 90 ? "#16a34a" : pct >= 75 ? "#2563eb" : pct >= 60 ? "#d97706" : "#dc2626",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Responses */}
            {responses && Object.keys(responses).length > 0 ? (
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Responses
                </h4>
                <div className="space-y-2">
                  {Object.entries(responses).map(([key, value]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium mb-0.5">{key}</p>
                      <p className="text-sm text-gray-800">
                        {Array.isArray(value) ? value.join(", ") : String(value || "—")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No response data available.</p>
            )}

            {/* Status change */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">Change status:</span>
              {(["submitted", "reviewed"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={sub.status === s || updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: sub.id, status: s })}
                >
                  Mark {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── STATS CARDS ──────────────────────────────────────────────────────────────
function StatsCards({ labId }: { labId: number }) {
  const { data: stats, isLoading } = trpc.formBuilder.getSubmissionStats.useQuery(
    { labId },
    { enabled: labId > 0 }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: "Total Submissions",
      value: stats.total,
      icon: ClipboardList,
      color: BRAND,
    },
    {
      label: "Last 30 Days",
      value: stats.last30Days,
      icon: Calendar,
      color: "#2563eb",
    },
    {
      label: "Avg Quality Score",
      value: stats.avgQualityScore > 0 ? `${Math.round(stats.avgQualityScore)}/100` : "—",
      icon: Star,
      color: "#d97706",
    },
    {
      label: "Form Types Used",
      value: stats.byType.length,
      icon: FileText,
      color: "#7c3aed",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statCards.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: color + "18" }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight" style={{ color }}>
              {value}
            </p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface FormResponsesTabProps {
  lab: { id: number; labName: string };
  members: Array<{ id: number; displayName?: string; userId?: number }>;
}

export default function FormResponsesTab({ lab, members }: FormResponsesTabProps) {
  const [formType, setFormType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [detailOpen, setDetailOpen] = useState(false);

  const PAGE_SIZE = 20;

  const queryInput = useMemo(
    () => ({
      labId: lab.id,
      formType: formType !== "all" ? formType : undefined,
      status: (status !== "all" ? status : undefined) as
        | "draft"
        | "submitted"
        | "reviewed"
        | undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [lab.id, formType, status, dateFrom, dateTo, page]
  );

  const { data, isLoading, refetch } = trpc.formBuilder.listSubmissionsForLab.useQuery(
    queryInput,
    { enabled: lab.id > 0 }
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Client-side search filter on submitter name
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        (r.submitterDisplayName ?? r.submitterName ?? "").toLowerCase().includes(q) ||
        (r.templateName ?? "").toLowerCase().includes(q) ||
        r.formType.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openDetail = (id: number) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const headers = [
      "ID",
      "Form Type",
      "Template",
      "Submitted By",
      "Credentials",
      "Status",
      "Quality Score",
      "Max Score",
      "Score %",
      "Submitted At",
    ];
    const csvRows = rows.map((r) => {
      const pct =
        r.maxPossibleScore > 0
          ? Math.round((r.qualityScore / r.maxPossibleScore) * 100)
          : 0;
      return [
        r.id,
        FORM_TYPE_LABELS[r.formType] ?? r.formType,
        r.templateName ?? "",
        r.submitterDisplayName ?? r.submitterName ?? "",
        r.submitterCredentials ?? "",
        r.status,
        r.qualityScore,
        r.maxPossibleScore,
        `${pct}%`,
        r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-responses-${lab.labName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  };

  const clearFilters = () => {
    setFormType("all");
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const hasFilters =
    formType !== "all" ||
    status !== "all" ||
    search.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Form Responses</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            All dynamic form submissions for {lab.labName}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 border-[#189aa1] text-[#189aa1] hover:bg-[#f0fbfc]"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <StatsCards labId={lab.id} />

      {/* Filters */}
      <Card className="border border-gray-100">
        <CardContent className="pt-3 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search submitter or template..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            {/* Form Type */}
            <Select
              value={formType}
              onValueChange={(v) => {
                setFormType(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All form types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Form Types</SelectItem>
                <SelectItem value="image_quality_review">Image Quality Review</SelectItem>
                <SelectItem value="peer_review">Sonographer Peer Review</SelectItem>
                <SelectItem value="physician_peer_review">Physician Peer Review</SelectItem>
                <SelectItem value="case_mix">Case Mix Submission</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex gap-1">
              <Input
                type="date"
                className="h-8 text-xs"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                placeholder="From"
              />
              <Input
                type="date"
                className="h-8 text-xs"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                placeholder="To"
              />
            </div>
          </div>

          {hasFilters && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Filters active</span>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-gray-100">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FileText className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">
                {hasFilters
                  ? "No submissions match your filters."
                  : "No form submissions yet. Submit a form to see responses here."}
              </p>
              {hasFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap">
                        Form Type
                      </th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap">
                        Submitted By
                      </th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap">
                        Quality Score
                      </th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap">
                        Status
                      </th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 whitespace-nowrap">
                        Submitted At
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => {
                      const pct =
                        row.maxPossibleScore > 0
                          ? Math.round((row.qualityScore / row.maxPossibleScore) * 100)
                          : 0;
                      const { tier, color, bg } = qsTier(pct);
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            idx % 2 === 0 ? "" : "bg-gray-50/30"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {FORM_TYPE_LABELS[row.formType] ?? row.formType}
                              </p>
                              {row.templateName && (
                                <p className="text-gray-400 text-[10px]">{row.templateName}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div>
                              <p className="font-medium text-gray-700">
                                {row.submitterDisplayName ?? row.submitterName ?? "Unknown"}
                              </p>
                              {row.submitterCredentials && (
                                <p className="text-gray-400 text-[10px]">
                                  {row.submitterCredentials}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {row.maxPossibleScore > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: color,
                                    }}
                                  />
                                </div>
                                <span
                                  className="font-semibold text-xs"
                                  style={{ color }}
                                >
                                  {pct}
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ color, background: bg }}
                                >
                                  {tier}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            {row.submittedAt
                              ? new Date(row.submittedAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openDetail(row.id)}
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" style={{ color: BRAND }} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    Showing {page * PAGE_SIZE + 1}–
                    {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs px-2 text-gray-600">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* By-type breakdown */}
      {data?.rows && data.rows.length > 0 && (
        <ByTypeBreakdown labId={lab.id} />
      )}

      {/* Detail modal */}
      <ResponseDetailModal
        submissionId={selectedId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onStatusChange={() => refetch()}
      />
    </div>
  );
}

// ─── BY-TYPE BREAKDOWN ────────────────────────────────────────────────────────
function ByTypeBreakdown({ labId }: { labId: number }) {
  const { data: stats } = trpc.formBuilder.getSubmissionStats.useQuery(
    { labId },
    { enabled: labId > 0 }
  );

  if (!stats || stats.byType.length === 0) return null;

  return (
    <Card className="border border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: BRAND }} />
          Submissions by Form Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.byType.map((item) => {
            const label = FORM_TYPE_LABELS[item.formType] ?? item.formType;
            const cnt = Number(item.cnt);
            const pct = stats.total > 0 ? Math.round((cnt / stats.total) * 100) : 0;
            const avgScore = item.avgScore != null ? Math.round(Number(item.avgScore)) : null;
            return (
              <div key={item.formType} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-600 truncate flex-shrink-0">
                  {label}
                </div>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: BRAND }}
                  />
                </div>
                <div className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                  {cnt} ({pct}%)
                </div>
                {avgScore !== null && avgScore > 0 && (
                  <div
                    className="text-xs font-semibold w-16 text-right flex-shrink-0"
                    style={{ color: BRAND }}
                  >
                    avg {avgScore}/100
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
