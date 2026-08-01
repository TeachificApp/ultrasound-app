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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle, Clock, AlertCircle, Download, Edit2, Search,
  Loader2, FileText, RefreshCw, FileDown,
} from "lucide-react";
import { CmeActivityFormPanel } from "./CmeActivityFormPanel";

// ─── Status config ────────────────────────────────────────────────────────────
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

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CmeFormsListTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FormStatus | "all">("all");
  const [editCourseId, setEditCourseId] = useState<number | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editCreditHours, setEditCreditHours] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.lmsAdmin.listCmeActivityForms.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const downloadMutation = trpc.lmsAdmin.downloadCmeActivityForm.useMutation();
  const downloadPdfMutation = trpc.lmsAdmin.downloadCmeActivityFormPdf.useMutation();

  const handleDownloadPdf = async (courseId: number, courseTitle: string) => {
    setDownloadingPdf(courseId);
    try {
      const result = await downloadPdfMutation.mutateAsync({ courseId });
      // Fetch as blob to force download — CloudFront URLs lack Content-Disposition
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
      // Fetch as blob to force download — CloudFront URLs lack Content-Disposition
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

  const filtered = (data ?? []).filter(row => {
    const matchesSearch = !search.trim() || row.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || row.formStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary counts
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
        <div className="flex gap-1.5">
          {(["all", "pending", "in_progress", "complete"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                statusFilter === s
                  ? "bg-[#189aa1] text-white border-[#189aa1]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "all" && data && (
                <span className="ml-1 opacity-70">
                  ({s === "pending" ? counts.pending : s === "in_progress" ? counts.in_progress : counts.complete})
                </span>
              )}
            </button>
          ))}
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
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-600">Course</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-28">Credits</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-36">Form Status</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-36">Proposed Date</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-36">Last Updated</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(row => (
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
                    <StatusBadge status={row.formStatus as FormStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {row.formProposedDate || "—"}
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
              ))}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#189aa1]" />
              CME Activity Form — {editCourseTitle}
            </DialogTitle>
          </DialogHeader>
          {editCourseId !== null && (
            <CmeActivityFormPanel
              courseId={editCourseId}
              courseTitle={editCourseTitle}
              creditHours={editCreditHours}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
