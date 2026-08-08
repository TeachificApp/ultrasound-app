/**
 * CmeFormsListTab.tsx
 * Admin list view of all CME-eligible courses with form completion status.
 * Shown as a tab inside LMS Admin.
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle, Clock, AlertCircle, Download, Edit2, Search,
  Loader2, FileText, RefreshCw, FileDown, Mail, Send, TriangleAlert, CalendarIcon, X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CmeActivityFormPanel } from "./CmeActivityFormPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Link2 } from "lucide-react";

// ─── Form Status config ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  complete: {
    label: "Complete",
    icon: CheckCircle,
    className: "bg-green-100 text-green-700 border-green-200",
    iconClass: "text-green-600",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    iconClass: "text-yellow-600",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    className: "bg-red-50 text-red-600 border-red-200",
    iconClass: "text-red-500",
  },
} as const;

type FormStatus = keyof typeof STATUS_CONFIG;

// ─── CardioServ Status config ─────────────────────────────────────────────────
type CmeStatus = "draft" | "pending_approval" | "approved" | "expired";

const CME_STATUS_CONFIG: Record<CmeStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600 border-gray-200" },
  pending_approval: { label: "Pending Approval", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  expired: { label: "Expired", className: "bg-red-100 text-red-600 border-red-200" },
};

function CmeStatusBadge({ status }: { status: CmeStatus }) {
  const cfg = CME_STATUS_CONFIG[status] ?? CME_STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: FormStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}>
      <Icon className={`w-3 h-3 ${cfg.iconClass}`} />
      {cfg.label}
    </span>
  );
}

function fmtDate(d: Date | string | number | null | undefined): string {
  if (!d) return "—";
  return new Date(d as any).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function isExpiringSoon(approvedAt: number | null | undefined): boolean {
  if (!approvedAt) return false;
  const expiresAt = approvedAt + TWO_YEARS_MS;
  const remaining = expiresAt - Date.now();
  return remaining > 0 && remaining <= NINETY_DAYS_MS;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CmeFormsListTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FormStatus | "all">("all");
  const [cmeFilter, setCmeFilter] = useState<CmeStatus | "all">("all");
  const [editCourseId, setEditCourseId] = useState<number | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editCreditHours, setEditCreditHours] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);

  // Send to CardioServ from list
  const [sendCourseId, setSendCourseId] = useState<number | null>(null);
  const [sendCourseTitle, setSendCourseTitle] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState<number | null>(null);
  const [sendCourseSlug, setSendCourseSlug] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.lmsAdmin.listCmeActivityForms.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const downloadMutation = trpc.lmsAdmin.downloadCmeActivityForm.useMutation();
  const downloadPdfMutation = trpc.lmsAdmin.downloadCmeActivityFormPdf.useMutation();
  const sendMutation = trpc.lmsAdmin.sendCmeFormToCardioServ.useMutation();
  const updateStatusMutation = trpc.lmsAdmin.updateCmeStatus.useMutation();
  const updateApprovedAtMutation = trpc.lmsAdmin.updateApprovedAt.useMutation();
  const [openDatePickerRow, setOpenDatePickerRow] = useState<number | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkApproving(true);
    const now = Date.now();
    let succeeded = 0;
    for (const id of selectedIds) {
      try {
        await updateStatusMutation.mutateAsync({ courseId: id, status: "approved" });
        await updateApprovedAtMutation.mutateAsync({ courseId: id, approvedAt: now });
        succeeded++;
      } catch { /* continue */ }
    }
    setBulkApproving(false);
    setSelectedIds(new Set());
    refetch();
    toast.success(`Marked ${succeeded} course${succeeded !== 1 ? "s" : ""} as Approved.`);
  };

  const handleApprovedAtChange = async (courseId: number, date: Date | undefined) => {
    const ts = date ? date.getTime() : null;
    try {
      await updateApprovedAtMutation.mutateAsync({ courseId, approvedAt: ts });
      refetch();
      setOpenDatePickerRow(null);
      toast.success(date ? `Approved date set to ${date.toLocaleDateString()}` : "Approved date cleared");
    } catch (e: any) {
      toast.error("Failed to update date: " + (e?.message ?? "Unknown error"));
    }
  };

  const handleDownloadPdf = async (courseId: number, courseTitle: string) => {
    setDownloadingPdf(courseId);
    try {
      const result = await downloadPdfMutation.mutateAsync({ courseId });
      const resp = await fetch(result.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeTitle = courseTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      a.download = `cme-activity-form-${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      toast.success(`PDF ready — downloading "${courseTitle}"`);
    } catch (e: any) {
      toast.error("PDF download failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleDownload = async (courseId: number, courseTitle: string) => {
    setDownloading(courseId);
    try {
      const result = await downloadMutation.mutateAsync({ courseId });
      const resp = await fetch(result.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const safeTitle = courseTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 60);
      a.download = `cme-activity-form-${safeTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      toast.success(`DOCX ready — downloading "${courseTitle}"`);
    } catch (e: any) {
      toast.error("Download failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setDownloading(null);
    }
  };

  const handleQuickResend = async (row: any) => {
    if (resending === row.id) return;
    setResending(row.id);
    const credits = row.creditHours ?? "";
    const slug = row.slug ?? row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const landingUrl = `https://learn.allaboutultrasound.com/courses/${slug}`;
    const subject = `CME Activity Planning & Proposal Form — ${row.title}${credits ? ` (${credits} CME)` : ""}`;
    const body = `Dear Don and Judith,\n\nPlease find attached the CME Activity Planning & Proposal Form for the following enduring activity:\n\nActivity Title: ${row.title}\nCME Credits Requested: ${credits || "—"}\nActivity Structure: Ongoing / Evergreen\n\nCourse Landing Page: ${landingUrl}\n\nPlease let us know if you need any additional information or revisions.\n\nBest regards,\nAll About Ultrasound, Inc. dba iHeartEcho`;
    try {
      const result = await sendMutation.mutateAsync({ courseId: row.id, subject, body });
      const enrolled = (result as any).autoEnrolledNames ?? [];
      if (enrolled.length > 0) {
        toast.success(`Resent to CardioServ. Auto-enrolled: ${enrolled.join(", ")}.`);
      } else {
        toast.success("Resent to CardioServ successfully.");
      }
      refetch();
    } catch (e: any) {
      toast.error("Resend failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setResending(null);
    }
  };

  const openSendDialog = (row: any) => {
    const credits = row.creditHours ?? "";
    const slug = row.slug ?? row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const landingUrl = `https://learn.allaboutultrasound.com/courses/${slug}`;
    const subject = `CME Activity Planning & Proposal Form — ${row.title}${credits ? ` (${credits} CME)` : ""}`;
    const body =
`Dear Don and Judith,

Please find attached the CME Activity Planning & Proposal Form for the following enduring activity:

Activity Title: ${row.title}
CME Credits Requested: ${credits || "—"}
Activity Structure: Ongoing / Evergreen

Course Landing Page: ${landingUrl}

Please let us know if you need any additional information or revisions.

Best regards,
All About Ultrasound, Inc. dba iHeartEcho`;
    setSendCourseId(row.id);
    setSendCourseTitle(row.title);
    setSendCourseSlug(slug);
    setSendSubject(subject);
    setSendBody(body);
  };

  const handleSend = async () => {
    if (!sendCourseId) return;
    setSending(true);
    try {
      await sendMutation.mutateAsync({ courseId: sendCourseId, subject: sendSubject, body: sendBody });
      toast.success("Email sent to CardioServ with PDF attached.");
      // Auto-advance status to pending_approval if currently draft
      const row = (data ?? []).find(r => r.id === sendCourseId);
      if (row && (row.cmeStatus === "draft" || !row.cmeStatus)) {
        await updateStatusMutation.mutateAsync({ courseId: sendCourseId, status: "pending_approval" });
      }
      setSendCourseId(null);
      refetch();
    } catch (e: any) {
      toast.error("Send failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (courseId: number, status: CmeStatus) => {
    try {
      await updateStatusMutation.mutateAsync({ courseId, status });
      toast.success("CardioServ status updated.");
      refetch();
    } catch (e: any) {
      toast.error("Status update failed: " + (e?.message ?? "Unknown error"));
    }
  };

  const filtered = (data ?? []).filter(row => {
    const matchesSearch = !search.trim() || row.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || row.formStatus === statusFilter;
    const matchesCs = cmeFilter === "all" || (row.cmeStatus ?? "draft") === cmeFilter;
    return matchesSearch && matchesStatus && matchesCs;
  });

  const cmeCounts: Record<CmeStatus, number> = {
    draft: (data ?? []).filter(r => (r.cmeStatus ?? "draft") === "draft").length,
    pending_approval: (data ?? []).filter(r => r.cmeStatus === "pending_approval").length,
    approved: (data ?? []).filter(r => r.cmeStatus === "approved").length,
    expired: (data ?? []).filter(r => r.cmeStatus === "expired").length,
  };

  const counts = {
    complete: (data ?? []).filter(r => r.formStatus === "complete").length,
    in_progress: (data ?? []).filter(r => r.formStatus === "in_progress").length,
    pending: (data ?? []).filter(r => r.formStatus === "pending").length,
    total: (data ?? []).length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#189aa1]" />
            CME Activity Planning Forms
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track CardioServ accreditation form completion for all CME-eligible courses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex-shrink-0 gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50"
            onClick={() => {
              if (!data?.length) return;
              const rows = data.map((r: any) => ({
                ID: r.id,
                Title: r.title,
                Type: r.productType ?? r.type ?? "",
                "Credit Hours": r.creditHours ?? "",
                "CME Status": r.cmeStatus ?? "",
                "Form Status": r.formStatus ?? "",
                "Proposed Date": r.formProposedDate ?? "",
                "Last Updated": r.formUpdatedAt ? new Date(r.formUpdatedAt).toLocaleDateString() : "",
                "Last Sent": r.lastSentAt ? new Date(r.lastSentAt).toLocaleDateString() : "",
                "Approved Date": r.approvedAt ? new Date(r.approvedAt).toLocaleDateString() : "",
              }));
              const headers = Object.keys(rows[0]);
              const escape = (v: any) => { const s = v == null ? "" : String(v).replace(/"/g, '""'); return /[,"\n]/.test(s) ? `"${s}"` : s; };
              const csv = [headers.join(","), ...rows.map((r: any) => headers.map(h => escape(r[h])).join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `cme-activity-forms-${new Date().toISOString().slice(0,10)}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-3 h-3" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs flex-shrink-0">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards — CardioServ Status counts */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total CME Courses", value: counts.total, color: "bg-gray-50 border-gray-200 text-gray-700", filter: "all" as const },
            { label: "Draft", value: cmeCounts.draft, color: "bg-gray-50 border-gray-200 text-gray-600", filter: "draft" as const },
            { label: "Pending Approval", value: cmeCounts.pending_approval, color: "bg-yellow-50 border-yellow-200 text-yellow-700", filter: "pending_approval" as const },
            { label: "Approved", value: cmeCounts.approved, color: "bg-green-50 border-green-200 text-green-700", filter: "approved" as const },
            { label: "Expired", value: cmeCounts.expired, color: "bg-red-50 border-red-200 text-red-600", filter: "expired" as const },
          ].map(card => (
            <button
              key={card.label}
              type="button"
              onClick={() => setCmeFilter(card.filter === "all" ? "all" : card.filter as CmeStatus)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                card.color
              } ${
                (card.filter === "all" && cmeFilter === "all") || (card.filter !== "all" && cmeFilter === card.filter)
                  ? "ring-2 ring-[#189aa1] ring-offset-1"
                  : ""
              }`}
            >
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs mt-0.5 opacity-80">{card.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search course title…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
          <span className="text-xs font-medium text-teal-700">{selectedIds.size} course{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <Button
            size="sm"
            className="h-7 text-xs bg-[#189aa1] hover:bg-[#147f85] text-white"
            onClick={handleBulkApprove}
            disabled={bulkApproving}
          >
            {bulkApproving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Mark as Approved
          </Button>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading CME courses…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {data?.length === 0
            ? <p className="text-sm">No CME-eligible products found.</p>
            : <p className="text-sm">No courses match your current filters.</p>
          }
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8 pl-3">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                    className="border-gray-300"
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Course</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-24">Credits</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-44">CardioServ Status</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-32">Approved Date</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-32">Last Sent</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-32">Last Updated</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(row => {
                const cmeStatus = (row.cmeStatus ?? "draft") as CmeStatus;
                return (
                  <TableRow key={row.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(row.id) ? "bg-teal-50" : ""}`}>
                    <TableCell className="pl-3">
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleSelect(row.id)}
                        aria-label={`Select ${row.title}`}
                        className="border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-gray-900 line-clamp-1">{row.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">ID: {row.id}</span>
                          {row.productType && row.productType !== "course" && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                              row.productType === "cohort" ? "bg-blue-50 text-blue-600 border-blue-200" :
                              row.productType === "workshop" ? "bg-purple-50 text-purple-600 border-purple-200" :
                              row.productType === "quiz" ? "bg-orange-50 text-orange-600 border-orange-200" :
                              row.productType === "webinar" ? "bg-teal-50 text-teal-600 border-teal-200" :
                              row.productType === "download" ? "bg-gray-100 text-gray-500 border-gray-200" :
                              "bg-teal-50 text-teal-600 border-teal-200"
                            }`}>
                              {row.productType.charAt(0).toUpperCase() + row.productType.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">
                        {row.creditHours ? `${row.creditHours} hr${parseFloat(row.creditHours) !== 1 ? "s" : ""}` : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Select
                          value={cmeStatus}
                          onValueChange={(val) => handleStatusChange(row.id, val as CmeStatus)}
                        >
                          <SelectTrigger className="h-7 text-xs w-40 border-gray-200">
                            <SelectValue>
                              <CmeStatusBadge status={cmeStatus} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">
                              <span className="text-xs text-gray-600">Draft</span>
                            </SelectItem>
                            <SelectItem value="pending_approval">
                              <span className="text-xs text-yellow-700">Pending Approval</span>
                            </SelectItem>
                            <SelectItem value="approved">
                              <span className="text-xs text-green-700">Approved</span>
                            </SelectItem>
                            <SelectItem value="expired">
                              <span className="text-xs text-red-600">Expired</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {isExpiringSoon(row.approvedAt) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                            <TriangleAlert className="w-2.5 h-2.5" /> Expiring Soon
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Popover open={openDatePickerRow === row.id} onOpenChange={open => setOpenDatePickerRow(open ? row.id : null)}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-left hover:bg-gray-50 rounded px-1 py-0.5 group"
                          >
                            {row.approvedAt ? (
                              <div>
                                <span className="text-gray-700 font-medium text-xs">{fmtDate(row.approvedAt)}</span>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Expires {fmtDate(row.approvedAt + TWO_YEARS_MS)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                            <CalendarIcon className="w-3 h-3 text-gray-300 group-hover:text-[#189aa1] shrink-0 ml-1" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 border-b flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">Set Approved Date</span>
                            {row.approvedAt && (
                              <button
                                type="button"
                                className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5"
                                onClick={() => handleApprovedAtChange(row.id, undefined)}
                              >
                                <X className="w-3 h-3" /> Clear
                              </button>
                            )}
                          </div>
                          <Calendar
                            mode="single"
                            selected={row.approvedAt ? new Date(row.approvedAt) : undefined}
                            onSelect={(date) => handleApprovedAtChange(row.id, date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.lastSentAt ? (
                        <span className="text-[#189aa1] font-medium">
                          {fmtDate(row.lastSentAt)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {fmtDate(row.formUpdatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-teal-600 hover:bg-teal-50"
                          onClick={() => {
                            setEditCourseId(row.id);
                            setEditCourseTitle(row.title);
                            setEditCreditHours(row.creditHours ?? null);
                          }}
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          {row.formStatus === "pending" ? "Start" : "Edit"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-[#189aa1] hover:bg-teal-50"
                          onClick={() => openSendDialog(row)}
                          title="Send to CardioServ"
                        >
                          <Mail className="w-3 h-3" />
                        </Button>
                        {row.lastSentAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-amber-600 hover:bg-amber-50"
                            disabled={resending === row.id}
                            onClick={() => handleQuickResend(row)}
                            title="Quick resend to CardioServ (re-triggers auto-enrollment)"
                          >
                            {resending === row.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RefreshCw className="w-3 h-3" />
                            }
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-gray-500 hover:bg-gray-100"
                          disabled={downloading === row.id}
                          onClick={() => handleDownload(row.id, row.title)}
                          title="Download DOCX"
                        >
                          {downloading === row.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-gray-500 hover:bg-gray-100"
                          disabled={downloadingPdf === row.id}
                          onClick={() => handleDownloadPdf(row.id, row.title)}
                          title="Download PDF"
                        >
                          {downloadingPdf === row.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <FileDown className="w-3 h-3" />
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editCourseId !== null}
        onOpenChange={open => {
          if (!open) {
            setEditCourseId(null);
            refetch();
          }
        }}
      >
        <DialogContent
          className="h-[96vh] max-h-[96vh] flex flex-col p-0 gap-0"
          style={{ width: "98vw", maxWidth: "98vw" }}
        >
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#189aa1]" />
              CME Activity Form — {editCourseTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
          {editCourseId !== null && (
            <CmeActivityFormPanel
              courseId={editCourseId}
              courseTitle={editCourseTitle}
              creditHours={editCreditHours}
            />
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send to CardioServ dialog */}
      <Dialog open={sendCourseId !== null} onOpenChange={open => { if (!open) setSendCourseId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-[#189aa1]" />
              Send CME Form to CardioServ — {sendCourseTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Recipients */}
            <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#189aa1] w-8">To:</span>
                <span className="text-gray-700">Don Gerig &lt;don@cardioserv.net&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#189aa1] w-8">CC:</span>
                <span className="text-gray-700">Judith Buckland &lt;j.buckland@cardioserv.net&gt;, admin@allaboutultrasound.com</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#189aa1] w-8">📎</span>
                <span className="text-gray-500 italic">CME Activity Planning & Proposal Form (PDF) — generated from current saved form</span>
              </div>
            </div>
            {/* Subject */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Subject</label>
              <input
                type="text"
                value={sendSubject}
                onChange={e => setSendSubject(e.target.value)}
                className="w-full h-8 text-sm border border-gray-300 rounded px-3 focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
            {/* Body */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Email Body <span className="text-gray-400">(editable)</span></label>
              <textarea
                value={sendBody}
                onChange={e => setSendBody(e.target.value)}
                rows={12}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 font-mono resize-y"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSendCourseId(null)} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={sending || !sendSubject.trim() || !sendBody.trim()}
              className="bg-[#189aa1] hover:bg-[#147f85] text-white"
            >
              {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              {sending ? "Sending…" : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generic Disclosure Submissions ── */}
      <GenericDisclosuresSection />
    </div>
  );
}

// ─── Generic Disclosures Section ─────────────────────────────────────────────
function GenericDisclosuresSection() {
  const [search, setSearch] = useState("");
  const [viewRow, setViewRow] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [linkingCourseId, setLinkingCourseId] = useState<string>("");
  const [linkingInProgress, setLinkingInProgress] = useState(false);

  const downloadPdfMutation = trpc.lmsAdmin.downloadGenericDisclosurePdf.useMutation();
  const linkMutation = trpc.lmsAdmin.linkGenericDisclosureToCourse.useMutation();
  const unlinkMutation = trpc.lmsAdmin.unlinkGenericDisclosure.useMutation();

  const { data: cmeCoursesData } = trpc.lmsAdmin.listCmeActivityForms.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const cmeCourses = Array.isArray(cmeCoursesData) ? cmeCoursesData : [];

  const handleLinkCourse = async (row: any) => {
    if (!linkingCourseId) return;
    setLinkingInProgress(true);
    try {
      await linkMutation.mutateAsync({ id: row.id, courseId: parseInt(linkingCourseId) });
      toast.success("Linked to course successfully");
      setViewRow((prev: any) => prev ? { ...prev, linkedCourseId: parseInt(linkingCourseId) } : null);
      setLinkingCourseId("");
      refetch();
    } catch {
      toast.error("Failed to link course");
    } finally {
      setLinkingInProgress(false);
    }
  };

  const handleUnlink = async (row: any) => {
    setLinkingInProgress(true);
    try {
      await unlinkMutation.mutateAsync({ id: row.id });
      toast.success("Unlinked from course");
      setViewRow((prev: any) => prev ? { ...prev, linkedCourseId: null } : null);
      refetch();
    } catch {
      toast.error("Failed to unlink");
    } finally {
      setLinkingInProgress(false);
    }
  };

  const handleDownloadPdf = async (row: any) => {
    setDownloadingPdf(true);
    try {
      const result = await downloadPdfMutation.mutateAsync({ id: row.id });
      window.open(result.url, "_blank");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const { data, isLoading, refetch } = trpc.lmsAdmin.listGenericDisclosures.useQuery(
    { search: search || undefined },
    { refetchOnWindowFocus: false }
  );
  const rows: any[] = (data as any)?.rows ?? [];

  return (
    <div className="space-y-4 pt-2 border-t border-gray-100 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#189aa1]" />
            Generic Disclosure Submissions
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Financial disclosures submitted via the generic public form (not linked to a specific course).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search name, email, activity…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm w-56"
          />
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs flex-shrink-0">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-teal-500" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          No generic disclosure submissions yet.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">Faculty</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Activity</TableHead>
                <TableHead className="text-xs">Submitted</TableHead>
                <TableHead className="text-xs">Relationships</TableHead>
                <TableHead className="text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.id} className="hover:bg-gray-50">
                  <TableCell className="text-xs font-medium">{row.facultyName}</TableCell>
                  <TableCell className="text-xs text-gray-600">{row.facultyEmail}</TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-[180px] truncate">{row.activityTitle}</TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.noRelationships ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">None</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">Disclosed</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-teal-600" onClick={() => setViewRow(row)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Dialog */}
      {viewRow && (
        <Dialog open={!!viewRow} onOpenChange={() => setViewRow(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Generic Disclosure — {viewRow.facultyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 text-xs">
                <div><span className="font-medium text-gray-600">Faculty:</span> {viewRow.facultyName}</div>
                <div><span className="font-medium text-gray-600">Email:</span> {viewRow.facultyEmail}</div>
                <div><span className="font-medium text-gray-600">Activity:</span> {viewRow.activityTitle}</div>
                <div><span className="font-medium text-gray-600">Submitted:</span> {viewRow.submittedAt ? new Date(viewRow.submittedAt).toLocaleString() : "—"}</div>
                <div><span className="font-medium text-gray-600">Attestation:</span> {viewRow.attestationName}</div>
              </div>
              {viewRow.rolesJson && (() => {
                try {
                  const roles: string[] = JSON.parse(viewRow.rolesJson);
                  return roles.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Roles</p>
                      <p className="text-xs text-gray-700">{roles.join(", ")}</p>
                    </div>
                  ) : null;
                } catch { return null; }
              })()}
              {viewRow.noRelationships ? (
                <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                  No financial relationships disclosed in the past 24 months.
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Financial Relationships</p>
                  {(() => {
                    try {
                      const rels = JSON.parse(viewRow.relationshipsJson ?? "[]");
                      return rels.filter((r: any) => r.company?.trim()).map((r: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded p-2 text-xs mb-1">
                          <span className="font-medium">{r.company}</span> — {r.nature}
                          {r.ended && <span className="ml-2 text-amber-600">(Ended)</span>}
                        </div>
                      ));
                    } catch { return <p className="text-xs text-gray-500">Unable to parse relationships.</p>; }
                  })()}
                </div>
              )}
            </div>

            {/* Link to Course */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-teal-600" />
                Link to Course / Webinar
              </p>
              {viewRow.linkedCourseId ? (
                <div className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-teal-700 font-medium">
                    Linked to: {cmeCourses.find((c: any) => c.id === viewRow.linkedCourseId)?.title ?? `Course #${viewRow.linkedCourseId}`}
                  </p>
                  <Button
                    size="sm" variant="ghost"
                    className="h-6 text-xs text-red-500 hover:text-red-700"
                    disabled={linkingInProgress}
                    onClick={() => handleUnlink(viewRow)}
                  >
                    {linkingInProgress ? <Loader2 className="w-3 h-3 animate-spin" /> : "Unlink"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={linkingCourseId} onValueChange={setLinkingCourseId}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Select a CME course or webinar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {cmeCourses.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!linkingCourseId || linkingInProgress}
                    onClick={() => handleLinkCourse(viewRow)}
                    style={{ background: "#189aa1" }}
                    className="text-white h-8 text-xs flex-shrink-0"
                  >
                    {linkingInProgress ? <Loader2 className="w-3 h-3 animate-spin" /> : "Link"}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-gray-400">Linking associates this disclosure with the course's CME Section 6 faculty disclosures.</p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf(viewRow)}
                className="gap-1.5"
              >
                {downloadingPdf ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                ) : (
                  <><FileDown className="w-3.5 h-3.5" /> Download PDF</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewRow(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
