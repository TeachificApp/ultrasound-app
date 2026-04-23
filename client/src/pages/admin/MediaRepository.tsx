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
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: any;
  onClick: () => void;
}

function AssetCard({ asset, onClick }: AssetCardProps) {
  const mediaType = asset.mediaType as MediaType;
  const isPublic = asset.access === "public";

  return (
    <div
      className="border border-border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group bg-card"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground shrink-0">{MEDIA_TYPE_ICONS[mediaType]}</span>
          <span className="font-medium text-sm truncate">{asset.title}</span>
        </div>
        <Badge variant={isPublic ? "default" : "secondary"} className="shrink-0 text-xs">
          {isPublic ? <><Globe className="w-3 h-3 mr-1" />Public</> : <><Lock className="w-3 h-3 mr-1" />Private</>}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">{MEDIA_TYPE_LABELS[mediaType]}</Badge>
        {asset.currentVersion && (
          <span>v{asset.currentVersion.versionNumber} · {formatBytes(asset.currentVersion.fileSize)}</span>
        )}
      </div>

      {asset.tags && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{asset.tags}</p>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        {new Date(asset.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

// ─── Embed Code Panel ─────────────────────────────────────────────────────────

function EmbedPanel({ asset, token }: { asset: any; token?: string }) {
  const origin = getOrigin();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  const directUrl = `${origin}/media/${asset.slug}${tokenParam}`;
  const embedUrl = `${origin}/media/${asset.slug}/embed${tokenParam}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="480" frameborder="0" allowfullscreen loading="lazy" title="${asset.title.replace(/"/g, "&quot;")}"></iframe>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Direct Link</Label>
        <div className="flex gap-2 mt-1">
          <Input value={directUrl} readOnly className="text-xs font-mono" />
          <Button size="icon" variant="outline" onClick={() => copy(directUrl, "Direct link")}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" asChild>
            <a href={directUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Embed URL</Label>
        <div className="flex gap-2 mt-1">
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
            <div className="flex gap-2 flex-wrap mt-1">
              <Badge variant={isPublic ? "default" : "secondary"}>
                {isPublic ? <><Globe className="w-3 h-3 mr-1" />Public</> : <><Lock className="w-3 h-3 mr-1" />Private</>}
              </Badge>
              <Badge variant="outline">{MEDIA_TYPE_LABELS[asset.mediaType as MediaType]}</Badge>
              {asset.mimeType && <Badge variant="outline" className="font-mono text-xs">{asset.mimeType}</Badge>}
              {currentVersion && <span className="text-xs text-muted-foreground self-center">v{currentVersion.versionNumber} · {formatBytes(currentVersion.fileSize)}</span>}
            </div>
          </DialogHeader>

          <Tabs defaultValue="embed">
            <TabsList className="w-full">
              <TabsTrigger value="embed" className="flex-1"><Link className="w-3 h-3 mr-1" />Links & Embed</TabsTrigger>
              <TabsTrigger value="versions" className="flex-1"><History className="w-3 h-3 mr-1" />Versions ({versions.length})</TabsTrigger>
              <TabsTrigger value="access" className="flex-1"><Shield className="w-3 h-3 mr-1" />Access Control</TabsTrigger>
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
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.mediaRepo.listAssets.useQuery({
    search: search || undefined,
    mediaType: typeFilter !== "all" ? (typeFilter as MediaType) : undefined,
    access: accessFilter !== "all" ? (accessFilter as "public" | "private") : undefined,
    page,
    pageSize: 24,
  });

  const handleRefresh = () => {
    refetch();
    utils.mediaRepo.listAssets.invalidate();
  };

  const totalPages = data ? Math.ceil(data.total / 24) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Media Repository</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload and manage media files with version history, access control, and embed links.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />Upload File
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title or tag…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accessFilter} onValueChange={(v) => { setAccessFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All access" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All access</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats bar */}
      {data && (
        <p className="text-sm text-muted-foreground mb-4">
          {data.total} file{data.total !== 1 ? "s" : ""} {search || typeFilter !== "all" || accessFilter !== "all" ? "matching filters" : "total"}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
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
