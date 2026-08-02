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
type CardioServStatus = "draft" | "pending_approval" | "approved" | "expired";

const CARDIOSERV_STATUS_CONFIG: Record<CardioServStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600 border-gray-200" },
  pending_approval: { label: "Pending Approval", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  expired: { label: "Expired", className: "bg-red-100 text-red-600 border-red-200" },
};

function CardioServStatusBadge({ status }: { status: CardioServStatus }) {
  const cfg = CARDIOSERV_STATUS_CONFIG[status] ?? CARDIOSERV_STATUS_CONFIG.draft;
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
  const [csFilter, setCsFilter] = useState<CardioServStatus | "all">("all");
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
  const [sendCourseSlug, setSendCourseSlug] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.lmsAdmin.listCmeActivityForms.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const downloadMutation = trpc.lmsAdmin.downloadCmeActivityForm.useMutation();
  const downloadPdfMutation = trpc.lmsAdmin.downloadCmeActivityFormPdf.useMutation();
  const sendMutation = trpc.lmsAdmin.sendCmeFormToCardioServ.useMutation();
  const updateStatusMutation = trpc.lmsAdmin.updateCardioServStatus.useMutation();
  const updateApprovedAtMutation = trpc.lmsAdmin.updateApprovedAt.useMutation();
  const [openDatePickerRow, setOpenDatePickerRow] = useState<number | null>(null);

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
      if (row && (row.cardioservStatus === "draft" || !row.cardioservStatus)) {
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

  const handleStatusChange = async (courseId: number, status: CardioServStatus) => {
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
    const matchesCs = csFilter === "all" || (row.cardioservStatus ?? "draft") === csFilter;
    return matchesSearch && matchesStatus && matchesCs;
  });

  const csCounts: Record<CardioServStatus, number> = {
    draft: (data ?? []).filter(r => (r.cardioservStatus ?? "draft") === "draft").length,
    pending_approval: (data ?? []).filter(r => r.cardioservStatus === "pending_approval").length,
    approved: (data ?? []).filter(r => r.cardioservStatus === "approved").length,
    expired: (data ?? []).filter(r => r.cardioservStatus === "expired").length,
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
        <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs flex-shrink-0">
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total CME Courses", value: counts.total, color: "bg-gray-50 border-gray-200 text-gray-700" },
            { label: "Complete", value: counts.complete, color: "bg-green-50 border-green-200 text-green-700" },
            { label: "In Progress", value: counts.in_progress, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
            { label: "Pending", value: counts.pending, color: "bg-red-50 border-red-200 text-red-600" },
          ].map(card => (
            <div key={card.label} className={`rounded-lg border p-3 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs mt-0.5 opacity-80">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        {/* Row 1: search */}
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
        {/* Row 2: CardioServ status filter */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-gray-400 pr-1">CardioServ:</span>
          {(["all", "draft", "pending_approval", "approved", "expired"] as const).map(s => {
            const labels: Record<string, string> = { all: "All", draft: "Draft", pending_approval: "Pending Approval", approved: "Approved", expired: "Expired" };
            const count = s !== "all" ? csCounts[s as CardioServStatus] : undefined;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setCsFilter(s)}
                className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                  csFilter === s
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {labels[s]}
                {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading CME courses…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {data?.length === 0
            ? <p className="text-sm">No CME-eligible courses found. Enable <strong>Certificate of Completion</strong> on a course to make it appear here.</p>
            : <p className="text-sm">No courses match your current filters.</p>
          }
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
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
                const csStatus = (row.cardioservStatus ?? "draft") as CardioServStatus;
                return (
                  <TableRow key={row.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-gray-900 line-clamp-1">{row.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">ID: {row.id}</p>
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
                          value={csStatus}
                          onValueChange={(val) => handleStatusChange(row.id, val as CardioServStatus)}
                        >
                          <SelectTrigger className="h-7 text-xs w-40 border-gray-200">
                            <SelectValue>
                              <CardioServStatusBadge status={csStatus} />
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
    </div>
  );
}
