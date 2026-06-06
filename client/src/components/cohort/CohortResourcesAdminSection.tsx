import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ResourceRow = {
  id: number;
  title: string;
  description?: string | null;
  cardImageUrl?: string | null;
  actionType: "link" | "download";
  linkUrl?: string | null;
  downloadSource?: "upload" | "media_repo" | "download_product" | null;
  fileUrl?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  mediaAssetId?: number | null;
  mediaAssetTitle?: string | null;
  downloadProductId?: number | null;
  downloadProductTitle?: string | null;
  status: "draft" | "published";
  scope: "course" | "cohort";
  cohortGroupId?: number | null;
  actionUrl?: string | null;
};

type ResourceForm = {
  title: string;
  description: string;
  cardImageUrl: string;
  scope: "course" | "cohort";
  cohortGroupId: number | null;
  actionType: "link" | "download";
  linkUrl: string;
  downloadSource: "upload" | "media_repo" | "download_product";
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mediaAssetId: number | null;
  mediaAssetTitle: string;
  downloadProductId: number | null;
  downloadProductTitle: string;
  status: "draft" | "published";
};

const emptyForm = (cohortGroupId: number | null): ResourceForm => ({
  title: "",
  description: "",
  cardImageUrl: "",
  scope: cohortGroupId ? "cohort" : "course",
  cohortGroupId,
  actionType: "link",
  linkUrl: "",
  downloadSource: "upload",
  fileUrl: "",
  fileKey: "",
  fileName: "",
  mediaAssetId: null,
  mediaAssetTitle: "",
  downloadProductId: null,
  downloadProductTitle: "",
  status: "draft",
});

function MediaPickerInline({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: { id: number; title: string; s3Url: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading } = trpc.mediaRepo.listAssets.useQuery(
    { search: debounced || undefined, page: 1, pageSize: 30 },
    { enabled: open },
  );
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select from Media Repository</DialogTitle>
        </DialogHeader>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="h-8 text-sm"
        />
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (
            (data?.assets ?? []).map((a: { id: number; title: string; s3Url: string }) => (
              <button
                key={a.id}
                type="button"
                className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:border-teal-400 hover:bg-teal-50 text-sm truncate"
                onClick={() => {
                  onSelect({ id: a.id, title: a.title, s3Url: a.s3Url });
                  onClose();
                }}
              >
                {a.title}
              </button>
            ))
          )}
          {!isLoading && (data?.assets ?? []).length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No assets found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CohortResourcesAdminSection({
  courseId,
  multiCohortMode,
  cohortGroups,
  effectiveGroupId,
  contentGroupId,
  onContentGroupChange,
}: {
  courseId: number;
  multiCohortMode: boolean;
  cohortGroups: { id: number; name: string }[];
  effectiveGroupId?: number;
  contentGroupId: number | null;
  onContentGroupChange: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data: resources = [], isLoading } = trpc.lmsAdmin.listCohortResources.useQuery({
    courseId,
    cohortGroupId: effectiveGroupId,
  });
  const { data: downloadProducts = [] } = trpc.lmsAdmin.listDownloadsForCohortResource.useQuery({});
  const createResource = trpc.lmsAdmin.createCohortResource.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCohortResources.invalidate({ courseId });
      toast.success("Resource created");
      setDialog({ open: false });
    },
    onError: (e) => toast.error(e.message),
  });
  const updateResource = trpc.lmsAdmin.updateCohortResource.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCohortResources.invalidate({ courseId });
      toast.success("Resource updated");
      setDialog({ open: false });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteResource = trpc.lmsAdmin.deleteCohortResource.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.listCohortResources.invalidate({ courseId });
      toast.success("Resource deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState<{ open: boolean; resource?: ResourceRow }>({ open: false });
  const [form, setForm] = useState<ResourceForm>(emptyForm(effectiveGroupId ?? null));
  const [uploading, setUploading] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [cardImageUploading, setCardImageUploading] = useState(false);

  const openDialog = (resource?: ResourceRow) => {
    if (resource) {
      setForm({
        title: resource.title,
        description: resource.description ?? "",
        cardImageUrl: resource.cardImageUrl ?? "",
        scope: resource.scope,
        cohortGroupId: resource.cohortGroupId ?? effectiveGroupId ?? null,
        actionType: resource.actionType,
        linkUrl: resource.linkUrl ?? "",
        downloadSource: resource.downloadSource ?? "upload",
        fileUrl: resource.fileUrl ?? "",
        fileKey: resource.fileKey ?? "",
        fileName: resource.fileName ?? "",
        mediaAssetId: resource.mediaAssetId ?? null,
        mediaAssetTitle: resource.mediaAssetTitle ?? "",
        downloadProductId: resource.downloadProductId ?? null,
        downloadProductTitle: resource.downloadProductTitle ?? "",
        status: resource.status,
      });
    } else {
      setForm(emptyForm(effectiveGroupId ?? null));
    }
    setDialog({ open: true, resource });
  };

  const uploadFile = async (file: File, forCardImage = false) => {
    if (forCardImage) setCardImageUploading(true);
    else setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/cohort-resource", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (forCardImage) {
        setForm((p) => ({ ...p, cardImageUrl: data.url }));
      } else {
        setForm((p) => ({
          ...p,
          fileUrl: data.url,
          fileKey: data.fileKey,
          fileName: data.fileName,
          downloadSource: "upload",
        }));
      }
      toast.success("File uploaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setCardImageUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      cardImageUrl: form.cardImageUrl || undefined,
      scope: form.scope,
      cohortGroupId: form.scope === "cohort" ? (form.cohortGroupId ?? effectiveGroupId) : undefined,
      actionType: form.actionType,
      linkUrl: form.actionType === "link" ? form.linkUrl : undefined,
      downloadSource: form.actionType === "download" ? form.downloadSource : undefined,
      fileUrl: form.downloadSource === "upload" ? form.fileUrl : undefined,
      fileKey: form.downloadSource === "upload" ? form.fileKey : undefined,
      fileName: form.downloadSource === "upload" ? form.fileName : undefined,
      mediaAssetId: form.downloadSource === "media_repo" ? (form.mediaAssetId ?? undefined) : undefined,
      downloadProductId:
        form.downloadSource === "download_product" ? (form.downloadProductId ?? undefined) : undefined,
      status: form.status,
    };
    if (dialog.resource) {
      updateResource.mutate({ id: dialog.resource.id, ...payload });
    } else {
      createResource.mutate({ courseId, ...payload });
    }
  };

  const statusBadge = (status: string) => (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-medium",
        status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
      )}
    >
      {status}
    </span>
  );

  return (
    <div className="space-y-3">
      {multiCohortMode && cohortGroups.length > 0 && (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
          <Users className="w-4 h-4 text-teal-600 flex-shrink-0" />
          <span className="text-xs font-medium text-teal-700">Filter by group:</span>
          <select
            value={contentGroupId ?? cohortGroups[0]?.id ?? ""}
            onChange={(e) => onContentGroupChange(Number(e.target.value))}
            className="text-xs border border-teal-300 rounded px-2 py-0.5 bg-white text-teal-800"
          >
            {cohortGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-teal-500 ml-auto">
            Shows course-wide + this group&apos;s resources
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Share links and downloadable files with students. Scope items to the entire course or a
          specific cohort group.
        </p>
        <Button
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => openDialog()}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Resource
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No resources yet — add your first card above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(resources as ResourceRow[]).map((r) => (
            <div
              key={r.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col"
            >
              {r.cardImageUrl ? (
                <img src={r.cardImageUrl} alt="" className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 bg-teal-50 flex items-center justify-center">
                  {r.actionType === "download" ? (
                    <Download className="w-8 h-8 text-teal-300" />
                  ) : (
                    <Link2 className="w-8 h-8 text-teal-300" />
                  )}
                </div>
              )}
              <div className="p-3 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 line-clamp-2">{r.title}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {statusBadge(r.status)}
                  </div>
                </div>
                {r.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{r.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                  {r.scope === "course" ? (
                    <span className="flex items-center gap-0.5">
                      <Globe className="w-3 h-3" /> Entire course
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <Users className="w-3 h-3" /> Cohort only
                    </span>
                  )}
                  <span>·</span>
                  <span>{r.actionType === "link" ? "Link" : "Download"}</span>
                </div>
                <div className="flex items-center gap-1 mt-auto pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => openDialog(r)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => {
                      if (confirm("Delete this resource?")) deleteResource.mutate({ id: r.id });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {r.actionUrl && (
                    <a
                      href={r.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-teal-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Preview
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.resource ? "Edit Resource" : "Add Resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Week 1 Study Guide"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Short description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Brief summary shown on the card"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Card image</Label>
              <Input
                value={form.cardImageUrl}
                onChange={(e) => setForm((p) => ({ ...p, cardImageUrl: e.target.value }))}
                placeholder="https://... or upload below"
                className="mb-2"
              />
              <label className="inline-flex items-center gap-2 text-xs text-teal-700 cursor-pointer border border-teal-200 rounded px-2 py-1.5 hover:bg-teal-50">
                <Upload className="w-3.5 h-3.5" />
                {cardImageUploading ? "Uploading…" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={cardImageUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f, true);
                  }}
                />
              </label>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">Availability</Label>
              <Select
                value={form.scope}
                onValueChange={(v: "course" | "cohort") => setForm((p) => ({ ...p, scope: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Entire course (all cohorts, including future)</SelectItem>
                  <SelectItem value="cohort">This cohort group only</SelectItem>
                </SelectContent>
              </Select>
              {form.scope === "cohort" && multiCohortMode && cohortGroups.length > 0 && (
                <Select
                  value={String(form.cohortGroupId ?? effectiveGroupId ?? "")}
                  onValueChange={(v) => setForm((p) => ({ ...p, cohortGroupId: Number(v) }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select cohort group" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohortGroups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium mb-1 block">Action type</Label>
              <Select
                value={form.actionType}
                onValueChange={(v: "link" | "download") => setForm((p) => ({ ...p, actionType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">URL link</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.actionType === "link" && (
              <div>
                <Label className="text-sm font-medium mb-1 block">Link URL *</Label>
                <Input
                  value={form.linkUrl}
                  onChange={(e) => setForm((p) => ({ ...p, linkUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            )}

            {form.actionType === "download" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium mb-1 block">Download source</Label>
                  <Select
                    value={form.downloadSource}
                    onValueChange={(v: ResourceForm["downloadSource"]) =>
                      setForm((p) => ({ ...p, downloadSource: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upload">Upload file or file URL</SelectItem>
                      <SelectItem value="media_repo">Media repository</SelectItem>
                      <SelectItem value="download_product">Download product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.downloadSource === "upload" && (
                  <div className="space-y-2">
                    <Input
                      value={form.fileUrl}
                      onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))}
                      placeholder="File URL (optional if uploading)"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-teal-700 cursor-pointer border border-teal-200 rounded px-2 py-1.5 hover:bg-teal-50">
                      <Upload className="w-3.5 h-3.5" />
                      {uploading ? "Uploading…" : form.fileName || "Upload file"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadFile(f);
                        }}
                      />
                    </label>
                  </div>
                )}
                {form.downloadSource === "media_repo" && (
                  <div>
                    {form.mediaAssetId ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate flex-1">{form.mediaAssetTitle}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setMediaPickerOpen(true)}
                        >
                          Change
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              mediaAssetId: null,
                              mediaAssetTitle: "",
                            }))
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => setMediaPickerOpen(true)}>
                        Select from media repository
                      </Button>
                    )}
                  </div>
                )}
                {form.downloadSource === "download_product" && (
                  <Select
                    value={form.downloadProductId ? String(form.downloadProductId) : ""}
                    onValueChange={(v) => {
                      const prod = downloadProducts.find((p) => p.id === Number(v));
                      setForm((p) => ({
                        ...p,
                        downloadProductId: Number(v),
                        downloadProductTitle: prod?.title ?? "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select download product" />
                    </SelectTrigger>
                    <SelectContent>
                      {downloadProducts.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-1 block">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: "draft" | "published") => setForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog({ open: false })}>
                Cancel
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleSave}
                disabled={createResource.isPending || updateResource.isPending}
              >
                {dialog.resource ? "Save changes" : "Create resource"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MediaPickerInline
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(asset) =>
          setForm((p) => ({
            ...p,
            mediaAssetId: asset.id,
            mediaAssetTitle: asset.title,
            downloadSource: "media_repo",
          }))
        }
      />
    </div>
  );
}
