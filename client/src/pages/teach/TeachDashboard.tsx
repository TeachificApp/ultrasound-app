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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Presentation, Upload, Plus, FolderOpen, GraduationCap, Building2,
  Loader2, Pencil, Play, Trash2, Copy, Lock, LayoutTemplate,
} from "lucide-react";

export default function TeachDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [ownerContext, setOwnerContext] = useState<"lms_instructor" | "educator_assist">("lms_instructor");
  const [educatorOrgId, setEducatorOrgId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: ctx, isLoading: ctxLoading } = trpc.teach.getMyContext.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: materials, isLoading: matsLoading, refetch } = trpc.teach.listMyMaterials.useQuery(undefined, {
    enabled: !!user && !!ctx?.canAccessTeach,
  });
  const { data: masters, refetch: refetchMasters } = trpc.teach.listMasters.useQuery(undefined, {
    enabled: !!user && !!ctx?.canAccessTeach,
  });
  const { data: platformVisible } = trpc.educator.getPlatformVisible.useQuery();

  const createMaster = trpc.teach.createMaster.useMutation({
    onSuccess: (data) => {
      toast.success("Slide master created");
      refetchMasters();
      navigate(`/teach/master/${data.id}/design`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMaster = trpc.teach.deleteMaster.useMutation({
    onSuccess: () => { toast.success("Master deleted"); refetchMasters(); },
    onError: (e) => toast.error(e.message),
  });

  const createPresentation = trpc.teach.createPresentation.useMutation({
    onSuccess: (data) => {
      toast.success("Presentation created");
      setCreateOpen(false);
      setNewTitle("");
      refetch();
      navigate(`/teach/presentation/${data.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadMaterial = trpc.teach.uploadMaterial.useMutation({
    onSuccess: (data) => {
      toast.success(data.parsed ? "PowerPoint imported — slides ready to edit" : "File uploaded to your TEACH library");
      refetch();
      refetchMasters();
      setUploading(false);
      if (data.parsed && data.materialId) {
        navigate(`/teach/presentation/${data.materialId}/edit`);
      }
    },
    onError: (e) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  const deleteMaterial = trpc.teach.deleteMaterial.useMutation({
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const copyMaterial = trpc.teach.copyToMyAccount.useMutation({
    onSuccess: (data) => {
      toast.success("Copied to your library");
      refetch();
      if (data.id) navigate(`/teach/presentation/${data.id}/edit`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading || ctxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

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
            <p>
              TEACH is available to <strong>LMS Instructors</strong> with a linked account, or
              <strong> EducatorAssist™</strong> organization educators.
            </p>
            <p>Contact your administrator to be assigned as an instructor or EducatorAssist educator.</p>
            <Link href="/instructor-portal">
              <Button variant="outline" className="w-full mt-2">Instructor Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleFileUpload = async (file: File) => {
    if (file.size > 40 * 1024 * 1024) {
      toast.error("File must be under 40 MB");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    uploadMaterial.mutate({
      title: file.name.replace(/\.[^.]+$/, ""),
      fileData,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      ownerContext,
      educatorOrgId: educatorOrgId ?? undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Presentation className="w-7 h-7 text-teal-600" />
                TEACH
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Upload presentations and media for your courses. Files are stored in your private
                Teach folder in the media repository. <strong>.pptx</strong> files are parsed into editable slides.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {ctx.lmsInstructor && (
                <Link href="/instructor-portal">
                  <Button variant="outline" size="sm">
                    <GraduationCap className="w-4 h-4 mr-1" /> Instructor Portal
                  </Button>
                </Link>
              )}
              {ctx.educatorAssistPreview && (
                <Link href="/educator-admin">
                  <Button variant="outline" size="sm">
                    <Building2 className="w-4 h-4 mr-1" /> EducatorAssist™
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {ctx.lmsInstructor && (
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                LMS Instructor: {ctx.lmsInstructor.name}
              </Badge>
            )}
            {ctx.educatorOrgs.map((org) => (
              <Badge key={org.orgId} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                EducatorAssist™: {org.orgName}
              </Badge>
            ))}
            {!platformVisible?.visible && ctx.educatorAssistPreview && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                EducatorAssist™ subscription — preview only (not public yet)
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> New Presentation
          </Button>
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Upload File
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".ppt,.pptx,.pdf,.mp4,.mov,.png,.jpg,.jpeg,.gif,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={() => createMaster.mutate({ name: "New Slide Master" })}
            disabled={createMaster.isPending}
          >
            {createMaster.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LayoutTemplate className="w-4 h-4 mr-1" />}
            New Slide Master
          </Button>
        </div>

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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-red-500"
                          onClick={() => { if (confirm("Delete this slide master?")) deleteMaster.mutate({ masterId: m.id }); }}
                        >
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-teal-600" />
              My Library
              <span className="text-xs font-normal text-gray-400">
                Folder: Teach/user-{ctx.userId}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matsLoading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : (materials ?? []).length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                No materials yet. Create a presentation or upload a file to get started.
              </div>
            ) : (
              <div className="divide-y">
                {(materials ?? []).map((m) => (
                  <div key={m.id} className="py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Presentation className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {m.materialType} · {m.ownerContext.replace("_", " ")} · {m.status}
                        {!m.isOwner && " · shared with you"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {m.materialType === "presentation" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => navigate(`/teach/presentation/${m.id}/edit`)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-teal-600"
                            onClick={() => {
                              const notes = window.open(
                                `/teach/presentation/${m.id}/notes`,
                                `teach-notes-${m.id}`,
                                "width=480,height=720",
                              );
                              if (notes) {
                                window.open(`/teach/presentation/${m.id}/present`, "_blank");
                              } else {
                                navigate(`/teach/presentation/${m.id}/present`);
                              }
                            }}
                          >
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {!m.isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => copyMaterial.mutate({ materialId: m.id })}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {m.isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-red-500"
                          onClick={() => {
                            if (confirm("Delete this material?")) deleteMaterial.mutate({ materialId: m.id });
                          }}
                        >
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

        <Card className="border-dashed border-amber-200 bg-amber-50/50">
          <CardContent className="py-4 text-xs text-amber-800">
            <strong>EducatorAssist™</strong> is a separate educator subscription platform (schools, hospitals, programs).
            It is not open for public sign-up yet — features are being built so everything is ready at launch.
            LMS Instructors use TEACH today for presentations and course media.
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Presentation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1" />
            </div>
            {ctx.educatorOrgs.length > 0 && (
              <div>
                <Label>Context</Label>
                <Select
                  value={ownerContext}
                  onValueChange={(v: "lms_instructor" | "educator_assist") => {
                    setOwnerContext(v);
                    if (v === "educator_assist" && ctx.educatorOrgs[0]) {
                      setEducatorOrgId(ctx.educatorOrgs[0].orgId);
                    }
                  }}
                >
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
                <Select
                  value={String(educatorOrgId ?? "")}
                  onValueChange={(v) => setEducatorOrgId(parseInt(v))}
                >
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
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!newTitle.trim() || createPresentation.isPending}
              onClick={() =>
                createPresentation.mutate({
                  title: newTitle.trim(),
                  ownerContext,
                  educatorOrgId: educatorOrgId ?? undefined,
                })
              }
            >
              {createPresentation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
