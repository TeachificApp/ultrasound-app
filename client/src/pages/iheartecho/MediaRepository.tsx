/*
  Media Repository — iHeartEcho™ Platform Admin
  ─────────────────────────────────────────────
  Features:
  - List view (default) and card/icon grid view with toggle
  - Folder sidebar for organizing assets by course, module, or topic
  - Recycle Bin — soft-deleted assets with restore and 30-day expiry
  - Chunked upload (5 MB chunks) for files of any size
  - Asset detail panel: metadata, versions, access rules, embed code
  - Analytics panel: view/play counts, daily breakdown chart, recent access log
  - Email invite for private assets
*/
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload,
  Folder,
  FolderPlus,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  File,
  Globe,
  Lock,
  Search,
  Copy,
  Mail,
  Eye,
  Code2,
  X,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Play,
  Download,
  UploadCloud,
  Trash2,
  AlertTriangle,
  ArchiveRestore,
  RotateCcw,
  LayoutList,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MediaType = "image" | "audio" | "video" | "html" | "scorm" | "zip" | "lms" | "document" | "other";
type AccessMode = "public" | "private";

interface AssetRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  mediaType: MediaType;
  originalFilename: string | null;
  tags: string[];
  accessMode: AccessMode;
  folderId: number | null;
  currentVersionId: number | null;
  currentVersionUrl: string | null;
  currentVersionMime: string | null;
  serveUrl: string;
  viewUrl: string;
  downloadUrl: string;
  embedUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FolderRow {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  sortOrder: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND = "#189aa1";

const MEDIA_TYPE_ICONS: Record<MediaType, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  html: Globe,
  scorm: Globe,
  zip: File,
  lms: Globe,
  document: FileText,
  other: File,
};

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  html: "HTML",
  scorm: "SCORM",
  zip: "ZIP",
  lms: "LMS",
  document: "Document",
  other: "Other",
};

const MEDIA_TYPE_BG: Record<MediaType, string> = {
  image: "#f0fbfc", video: "#1a2e3b", audio: "#f5f0ff", html: "#f0f9ff",
  scorm: "#f0f9ff", zip: "#fef9f0", lms: "#f0f9ff", document: "#fff5f0", other: "#f8fafc",
};

const MEDIA_TYPE_COLOR: Record<MediaType, string> = {
  image: BRAND, video: "#4ad9e0", audio: "#7c3aed", html: "#0891b2",
  scorm: "#0891b2", zip: "#d97706", lms: "#0891b2", document: "#e05d3a", other: "#64748b",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Direct-to-Forge upload:
 * 1. Ask server for a pre-authorized upload URL (no file data sent to server)
 * 2. Browser uploads file directly to Forge CDN using XHR (real-time progress)
 * 3. Notify server to register the completed upload
 *
 * The file only travels once: user's computer → Forge CDN.
 * No double-upload, no server memory pressure, no timeout issues.
 */
async function chunkedUpload(
  file: File,
  folder: string,
  onProgress: (pct: number) => void
): Promise<{ url: string; fileKey: string; sizeBytes: number }> {
  // Step 1: Get pre-authorized upload URL from server
  onProgress(1);
  const prepareRes = await fetch("/api/media-upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      folder,
    }),
  });
  if (!prepareRes.ok) {
    const errData = await prepareRes.json().catch(() => ({})) as { error?: string };
    throw new Error(errData.error ?? `Prepare failed (${prepareRes.status})`);
  }
  const { uploadUrl, fileKey, forgeApiKey } = await prepareRes.json() as {
    uploadUrl: string;
    fileKey: string;
    forgeApiKey: string;
  };

  // Step 2: Upload file directly to Forge using XHR for progress tracking
  const forgeUrl = await new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    // No credentials needed — we're going directly to Forge (different origin)
    xhr.withCredentials = false;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        // 1% reserved for prepare, 2% for register; 3-98% for actual upload
        onProgress(3 + Math.round((e.loaded / e.total) * 95));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url: string };
          resolve(data.url);
        } catch {
          reject(new Error("Invalid response from Forge storage"));
        }
      } else {
        let errMsg = `Storage upload failed (${xhr.status})`;
        try {
          const errData = JSON.parse(xhr.responseText);
          errMsg = errData.error ?? errMsg;
        } catch {
          if (xhr.responseText && xhr.responseText.length < 500) errMsg = xhr.responseText;
        }
        reject(new Error(errMsg));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out")));

    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${forgeApiKey}`);
    xhr.timeout = 60 * 60 * 1000; // 60 minute timeout for very large files
    xhr.send(form);
  });

  // Step 3: Register the completed upload with the server
  onProgress(99);
  const registerRes = await fetch("/api/media-upload/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      fileKey,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      url: forgeUrl,
    }),
  });
  if (!registerRes.ok) {
    const errData = await registerRes.json().catch(() => ({})) as { error?: string };
    throw new Error(errData.error ?? `Register failed (${registerRes.status})`);
  }
  const result = await registerRes.json() as { url: string; fileKey: string; sizeBytes: number };
  onProgress(100);
  return result;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────
function AssetThumbnail({ asset, size = "md" }: { asset: AssetRow; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  const Icon = MEDIA_TYPE_ICONS[asset.mediaType];
  const dim = size === "sm" ? "h-14 w-14" : size === "lg" ? "h-32 w-full" : "h-24 w-full";

  if (asset.mediaType === "image" && asset.currentVersionUrl && !imgError) {
    return (
      <div className={`${dim} overflow-hidden bg-gray-100 flex-shrink-0`}>
        <img
          src={asset.currentVersionUrl}
          alt={asset.title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  if (asset.mediaType === "video" && asset.currentVersionUrl) {
    return (
      <div className={`${dim} overflow-hidden bg-gray-900 flex-shrink-0 relative flex items-center justify-center`}>
        <video
          src={asset.currentVersionUrl}
          className="w-full h-full object-cover opacity-60"
          muted
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-8 h-8 text-white drop-shadow-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${dim} flex-shrink-0 flex items-center justify-center`}
      style={{ background: MEDIA_TYPE_BG[asset.mediaType] }}
    >
      <Icon className="w-8 h-8" style={{ color: MEDIA_TYPE_COLOR[asset.mediaType] }} />
    </div>
  );
}

// ─── Folder Sidebar ──────────────────────────────────────────────────────
function FolderSidebar({
  folders,
  selectedFolderId,
  showTrash,
  onSelectFolder,
  onSelectTrash,
  onCreateFolder,
  onDeleteFolder,
  assetCounts,
  trashCount,
}: {
  folders: FolderRow[];
  selectedFolderId: number | null | undefined;
  showTrash: boolean;
  onSelectFolder: (id: number | null | undefined) => void;
  onSelectTrash: () => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: number) => void;
  assetCounts: Record<string, number>;
  trashCount: number;
}) {
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const totalCount = Object.values(assetCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Folders</p>
        <button
          onClick={() => onSelectFolder(undefined)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            !showTrash && selectedFolderId === undefined ? "bg-[#f0fbfc] text-[#189aa1] font-semibold" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left truncate">All Assets</span>
          <span className="text-xs text-gray-400">{totalCount}</span>
        </button>
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            !showTrash && selectedFolderId === null ? "bg-[#f0fbfc] text-[#189aa1] font-semibold" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <File className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span className="flex-1 text-left truncate">Unfiled</span>
          <span className="text-xs text-gray-400">{assetCounts["null"] ?? 0}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
              !showTrash && selectedFolderId === folder.id ? "bg-[#f0fbfc] text-[#189aa1] font-semibold" : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => onSelectFolder(folder.id)}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
            <span className="flex-1 truncate">{folder.name}</span>
            <span className="text-xs text-gray-400">{assetCounts[folder.id] ?? 0}</span>
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 hover:text-red-500 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete folder "${folder.name}"? Assets will be moved to Unfiled.`)) {
                  onDeleteFolder(folder.id);
                }
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Trash */}
      <div className="px-2 pb-1 border-t border-gray-100 pt-2">
        <button
          onClick={onSelectTrash}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            showTrash ? "bg-red-50 text-red-600 font-semibold" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Trash2 className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left truncate">Recycle Bin</span>
          {trashCount > 0 && (
            <span className="text-xs text-red-400 font-medium">{trashCount}</span>
          )}
        </button>
      </div>
      <div className="p-2 border-t border-gray-100">
        {showNewFolder ? (
          <div className="flex gap-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  onCreateFolder(newFolderName.trim());
                  setNewFolderName("");
                  setShowNewFolder(false);
                }
                if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
              }}
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 px-2"
              style={{ background: BRAND }}
              onClick={() => {
                if (newFolderName.trim()) {
                  onCreateFolder(newFolderName.trim());
                  setNewFolderName("");
                  setShowNewFolder(false);
                }
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-gray-500 hover:text-[#189aa1]"
            onClick={() => setShowNewFolder(true)}
          >
            <FolderPlus className="w-3.5 h-3.5 mr-1" />
            New Folder
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Chart ──────────────────────────────────────────────────────────
function AnalyticsChart({ data }: { data: { date: string; serve: number; embed: number }[] }) {
  if (!data.length) {
    return <div className="h-24 flex items-center justify-center text-xs text-gray-400">No access data yet</div>;
  }
  const maxVal = Math.max(...data.map((d) => d.serve + d.embed), 1);
  return (
    <div className="flex items-end gap-0.5 h-20 w-full">
      {data.slice(-30).map((d) => {
        const total = d.serve + d.embed;
        const heightPct = (total / maxVal) * 100;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full rounded-sm"
              style={{ height: `${Math.max(heightPct, 4)}%`, background: BRAND, opacity: 0.8 }}
            />
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {d.date}: {total} views
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Asset Detail Panel ────────────────────────────────────────────────────────
function AssetDetailPanel({
  assetId,
  onClose,
  folders,
}: {
  assetId: number;
  onClose: () => void;
  folders: FolderRow[];
}) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"info" | "versions" | "access" | "analytics" | "embed">("info");
  const [inviteEmail, setInviteEmail] = useState("");
  const [embedWidth, setEmbedWidth] = useState("100%");
  const [embedHeight, setEmbedHeight] = useState("480px");
  const [copiedCode, setCopiedCode] = useState(false);

  const { data, isLoading } = trpc.media.getAsset.useQuery({ assetId });
  const { data: analytics } = trpc.media.getAssetAnalytics.useQuery({ assetId });
  const { data: embedData } = trpc.media.getEmbedCode.useQuery({ assetId, width: embedWidth, height: embedHeight });

  const promoteVersion = trpc.media.promoteVersion.useMutation({
    onSuccess: () => { toast.success("Version promoted"); utils.media.getAsset.invalidate({ assetId }); },
  });
  const inviteMutation = trpc.media.inviteByEmail.useMutation({
    onSuccess: () => { toast.success(`Invite sent to ${inviteEmail}`); setInviteEmail(""); utils.media.getAsset.invalidate({ assetId }); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMutation = trpc.media.revokeAccess.useMutation({
    onSuccess: () => { toast.success("Access revoked"); utils.media.getAsset.invalidate({ assetId }); },
  });
  const updateAsset = trpc.media.updateAsset.useMutation({
    onSuccess: () => { toast.success("Updated"); utils.media.getAsset.invalidate({ assetId }); },
  });
  const reExtractScorm = trpc.media.reExtractScorm.useMutation({
    onSuccess: (result) => {
      toast.success("Re-extracting package — opening view page now.");
      utils.media.getAsset.invalidate({ assetId });
      // The server cleared the sentinel and reset mediaType to "zip".
      // Opening the view URL will trigger the SSE loading page which runs extraction.
      const viewUrl = result?.viewUrl ?? data?.viewUrl;
      if (viewUrl) {
        window.open(viewUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (e) => toast.error(`Re-extraction failed: ${e.message}`),
  });

  // ── Upload new version state ────────────────────────────────────────────────
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNote, setVersionNote] = useState("");
  const [versionUploading, setVersionUploading] = useState(false);
  const [versionProgress, setVersionProgress] = useState(0);

  const handleVersionUpload = async () => {
    if (!versionFile) return;
    setVersionUploading(true);
    setVersionProgress(0);
    try {
      const { url, fileKey, sizeBytes } = await chunkedUpload(versionFile, "media-assets", setVersionProgress);
      await addVersionMutation.mutateAsync({
        assetId: asset.id,
        fileS3Url: url,
        fileS3Key: fileKey,
        mimeType: versionFile.type || "application/octet-stream",
        fileSizeBytes: sizeBytes,
        originalFilename: versionFile.name,
        changeNote: versionNote || undefined,
        promoteToActive: true,
      });
      setVersionFile(null);
      setVersionNote("");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setVersionUploading(false);
      setVersionProgress(0);
    }
  };

  const addVersionMutation = trpc.media.addVersion.useMutation({
    onSuccess: (result) => {
      toast.success(`Version ${result.versionNumber} uploaded and set as active`);
      utils.media.getAsset.invalidate({ assetId });
      utils.media.listAssets.invalidate();
    },
    onError: (e) => toast.error(`Upload failed: ${e.message}`),
  });

  // ── Delete state ────────────────────────────────────────────────────────────
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState(false);
  const [confirmDeleteVersionId, setConfirmDeleteVersionId] = useState<number | null>(null);

  const deleteAssetMutation = trpc.media.deleteAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset deleted");
      utils.media.listAssets.invalidate();
      onClose();
    },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  const deleteVersionMutation = trpc.media.deleteVersion.useMutation({
    onSuccess: () => {
      toast.success("Version deleted");
      setConfirmDeleteVersionId(null);
      utils.media.getAsset.invalidate({ assetId });
    },
    onError: (e) => {
      toast.error(e.message);
      setConfirmDeleteVersionId(null);
    },
  });

  const copyToClipboard = (text: string, label = "Copied!") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
      </div>
    );
  }

  const { asset, versions, accessRules, serveUrl, viewUrl, downloadUrl, embedUrl } = data;

  const tabs = [
    { id: "info" as const, label: "Info" },
    { id: "versions" as const, label: `Versions (${versions.length})` },
    { id: "access" as const, label: `Access (${accessRules.length})` },
    { id: "analytics" as const, label: "Analytics" },
    { id: "embed" as const, label: "Embed" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Modal header row: compact single-line */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-3 pb-3 border-b border-gray-100">
        <div className="flex-shrink-0">
          <AssetThumbnail asset={asset as unknown as AssetRow} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{asset.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge
              className="text-xs flex items-center gap-1 h-5 px-1.5"
              style={{ background: asset.accessMode === "public" ? "#10b981" : "#f59e0b", color: "#fff", border: "none" }}
            >
              {asset.accessMode === "public" ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
              {asset.accessMode === "public" ? "Public" : "Private"}
            </Badge>
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded font-mono">{asset.mediaType}</span>
            {versions[0] && <span className="text-xs text-gray-400">v{versions.length} · {versions[0]?.fileSizeBytes ? formatBytes(versions[0].fileSizeBytes) : ""}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2"
            onClick={() => updateAsset.mutate({ assetId: asset.id, accessMode: asset.accessMode === "public" ? "private" : "public" })}
          >
            {asset.accessMode === "public" ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {asset.accessMode === "public" ? "Make Private" : "Make Public"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 px-2"
            onClick={() => setActiveTab("versions")}
          >
            <UploadCloud className="w-3 h-3" /> New Version
          </Button>
        </div>
      </div>
      {/* Tabs — always visible, flex-shrink-0 */}
      <div className="flex-shrink-0 flex gap-0 border-b border-gray-100 px-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[#189aa1] text-[#189aa1]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* INFO */}
        {activeTab === "info" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Title</p>
              <p className="text-sm font-medium text-gray-800">{asset.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Filename</p>
              <div className="flex gap-1">
                <Input
                  defaultValue={asset.originalFilename ?? ""}
                  key={asset.originalFilename ?? ""}
                  className="h-7 text-xs"
                  placeholder="e.g. module-1.zip"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (asset.originalFilename ?? "")) {
                      updateAsset.mutate({ assetId: asset.id, originalFilename: val || null });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Used as the download filename. Press Enter or click away to save.</p>
            </div>
            {asset.description && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-600">{asset.description}</p>
              </div>
            )}
            {asset.tags && (asset.tags as string[]).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(asset.tags as string[]).map((tag) => (
                    <span key={tag} className="text-xs bg-[#f0fbfc] text-[#189aa1] px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Folder</p>
              <Select
                value={(asset.folderId ?? "none").toString()}
                onValueChange={(v) => updateAsset.mutate({ assetId: asset.id, folderId: v === "none" ? null : parseInt(v) })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unfiled —</SelectItem>
                  {folders.map((f) => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Access Mode</p>
              <Select
                value={asset.accessMode}
                onValueChange={(v) => updateAsset.mutate({ assetId: asset.id, accessMode: v as AccessMode })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (anyone with link)</SelectItem>
                  <SelectItem value="private">Private (email invite only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">View URL (opens inline in browser)</p>
              <div className="flex gap-1">
                <Input value={viewUrl ?? serveUrl} readOnly className="h-7 text-xs font-mono" />
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyToClipboard(viewUrl ?? serveUrl, "View URL copied")}>
                  <Copy className="w-3 h-3" />
                </Button>
                <a href={viewUrl ?? serveUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-7 px-2" title="Open in browser"><ExternalLink className="w-3 h-3" /></Button>
                </a>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Download URL (forces file download)</p>
              <div className="flex gap-1">
                <Input value={downloadUrl ?? (serveUrl + "/download")} readOnly className="h-7 text-xs font-mono" />
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyToClipboard(downloadUrl ?? (serveUrl + "/download"), "Download URL copied")}>
                  <Copy className="w-3 h-3" />
                </Button>
                <a href={downloadUrl ?? (serveUrl + "/download")} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="h-7 px-2" title="Download file"><Download className="w-3 h-3" /></Button>
                </a>
              </div>
            </div>
            {/* Re-extract button for SCORM/zip assets */}
            {(asset.mediaType === "scorm" || asset.mediaType === "zip" || asset.mediaType === "lms") && (
              <div>
                <p className="text-xs text-gray-500 mb-1">SCORM Package</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 w-full"
                  disabled={reExtractScorm.isPending}
                  onClick={() => reExtractScorm.mutate({ assetId: asset.id })}
                >
                  <RefreshCw className={`w-3 h-3 ${reExtractScorm.isPending ? "animate-spin" : ""}`} />
                  {reExtractScorm.isPending ? "Resetting…" : "Re-extract Package Files"}
                </Button>
                <p className="text-xs text-gray-400 mt-1">Clears the current extraction, then opens the view page which will stream live re-extraction progress.</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Embed URL</p>
              <div className="flex gap-1">
                <Input value={embedUrl} readOnly className="h-7 text-xs font-mono" />
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyToClipboard(embedUrl, "Embed URL copied")}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-400 space-y-0.5">
              <p>Created: {formatDate(asset.createdAt)}</p>
              <p>Updated: {formatDate(asset.updatedAt)}</p>
            </div>

            {/* Danger Zone */}
            <div className="border border-red-100 rounded-lg p-3 bg-red-50/50">
              <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Danger Zone
              </p>
              {!confirmDeleteAsset ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 w-full"
                  onClick={() => setConfirmDeleteAsset(true)}
                >
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  Move to Recycle Bin
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-700 font-medium">
                    Move &quot;{asset.title}&quot; to Recycle Bin? It will be permanently deleted after 30 days.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-red-600 hover:bg-red-700 text-white"
                      disabled={deleteAssetMutation.isPending}
                      onClick={() => deleteAssetMutation.mutate({ assetId: asset.id })}
                    >
                      {deleteAssetMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Yes, Move to Bin"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1"
                      onClick={() => setConfirmDeleteAsset(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VERSIONS */}
        {activeTab === "versions" && (
          <div className="space-y-4">
            {/* ── Upload New Version ─────────────────────────────────────────── */}
            <div className="border border-dashed border-[#189aa1]/40 rounded-lg p-4 bg-[#f0fbfc]/50">
              <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-[#189aa1]" />
                Upload New Version
              </p>
              {/* File drop zone */}
              <label className="block cursor-pointer">
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    versionFile ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-200 hover:border-[#189aa1]/50"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) setVersionFile(f);
                  }}
                >
                  {versionFile ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-[#189aa1] flex-shrink-0" />
                        <span className="text-xs text-gray-700 truncate">{versionFile.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">({formatBytes(versionFile.size)})</span>
                      </div>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                        onClick={(e) => { e.preventDefault(); setVersionFile(null); }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <UploadCloud className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Click or drag a file here</p>
                      <p className="text-xs text-gray-400 mt-0.5">Replaces active version — old versions are kept</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setVersionFile(f);
                  }}
                />
              </label>
              {/* Change note */}
              <Input
                placeholder="Change note (optional)"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                className="mt-2 h-8 text-xs"
                disabled={versionUploading}
              />
              {/* Progress bar */}
              {versionUploading && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#189aa1] transition-all duration-300 rounded-full"
                    style={{ width: `${versionProgress}%` }}
                  />
                </div>
              )}
              <Button
                className="mt-2 w-full h-8 text-xs"
                style={{ background: BRAND }}
                disabled={!versionFile || versionUploading}
                onClick={handleVersionUpload}
              >
                {versionUploading ? (
                  <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Uploading…</>
                ) : (
                  <><UploadCloud className="w-3 h-3 mr-1.5" /> Upload & Set as Active</>
                )}
              </Button>
            </div>

            {/* ── Version History ────────────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Version History</p>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`p-3 rounded-lg border text-xs ${
                      v.id === asset.currentVersionId ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">
                        v{v.versionNumber}
                        {v.id === asset.currentVersionId && (
                          <span className="ml-2 text-[#189aa1] font-bold">● Active</span>
                        )}
                      </span>
                      <span className="text-gray-400">{formatDate(v.createdAt)}</span>
                    </div>
                    <p className="text-gray-500 truncate">{v.originalFilename ?? "—"}</p>
                    <p className="text-gray-400">{formatBytes(v.fileSizeBytes)}</p>
                    {v.changeNote && <p className="text-gray-500 mt-1 italic">"{v.changeNote}"</p>}
                    {v.id !== asset.currentVersionId && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => promoteVersion.mutate({ assetId: asset.id, versionId: v.id })}
                        >
                          Revert to This Version
                        </Button>
                        {confirmDeleteVersionId === v.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-6 text-xs bg-red-600 hover:bg-red-700 text-white px-2"
                              disabled={deleteVersionMutation.isPending}
                              onClick={() => deleteVersionMutation.mutate({ assetId: asset.id, versionId: v.id })}
                            >
                              {deleteVersionMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Confirm"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => setConfirmDeleteVersionId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs text-red-500 border-red-200 hover:bg-red-50 px-2"
                            title="Delete this version"
                            onClick={() => setConfirmDeleteVersionId(v.id)}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACCESS */}
        {activeTab === "access" && (
          <div className="space-y-4">
            {asset.accessMode === "private" && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Invite by Email</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inviteEmail) {
                        inviteMutation.mutate({ assetId: asset.id, email: inviteEmail });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    style={{ background: BRAND }}
                    disabled={!inviteEmail || inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate({ assetId: asset.id, email: inviteEmail })}
                  >
                    <Mail className="w-3 h-3 mr-1" /> Invite
                  </Button>
                </div>
              </div>
            )}
            {accessRules.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                {asset.accessMode === "public" ? "Public asset — no invite rules needed" : "No invites sent yet"}
              </p>
            ) : (
              <div className="space-y-2">
                {accessRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                      rule.revokedAt ? "border-red-100 bg-red-50 opacity-60" : "border-gray-100 bg-white"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{rule.email}</p>
                      <p className="text-gray-400">
                        {rule.revokedAt
                          ? `Revoked ${formatDate(rule.revokedAt)}`
                          : rule.expiresAt
                          ? `Expires ${formatDate(rule.expiresAt)}`
                          : "No expiry"}
                      </p>
                    </div>
                    {!rule.revokedAt && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(`${serveUrl}?token=${rule.accessToken}`, "Private link copied")}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                          onClick={() => revokeMutation.mutate({ ruleId: rule.id })}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total Views", value: analytics.total, icon: Eye },
                { label: "Direct Serves", value: analytics.totalServe, icon: ExternalLink },
                { label: "Embed Loads", value: analytics.totalEmbed, icon: Code2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-[#f0fbfc] rounded-lg p-2.5 text-center">
                  <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: BRAND }} />
                  <p className="text-lg font-bold" style={{ color: BRAND }}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Last 30 Days</p>
              <AnalyticsChart data={analytics.dailyBreakdown} />
            </div>
            {analytics.recentAccess.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Recent Access</p>
                <div className="space-y-1">
                  {analytics.recentAccess.map((log) => (
                    <div key={log.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span
                        className="px-1.5 py-0.5 rounded text-white text-xs"
                        style={{ background: log.accessType === "embed" ? "#7c3aed" : BRAND }}
                      >
                        {log.accessType}
                      </span>
                      <span className="flex-1 truncate">{log.referer ?? log.ipAddress ?? "—"}</span>
                      <span className="text-gray-400 flex-shrink-0">
                        {new Date(log.accessedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* EMBED */}
        {activeTab === "embed" && embedData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Width</p>
                <Input value={embedWidth} onChange={(e) => setEmbedWidth(e.target.value)} className="h-8 text-xs" placeholder="100%" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Height</p>
                <Input value={embedHeight} onChange={(e) => setEmbedHeight(e.target.value)} className="h-8 text-xs" placeholder="480px" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Embed Code</p>
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                  {embedData.code}
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2 h-6 text-xs"
                  style={{ background: BRAND }}
                  onClick={() => {
                    copyToClipboard(embedData.code, "Embed code copied!");
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Preview</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50" style={{ height: "200px" }}>
                <iframe
                  src={embedData.embedUrl}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  title="Embed preview"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload Dialog ─────────────────────────────────────────────────────────────
function UploadDialog({
  open,
  onClose,
  folderId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  folderId?: number | null;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [accessMode, setAccessMode] = useState<AccessMode>("private");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createAsset = trpc.media.createAsset.useMutation({
    onSuccess: () => {
      toast.success("Asset uploaded successfully");
      onSuccess();
      onClose();
      resetForm();
    },
    onError: (e) => { toast.error(e.message); setUploading(false); setUploadProgress(0); },
  });

  function resetForm() {
    setTitle(""); setDescription(""); setTags(""); setAccessMode("private"); setFile(null); setUploading(false); setUploadProgress(0);
  }

  const handleFile = (f: File) => { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { url, fileKey, sizeBytes } = await chunkedUpload(file, "media-assets", setUploadProgress);
      createAsset.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        accessMode,
        folderId: folderId ?? undefined,
        fileS3Url: url,
        fileS3Key: fileKey,
        mimeType: file.type || undefined,
        fileSizeBytes: sizeBytes,
        originalFilename: file.name,
        changeNote: "Initial upload",
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" style={{ color: BRAND }} />
            Upload Media Asset
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              dragOver ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-200 hover:border-[#189aa1]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <File className="w-8 h-8" style={{ color: BRAND }} />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                </div>
                <button
                  className="ml-2 p-1 rounded hover:bg-red-50 text-red-400"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">Drop a file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Images, video, audio, PDF, HTML, ZIP</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Title *</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset title" className="h-9" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Description</p>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="h-9" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Tags (comma-separated)</p>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. TTE, Adult Echo, Module 3" className="h-9" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Access Mode</p>
            <Select value={accessMode} onValueChange={(v) => setAccessMode(v as AccessMode)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private (email invite only)</SelectItem>
                <SelectItem value="public">Public (anyone with link)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {uploadProgress < 3
                  ? "Preparing upload…"
                  : uploadProgress >= 98
                  ? "Finishing up…"
                  : "Uploading to storage…"}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%`, background: BRAND }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {uploadProgress < 3
                ? "Connecting to storage…"
                : uploadProgress >= 98
                ? "Registering file…"
                : `Uploading directly to CDN — ${uploadProgress}% complete`}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }} disabled={uploading}>Cancel</Button>
          <Button disabled={!file || !title.trim() || uploading} style={{ background: BRAND }} onClick={handleSubmit}>
            {uploading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
              : <><Upload className="w-4 h-4 mr-2" />Upload</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MediaRepository() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaType | "all">("all");
  const [accessFilter, setAccessFilter] = useState<AccessMode | "all">("all");
   const [selectedFolderId, setSelectedFolderId] = useState<number | null | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showFolderSidebar, setShowFolderSidebar] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    try { return (localStorage.getItem("mediaViewMode") as "list" | "grid") || "list"; } catch { return "list"; }
  });
  const [sortField, setSortField] = useState<"name" | "type" | "date" | "access">(() => {
    try { return (localStorage.getItem("mediaSortField") as any) || "name"; } catch { return "name"; }
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    try { return (localStorage.getItem("mediaSortDir") as any) || "asc"; } catch { return "asc"; }
  });
  const [showTrash, setShowTrash] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: assetsData, isLoading: assetsLoading, refetch: refetchAssets } = trpc.media.listAssets.useQuery({
    search: debouncedSearch || undefined,
    mediaType: mediaTypeFilter !== "all" ? mediaTypeFilter : undefined,
    accessMode: accessFilter !== "all" ? accessFilter : undefined,
    folderId: selectedFolderId,
    limit: 100,
    offset: 0,
  }, { enabled: !showTrash });

  const { data: deletedAssetsData, isLoading: trashLoading, refetch: refetchTrash } = trpc.media.listDeletedAssets.useQuery(
    undefined, { enabled: showTrash }
  );

  const restoreAsset = trpc.media.restoreAsset.useMutation({
    onSuccess: () => { toast.success("Asset restored"); refetchTrash(); refetchAssets(); },
    onError: (e) => toast.error(e.message),
  });

  const { data: folders = [], refetch: refetchFolders } = trpc.media.listFolders.useQuery();
  const { data: analyticsSummary } = trpc.media.getAnalyticsSummary.useQuery();

  const createFolder = trpc.media.createFolder.useMutation({
    onSuccess: () => { refetchFolders(); toast.success("Folder created"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteFolder = trpc.media.deleteFolder.useMutation({
    onSuccess: () => { refetchFolders(); refetchAssets(); toast.success("Folder deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const rawAssets: AssetRow[] = (assetsData?.assets ?? []) as AssetRow[];

  // Client-side tag filter (server handles title/filename search)
  const assets: AssetRow[] = rawAssets.filter((a) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    const inTitle = a.title?.toLowerCase().includes(q);
    const inFilename = a.originalFilename?.toLowerCase().includes(q);
    const inTags = (a.tags ?? []).some((t: string) => t.toLowerCase().includes(q));
    return inTitle || inFilename || inTags;
  });

  // Sort helper
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      const next = sortDir === "asc" ? "desc" : "asc";
      setSortDir(next);
      try { localStorage.setItem("mediaSortDir", next); } catch {}
    } else {
      setSortField(field);
      setSortDir("asc");
      try { localStorage.setItem("mediaSortField", field); localStorage.setItem("mediaSortDir", "asc"); } catch {}
    }
  };

  const sortedAssets = [...assets].sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") {
      cmp = (a.title ?? "").localeCompare(b.title ?? "");
    } else if (sortField === "type") {
      cmp = (a.mediaType ?? "").localeCompare(b.mediaType ?? "");
    } else if (sortField === "access") {
      cmp = (a.accessMode ?? "").localeCompare(b.accessMode ?? "");
    } else if (sortField === "date") {
      cmp = (a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt ?? 0).getTime())
          - (b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt ?? 0).getTime());
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  const total = assetsData?.total ?? 0;
  const deletedAssets = (deletedAssetsData ?? []) as unknown as Array<AssetRow & { daysRemaining: number }>;
  const trashCount = deletedAssets.length;
  // Build per-folder asset counts for the sidebar
  const assetCounts: Record<string, number> = { null: 0 };
  for (const a of assets) {
    if (a.folderId === null || a.folderId === undefined) {
      assetCounts["null"] = (assetCounts["null"] ?? 0) + 1;
    } else {
      assetCounts[a.folderId] = (assetCounts[a.folderId] ?? 0) + 1;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* ── Full-screen top bar ────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 100%)" }}
      >
        {/* Left: back link + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin">
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-xs font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Platform Admin</span>
            </button>
          </Link>
          <span className="text-white/30 hidden sm:inline">|</span>
          {/* Mobile: folder sidebar toggle */}
          <button
            className="sm:hidden flex-shrink-0 p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setShowFolderSidebar(true)}
            aria-label="Open folders"
          >
            <Folder className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-lg font-black text-white truncate" style={{ fontFamily: "Merriweather, serif" }}>
            Media Repository
          </h1>
          <span className="text-xs text-white/50 hidden sm:inline">{total} file{total !== 1 ? "s" : ""}</span>
        </div>
        {/* Right: toolbar buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* List/Grid toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/20">
            <button
              className={`h-8 w-8 flex items-center justify-center transition-colors ${
                viewMode === "list" ? "bg-[#189aa1] text-white" : "text-white/60 hover:bg-white/10"
              }`}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              className={`h-8 w-8 flex items-center justify-center transition-colors ${
                viewMode === "grid" ? "bg-[#189aa1] text-white" : "text-white/60 hover:bg-white/10"
              }`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Trash button */}
          <button
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors border ${
              showTrash
                ? "bg-red-500 text-white border-red-500"
                : "text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
            }`}
            onClick={() => { setShowTrash(!showTrash); setSelectedAssetId(null); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trash</span>
            {trashCount > 0 && <span className="bg-red-400 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{trashCount}</span>}
          </button>
          {/* Upload button */}
          <Button
            className="flex items-center gap-1.5 h-8 text-xs font-semibold"
            style={{ background: "#189aa1" }}
            onClick={() => setShowUpload(true)}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload File</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>
      </div>
      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile: Folder sidebar overlay */}
        {showFolderSidebar && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFolderSidebar(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-700">Folders</p>
                <button onClick={() => setShowFolderSidebar(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <FolderSidebar
                  folders={folders as FolderRow[]}
                  selectedFolderId={selectedFolderId}
                  showTrash={showTrash}
                  onSelectFolder={(id) => { setSelectedFolderId(id); setShowTrash(false); setShowFolderSidebar(false); }}
                  onSelectTrash={() => { setShowTrash(true); setSelectedAssetId(null); setShowFolderSidebar(false); }}
                  onCreateFolder={(name) => createFolder.mutate({ name })}
                  onDeleteFolder={(id) => deleteFolder.mutate({ folderId: id })}
                  assetCounts={assetCounts}
                  trashCount={trashCount}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mobile: Detail panel overlay */}
        {selectedAssetId && showDetailPanel && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowDetailPanel(false); setSelectedAssetId(null); }} />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl flex flex-col overflow-hidden">
              <AssetDetailPanel
                assetId={selectedAssetId}
                onClose={() => { setShowDetailPanel(false); setSelectedAssetId(null); }}
                folders={folders as FolderRow[]}
              />
            </div>
          </div>
        )}

        {/* Body: sidebar + main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop folder sidebar — hidden on mobile */}
          <div className="hidden sm:flex">
            <FolderSidebar
              folders={folders as FolderRow[]}
              selectedFolderId={selectedFolderId}
              showTrash={showTrash}
              onSelectFolder={(id) => { setSelectedFolderId(id); setShowTrash(false); }}
              onSelectTrash={() => { setShowTrash(true); setSelectedAssetId(null); }}
              onCreateFolder={(name) => createFolder.mutate({ name })}
              onDeleteFolder={(id) => deleteFolder.mutate({ folderId: id })}
              assetCounts={assetCounts}
              trashCount={trashCount}
            />
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Asset panel */}
            <div className={`flex flex-col flex-1 overflow-hidden ${selectedAssetId ? "sm:border-r sm:border-gray-100" : ""}`}>
              {/* Filter / toolbar bar */}
              <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-gray-100 bg-white flex-wrap">
                {!showTrash && (
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search assets…"
                      className="pl-8 pr-7 h-8 text-sm"
                    />
                    {search && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {showTrash && (
                  <p className="flex-1 text-sm font-semibold text-red-600 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> Recycle Bin
                    <span className="text-xs font-normal text-gray-400 ml-1">Items are permanently deleted after 30 days</span>
                  </p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!showTrash && (
                    <>
                      <Select value={mediaTypeFilter} onValueChange={(v) => setMediaTypeFilter(v as any)}>
                        <SelectTrigger className="h-8 w-28 sm:w-36 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          {(Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).map((t) => (
                            <SelectItem key={t} value={t}>{MEDIA_TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={accessFilter} onValueChange={(v) => setAccessFilter(v as any)}>
                        <SelectTrigger className="h-8 w-24 sm:w-32 text-xs"><SelectValue placeholder="All access" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All access</SelectItem>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetchAssets()}>
                        <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                    </>
                  )}
                  {showTrash && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetchTrash()}>
                      <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                  )}

                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Trash view ──────────────────────────────────────────── */}
                {showTrash && (
                  <div className="p-2 sm:p-4">
                    {trashLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
                      </div>
                    ) : deletedAssets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Trash2 className="w-10 h-10 text-gray-200 mb-3" />
                        <p className="text-sm font-medium text-gray-500">Recycle Bin is empty</p>
                        <p className="text-xs text-gray-400 mt-1">Deleted assets appear here for 30 days</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 w-8"></th>
                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Name</th>
                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 hidden sm:table-cell">Type</th>
                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 hidden md:table-cell">Expires in</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deletedAssets.map((asset) => {
                            const Icon = MEDIA_TYPE_ICONS[asset.mediaType];
                            return (
                              <tr key={asset.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-2">
                                  <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: MEDIA_TYPE_BG[asset.mediaType] }}>
                                    <Icon className="w-3.5 h-3.5" style={{ color: MEDIA_TYPE_COLOR[asset.mediaType] }} />
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <p className="text-sm font-medium text-gray-700">{asset.title}</p>
                                  {asset.originalFilename && (
                                    <p className="text-xs text-gray-400">{asset.originalFilename}</p>
                                  )}
                                </td>
                                <td className="py-2 px-2 hidden sm:table-cell">
                                  <span className="text-xs text-gray-500 capitalize">{asset.mediaType}</span>
                                </td>
                                <td className="py-2 px-2 hidden md:table-cell">
                                  <span className={`text-xs font-medium ${
                                    asset.daysRemaining <= 3 ? "text-red-500" : "text-gray-500"
                                  }`}>
                                    {asset.daysRemaining}d
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1.5 text-[#189aa1] border-[#189aa1]/30 hover:bg-[#f0fbfc]"
                                    disabled={restoreAsset.isPending}
                                    onClick={() => restoreAsset.mutate({ assetId: asset.id })}
                                  >
                                    <ArchiveRestore className="w-3 h-3" /> Restore
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ── Normal assets view ──────────────────────────────────── */}
                {!showTrash && (
                  <>
                    {assetsLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
                      </div>
                    ) : assets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Upload className="w-10 h-10 text-gray-200 mb-3" />
                        <p className="text-sm font-medium text-gray-500">No assets found</p>
                        <p className="text-xs text-gray-400 mt-1">Upload your first asset to get started</p>
                        <Button size="sm" className="mt-3" style={{ background: BRAND }} onClick={() => setShowUpload(true)}>
                          <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Asset
                        </Button>
                      </div>
                    ) : viewMode === "list" ? (
                      /* ── List view (Windows-style) ── */
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 w-8"></th>
                            <th
                              className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-[#189aa1] transition-colors"
                              onClick={() => handleSort("name")}
                            >
                              <span className="inline-flex items-center gap-1">
                                Name
                                {sortField === "name" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronUp className="w-3 h-3 opacity-20" />}
                              </span>
                            </th>
                            <th
                              className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 hidden sm:table-cell w-24 cursor-pointer select-none hover:text-[#189aa1] transition-colors"
                              onClick={() => handleSort("type")}
                            >
                              <span className="inline-flex items-center gap-1">
                                Type
                                {sortField === "type" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronUp className="w-3 h-3 opacity-20" />}
                              </span>
                            </th>
                            <th
                              className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 hidden md:table-cell w-20 cursor-pointer select-none hover:text-[#189aa1] transition-colors"
                              onClick={() => handleSort("access")}
                            >
                              <span className="inline-flex items-center gap-1">
                                Access
                                {sortField === "access" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronUp className="w-3 h-3 opacity-20" />}
                              </span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 hidden lg:table-cell w-20">Size</th>
                            <th
                              className="text-left py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 hidden xl:table-cell w-28 cursor-pointer select-none hover:text-[#189aa1] transition-colors"
                              onClick={() => handleSort("date")}
                            >
                              <span className="inline-flex items-center gap-1">
                                Modified
                                {sortField === "date" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronUp className="w-3 h-3 opacity-20" />}
                              </span>
                            </th>
                            <th className="text-right py-2 px-2 sm:px-3 text-xs font-semibold text-gray-500 w-28">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAssets.length === 0 && !assetsLoading ? (
                            <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                              {debouncedSearch ? `No results for "${debouncedSearch}"` : "No files in this folder"}
                            </td></tr>
                          ) : sortedAssets.map((asset) => {
                            const Icon = MEDIA_TYPE_ICONS[asset.mediaType];
                            const views = (analyticsSummary as any)?.[asset.id]?.total ?? 0;
                            const isSelected = selectedAssetId === asset.id;
                            return (
                              <tr
                                key={asset.id}
                                className={`border-b border-gray-50 cursor-pointer transition-colors ${
                                  isSelected ? "bg-[#f0fbfc]" : "hover:bg-gray-50"
                                }`}
                                onClick={() => {
                                  if (isSelected) { setSelectedAssetId(null); setShowDetailPanel(false); }
                                  else { setSelectedAssetId(asset.id); setShowDetailPanel(true); }
                                }}
                              >
                                <td className="py-1.5 px-2 sm:px-3">
                                  <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: MEDIA_TYPE_BG[asset.mediaType] }}>
                                    <Icon className="w-3.5 h-3.5" style={{ color: MEDIA_TYPE_COLOR[asset.mediaType] }} />
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 sm:px-3">
                                  <p className="text-sm font-medium text-gray-800 leading-snug">{asset.title}</p>
                                  {asset.originalFilename && asset.originalFilename !== asset.title && (
                                    <p className="text-xs text-gray-400 leading-tight">{asset.originalFilename}</p>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 sm:px-3 hidden sm:table-cell">
                                  <span className="text-xs text-gray-500 capitalize">{MEDIA_TYPE_LABELS[asset.mediaType]}</span>
                                </td>
                                <td className="py-1.5 px-2 sm:px-3 hidden md:table-cell">
                                  {asset.accessMode === "public"
                                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Globe className="w-3 h-3" />Public</span>
                                    : <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Lock className="w-3 h-3" />Private</span>
                                  }
                                </td>
                                <td className="py-1.5 px-2 sm:px-3 hidden lg:table-cell">
                                  <span className="text-xs text-gray-500">—</span>
                                </td>
                                <td className="py-1.5 px-2 sm:px-3 hidden xl:table-cell">
                                  <span className="text-xs text-gray-500">{formatDate(asset.updatedAt)}</span>
                                </td>
                                <td className="py-1.5 px-2 sm:px-3 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1">
                                    {views > 0 && (
                                      <span className="text-xs text-gray-400 flex items-center gap-0.5 mr-1">
                                        <Eye className="w-3 h-3" />{views}
                                      </span>
                                    )}
                                    <a href={asset.viewUrl ?? asset.serveUrl} target="_blank" rel="noopener noreferrer" title="View">
                                      <button className="h-7 w-7 flex items-center justify-center rounded border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1] text-gray-400 transition-colors">
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    </a>
                                    <a href={asset.downloadUrl ?? (asset.serveUrl + "/download")} target="_blank" rel="noopener noreferrer" title="Download">
                                      <button className="h-7 w-7 flex items-center justify-center rounded border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1] text-gray-400 transition-colors">
                                        <Download className="w-3 h-3" />
                                      </button>
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      /* ── Grid / icon view ── */
                      <div className="p-2 sm:p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                          {sortedAssets.map((asset) => {
                            const views = (analyticsSummary as any)?.[asset.id]?.total ?? 0;
                            const isSelected = selectedAssetId === asset.id;
                            return (
                              <div
                                key={asset.id}
                                className={`group rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                                  isSelected
                                    ? "border-[#189aa1] shadow-md ring-1 ring-[#189aa1]/20"
                                    : "border-gray-100 hover:border-gray-200"
                                } bg-white overflow-hidden`}
                                onClick={() => {
                                  if (isSelected) { setSelectedAssetId(null); setShowDetailPanel(false); }
                                  else { setSelectedAssetId(asset.id); setShowDetailPanel(true); }
                                }}
                              >
                                <AssetThumbnail asset={asset} size="lg" />
                                <div className="p-2 sm:p-2.5">
                                  <p className="text-xs font-semibold text-gray-800 leading-snug">{asset.title}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-gray-400 capitalize">{asset.mediaType}</span>
                                    <div className="flex items-center gap-1">
                                      {asset.accessMode === "public"
                                        ? <Globe className="w-3 h-3 text-emerald-500" />
                                        : <Lock className="w-3 h-3 text-amber-500" />
                                      }
                                      {views > 0 && (
                                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                          <Eye className="w-2.5 h-2.5" />{views}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 mt-1.5 sm:mt-2" onClick={(e) => e.stopPropagation()}>
                                    <a href={asset.viewUrl ?? asset.serveUrl} target="_blank" rel="noopener noreferrer" title="View in browser" className="flex-1">
                                      <button className="w-full flex items-center justify-center gap-1 text-xs py-1 rounded border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1] text-gray-500 transition-colors min-h-[32px]">
                                        <ExternalLink className="w-3 h-3" /> View
                                      </button>
                                    </a>
                                    <a href={asset.downloadUrl ?? (asset.serveUrl + "/download")} target="_blank" rel="noopener noreferrer" title="Download file" className="flex-1">
                                      <button className="w-full flex items-center justify-center gap-1 text-xs py-1 rounded border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1] text-gray-500 transition-colors min-h-[32px]">
                                        <Download className="w-3 h-3" /> <span className="hidden sm:inline">Download</span><span className="sm:hidden">DL</span>
                                      </button>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        folderId={typeof selectedFolderId === "number" ? selectedFolderId : undefined}
        onSuccess={() => refetchAssets()}
      />
      {/* ── Asset Detail Modal ────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedAssetId}
        onOpenChange={(open) => { if (!open) { setSelectedAssetId(null); setShowDetailPanel(false); } }}
      >
        <DialogContent
          className="max-w-4xl w-full p-0 overflow-hidden"
          style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>View and manage asset settings, versions, access, and embed code.</DialogDescription>
          </DialogHeader>
          {selectedAssetId && (
            <AssetDetailPanel
              assetId={selectedAssetId}
              onClose={() => { setSelectedAssetId(null); setShowDetailPanel(false); }}
              folders={folders as FolderRow[]}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
