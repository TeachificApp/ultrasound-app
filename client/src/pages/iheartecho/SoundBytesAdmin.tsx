/**
 * SoundBytes™ Admin — Platform Admin panel for creating, editing, and publishing
 * SoundBytes micro-lessons. Includes view analytics visible only to admins.
 */

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/uploadFile";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Play,
  Plus,
  Pencil,
  Trash2,
  Eye,
  BarChart2,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Crown,
  X,
  MessageCircle,
  Check,
  Ban,
  Reply,
  Send,
  ChevronDown,
  ChevronUp,
  Upload,
  Film,
  Image as ImageIcon,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "acs", label: "ACS" },
  { id: "adult_echo", label: "Adult Echo" },
  { id: "pediatric_echo", label: "Pediatric Echo" },
  { id: "fetal_echo", label: "Fetal Echo" },
  { id: "pocus", label: "POCUS" },
  { id: "physics", label: "Physics" },
  { id: "ecg", label: "ECG" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const CATEGORY_LABELS: Record<string, string> = {
  acs: "ACS",
  adult_echo: "Adult Echo",
  pediatric_echo: "Pediatric Echo",
  fetal_echo: "Fetal Echo",
  pocus: "POCUS",
  physics: "Physics",
  ecg: "ECG",
};

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  body: string;
  videoUrl: string;
  thumbnailUrl: string;
  category: CategoryId;
  sortOrder: number;
  displayViews: number;
  status: "draft" | "published";
}

const DEFAULT_FORM: FormState = {
  title: "",
  body: "",
  videoUrl: "",
  thumbnailUrl: "",
  category: "adult_echo",
  sortOrder: 0,
  displayViews: 0,
  status: "draft",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function SoundBytesAdmin() {
  const { user } = useAuth();
  // toast is imported from sonner directly
  const utils = trpc.useUtils();

  const [view, setView] = useState<"list" | "create" | "edit" | "analytics" | "discussions">("list");
  const [adminTab, setAdminTab] = useState<"soundbytes" | "discussions">("soundbytes");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  // Reply state: track which discussion has its reply form open and the reply body
  const [replyOpenId, setReplyOpenId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");

  // Upload state
  const [videoUploading, setVideoUploading] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [thumbDragOver, setThumbDragOver] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Guard: admin only
  if ((user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm">Admin access required.</p>
          <Link href="/">
            <Button variant="outline" className="mt-3">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: items = [], isLoading, refetch } = trpc.soundBytes.adminList.useQuery();
  const { data: viewerStats = [] } = trpc.soundBytes.adminViewerStats.useQuery(
    { soundByteId: analyticsId! },
    { enabled: analyticsId !== null }
  );

  // Discussions approval queue
  const { data: pendingDiscussions = [], isLoading: pendingLoading } = trpc.soundBytes.adminListPendingDiscussions.useQuery();
  const approveDiscussion = trpc.soundBytes.adminApproveDiscussion.useMutation({
    onSuccess: () => { toast.success("Comment approved and published."); utils.soundBytes.adminListPendingDiscussions.invalidate(); },
    onError: () => toast.error("Failed to approve comment."),
  });
  const rejectDiscussion = trpc.soundBytes.adminRejectDiscussion.useMutation({
    onSuccess: () => { toast.success("Comment rejected and removed."); utils.soundBytes.adminListPendingDiscussions.invalidate(); },
    onError: () => toast.error("Failed to reject comment."),
  });

  const handleFileUpload = useCallback(async (
    file: File,
    fileType: "video" | "thumbnail"
  ) => {
    const MAX_VIDEO_MB = 500;
    const MAX_IMG_MB = 20;
    const maxMB = fileType === "video" ? MAX_VIDEO_MB : MAX_IMG_MB;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`File too large. Max ${maxMB} MB for ${fileType === "video" ? "videos" : "images"}.`);
      return;
    }
    const setSaving = fileType === "video" ? setVideoUploading : setThumbUploading;
    setSaving(true);
    try {
      const folder = fileType === "video" ? "soundbytes/videos" : "soundbytes/thumbnails";
      const allowedTypes = fileType === "video" ? "video" : "image";
      const { url } = await uploadFile(file, folder, { maxMB, allowedTypes });
      if (fileType === "video") {
        setForm((p) => ({ ...p, videoUrl: url }));
        toast.success("Video uploaded and URL filled in.");
      } else {
        setForm((p) => ({ ...p, thumbnailUrl: url }));
        toast.success("Thumbnail uploaded and URL filled in.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  const submitReply = trpc.soundBytes.adminSubmitReply.useMutation({
    onSuccess: () => {
      toast.success("Reply posted.");
      setReplyOpenId(null);
      setReplyBody("");
    },
    onError: () => toast.error("Failed to post reply."),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createMutation = trpc.soundBytes.adminCreate.useMutation({
    onSuccess: () => {
      toast.success("SoundByte created — micro-lesson saved.");
      utils.soundBytes.adminList.invalidate();
      setView("list");
      setForm(DEFAULT_FORM);
    },
    onError: (e) => toast.error(e.message || "Failed to create."),
  });

  const updateMutation = trpc.soundBytes.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("SoundByte updated.");
      utils.soundBytes.adminList.invalidate();
      setView("list");
      setEditingId(null);
      setForm(DEFAULT_FORM);
    },
    onError: (e) => toast.error(e.message || "Failed to update."),
  });

  const deleteMutation = trpc.soundBytes.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("SoundByte deleted.");
      utils.soundBytes.adminList.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete."),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleEdit(item: (typeof items)[0]) {
    setForm({
      title: item.title,
      body: "",
      videoUrl: "",
      thumbnailUrl: "",
      category: item.category as CategoryId,
      sortOrder: item.sortOrder,
      displayViews: item.displayViews,
      status: item.status as "draft" | "published",
    });
    setEditingId(item.id);
    // Fetch full item for body/videoUrl
    utils.soundBytes.adminGetById.fetch({ id: item.id }).then((full) => {
      setForm((prev) => ({
        ...prev,
        body: full.body ?? "",
        videoUrl: full.videoUrl ?? "",
        thumbnailUrl: full.thumbnailUrl ?? "",
      }));
    });
    setView("edit");
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!form.videoUrl.trim()) {
      toast.error("Video URL is required.");
      return;
    }
    if (view === "create") {
      createMutation.mutate({
        ...form,
        thumbnailUrl: form.thumbnailUrl || undefined,
      });
    } else if (view === "edit" && editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        ...form,
        thumbnailUrl: form.thumbnailUrl || null,
      });
    }
  }

  function handleQuickPublish(id: number, currentStatus: string) {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    updateMutation.mutate({ id, status: newStatus });
  }

  // ── Analytics view ────────────────────────────────────────────────────────────

  if (view === "analytics" && analyticsId !== null) {
    const item = items.find((i) => i.id === analyticsId);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-6 max-w-4xl">
          <button
            onClick={() => { setView("list"); setAnalyticsId(null); }}
            className="flex items-center gap-1.5 text-sm text-[#189aa1] font-semibold mb-5 hover:opacity-80"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to SoundBytes
          </button>
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
            <h2 className="font-bold text-gray-800 text-base mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              {item?.title}
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {item?.trueViews ?? 0} true views</span>
              <span className="flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5" /> {item?.completions ?? 0} completions</span>
              <span className="flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-500" /> {item?.displayViews ?? 0} display views</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Viewer Log</h3>
            </div>
            {viewerStats.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No views recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-5 py-2 text-left">User ID</th>
                    <th className="px-5 py-2 text-left">Watched (s)</th>
                    <th className="px-5 py-2 text-left">Completed</th>
                    <th className="px-5 py-2 text-left">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {viewerStats.map((v) => (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-2 text-gray-600">{v.userId ?? "—"}</td>
                      <td className="px-5 py-2 text-gray-600">{v.watchedSeconds}s</td>
                      <td className="px-5 py-2">
                        {v.completed ? (
                          <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
                        ) : (
                          <span className="text-gray-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> In progress</span>
                        )}
                      </td>
                      <td className="px-5 py-2 text-gray-400 text-xs">
                        {new Date(v.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Create / Edit form ────────────────────────────────────────────────────────

  if (view === "create" || view === "edit") {
    const isEdit = view === "edit";
    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-6 max-w-3xl">
          <button
            onClick={() => { setView("list"); setEditingId(null); setForm(DEFAULT_FORM); }}
            className="flex items-center gap-1.5 text-sm text-[#189aa1] font-semibold mb-5 hover:opacity-80"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to SoundBytes
          </button>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2
              className="text-lg font-bold text-gray-800 mb-5"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              {isEdit ? "Edit SoundByte" : "New SoundByte"}
            </h2>

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Aortic Stenosis: Doppler Grading"
                  className="text-sm"
                />
              </div>

              {/* Category + Status row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as CategoryId }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "draft" | "published" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              {/* Video — upload zone + URL fallback */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Video *</label>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                  onDragLeave={() => setVideoDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setVideoDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file, "video");
                  }}
                  onClick={() => !videoUploading && videoInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-all ${
                    videoDragOver
                      ? "border-[#189aa1] bg-[#189aa1]/8"
                      : "border-gray-200 bg-gray-50 hover:border-[#189aa1]/50 hover:bg-[#189aa1]/5"
                  }`}
                >
                  {videoUploading ? (
                    <><Loader2 className="w-6 h-6 text-[#189aa1] animate-spin" /><span className="text-xs text-gray-500">Uploading video…</span></>
                  ) : form.videoUrl && !form.videoUrl.startsWith("http") ? null : form.videoUrl ? (
                    <>
                      <Film className="w-6 h-6 text-[#189aa1]" />
                      <span className="text-xs font-medium text-[#189aa1] text-center px-4 truncate max-w-full">
                        {form.videoUrl.length > 60 ? form.videoUrl.slice(0, 57) + "…" : form.videoUrl}
                      </span>
                      <span className="text-xs text-gray-400">Click or drop to replace</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">Drop video file here or click to browse</span>
                      <span className="text-xs text-gray-400">MP4, WebM, MOV, AVI, WMV — up to 500 MB</span>
                    </>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-ms-wmv,video/ogg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "video");
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* URL fallback */}
                <div className="mt-2 flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <Input
                    value={form.videoUrl}
                    onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
                    placeholder="Or paste YouTube, Vimeo, or direct video URL"
                    className="text-sm h-8"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Upload a file above, or paste a URL directly. Supports YouTube, Vimeo, or direct MP4/embed URLs.</p>
              </div>

              {/* Thumbnail — upload zone + URL fallback */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Thumbnail (optional)</label>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setThumbDragOver(true); }}
                  onDragLeave={() => setThumbDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setThumbDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file, "thumbnail");
                  }}
                  onClick={() => !thumbUploading && thumbInputRef.current?.click()}
                  className={`relative flex items-center justify-center gap-3 rounded-xl border-2 border-dashed py-4 cursor-pointer transition-all ${
                    thumbDragOver
                      ? "border-[#189aa1] bg-[#189aa1]/8"
                      : "border-gray-200 bg-gray-50 hover:border-[#189aa1]/50 hover:bg-[#189aa1]/5"
                  }`}
                >
                  {thumbUploading ? (
                    <><Loader2 className="w-5 h-5 text-[#189aa1] animate-spin" /><span className="text-xs text-gray-500">Uploading thumbnail…</span></>
                  ) : form.thumbnailUrl ? (
                    <>
                      <img
                        src={form.thumbnailUrl}
                        alt="Thumbnail preview"
                        className="w-16 h-10 object-cover rounded-md flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-[#189aa1]">Thumbnail set</span>
                        <span className="text-xs text-gray-400">Click or drop to replace</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-600">Drop image here or click to browse</span>
                        <span className="text-xs text-gray-400">JPEG, PNG, WebP — up to 20 MB</span>
                      </div>
                    </>
                  )}
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "thumbnail");
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* URL fallback */}
                <div className="mt-2 flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <Input
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                    placeholder="Or paste thumbnail image URL"
                    className="text-sm h-8"
                  />
                </div>
              </div>

              {/* Sort order + display views row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sort Order</label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="text-sm"
                    min={0}
                  />
                  <p className="text-xs text-gray-400 mt-1">Lower = appears first.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Display Views</label>
                  <Input
                    type="number"
                    value={form.displayViews}
                    onChange={(e) => setForm((p) => ({ ...p, displayViews: parseInt(e.target.value) || 0 }))}
                    className="text-sm"
                    min={0}
                  />
                  <p className="text-xs text-gray-400 mt-1">Cosmetic count shown to members.</p>
                </div>
              </div>

              {/* Rich text body */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Body (rich text)</label>
                <RichTextEditor
                  value={form.body}
                  onChange={(html) => setForm((p) => ({ ...p, body: html }))}
                  placeholder="Add clinical notes, key takeaways, or references…"
                  minHeight={200}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="text-white font-semibold"
                  style={{ background: "#189aa1" }}
                >
                  {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create SoundByte"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setView("list"); setEditingId(null); setForm(DEFAULT_FORM); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/platform-admin">
              <button className="flex items-center gap-1.5 text-sm text-[#189aa1] font-semibold hover:opacity-80">
                <ChevronLeft className="w-4 h-4" />
                Platform Admin
              </button>
            </Link>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#189aa115" }}
              >
                <Play className="w-4 h-4" style={{ color: "#189aa1" }} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  SoundBytes™ Admin
                </h1>
                <p className="text-xs text-gray-400">Manage premium micro-lesson videos</p>
              </div>
            </div>
          </div>
          {adminTab === "soundbytes" && (
            <Button
              onClick={() => { setForm(DEFAULT_FORM); setView("create"); }}
              className="text-white font-semibold text-sm flex items-center gap-1.5"
              style={{ background: "#189aa1" }}
            >
              <Plus className="w-4 h-4" />
              New SoundByte
            </Button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-5 border-b border-gray-100">
          <button
            onClick={() => setAdminTab("soundbytes")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              adminTab === "soundbytes"
                ? "border-[#189aa1] text-[#189aa1]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            SoundBytes
          </button>
          <button
            onClick={() => setAdminTab("discussions")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              adminTab === "discussions"
                ? "border-[#189aa1] text-[#189aa1]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Discussion Approvals
            {pendingDiscussions.length > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold" style={{ background: "#e11d48" }}>
                {pendingDiscussions.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Discussions approval queue ─────────────────────────────────── */}
        {adminTab === "discussions" && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {pendingLoading && (
              <div className="py-12 text-center text-gray-400 text-sm">Loading pending comments…</div>
            )}
            {!pendingLoading && pendingDiscussions.length === 0 && (
              <div className="py-16 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-200" />
                <p className="text-sm font-medium text-gray-500">No comments pending review.</p>
                <p className="text-xs text-gray-400 mt-1">All submitted discussions have been moderated.</p>
              </div>
            )}
                {!pendingLoading && pendingDiscussions.length > 0 && (
              <div className="divide-y divide-gray-50">
                {pendingDiscussions.map((d) => (
                  <div key={d.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* SoundByte context */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <Play className="w-3 h-3 text-[#189aa1]" />
                          <span className="text-xs font-semibold text-[#189aa1] truncate">
                            {(d as any).soundByteTitle ?? `SoundByte #${d.soundByteId}`}
                          </span>
                        </div>
                        {/* Author + time */}
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: "#189aa1" }}
                          >
                            {((d as any).userDisplayName || "M").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-800">
                              {(d as any).userDisplayName || "Member"}
                              {(d as any).userCredentials && (
                                <span className="text-gray-500 font-normal">, {(d as any).userCredentials}</span>
                              )}
                            </span>
                            <div className="text-xs text-gray-400">
                              {new Date(d.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        {/* Comment body */}
                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                          {d.body}
                        </p>

                        {/* Admin reply toggle */}
                        <button
                          onClick={() => {
                            if (replyOpenId === d.id) { setReplyOpenId(null); setReplyBody(""); }
                            else { setReplyOpenId(d.id); setReplyBody(""); }
                          }}
                          className="mt-2 flex items-center gap-1 text-xs text-[#189aa1] font-semibold hover:opacity-80 transition-opacity"
                        >
                          <Reply className="w-3 h-3" />
                          {replyOpenId === d.id ? (
                            <><ChevronUp className="w-3 h-3" /> Hide reply form</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" /> Reply as Admin</>
                          )}
                        </button>

                        {/* Admin reply form */}
                        {replyOpenId === d.id && (
                          <div className="mt-2 bg-[#f0fbfc] rounded-lg border border-[#189aa1]/20 p-3">
                            <textarea
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value)}
                              placeholder="Write an admin reply…"
                              rows={3}
                              className="w-full rounded-lg border border-[#189aa1]/20 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] resize-none"
                            />
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => {
                                  if (!replyBody.trim()) return;
                                  submitReply.mutate({ discussionId: d.id, body: replyBody.trim() });
                                }}
                                disabled={!replyBody.trim() || submitReply.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
                                style={{ background: "#189aa1" }}
                              >
                                <Send className="w-3 h-3" />
                                {submitReply.isPending ? "Posting…" : "Post Reply"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => approveDiscussion.mutate({ id: d.id })}
                          disabled={approveDiscussion.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectDiscussion.mutate({ id: d.id })}
                          disabled={rejectDiscussion.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SoundBytes list ────────────────────────────────────────────── */}
        {adminTab === "soundbytes" && (
          <>
        {/* Stats summary */}
        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total", value: items.length, color: "#189aa1" },
              { label: "Published", value: items.filter((i) => i.status === "published").length, color: "#16a34a" },
              { label: "Drafts", value: items.filter((i) => i.status === "draft").length, color: "#d97706" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {isLoading && (
            <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="py-16 text-center">
              <Play className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">No SoundBytes yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click "New SoundByte" to create your first micro-lesson.</p>
            </div>
          )}
          {!isLoading && items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Views</th>
                  <th className="px-4 py-3 text-right">Completions</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800 line-clamp-1">{item.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#189aa115", color: "#189aa1" }}
                      >
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleQuickPublish(item.id, item.status)}
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all hover:opacity-80 ${
                          item.status === "published"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                        title={item.status === "published" ? "Click to unpublish" : "Click to publish"}
                      >
                        {item.status === "published" ? (
                          <><CheckCircle2 className="w-3 h-3" /> Published</>
                        ) : (
                          <><Clock className="w-3 h-3" /> Draft</>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-semibold text-gray-800">{(item.trueViews ?? 0).toLocaleString()}</span>
                        <span className="text-xs text-gray-400">({(item.displayViews ?? 0).toLocaleString()} display)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{(item.completions ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setAnalyticsId(item.id); setView("analytics"); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#189aa1] hover:bg-[#189aa1]/10 transition-all"
                          title="View analytics"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMutation.mutate({ id: item.id })}
                              className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-0.5 rounded bg-red-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
