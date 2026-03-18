/**
 * MeetingMinutesArchive.tsx
 * Searchable, filterable list of all finalized meeting minutes.
 * Accessible from the Quality Meetings tab in DIY Accreditation Tool.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, FileText, Download, Eye, Calendar, Clock, Users } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const BRAND = "#189aa1";

const MEETING_TYPE_LABELS: Record<string, string> = {
  quality_assurance: "Quality Assurance",
  peer_review: "Peer Review",
  accreditation: "Accreditation",
  staff_education: "Staff Education",
  policy_review: "Policy Review",
  other: "Other",
};

const MEETING_TYPE_COLORS: Record<string, string> = {
  quality_assurance: "bg-teal-100 text-teal-800",
  peer_review: "bg-blue-100 text-blue-800",
  accreditation: "bg-purple-100 text-purple-800",
  staff_education: "bg-green-100 text-green-800",
  policy_review: "bg-orange-100 text-orange-800",
  other: "bg-gray-100 text-gray-700",
};

function MinutesViewerDialog({
  meeting,
  onClose,
}: {
  meeting: { id: number; title: string; scheduledAt: Date | string; minutesHtml: string | null };
  onClose: () => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: meeting.minutesHtml ?? "<p>No minutes available.</p>",
    editable: false,
  });

  function handleDownloadDocx() {
    // Simple HTML download as .html file for Word compatibility
    const blob = new Blob(
      [`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;max-width:800px;margin:40px auto;line-height:1.6}h1,h2,h3{color:#189aa1}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}th{background:#f0fbfc}</style></head><body><h1>${meeting.title}</h1><p><strong>Date:</strong> ${new Date(meeting.scheduledAt).toLocaleDateString("en-US", { dateStyle: "full" })}</p><hr/>${meeting.minutesHtml ?? ""}</body></html>`],
      { type: "text/html" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meeting.title.replace(/[^a-z0-9]/gi, "_")}_minutes.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;max-width:800px;margin:40px auto;line-height:1.6}h1,h2,h3{color:#189aa1}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}th{background:#f0fbfc}@media print{body{margin:20px}}</style></head><body><h1>${meeting.title}</h1><p><strong>Date:</strong> ${new Date(meeting.scheduledAt).toLocaleDateString("en-US", { dateStyle: "full" })}</p><hr/>${meeting.minutesHtml ?? ""}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ color: BRAND }}>
            {meeting.title}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {new Date(meeting.scheduledAt).toLocaleDateString("en-US", { dateStyle: "full" })}
          </p>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={handleDownloadDocx}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download (.html/Word)
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Print / Save PDF
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-white">
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none [&_h2]:text-[#189aa1] [&_h2]:font-bold [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-teal-50"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MeetingMinutesArchive() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [viewingMeeting, setViewingMeeting] = useState<null | {
    id: number; title: string; scheduledAt: Date | string; minutesHtml: string | null;
  }>(null);

  const { data: meetings = [], isLoading } = trpc.meeting.listFinalized.useQuery({
    meetingType: typeFilter === "all" ? "all" : typeFilter as any,
  });

  // Derive available years from data
  const availableYears = useMemo(() => {
    const years = new Set(meetings.map((m) => new Date(m.scheduledAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [meetings]);

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (yearFilter !== "all" && new Date(m.scheduledAt).getFullYear() !== parseInt(yearFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !(m.agenda ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [meetings, yearFilter, search]);

  function handleBulkPdf() {
    if (filtered.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const content = filtered.map((m) =>
      `<div style="page-break-after:always"><h1>${m.title}</h1><p><strong>Date:</strong> ${new Date(m.scheduledAt).toLocaleDateString("en-US", { dateStyle: "full" })}</p><p><strong>Type:</strong> ${MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}</p><hr/>${m.minutesHtml ?? "<p>No minutes recorded.</p>"}</div>`
    ).join("\n");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11pt;max-width:800px;margin:40px auto;line-height:1.6}h1{color:#189aa1;font-size:16pt}h2{color:#189aa1}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}th{background:#f0fbfc}@media print{div{page-break-after:always}}</style></head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: BRAND }}>Meeting Minutes Archive</h3>
          <p className="text-sm text-gray-500">All finalized meeting minutes — searchable and exportable for accreditation submission</p>
        </div>
        <Button
          size="sm"
          onClick={handleBulkPdf}
          disabled={filtered.length === 0}
          style={{ background: BRAND, color: "white" }}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export All ({filtered.length}) as PDF
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by title or agenda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading archive...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No finalized minutes found</p>
          <p className="text-gray-400 text-sm mt-1">
            {meetings.length === 0
              ? "Finalize meeting minutes from the Quality Meetings tab to populate this archive."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-[#189aa1]/40 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f0fbfc" }}>
                <FileText className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm truncate">{m.title}</span>
                  <Badge className={`text-xs ${MEETING_TYPE_COLORS[m.meetingType] ?? "bg-gray-100 text-gray-700"}`}>
                    {MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(m.scheduledAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </span>
                  {m.durationMinutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {m.durationMinutes} min
                    </span>
                  )}
                  {m.minutesFinalizedAt && (
                    <span className="text-green-600 font-medium">
                      Finalized {new Date(m.minutesFinalizedAt).toLocaleDateString("en-US", { dateStyle: "short" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewingMeeting(m)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> View
                </Button>
                <Button
                  size="sm"
                  onClick={() => setViewingMeeting(m)}
                  style={{ background: BRAND, color: "white" }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1" /> Open Minutes
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Minutes viewer dialog */}
      {viewingMeeting && (
        <MinutesViewerDialog
          meeting={viewingMeeting}
          onClose={() => setViewingMeeting(null)}
        />
      )}
    </div>
  );
}
