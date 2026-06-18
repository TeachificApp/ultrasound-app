/**
 * TeachDashboard.tsx — TEACH workspace for LMS Instructors and EducatorAssist™ educators.
 * Route: /teach
 */
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Presentation, Upload, Plus, FolderOpen, GraduationCap, Building2,
  Loader2, Pencil, Play, Trash2, Copy, Lock, LayoutTemplate,
  FolderPlus, Folder, MoreVertical, RotateCcw, ChevronRight,
  Home, FileText, Film, FileIcon,
} from "lucide-react";

type FolderItem = { id: number; name: string; parentId: number | null; ownerUserId: number };
type Material = {
  id: number; title: string; materialType: string; ownerContext: string;
  status: string; isOwner: boolean; folderId: number | null; folderName: string | null;
  trashedAt: Date | null; ownerUserId?: number;
};

function materialIcon(type: string) {
  if (type === "presentation") return <Presentation className="w-4 h-4 text-teal-600" />;
  if (type === "media") return <Film className="w-4 h-4 text-purple-500" />;
  if (type === "document") return <FileText className="w-4 h-4 text-blue-500" />;
  return <FileIcon className="w-4 h-4 text-gray-400" />;
}

export default function TeachDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [ownerContext, setOwnerContext] = useState<"lms_instructor" | "educator_assist">("lms_instructor");
  const [educatorOrgId, setEducatorOrgId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null | "trash">(null);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");
  const [renamingMaterialId, setRenamingMaterialId] = useState<number | null>(null);
  const [renamingMaterialTitle, setRenamingMaterialTitle] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const { data: ctx, isLoading: ctxLoading } = trpc.teach.getMyContext.useQuery(undefined, { enabled: !!user });
  const { data: materials, isLoading: matsLoading, refetch } = trpc.teach.listMyMaterials.useQuery(undefined, {
    enabled: !!user && !!ctx?.canAccessTeach,
  });
  const { data: trashItems, isLoading: trashLoading, refetch: refetchTrash } = trpc.teach.listTrash.useQuery(undefined, {
    enabled: !!user && !!ctx?.canAccessTeach && selectedFolderId === "trash",
  });
  const { data: folders, refetch: refetchFolders } = trpc.teach.listFolders.useQuery(undefined, {
    enabled: !!user && !!ctx?.canAccessTeach,
  });
  const { data: masters, refetch: refetchMasters } = trpc.teach.listMasters.useQuery(undefined, {
    enabled: !!user && !!ctx?.canAccessTeach,
  });

  const createMaster = trpc.teach.createMaster.useMutation({
    onSuccess: (data) => { toast.success("Slide master created"); refetchMasters(); navigate(`/teach/master/${data.id}/design`); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMaster = trpc.teach.deleteMaster.useMutation({
    onSuccess: () => { toast.success("Master deleted"); refetchMasters(); },
    onError: (e) => toast.error(e.message),
  });
  const createPresentation = trpc.teach.createPresentation.useMutation({
    onSuccess: (data) => {
      toast.success("Presentation created"); setCreateOpen(false); setNewTitle(""); refetch();
      navigate(`/teach/presentation/${data.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadMaterial = trpc.teach.uploadMaterial.useMutation({
    onSuccess: (data) => {
      toast.success(data.parsed ? "PowerPoint imported — slides ready to edit" : "File uploaded");
      refetch(); refetchMasters(); setUploading(false);
      if (data.parsed && data.materialId) navigate(`/teach/presentation/${data.materialId}/edit`);
    },
    onError: (e) => { toast.error(e.message); setUploading(false); },
  });
  const parsePptxFromUrl = trpc.teach.parsePptxFromUrl.useMutation({
    onSuccess: (data) => {
      toast.success(data.parsed ? "PowerPoint imported — slides ready to edit" : "File uploaded");
      refetch(); refetchMasters(); setUploading(false); setProcessing(false);
      if (data.parsed && data.materialId) navigate(`/teach/presentation/${data.materialId}/edit`);
    },
    onError: (e) => { toast.error(e.message); setUploading(false); setProcessing(false); },
  });
  const deleteMaterial = trpc.teach.deleteMaterial.useMutation({
    onSuccess: () => { toast.success("Permanently deleted"); refetch(); refetchTrash(); },
    onError: (e) => toast.error(e.message),
  });
  const trashMaterial = trpc.teach.trashMaterial.useMutation({
    onSuccess: () => { toast.success("Moved to trash"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const restoreMaterial = trpc.teach.restoreMaterial.useMutation({
    onSuccess: () => { toast.success("Restored"); refetchTrash(); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const copyMaterial = trpc.teach.copyToMyAccount.useMutation({
    onSuccess: (data) => {
      toast.success("Copied to your library"); refetch();
      if (data.id) navigate(`/teach/presentation/${data.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });
  const createFolder = trpc.teach.createFolder.useMutation({
    onSuccess: () => { toast.success("Folder created"); refetchFolders(); setNewFolderOpen(false); setNewFolderName(""); },
    onError: (e) => toast.error(e.message),
  });
  const renameFolder = trpc.teach.renameFolder.useMutation({
    onSuccess: () => { toast.success("Folder renamed"); refetchFolders(); setRenamingFolderId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteFolder = trpc.teach.deleteFolder.useMutation({
    onSuccess: () => { toast.success("Folder deleted"); refetchFolders(); refetch(); setSelectedFolderId(null); },
    onError: (e) => toast.error(e.message),
  });
  const renameMaterial = trpc.teach.renameMaterial.useMutation({
    onSuccess: () => { toast.success("Renamed"); refetch(); setRenamingMaterialId(null); },
    onError: (e) => toast.error(e.message),
  });
  const moveMaterialToFolder = trpc.teach.moveMaterialToFolder.useMutation({
    onSuccess: () => { toast.success("Moved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading || ctxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }
  if (!user) { window.location.href = getLoginUrl(); return null; }
  if (!ctx?.canAccessTeach) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" /> TEACH Access Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>TEACH is available to <strong>LMS Instructors</strong> or <strong>EducatorAssist™</strong> educators.</p>
            <p>Contact your administrator to be assigned as an instructor or EducatorAssist educator.</p>
            <Link href="/instructor-portal">
              <Button variant="outline" className="w-full mt-2">Instructor Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = ctx.isPlatformAdmin || ctx.isEducationManager;
  const maxFileSizeBytes = isAdmin ? Infinity : 200 * 1024 * 1024;
  const maxFileSizeLabel = isAdmin ? "unlimited" : "200 MB";

  // Chunked upload threshold: files above 10 MB use the multipart endpoint
  // to avoid the tRPC JSON body limit and Cloud Run 180s timeout.
  const CHUNKED_THRESHOLD = 10 * 1024 * 1024; // 10 MB
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks

  const handleFileUpload = async (file: File) => {
    if (file.size > maxFileSizeBytes) { toast.error(`File must be under ${maxFileSizeLabel}`); return; }
    setUploading(true);

    // For large files, use the chunked upload endpoint
    if (file.size > CHUNKED_THRESHOLD) {
      try {
        const mimeType = file.type || "application/octet-stream";
        const title = file.name.replace(/\.[^.]+$/, "");
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Step 1: Init upload session
        const initRes = await fetch("/api/upload-teach/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType,
            fileSize: file.size,
            totalChunks,
            title,
            ownerContext,
            educatorOrgId: educatorOrgId ?? undefined,
          }),
          credentials: "include",
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({ error: "Upload init failed" }));
          throw new Error(err.error || "Upload init failed");
        }
        const { uploadId } = await initRes.json();

        // Step 2: Upload chunks
        let lastResult: any = null;
        setUploadProgress({ current: 0, total: totalChunks });
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("uploadId", uploadId);
          formData.append("chunkIndex", String(i));
          const chunkRes = await fetch("/api/upload-teach/chunk", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!chunkRes.ok) {
            const err = await chunkRes.json().catch(() => ({ error: "Chunk upload failed" }));
            throw new Error(err.error || "Chunk upload failed");
          }
          lastResult = await chunkRes.json();
          setUploadProgress({ current: i + 1, total: totalChunks });
        }
        // Step 3: Parse PPTX from the uploaded S3 URL
        if (!lastResult?.done) throw new Error("Upload did not complete");
        setUploadProgress(null);
        setProcessing(true);
        parsePptxFromUrl.mutate({
          assetId: lastResult.assetId,
          s3Url: lastResult.s3Url,
          s3Key: lastResult.s3Key,
          fileName: lastResult.fileName,
          mimeType: lastResult.mimeType,
          fileSize: lastResult.fileSize,
          title,
          ownerContext,
          educatorOrgId: educatorOrgId ?? undefined,
        });
      } catch (err: any) {
        toast.error(err?.message || "Upload failed");
        setUploading(false);
        setUploadProgress(null);
      }
      return;
    }

    // For small files, use the existing base64 tRPC path
    const reader = new FileReader();
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => { const r = reader.result as string; resolve(r.split(",")[1] ?? ""); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    uploadMaterial.mutate({
      title: file.name.replace(/\.[^.]+$/, ""),
      fileData, fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size, ownerContext,
      educatorOrgId: educatorOrgId ?? undefined,
    });
  };

  const activeMaterials = ((materials ?? []) as Material[]).filter((m) => !m.trashedAt);
  const visibleMaterials = selectedFolderId === null || selectedFolderId === "trash"
    ? activeMaterials.filter((m) => m.folderId == null)
    : activeMaterials.filter((m) => m.folderId === selectedFolderId);
  const folderList = (folders ?? []) as FolderItem[];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Presentation className="w-7 h-7 text-teal-600" /> TEACH
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Upload presentations and media for your courses. <strong>.pptx</strong> files are parsed into editable slides.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {ctx.lmsInstructor && (
                <Link href="/instructor-portal">
                  <Button variant="outline" size="sm"><GraduationCap className="w-4 h-4 mr-1" /> Instructor Portal</Button>
                </Link>
              )}
              {ctx.educatorAssistPreview && (
                <Link href="/educator-admin">
                  <Button variant="outline" size="sm"><Building2 className="w-4 h-4 mr-1" /> EducatorAssist™</Button>
                </Link>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ctx.lmsInstructor && (
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                LMS Instructor: {ctx.lmsInstructor.name}
              </Badge>
            )}
            {ctx.educatorOrgs.map((o) => (
              <Badge key={o.orgId} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                EducatorAssist™: {o.orgName}
              </Badge>
            ))}
            {isAdmin && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Admin · Unlimited uploads</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Folder sidebar */}
        <aside className="w-52 flex-shrink-0 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <button
            type="button"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${selectedFolderId === null ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
            onClick={() => setSelectedFolderId(null)}
          >
            <Home className="w-3.5 h-3.5 flex-shrink-0" /> All Files
          </button>
          {folderList.map((f) => (
            <div key={f.id} className="group flex items-center gap-1">
              {renamingFolderId === f.id ? (
                <form className="flex-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (renamingFolderName.trim()) renameFolder.mutate({ folderId: f.id, name: renamingFolderName.trim() }); }}>
                  <Input autoFocus value={renamingFolderName} onChange={(e) => setRenamingFolderName(e.target.value)} className="h-6 text-xs px-1" onBlur={() => setRenamingFolderId(null)} />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${selectedFolderId === f.id ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                    onClick={() => setSelectedFolderId(f.id)}
                  >
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => { setRenamingFolderId(f.id); setRenamingFolderName(f.name); }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm(`Delete folder "${f.name}"? Files will be moved to root.`)) deleteFolder.mutate({ folderId: f.id }); }}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ))}
          <button
            type="button"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors mt-2 ${selectedFolderId === "trash" ? "bg-red-50 text-red-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => setSelectedFolderId("trash")}
          >
            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /> Trash
          </button>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {selectedFolderId !== "trash" && (
            <div className="flex flex-wrap gap-2 items-center">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Presentation
              </Button>
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || processing}>
                  {(uploading || processing) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                  {processing ? "Processing File…" : uploading ? "Uploading…" : "Upload File"}
                </Button>
                {uploadProgress && (
                  <div className="w-36">
                    <Progress value={Math.round((uploadProgress.current / uploadProgress.total) * 100)} className="h-1.5" />
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" disabled={createMaster.isPending} onClick={() => createMaster.mutate({ name: "New Slide Master", isGlobal: false })}>
                {createMaster.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LayoutTemplate className="w-4 h-4 mr-1" />}
                New Slide Master
              </Button>
              <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
              {!isAdmin && <span className="text-xs text-gray-400 ml-1">Max: {maxFileSizeLabel}</span>}
            </div>
          )}

          {selectedFolderId !== null && selectedFolderId !== "trash" && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <button type="button" className="hover:text-teal-600" onClick={() => setSelectedFolderId(null)}>All Files</button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-800 font-medium">{folderList.find((f) => f.id === selectedFolderId)?.name}</span>
            </div>
          )}

          {selectedFolderId === null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-teal-600" />
                  Slide Masters
                  <span className="text-xs font-normal text-gray-400">Design layouts to apply or force on presentations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(masters ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">No slide masters yet. Create one or import a .pptx to extract masters.</p>
                ) : (
                  <div className="divide-y">
                    {(masters ?? []).map((m) => (
                      <div key={m.id} className="py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{m.name}</p>
                          <p className="text-xs text-gray-400">
                            {m.isGlobal ? "Global" : m.isOwner ? "My master" : "Shared"}
                            {m.isDefaultForced ? " · default forced" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {m.canEdit && (
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate(`/teach/master/${m.id}/design`)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {m.isOwner && (
                            <Button size="sm" variant="ghost" className="h-8 text-red-500" onClick={() => { if (confirm("Delete this slide master?")) deleteMaster.mutate({ masterId: m.id }); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedFolderId !== "trash" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-teal-600" />
                  {selectedFolderId === null ? "My Library" : folderList.find((f) => f.id === selectedFolderId)?.name ?? "Folder"}
                  {selectedFolderId === null && user && <span className="text-xs font-normal text-gray-400">{user.displayName ?? user.name ?? "My Library"}</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {matsLoading ? (
                  <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
                ) : visibleMaterials.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">
                    {selectedFolderId === null ? "No materials yet. Create a presentation or upload a file to get started." : "This folder is empty."}
                  </div>
                ) : (
                  <div className="divide-y">
                    {visibleMaterials.map((m) => (
                      <div key={m.id} className="py-3 flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          {materialIcon(m.materialType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {renamingMaterialId === m.id ? (
                            <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (renamingMaterialTitle.trim()) renameMaterial.mutate({ materialId: m.id, title: renamingMaterialTitle.trim() }); }}>
                              <Input autoFocus value={renamingMaterialTitle} onChange={(e) => setRenamingMaterialTitle(e.target.value)} className="h-7 text-sm" onBlur={() => setRenamingMaterialId(null)} />
                              <Button type="submit" size="sm" className="h-7 px-2 bg-teal-600 hover:bg-teal-700 text-white">Save</Button>
                            </form>
                          ) : (
                            <>
                              <p className="font-medium text-sm text-gray-900 truncate">{m.title}</p>
                              <p className="text-xs text-gray-400 capitalize">
                                {m.materialType} · {m.ownerContext.replace("_", " ")} · {m.status}
                                {m.folderName ? ` · ${m.folderName}` : ""}
                                {!m.isOwner && " · shared with you"}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {m.materialType === "presentation" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate(`/teach/presentation/${m.id}/edit`)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 text-teal-600" onClick={() => {
                                const notes = window.open(`/teach/presentation/${m.id}/notes`, `teach-notes-${m.id}`, "width=480,height=720");
                                if (notes) window.open(`/teach/presentation/${m.id}/present`, "_blank");
                                else navigate(`/teach/presentation/${m.id}/present`);
                              }}>
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {!m.isOwner && (
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => copyMaterial.mutate({ materialId: m.id })}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {m.isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8"><MoreVertical className="w-3.5 h-3.5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => { setRenamingMaterialId(m.id); setRenamingMaterialTitle(m.title); }}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                                </DropdownMenuItem>
                                {folderList.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {m.folderId != null && (
                                      <DropdownMenuItem onClick={() => moveMaterialToFolder.mutate({ materialId: m.id, folderId: null })}>
                                        <Home className="w-3.5 h-3.5 mr-2" /> Move to Root
                                      </DropdownMenuItem>
                                    )}
                                    {folderList.filter((f) => f.id !== m.folderId).map((f) => (
                                      <DropdownMenuItem key={f.id} onClick={() => moveMaterialToFolder.mutate({ materialId: m.id, folderId: f.id })}>
                                        <Folder className="w-3.5 h-3.5 mr-2" /> {f.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => trashMaterial.mutate({ materialId: m.id })}>
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Move to Trash
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedFolderId === "trash" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Trash
                  <span className="text-xs font-normal text-gray-400">Items are permanently deleted after 30 days</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trashLoading ? (
                  <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
                ) : (trashItems ?? []).length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">Trash is empty.</div>
                ) : (
                  <div className="divide-y">
                    {(trashItems ?? []).map((m) => {
                      const trashedDate = m.trashedAt ? new Date(m.trashedAt as unknown as string) : null;
                      const expiresAt = trashedDate ? new Date(trashedDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                      const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;
                      return (
                        <div key={m.id} className="py-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 opacity-60">
                            {materialIcon(m.materialType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-700 truncate">{m.title}</p>
                            <p className="text-xs text-gray-400">
                              {m.materialType} · deleted {trashedDate?.toLocaleDateString()}
                              {daysLeft !== null ? ` · ${daysLeft}d until permanent deletion` : ""}
                              {(m as { ownerName?: string }).ownerName ? ` · ${(m as { ownerName?: string }).ownerName}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button size="sm" variant="ghost" className="h-8 text-teal-600" onClick={() => restoreMaterial.mutate({ materialId: m.id })}>
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                            {((m as Material).ownerUserId === ctx.userId || isAdmin) && (
                              <Button size="sm" variant="ghost" className="h-8 text-red-500" onClick={() => { if (confirm("Permanently delete? This cannot be undone.")) deleteMaterial.mutate({ materialId: m.id }); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-dashed border-amber-200 bg-amber-50/50">
            <CardContent className="py-4 text-xs text-amber-800">
              <strong>EducatorAssist™</strong> is a separate educator subscription platform (schools, hospitals, programs).
              LMS Instructors use TEACH today for presentations and course media.
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create presentation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Presentation</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1" />
            </div>
            {ctx.educatorOrgs.length > 0 && (
              <div>
                <Label>Context</Label>
                <Select value={ownerContext} onValueChange={(v: "lms_instructor" | "educator_assist") => { setOwnerContext(v); if (v === "educator_assist" && ctx.educatorOrgs[0]) setEducatorOrgId(ctx.educatorOrgs[0].orgId); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lms_instructor">LMS Instructor</SelectItem>
                    <SelectItem value="educator_assist">EducatorAssist™ Org</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {ownerContext === "educator_assist" && ctx.educatorOrgs.length > 0 && (
              <div>
                <Label>Organization</Label>
                <Select value={String(educatorOrgId ?? "")} onValueChange={(v) => setEducatorOrgId(parseInt(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ctx.educatorOrgs.map((o) => (
                      <SelectItem key={o.orgId} value={String(o.orgId)}>{o.orgName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" disabled={!newTitle.trim() || createPresentation.isPending}
              onClick={() => createPresentation.mutate({ title: newTitle.trim(), ownerContext, educatorOrgId: educatorOrgId ?? undefined })}>
              {createPresentation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Folder Name</Label>
            <Input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="mt-1"
              onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) createFolder.mutate({ name: newFolderName.trim() }); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" disabled={!newFolderName.trim() || createFolder.isPending}
              onClick={() => createFolder.mutate({ name: newFolderName.trim() })}>
              {createFolder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
