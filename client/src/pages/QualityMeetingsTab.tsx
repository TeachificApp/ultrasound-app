/*
  QualityMeetingsTab — DIY Accreditation Tool™ — iHeartEcho™
  Upload-based Zoom/Teams meeting management with AI transcription and minutes.
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, Clock, Users, Plus, ChevronRight, ChevronLeft, Upload, FileText,
  Loader2, CheckCircle, XCircle, AlertTriangle, Mail, Video, Mic,
  Download, Edit3, Trash2, UserCheck, UserX, HelpCircle, Zap, ExternalLink,
  RefreshCw, Send, Save, X
} from "lucide-react";
import { toast } from "sonner";
import MeetingMinutesArchive from "./MeetingMinutesArchive";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";

const BRAND = "#189aa1";

// ─── Types ────────────────────────────────────────────────────────────────────

type Meeting = {
  id: number;
  title: string;
  meetingType: string;
  scheduledAt: Date;
  durationMinutes: number;
  location?: string | null;
  agenda?: string | null;
  status: string;
  minutesHtml?: string | null;
  minutesFinalized?: boolean | null;
};

type Attendee = {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  rsvpStatus: string;
  attendanceStatus: string;
  inviteSentAt?: Date | null;
};

type Recording = {
  id: number;
  fileName: string;
  fileUrl: string;
  transcriptionStatus: string;
  durationSeconds?: number | null;
};

type Transcript = {
  id: number;
  fullText: string;
  language: string;
  durationSeconds?: number | null;
};

type MinutesDraft = {
  id: number;
  minutesHtml: string;
  isAiGenerated: boolean;
  createdAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  quality_assurance: "Quality Assurance",
  peer_review: "Peer Review",
  accreditation: "Accreditation",
  staff_education: "Staff Education",
  policy_review: "Policy Review",
  other: "Other",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Scheduled", color: "#0e7490", bg: "#e0f7f8" },
  in_progress: { label: "In Progress", color: "#d97706", bg: "#fef3c7" },
  completed: { label: "Completed", color: "#15803d", bg: "#dcfce7" },
  cancelled: { label: "Cancelled", color: "#dc2626", bg: "#fee2e2" },
};

const RSVP_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  accepted: { label: "Accepted", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "#15803d" },
  declined: { label: "Declined", icon: <XCircle className="w-3.5 h-3.5" />, color: "#dc2626" },
  pending: { label: "Pending", icon: <HelpCircle className="w-3.5 h-3.5" />, color: "#6b7280" },
  tentative: { label: "Tentative", icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "#d97706" },
};

const ATTENDANCE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  present: { label: "Present", icon: <UserCheck className="w-3.5 h-3.5" />, color: "#15803d" },
  absent: { label: "Absent", icon: <UserX className="w-3.5 h-3.5" />, color: "#dc2626" },
  excused: { label: "Excused", icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "#d97706" },
  unknown: { label: "Unknown", icon: <HelpCircle className="w-3.5 h-3.5" />, color: "#9ca3af" },
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── Create/Edit Meeting Modal ────────────────────────────────────────────────

function MeetingFormModal({
  meeting,
  onClose,
  onSaved,
}: {
  meeting?: Meeting | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!meeting;
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [meetingType, setMeetingType] = useState(meeting?.meetingType ?? "quality_assurance");
  const [dateStr, setDateStr] = useState(
    meeting ? new Date(meeting.scheduledAt).toISOString().slice(0, 16) : ""
  );
  const [duration, setDuration] = useState(String(meeting?.durationMinutes ?? 60));
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [agenda, setAgenda] = useState(meeting?.agenda ?? "");

  const createMutation = trpc.meeting.create.useMutation();
  const updateMutation = trpc.meeting.update.useMutation();
  const utils = trpc.useUtils();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateStr) {
      toast.error("Title and date/time are required.");
      return;
    }
    try {
      if (isEdit && meeting) {
        await updateMutation.mutateAsync({
          meetingId: meeting.id,
          title: title.trim(),
          meetingType: meetingType as any,
          scheduledAt: new Date(dateStr),
          durationMinutes: Number(duration) || 60,
          location: location.trim() || undefined,
          agenda: agenda.trim() || undefined,
        });
        toast.success("Meeting updated.");
      } else {
        await createMutation.mutateAsync({
          title: title.trim(),
          meetingType: meetingType as any,
          scheduledAt: new Date(dateStr),
          durationMinutes: Number(duration) || 60,
          location: location.trim() || undefined,
          agenda: agenda.trim() || undefined,
        });
        toast.success("Meeting scheduled.");
      }
      utils.meeting.list.invalidate();
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save meeting.");
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            {isEdit ? "Edit Meeting" : "Schedule New Meeting"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Meeting Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly QA Review — March 2026" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Meeting Type *</label>
              <Select value={meetingType} onValueChange={setMeetingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duration (minutes)</label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={5} max={480} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date &amp; Time *</label>
            <Input type="datetime-local" value={dateStr} onChange={e => setDateStr(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Location / Meeting Link</label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Zoom link, Teams link, or room number" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Agenda</label>
            <Textarea value={agenda} onChange={e => setAgenda(e.target.value)} rows={4} placeholder="1. Review QA metrics&#10;2. Peer review cases&#10;3. Action items follow-up" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={isPending} className="flex-1 text-white" style={{ background: BRAND }}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEdit ? "Save Changes" : "Schedule Meeting"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Attendee Form ────────────────────────────────────────────────────────

function AddAttendeeForm({ meetingId, onAdded }: { meetingId: number; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const addMutation = trpc.meeting.addAttendee.useMutation();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    try {
      await addMutation.mutateAsync({ meetingId, name: name.trim(), email: email.trim(), role: role.trim() || undefined });
      setName(""); setEmail(""); setRole("");
      onAdded();
      toast.success("Attendee added.");
    } catch {
      toast.error("Failed to add attendee.");
    }
  };

  return (
    <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end mt-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
      <div className="flex-1 min-w-[140px]">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Name *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required className="h-8 text-sm" />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@lab.com" required className="h-8 text-sm" />
      </div>
      <div className="w-32">
        <label className="block text-xs font-semibold text-gray-500 mb-1">Role</label>
        <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Sonographer" className="h-8 text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={addMutation.isPending} className="text-white h-8" style={{ background: BRAND }}>
        {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Add
      </Button>
    </form>
  );
}

// ─── Recording Upload Section ─────────────────────────────────────────────────

function RecordingUploadSection({ meetingId, onUploaded }: { meetingId: number; onUploaded: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getUploadUrl = trpc.meeting.getRecordingUploadUrl.useMutation();
  const confirmUpload = trpc.meeting.confirmRecordingUpload.useMutation();

  const handleFile = useCallback(async (file: File) => {
    const maxMB = 500;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${maxMB}MB.`);
      return;
    }
    const allowed = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm", "video/mp4", "video/webm", "video/quicktime", "video/x-ms-wmv", "video/avi", "video/x-msvideo", "audio/x-m4a"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|mp4|wav|ogg|webm|m4a|mov|wmv|avi)$/i)) {
      toast.error("Unsupported file type. Please upload an audio or video recording.");
      return;
    }

    setUploading(true);
    setProgress(10);
    try {
      const { recordingId, uploadUrl } = await getUploadUrl.mutateAsync({
        meetingId,
        fileName: file.name,
        mimeType: file.type || "audio/mpeg",
        fileSizeBytes: file.size,
      });
      setProgress(30);

      // Upload directly to S3
      const uploadResp = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "audio/mpeg" },
      });

      if (!uploadResp.ok) {
        // Fallback: use the URL as-is (S3 presigned PUT may already work)
        // Try confirming with the base URL
      }
      setProgress(70);

      // Confirm upload — use the base URL (strip query params for the stored URL)
      const finalUrl = uploadUrl.split("?")[0];
      await confirmUpload.mutateAsync({ recordingId, fileUrl: finalUrl });
      setProgress(100);
      toast.success("Recording uploaded successfully. You can now transcribe it.");
      onUploaded();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [meetingId, getUploadUrl, confirmUpload, onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-200 hover:border-[#189aa1]/50 hover:bg-gray-50"
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" className="hidden" accept="audio/*,video/*,.mp3,.mp4,.wav,.ogg,.webm,.m4a,.mov,.wmv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: BRAND }} />
            <p className="text-sm font-medium text-gray-600">Uploading recording... {progress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, background: BRAND }} />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-sm font-medium text-gray-600">Drop your Zoom or Teams recording here</p>
            <p className="text-xs text-gray-400">MP3, MP4, WAV, M4A, WebM, MOV · Max 500MB</p>
            <Button size="sm" variant="outline" className="mt-2">Browse Files</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Minutes Rich-Text Editor ─────────────────────────────────────────────────

function MinutesEditor({
  meetingId,
  initialHtml,
  onSaved,
}: {
  meetingId: number;
  initialHtml: string;
  onSaved: () => void;
}) {
  const saveMutation = trpc.meeting.saveMinutes.useMutation();
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[300px] p-4",
        style: "font-family: Arial, sans-serif; font-size: 12pt;",
      },
    },
  });

  const handleSave = async (finalize = false) => {
    if (!editor) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        meetingId,
        minutesHtml: editor.getHTML(),
        finalize,
      });
      toast.success(finalize ? "Minutes finalized and meeting marked complete." : "Minutes saved.");
      onSaved();
    } catch {
      toast.error("Failed to save minutes.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Meeting Minutes</title><style>body{font-family:Arial,sans-serif;font-size:12pt;margin:40px;} table{border-collapse:collapse;width:100%;} td,th{border:1px solid #ccc;padding:6px;} h2{color:#0e7490;}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`px-2 py-1 rounded text-xs font-bold ${editor?.isActive("bold") ? "bg-[#189aa1] text-white" : "hover:bg-gray-200"}`}>B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`px-2 py-1 rounded text-xs italic ${editor?.isActive("italic") ? "bg-[#189aa1] text-white" : "hover:bg-gray-200"}`}>I</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded text-xs ${editor?.isActive("heading", { level: 2 }) ? "bg-[#189aa1] text-white" : "hover:bg-gray-200"}`}>H2</button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded text-xs ${editor?.isActive("bulletList") ? "bg-[#189aa1] text-white" : "hover:bg-gray-200"}`}>• List</button>
        <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 rounded text-xs ${editor?.isActive("orderedList") ? "bg-[#189aa1] text-white" : "hover:bg-gray-200"}`}>1. List</button>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={handleExportPdf} className="h-7 text-xs gap-1">
            <Download className="w-3 h-3" /> Export PDF
          </Button>
        </div>
      </div>
      {/* Editor */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <EditorContent editor={editor} />
      </div>
      {/* Save buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving} className="text-white gap-1" style={{ background: BRAND }}>
          <CheckCircle className="w-3.5 h-3.5" />
          Finalize Minutes
        </Button>
      </div>
    </div>
  );
}

// ─── Meeting Detail Panel ─────────────────────────────────────────────────────

function MeetingDetail({
  meetingId,
  onBack,
  isDiyAdmin,
}: {
  meetingId: number;
  onBack: () => void;
  isDiyAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.meeting.get.useQuery({ meetingId });
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "attendees" | "recording" | "transcript" | "minutes">("overview");

  const removeAttendeeMutation = trpc.meeting.removeAttendee.useMutation();
  const updateAttendanceMutation = trpc.meeting.updateAttendance.useMutation();
  const transcribeMutation = trpc.meeting.transcribeRecording.useMutation();
  const generateMinutesMutation = trpc.meeting.generateMinutes.useMutation();
  const sendInvitesMutation = trpc.meeting.sendInvitations.useMutation();
  const updateMeetingMutation = trpc.meeting.update.useMutation();

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND }} />
    </div>
  );
  if (!data) return <div className="text-center py-10 text-gray-400">Meeting not found.</div>;

  const { meeting, attendees, recordings, transcripts, minutesDrafts } = data as {
    meeting: Meeting;
    attendees: Attendee[];
    recordings: Recording[];
    transcripts: Transcript[];
    minutesDrafts: MinutesDraft[];
  };

  const latestRecording = recordings[0];
  const latestTranscript = transcripts[0];
  const latestMinutes = minutesDrafts[0];
  const statusCfg = STATUS_CONFIG[meeting.status] ?? STATUS_CONFIG.scheduled;
  const presentCount = attendees.filter(a => a.attendanceStatus === "present").length;
  const acceptedCount = attendees.filter(a => a.rsvpStatus === "accepted").length;

  const handleTranscribe = async () => {
    if (!latestRecording) return;
    try {
      await transcribeMutation.mutateAsync({ recordingId: latestRecording.id });
      toast.success("Transcription complete!");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Transcription failed.");
    }
  };

  const handleGenerateMinutes = async () => {
    try {
      await generateMinutesMutation.mutateAsync({ meetingId });
      toast.success("AI minutes generated!");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate minutes.");
    }
  };

  const handleSendInvites = async () => {
    try {
      const result = await sendInvitesMutation.mutateAsync({ meetingId });
      toast.success(`Invitations sent to ${result.sent} attendee(s).`);
    } catch {
      toast.error("Failed to send invitations.");
    }
  };

  const handleMarkStatus = async (status: "in_progress" | "completed" | "cancelled") => {
    await updateMeetingMutation.mutateAsync({ meetingId, status });
    utils.meeting.list.invalidate();
    refetch();
    toast.success(`Meeting marked as ${STATUS_CONFIG[status]?.label ?? status}.`);
  };

  const TABS = [
    { id: "overview", label: "Overview", icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: "attendees", label: `Attendees (${attendees.length})`, icon: <Users className="w-3.5 h-3.5" /> },
    { id: "recording", label: "Recording", icon: <Mic className="w-3.5 h-3.5" /> },
    { id: "transcript", label: "Transcript", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "minutes", label: "Minutes", icon: <Edit3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-800 truncate" style={{ fontFamily: "Merriweather, serif" }}>
              {meeting.title}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: statusCfg.color, background: statusCfg.bg }}>
              {statusCfg.label}
            </span>
            {meeting.minutesFinalized && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Minutes Finalized</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(meeting.scheduledAt)}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(meeting.scheduledAt)} · {fmtDuration(meeting.durationMinutes)}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{presentCount}/{attendees.length} attended</span>
          </div>
        </div>
        {/* Quick actions */}
        {isDiyAdmin && meeting.status === "scheduled" && (
          <div className="flex gap-1 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={handleSendInvites} disabled={sendInvitesMutation.isPending} className="h-8 text-xs gap-1">
              <Send className="w-3 h-3" /> Send Invites
            </Button>
            <Button size="sm" onClick={() => handleMarkStatus("in_progress")} className="h-8 text-xs text-white gap-1" style={{ background: "#d97706" }}>
              <Video className="w-3 h-3" /> Start
            </Button>
          </div>
        )}
        {isDiyAdmin && meeting.status === "in_progress" && (
          <Button size="sm" onClick={() => handleMarkStatus("completed")} className="h-8 text-xs text-white gap-1 flex-shrink-0" style={{ background: "#15803d" }}>
            <CheckCircle className="w-3 h-3" /> End Meeting
          </Button>
        )}
      </div>

      {/* Meeting link banner */}
      {meeting.location && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#189aa1]/30 bg-[#f0fbfc]">
          <Video className="w-5 h-5 flex-shrink-0" style={{ color: BRAND }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-600">Meeting Link / Location</p>
            {meeting.location.startsWith("http") ? (
              <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="text-sm text-[#189aa1] hover:underline flex items-center gap-1 truncate">
                {meeting.location} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            ) : (
              <p className="text-sm text-gray-700">{meeting.location}</p>
            )}
          </div>
          {meeting.location.startsWith("http") && (
            <a href={meeting.location} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="text-white flex-shrink-0" style={{ background: BRAND }}>
                Join Meeting
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeSection === tab.id
                ? "border-[#189aa1] text-[#189aa1] bg-[#f0fbfc]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-1">

        {/* Overview */}
        {activeSection === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "RSVP Accepted", value: acceptedCount, total: attendees.length, color: "#15803d" },
                { label: "Attended", value: presentCount, total: attendees.length, color: BRAND },
                { label: "Recordings", value: recordings.length, color: "#6b7280" },
                { label: "Minutes", value: minutesDrafts.length > 0 ? (meeting.minutesFinalized ? "Finalized" : "Draft") : "None", color: minutesDrafts.length > 0 ? "#15803d" : "#9ca3af" },
              ].map(stat => (
                <div key={stat.label} className="p-3 rounded-xl border border-gray-100 bg-white">
                  <div className="text-xl font-bold" style={{ color: stat.color, fontFamily: "JetBrains Mono, monospace" }}>
                    {typeof stat.value === "number" && stat.total !== undefined ? `${stat.value}/${stat.total}` : stat.value}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {meeting.agenda && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Agenda</h3>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{meeting.agenda}</pre>
              </div>
            )}

            {/* Pipeline status */}
            <div className="p-4 rounded-xl border border-gray-100 bg-white">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Meeting Pipeline</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "Scheduled", done: true },
                  { label: "Invites Sent", done: attendees.some(a => a.inviteSentAt) },
                  { label: "Recording Uploaded", done: recordings.length > 0 },
                  { label: "Transcribed", done: transcripts.length > 0 },
                  { label: "Minutes Generated", done: minutesDrafts.length > 0 },
                  { label: "Minutes Finalized", done: !!meeting.minutesFinalized },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${step.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {step.done ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                      {step.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Attendees */}
        {activeSection === "attendees" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{attendees.length} invitee(s) · {acceptedCount} accepted · {presentCount} attended</p>
              {isDiyAdmin && (
                <Button size="sm" variant="outline" onClick={() => setShowAddAttendee(!showAddAttendee)} className="gap-1 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Attendee
                </Button>
              )}
            </div>
            {showAddAttendee && (
              <AddAttendeeForm meetingId={meetingId} onAdded={() => { refetch(); setShowAddAttendee(false); }} />
            )}
            {attendees.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No attendees added yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendees.map(att => {
                  const rsvp = RSVP_CONFIG[att.rsvpStatus] ?? RSVP_CONFIG.pending;
                  const attend = ATTENDANCE_CONFIG[att.attendanceStatus] ?? ATTENDANCE_CONFIG.unknown;
                  return (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: BRAND }}>
                        {att.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{att.name}</div>
                        <div className="text-xs text-gray-400">{att.email}{att.role ? ` · ${att.role}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: rsvp.color }}>
                        {rsvp.icon}<span className="hidden sm:inline">{rsvp.label}</span>
                      </div>
                      {isDiyAdmin && (
                        <Select
                          value={att.attendanceStatus}
                          onValueChange={async val => {
                            await updateAttendanceMutation.mutateAsync({ attendeeId: att.id, attendanceStatus: val as any });
                            refetch();
                          }}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <div className="flex items-center gap-1" style={{ color: attend.color }}>
                              {attend.icon}<span>{attend.label}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ATTENDANCE_CONFIG).map(([v, cfg]) => (
                              <SelectItem key={v} value={v}>
                                <div className="flex items-center gap-1.5" style={{ color: cfg.color }}>
                                  {cfg.icon}{cfg.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isDiyAdmin && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove ${att.name}?`)) return;
                            await removeAttendeeMutation.mutateAsync({ attendeeId: att.id });
                            refetch();
                          }}
                          className="text-gray-300 hover:text-red-400 flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recording */}
        {activeSection === "recording" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <p className="font-semibold mb-1">How to upload your Zoom or Teams recording:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>After your meeting ends, Zoom/Teams saves a local recording to your computer</li>
                <li>Find the recording file (usually .mp4 or .m4a) in your Downloads or Zoom folder</li>
                <li>Drag and drop it below, or click to browse</li>
                <li>Once uploaded, click "Transcribe" to generate a full transcript</li>
              </ol>
            </div>
            {isDiyAdmin && <RecordingUploadSection meetingId={meetingId} onUploaded={refetch} />}
            {recordings.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-700">Uploaded Recordings</h3>
                {recordings.map(rec => (
                  <div key={rec.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                    <Mic className="w-5 h-5 flex-shrink-0 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{rec.fileName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          rec.transcriptionStatus === "completed" ? "bg-green-100 text-green-700" :
                          rec.transcriptionStatus === "processing" ? "bg-yellow-100 text-yellow-700" :
                          rec.transcriptionStatus === "failed" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {rec.transcriptionStatus === "completed" ? "Transcribed" :
                           rec.transcriptionStatus === "processing" ? "Transcribing..." :
                           rec.transcriptionStatus === "failed" ? "Transcription Failed" : "Pending"}
                        </span>
                        {rec.durationSeconds && <span className="text-xs text-gray-400">{Math.round(rec.durationSeconds / 60)} min</span>}
                      </div>
                    </div>
                    {isDiyAdmin && rec.transcriptionStatus !== "completed" && rec.transcriptionStatus !== "processing" && (
                      <Button
                        size="sm"
                        onClick={handleTranscribe}
                        disabled={transcribeMutation.isPending}
                        className="text-white flex-shrink-0 gap-1"
                        style={{ background: BRAND }}
                      >
                        {transcribeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        Transcribe
                      </Button>
                    )}
                    {rec.transcriptionStatus === "processing" && (
                      <div className="flex items-center gap-1 text-xs text-yellow-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transcript */}
        {activeSection === "transcript" && (
          <div className="space-y-3">
            {transcripts.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No transcript yet. Upload a recording and click Transcribe.</p>
              </div>
            ) : (
              <>
                {latestTranscript && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-700">Full Transcript</h3>
                      <div className="flex gap-2">
                        {isDiyAdmin && !minutesDrafts.length && (
                          <Button size="sm" onClick={handleGenerateMinutes} disabled={generateMinutesMutation.isPending} className="text-white gap-1" style={{ background: BRAND }}>
                            {generateMinutesMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Generate Minutes
                          </Button>
                        )}
                        {isDiyAdmin && minutesDrafts.length > 0 && (
                          <Button size="sm" onClick={handleGenerateMinutes} disabled={generateMinutesMutation.isPending} variant="outline" className="gap-1">
                            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{latestTranscript.fullText}</pre>
                    </div>
                    <p className="text-xs text-gray-400">Language: {latestTranscript.language?.toUpperCase()} · {latestTranscript.durationSeconds ? `${Math.round(latestTranscript.durationSeconds / 60)} min` : ""}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Minutes */}
        {activeSection === "minutes" && (
          <div className="space-y-3">
            {minutesDrafts.length === 0 && transcripts.length === 0 && !meeting.agenda ? (
              <div className="text-center py-10 text-gray-400">
                <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No minutes yet. Upload and transcribe a recording, then generate AI minutes.</p>
              </div>
            ) : minutesDrafts.length === 0 ? (
              <div className="space-y-3">
                <div className="text-center py-6 text-gray-400">
                  <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm mb-3">No minutes generated yet.</p>
                  {isDiyAdmin && (
                    <Button onClick={handleGenerateMinutes} disabled={generateMinutesMutation.isPending} className="text-white gap-1" style={{ background: BRAND }}>
                      {generateMinutesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Generate AI Minutes
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700">Meeting Minutes</h3>
                    <p className="text-xs text-gray-400">
                      {latestMinutes?.isAiGenerated ? "AI-generated · " : ""}
                      Last updated {latestMinutes ? fmtDate(latestMinutes.createdAt) : ""}
                    </p>
                  </div>
                  {isDiyAdmin && (
                    <Button size="sm" onClick={handleGenerateMinutes} disabled={generateMinutesMutation.isPending} variant="outline" className="gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </Button>
                  )}
                </div>
                {isDiyAdmin ? (
                  <MinutesEditor
                    meetingId={meetingId}
                    initialHtml={meeting.minutesHtml ?? latestMinutes?.minutesHtml ?? ""}
                    onSaved={() => { refetch(); utils.meeting.list.invalidate(); }}
                  />
                ) : (
                  <div
                    className="prose max-w-none p-4 rounded-xl border border-gray-100 bg-white"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: "12pt" }}
                    dangerouslySetInnerHTML={{ __html: meeting.minutesHtml ?? latestMinutes?.minutesHtml ?? "" }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Meeting List ─────────────────────────────────────────────────────────────

function MeetingList({
  onSelect,
  isDiyAdmin,
}: {
  onSelect: (id: number) => void;
  isDiyAdmin: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "in_progress" | "completed" | "cancelled">("all");
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const { data: meetings, isLoading } = trpc.meeting.list.useQuery({ status: statusFilter });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Quality Meetings</h2>
          <p className="text-xs text-gray-500">Schedule, record, and document quality assurance meetings</p>
        </div>
        {isDiyAdmin && (
          <Button onClick={() => setShowCreate(true)} className="text-white gap-1" style={{ background: BRAND }}>
            <Plus className="w-4 h-4" /> Schedule Meeting
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        {(["all", "scheduled", "in_progress", "completed", "cancelled"] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              statusFilter === s ? "text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            style={statusFilter === s ? { background: BRAND } : {}}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND }} />
        </div>
      ) : !meetings?.length ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No meetings found.</p>
          {isDiyAdmin && <p className="text-xs mt-1">Click "Schedule Meeting" to create your first quality meeting.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {(meetings as Meeting[]).map(m => {
            const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.scheduled;
            const isPast = new Date(m.scheduledAt) < new Date();
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-[#f0fbfc] hover:border-[#189aa1]/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                  <Calendar className="w-5 h-5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800 truncate">{m.title}</span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {m.minutesFinalized && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Minutes ✓</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                    <span>{MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}</span>
                    <span>·</span>
                    <span>{fmtDate(m.scheduledAt)} at {fmtTime(m.scheduledAt)}</span>
                    <span>·</span>
                    <span>{fmtDuration(m.durationMinutes)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#189aa1] flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <MeetingFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => utils.meeting.list.invalidate()}
        />
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function QualityMeetingsTab({ isDiyAdmin }: { isDiyAdmin: boolean }) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [mainTab, setMainTab] = useState<"meetings" | "archive">("meetings");

  if (selectedMeetingId !== null) {
    return (
      <MeetingDetail
        meetingId={selectedMeetingId}
        onBack={() => setSelectedMeetingId(null)}
        isDiyAdmin={isDiyAdmin}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMainTab("meetings")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mainTab === "meetings"
              ? "bg-white shadow-sm text-[#189aa1] font-semibold"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Meetings
          </span>
        </button>
        <button
          onClick={() => setMainTab("archive")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mainTab === "archive"
              ? "bg-white shadow-sm text-[#189aa1] font-semibold"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Minutes Archive
          </span>
        </button>
      </div>

      {mainTab === "meetings" && (
        <MeetingList onSelect={setSelectedMeetingId} isDiyAdmin={isDiyAdmin} />
      )}
      {mainTab === "archive" && (
        <MeetingMinutesArchive />
      )}
    </div>
  );
}
