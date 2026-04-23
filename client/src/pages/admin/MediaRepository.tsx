/**
 * MediaRepository.tsx
 * Platform-admin-only media repository management page.
 *
 * Features:
 * - Upload any file type (image, video, audio, PDF, HTML, SCORM, ZIP, LMS)
 * - Browse/search/filter all assets
 * - Version history with re-upload and restore
 * - Access control: public / private with email invite grants
 * - Copy direct link, embed code (iframe), and embed URL
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Globe,
  Lock,
  Copy,
  Code,
  Link,
  History,
  Trash2,
  Mail,
  RefreshCw,
  FileVideo,
  FileAudio,
  FileImage,
  FileText,
  File,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  RotateCcw,
  Shield,
  ShieldOff,
  ExternalLink,
  Folder,
  FolderOpen,
  BarChart2,
  Users,
  Monitor,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = "image" | "video" | "audio" | "document" | "html" | "scorm" | "zip" | "lms" | "other";

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: "Image", video: "Video", audio: "Audio", document: "Document",
  html: "HTML", scorm: "SCORM", zip: "ZIP", lms: "LMS", other: "Other",
};

const MEDIA_TYPE_ICONS: Record<MediaType, React.ReactNode> = {
  image: <FileImage className="w-4 h-4" />,
  video: <FileVideo className="w-4 h-4" />,
  audio: <FileAudio className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  html: <Code className="w-4 h-4" />,
  scorm: <File className="w-4 h-4" />,
  zip: <File className="w-4 h-4" />,
  lms: <File className="w-4 h-4" />,
  other: <File className="w-4 h-4" />,
};

// ─── Thumbnail Preview ───────────────────────────────────────────────────────

function AssetThumbnail({ asset }: { asset: any }) {
  const url = asset.currentVersion?.s3Url;
  const isImage = asset.mediaType === "image" || asset.mimeType?.startsWith("image/");
  const isVideo = asset.mediaType === "video" || asset.mimeType?.startsWith("video/");

  if (asset.thumbnailUrl) {
    return (
      <img
        src={asset.thumbnailUrl}
        alt={asset.title}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  if (isImage && url) {
    return (
      <img
        src={url}
        alt={asset.title}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  if (isVideo && url) {
    return (
      <video
        src={url}
        className="w-full h-full object-cover"
        muted
        preload="metadata"
        onLoadedMetadata={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 1; }}
      />
    );
  }
  const icons: Record<string, React.ReactNode> = {
    image: <FileImage className="w-6 h-6" />,
    video: <FileVideo className="w-6 h-6" />,
    audio: <FileAudio className="w-6 h-6" />,
    document: <FileText className="w-6 h-6" />,
    html: <Code className="w-6 h-6" />,
    scorm: <Monitor className="w-6 h-6" />,
    lms: <Monitor className="w-6 h-6" />,
  };
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground">
      {icons[asset.mediaType] ?? <File className="w-6 h-6" />}
    </div>
  );
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getOrigin(): string {
  return window.location.origin;
}

// ─── Upload Dialog ────────────────────────────────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingAssetId?: number;
  existingTitle?: string;
}

function UploadDialog({ open, onClose, onSuccess, existingAssetId, existingTitle }: UploadDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(existingTitle ?? "");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [access, setAccess] = useState<"public" | "private">("private");
  const [folderSlug, setFolderSlug] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: foldersData } = trpc.mediaRepo.listFoldersFull.useQuery();

  const isReupload = !!existingAssetId;

  const handleFile = (f: File) => {
    setFile(f);
    if (!isReupload && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [title, isReupload]);

  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file"); return; }
    if (!isReupload && !title.trim()) { toast.error("Title is required"); return; }
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!isReupload) {
        formData.append("title", title.trim());
        formData.append("description", description);
        formData.append("tags", tags);
        formData.append("access", access);
        if (folderSlug && folderSlug !== "none") formData.append("folder", folderSlug);
      }
      formData.append("notes", notes);
      if (existingAssetId) formData.append("assetId", String(existingAssetId));

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", "/api/upload-media-repo");
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      toast.success(isReupload ? "New version uploaded" : "File uploaded successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isReupload ? `Upload New Version — ${existingTitle}` : "Upload Media File"}</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          {file ? (
            <p className="text-sm font-medium">{file.name} <span className="text-muted-foreground">({formatBytes(file.size)})</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">Drag & drop any file, or click to browse<br /><span className="text-xs">Images, video, audio, PDF, HTML, SCORM, ZIP, LMS — up to 500 MB</span></p>
          )}
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {!isReupload && (
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Display title" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tags</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" />
              </div>
              <div>
                <Label>Access</Label>
                <Select value={access} onValueChange={(v) => setAccess(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (invite only)</SelectItem>
                    <SelectItem value="public">Public (anyone with link)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Folder</Label>
              <Select value={folderSlug} onValueChange={setFolderSlug}>
                <SelectTrigger><SelectValue placeholder="No folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder (uncategorized)</SelectItem>
                  {(foldersData ?? []).map((f: any) => (
                    <SelectItem key={f.id} value={f.slug}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label>Version Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this version" />
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? "Uploading…" : isReupload ? "Upload New Version" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}// ─── Asset Card ───────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: any;
  onClick: () => void;
}

function AssetCard({ asset, onClick }: AssetCardProps) {
  const mediaType = asset.mediaType as MediaType;
  const isPublic = asset.access === "public";

  return (
    <div
      className="border border-border rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group bg-card"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted overflow-hidden relative">
        <AssetThumbnail asset={asset} />
        <div className="absolute top-1.5 right-1.5">
          <Badge variant={isPublic ? "default" : "secondary"} className="text-xs py-0 px-1.5">
            {isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
          </Badge>
        </div>
      </div>
      {/* Info */}
      <div className="p-2.5">
        <p className="font-medium text-xs truncate mb-1">{asset.title}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{MEDIA_TYPE_ICONS[mediaType]}</span>
          <span>{MEDIA_TYPE_LABELS[mediaType]}</span>
          {asset.folder && (
            <span className="ml-auto truncate max-w-[80px] flex items-center gap-0.5">
              <Folder className="w-2.5 h-2.5 shrink-0" />{asset.folder.split("/").pop()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Embed Code Panel ─────────────────────────────────────────────────────────

function EmbedPanel({ asset, token }: { asset: any; token?: string }) {
  const origin = getOrigin();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  const displayUrl = `${origin}/media/${asset.slug}${tokenParam}`;
  const downloadUrl = `${origin}/media/${asset.slug}/download${tokenParam}`;
  const embedUrl = `${origin}/media/${asset.slug}/embed${tokenParam}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="480" frameborder="0" allowfullscreen loading="lazy" title="${asset.title.replace(/"/g, "&quot;")}"></iframe>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display Link</Label>
        <p className="text-xs text-muted-foreground mb-1">Opens and renders the file inline in the browser.</p>
        <div className="flex gap-2">
          <Input value={displayUrl} readOnly className="text-xs font-mono" />
          <Button size="icon" variant="outline" onClick={() => copy(displayUrl, "Display link")}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" asChild>
            <a href={displayUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Download Link</Label>
        <p className="text-xs text-muted-foreground mb-1">Forces the file to download to the user's device.</p>
        <div className="flex gap-2">
          <Input value={downloadUrl} readOnly className="text-xs font-mono" />
          <Button size="icon" variant="outline" onClick={() => copy(downloadUrl, "Download link")}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" asChild>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Embed URL</Label>
        <p className="text-xs text-muted-foreground mb-1">Use in an iframe — renders inline, no cookies required.</p>
        <div className="flex gap-2">
          <Input value={embedUrl} readOnly className="text-xs font-mono" />
          <Button size="icon" variant="outline" onClick={() => copy(embedUrl, "Embed URL")}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Embed Code (iframe)</Label>
        <div className="flex gap-2 mt-1">
          <Textarea value={iframeCode} readOnly className="text-xs font-mono resize-none" rows={3} />
          <Button size="icon" variant="outline" className="self-start" onClick={() => copy(iframeCode, "Embed code")}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Works cross-origin without third-party cookies. Token is embedded in the URL — no session required.
        </p>
      </div>
    </div>
  );
}

// ─── Analytics Panel ─────────────────────────────────────────────────────────

function AnalyticsPanel({ assetId }: { assetId: number }) {
  const { data, isLoading } = trpc.mediaRepo.getAnalytics.useQuery({ assetId });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading analytics…</div>;
  if (!data) return <div className="text-sm text-muted-foreground py-8 text-center">No data.</div>;

  const maxViews = Math.max(...(data.daily.map((d: any) => Number(d.views))), 1);

  return (
    <div className="space-y-5 mt-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Views", value: data.totalViews, icon: <Eye className="w-4 h-4" /> },
          { label: "Unique Viewers", value: data.uniqueViewers, icon: <Users className="w-4 h-4" /> },
          { label: "Embed Views", value: data.embedViews, icon: <Code className="w-4 h-4" /> },
          { label: "Direct Views", value: data.directViews, icon: <ExternalLink className="w-4 h-4" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
            <div className="text-primary">{icon}</div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {data.daily.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Daily Views — last 30 days</p>
          <div className="flex items-end gap-px h-20 bg-muted/30 rounded p-1">
            {data.daily.map((d: any) => (
              <div
                key={d.date}
                className="flex-1 bg-primary/70 rounded-sm"
                style={{ height: `${(Number(d.views) / maxViews) * 100}%`, minHeight: "2px" }}
                title={`${d.date}: ${d.views} views`}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No views in the last 30 days.</p>
      )}

      {data.topReferers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Top Referrers</p>
          <div className="space-y-1">
            {data.topReferers.slice(0, 5).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[220px] text-muted-foreground">{r.referer ?? "Direct"}</span>
                <Badge variant="secondary" className="ml-2 shrink-0">{r.views}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {Number(data.totalViews) === 0 && (
        <p className="text-xs text-muted-foreground text-center">Views are tracked when the embed or direct link is accessed.</p>
      )}
    </div>
  );
}

// ─── Asset Detail Dialog ──────────────────────────────────────────────────────

interface AssetDetailDialogProps {
  assetId: number | null;
  onClose: () => void;
  onRefresh: () => void;
}

function AssetDetailDialog({ assetId, onClose, onRefresh }: AssetDetailDialogProps) {
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("30");
  const [inviteMessage, setInviteMessage] = useState("");
  const [selectedToken, setSelectedToken] = useState<string | undefined>(undefined);

  const { data, refetch } = trpc.mediaRepo.getAsset.useQuery(
    { id: assetId! },
    { enabled: !!assetId }
  );
  const { data: foldersData } = trpc.mediaRepo.listFoldersFull.useQuery();
  const moveToFolderMutation = trpc.mediaRepo.moveAssetToFolder.useMutation({
    onSuccess: () => { toast.success("Folder updated"); refetch(); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const setAccessMutation = trpc.mediaRepo.setAccess.useMutation({
    onSuccess: () => { toast.success("Access updated"); refetch(); onRefresh(); },
  });

  const deleteMutation = trpc.mediaRepo.deleteAsset.useMutation({
    onSuccess: () => { toast.success("Asset deleted"); onClose(); onRefresh(); },
  });

  const restoreMutation = trpc.mediaRepo.restoreVersion.useMutation({
    onSuccess: () => { toast.success("Version restored"); refetch(); },
  });

  const inviteMutation = trpc.mediaRepo.inviteByEmail.useMutation({
    onSuccess: (res) => {
      toast.success(`Invite sent — access link sent to ${inviteEmail}`);
      setSelectedToken(res.token);
      setInviteEmail("");
      refetch();
    },
    onError: (e) => toast.error(`Failed to send invite: ${e.message}`),
  });

  const revokeMutation = trpc.mediaRepo.revokeGrant.useMutation({
    onSuccess: () => { toast.success("Grant revoked"); refetch(); },
  });

  if (!data) return null;
  const { asset, versions, grants } = data;
  const currentVersion = versions[0];
  const isPublic = asset.access === "public";

  return (
    <>
      <Dialog open={!!assetId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-lg">{asset.title}</DialogTitle>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={isPublic ? "outline" : "default"}
                  onClick={() => setAccessMutation.mutate({ id: asset.id, access: isPublic ? "private" : "public" })}
                >
                  {isPublic ? <><Lock className="w-3 h-3 mr-1" />Make Private</> : <><Globe className="w-3 h-3 mr-1" />Make Public</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReuploadOpen(true)}>
                  <RefreshCw className="w-3 h-3 mr-1" />Re-upload
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { if (confirm("Delete this asset? This cannot be undone.")) deleteMutation.mutate({ id: asset.id }); }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-1 items-center">
              <Badge variant={isPublic ? "default" : "secondary"}>
                {isPublic ? <><Globe className="w-3 h-3 mr-1" />Public</> : <><Lock className="w-3 h-3 mr-1" />Private</>}
              </Badge>
              <Badge variant="outline">{MEDIA_TYPE_LABELS[asset.mediaType as MediaType]}</Badge>
              {asset.mimeType && <Badge variant="outline" className="font-mono text-xs">{asset.mimeType}</Badge>}
              {currentVersion && <span className="text-xs text-muted-foreground self-center">v{currentVersion.versionNumber} · {formatBytes(currentVersion.fileSize)}</span>}
              {/* Folder assignment */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Select
                  value={asset.folder ?? "none"}
                  onValueChange={(v) => moveToFolderMutation.mutate({ assetId: asset.id, folderSlug: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-7 text-xs w-40">
                    <SelectValue placeholder="No folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {(foldersData ?? []).map((f: any) => (
                      <SelectItem key={f.id} value={f.slug}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="embed">
            <TabsList className="w-full">
              <TabsTrigger value="embed" className="flex-1"><Link className="w-3 h-3 mr-1" />Links & Embed</TabsTrigger>
              <TabsTrigger value="versions" className="flex-1"><History className="w-3 h-3 mr-1" />Versions ({versions.length})</TabsTrigger>
              <TabsTrigger value="access" className="flex-1"><Shield className="w-3 h-3 mr-1" />Access Control</TabsTrigger>
              <TabsTrigger value="analytics" className="flex-1"><BarChart2 className="w-3 h-3 mr-1" />Analytics</TabsTrigger>
            </TabsList>

            {/* Links & Embed */}
            <TabsContent value="embed" className="mt-4">
              {isPublic ? (
                <EmbedPanel asset={asset} />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                    <Lock className="w-4 h-4 inline mr-1" />
                    This asset is <strong>private</strong>. Links require a valid access token. Select a grant below to generate embed code for that recipient, or make the asset public.
                  </div>
                  {grants.filter(g => !g.revokedAt).length > 0 && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generate embed for grant</Label>
                      <div className="mt-2 space-y-1">
                        {grants.filter(g => !g.revokedAt).map(g => (
                          <button
                            key={g.id}
                            className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${selectedToken === g.token ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                            onClick={() => setSelectedToken(g.token)}
                          >
                            <span className="font-medium">{g.email}</span>
                            {g.expiresAt && <span className="text-xs text-muted-foreground ml-2">expires {new Date(g.expiresAt).toLocaleDateString()}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedToken && <EmbedPanel asset={asset} token={selectedToken} />}
                </div>
              )}
            </TabsContent>

            {/* Version History */}
            <TabsContent value="versions" className="mt-4">
              <div className="space-y-2">
                {versions.map((v, i) => (
                  <div key={v.id} className={`flex items-center gap-3 p-3 rounded-lg border ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">v{v.versionNumber}</span>
                        {i === 0 && <Badge className="text-xs">Current</Badge>}
                        <span className="text-xs text-muted-foreground truncate">{v.fileName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatBytes(v.fileSize)} · {new Date(v.createdAt).toLocaleString()}
                        {v.notes && <span className="ml-2 italic">"{v.notes}"</span>}
                      </div>
                    </div>
                    {i > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreMutation.mutate({ assetId: asset.id, versionId: v.id })}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />Restore
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <a href={v.s3Url} target="_blank" rel="noopener noreferrer">
                        <Eye className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Access Control */}
            <TabsContent value="access" className="mt-4 space-y-4">
              {isPublic ? (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-200">
                  <Globe className="w-4 h-4 inline mr-1" />
                  This asset is <strong>public</strong> — anyone with the link can view it. No invite tokens needed.
                </div>
              ) : (
                <>
                  {/* Invite form */}
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><Mail className="w-4 h-4" />Invite by Email</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Email address</Label>
                        <Input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="user@example.com"
                        />
                      </div>
                      <div>
                        <Label>Expires in (days, blank = never)</Label>
                        <Input
                          type="number"
                          value={inviteExpiry}
                          onChange={(e) => setInviteExpiry(e.target.value)}
                          placeholder="30"
                          min="1"
                          max="365"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Personal message (optional)</Label>
                      <Textarea
                        value={inviteMessage}
                        onChange={(e) => setInviteMessage(e.target.value)}
                        placeholder="Add a personal note to the invite email…"
                        rows={2}
                      />
                    </div>
                    <Button
                      onClick={() => inviteMutation.mutate({
                        assetId: asset.id,
                        email: inviteEmail,
                        expiresInDays: inviteExpiry ? parseInt(inviteExpiry) : undefined,
                        message: inviteMessage || undefined,
                      })}
                      disabled={!inviteEmail || inviteMutation.isPending}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      {inviteMutation.isPending ? "Sending…" : "Send Invite"}
                    </Button>
                  </div>

                  {/* Grants list */}
                  {grants.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Access Grants</h4>
                      <div className="space-y-2">
                        {grants.map(g => {
                          const isRevoked = !!g.revokedAt;
                          const isExpired = g.expiresAt && new Date(g.expiresAt) < new Date();
                          return (
                            <div key={g.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isRevoked ? "border-border opacity-50" : "border-border"}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{g.email}</span>
                                  {isRevoked && <Badge variant="destructive" className="text-xs">Revoked</Badge>}
                                  {!isRevoked && isExpired && <Badge variant="secondary" className="text-xs">Expired</Badge>}
                                  {!isRevoked && !isExpired && <Badge variant="default" className="text-xs bg-green-600">Active</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Sent {new Date(g.createdAt).toLocaleDateString()}
                                  {g.expiresAt && ` · Expires ${new Date(g.expiresAt).toLocaleDateString()}`}
                                  {g.firstUsedAt && ` · First used ${new Date(g.firstUsedAt).toLocaleDateString()}`}
                                </div>
                              </div>
                              {!isRevoked && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => revokeMutation.mutate({ grantId: g.id })}
                                  disabled={revokeMutation.isPending}
                                >
                                  <ShieldOff className="w-3 h-3 mr-1" />Revoke
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
            {/* Analytics */}
            <TabsContent value="analytics">
              <AnalyticsPanel assetId={asset.id} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {reuploadOpen && (
        <UploadDialog
          open={reuploadOpen}
          onClose={() => setReuploadOpen(false)}
          onSuccess={() => { refetch(); onRefresh(); }}
          existingAssetId={asset.id}
          existingTitle={asset.title}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MediaRepository() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [accessFilter, setAccessFilter] = useState<string>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const queryInput = {
    search: search || undefined,
    mediaType: typeFilter !== "all" ? (typeFilter as MediaType) : undefined,
    access: accessFilter !== "all" ? (accessFilter as "public" | "private") : undefined,
    folder: selectedFolder !== null ? selectedFolder : undefined,
    page,
    pageSize: 24,
  } as any;

  const { data, isLoading, refetch } = trpc.mediaRepo.listAssets.useQuery(queryInput);
  const { data: foldersData, refetch: refetchFolders } = trpc.mediaRepo.listFoldersFull.useQuery();

  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: number; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const createFolderMutation = trpc.mediaRepo.createFolder.useMutation({
    onSuccess: () => { refetchFolders(); setNewFolderName(""); setCreatingFolder(false); toast.success("Folder created"); },
    onError: (e) => toast.error(e.message),
  });
  const renameFolderMutation = trpc.mediaRepo.renameFolder.useMutation({
    onSuccess: () => { refetchFolders(); refetch(); setEditingFolder(null); toast.success("Folder renamed"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteFolderMutation = trpc.mediaRepo.deleteFolder.useMutation({
    onSuccess: () => { refetchFolders(); refetch(); if (selectedFolder) setSelectedFolder(null); toast.success("Folder deleted — assets moved to uncategorized"); },
    onError: (e) => toast.error(e.message),
  });

  const handleRefresh = () => {
    refetch();
    utils.mediaRepo.listAssets.invalidate();
  };

  const totalPages = data ? Math.ceil(data.total / 24) : 1;
  const folders = foldersData ?? [];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full min-h-screen relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Folder Sidebar */}
      <aside className={`
        fixed md:relative z-30 md:z-auto
        top-0 left-0 h-full md:h-auto
        w-64 md:w-56 shrink-0
        border-r border-border bg-card
        flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" /> Folders
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6"
              title="New folder"
              onClick={() => setCreatingFolder(true)}
            >
              <span className="text-lg leading-none">+</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6 md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* New folder input */}
        {creatingFolder && (
          <div className="p-2 border-b border-border flex gap-1">
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) createFolderMutation.mutate({ name: newFolderName.trim() });
                if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
              }}
            />
            <Button
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              onClick={() => newFolderName.trim() && createFolderMutation.mutate({ name: newFolderName.trim() })}
            >
              <span className="text-xs">✓</span>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* All Assets */}
          <button
            onClick={() => { setSelectedFolder(null); setPage(1); }}
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
              selectedFolder === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <Folder className="w-4 h-4" />
            <span className="flex-1">All Assets</span>
          </button>

          {/* Folder list */}
          {folders.map((f: any) => (
            <div key={f.id} className="group relative">
              {editingFolder?.id === f.id ? (
                <div className="flex gap-1 px-1">
                  <Input
                    autoFocus
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editFolderName.trim()) renameFolderMutation.mutate({ id: f.id, name: editFolderName.trim() });
                      if (e.key === "Escape") setEditingFolder(null);
                    }}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" disabled={!editFolderName.trim()} onClick={() => editFolderName.trim() && renameFolderMutation.mutate({ id: f.id, name: editFolderName.trim() })}>
                    <span className="text-xs">✓</span>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingFolder(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setSelectedFolder(f.slug); setPage(1); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                    selectedFolder === f.slug ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs opacity-60">{f.assetCount}</span>
                  {/* Edit / Delete buttons — visible on hover */}
                  <span className="hidden group-hover:flex items-center gap-0.5 ml-1">
                    <span
                      role="button"
                      className="p-0.5 rounded hover:bg-muted-foreground/20"
                      title="Rename"
                      onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: f.id, name: f.name }); setEditFolderName(f.name); }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H7v-3.414a2 2 0 01.586-1.414z" /></svg>
                    </span>
                    <span
                      role="button"
                      className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
                      title="Delete folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete folder "${f.name}"? Assets will be moved to uncategorized.`)) {
                          deleteFolderMutation.mutate({ id: f.id });
                        }
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
          ))}

          {folders.length === 0 && !creatingFolder && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No folders yet.<br />Click + to create one.</p>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger to open folder sidebar */}
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden w-8 h-8 shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Media Repository</h1>
              <p className="text-muted-foreground text-xs mt-0.5">
                {selectedFolder ? `Folder: ${selectedFolder}` : "All files"}
              </p>
            </div>
          </div>
          <Button onClick={() => setUploadOpen(true)} size="sm">
            <Upload className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Upload File</span><span className="sm:hidden">Upload</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by title or tag…"
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={(v) => { setAccessFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="All access" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All access</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {data && (
            <p className="text-xs text-muted-foreground mb-3">
              {data.total} file{data.total !== 1 ? "s" : ""} {search || typeFilter !== "all" || accessFilter !== "all" || selectedFolder ? "matching filters" : "total"}
            </p>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : data?.assets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No files found</p>
              <p className="text-sm mt-1">Upload your first file to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {data?.assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelectedAssetId(asset.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Upload dialog */}
      {uploadOpen && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={handleRefresh}
        />
      )}

      {/* Asset detail dialog */}
      <AssetDetailDialog
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

