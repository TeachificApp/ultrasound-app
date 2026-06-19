/**
 * TeachPresentationEditor.tsx — Office-style presentation editor with slide master support.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Play, Save, Loader2, Trash2, LayoutTemplate, Lock, RefreshCw, AlertTriangle } from "lucide-react";
import { TeachOfficeEditor, createEmptySlide } from "@/components/teach/TeachOfficeEditor";
import { type TeachSlide } from "@shared/teachPresentation";

export default function TeachPresentationEditor() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const [slides, setSlides] = useState<TeachSlide[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");

  const { data, isLoading, refetch } = trpc.teach.getMaterial.useQuery(
    { materialId },
    { enabled: !isNaN(materialId) },
  );
  const { data: masters } = trpc.teach.listMasters.useQuery(undefined, { enabled: !!data });
  const { data: ctx } = trpc.teach.getMyContext.useQuery();

  const IMPORT_PENDING = "__import_pending__";
  const IMPORT_FAILED_PREFIX = "IMPORT_FAILED:";
  const isImportPending = data?.description === IMPORT_PENDING;
  const isImportFailed = typeof data?.description === "string" && data.description.startsWith(IMPORT_FAILED_PREFIX);
  const importError = isImportFailed ? (data?.description as string).slice(IMPORT_FAILED_PREFIX.length).trim() : null;

  const reprocess = trpc.teach.reprocessPptx.useMutation({
    onSuccess: () => {
      toast.info("Re-processing started — this may take a few minutes for large files");
      // Poll for completion
      const interval = setInterval(async () => {
        const res = await fetch(`/api/upload-teach/parse-status/${materialId}`, { credentials: "include" });
        const json = await res.json();
        if (json.status === "done") {
          clearInterval(interval);
          toast.success(json.parsed ? "Slides imported successfully" : "File processed");
          refetch();
        } else if (json.status === "failed") {
          clearInterval(interval);
          toast.error("Import failed: " + (json.error ?? "Unknown error"));
          refetch();
        }
      }, 3000);
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.teach.updatePresentation.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setDirty(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const applyMaster = trpc.teach.applyMasterToPresentation.useMutation({
    onSuccess: () => {
      toast.success("Slide master applied");
      setDirty(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setSlides(data.slides ?? []);
      if (data.slideMasterId) setSelectedMasterId(String(data.slideMasterId));
    }
  }, [data]);

  const addSlide = () => {
    setSlides((prev) => [...prev, createEmptySlide(prev.length + 1)]);
    setActiveIdx(slides.length);
    setDirty(true);
  };

  const removeSlide = () => {
    if (slides.length <= 1 || data?.masterForced) return;
    setSlides((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    setDirty(true);
  };

  const save = () => {
    update.mutate({ materialId, title, slides });
  };

  const startPresent = () => {
    const open = () => {
      // Open the main presentation window first (user-initiated = not blocked by popup blocker)
      // Pass a flag so the presenter auto-opens the notes window and requests fullscreen
      const presentUrl = `/teach/presentation/${materialId}/present?openNotes=1`;
      window.open(presentUrl, `teach-present-${materialId}`);
    };
    if (dirty) {
      update.mutate({ materialId, title, slides }, { onSuccess: open });
    } else {
      open();
    }
  };

  const handleApplyMaster = (forced: boolean) => {
    const masterId = parseInt(selectedMasterId, 10);
    if (!masterId) {
      toast.error("Select a slide master");
      return;
    }
    applyMaster.mutate({ materialId, masterId, forced });
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (isImportPending || isImportFailed) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <Link href="/teach"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <span className="font-semibold text-gray-700">{data.title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md w-full text-center space-y-4">
            {isImportPending ? (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto" />
                <h2 className="text-lg font-semibold text-gray-800">Import in progress</h2>
                <p className="text-sm text-gray-500">Your PowerPoint is being processed. This can take several minutes for large files. Refresh this page to check progress.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Check status</Button>
              </>
            ) : (
              <>
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                <h2 className="text-lg font-semibold text-gray-800">Import did not complete</h2>
                <p className="text-sm text-gray-500">{importError || "The PowerPoint import failed. You can re-process the original file."}</p>
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={reprocess.isPending}
                  onClick={() => reprocess.mutate({ materialId })}
                >
                  {reprocess.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Re-process PowerPoint
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = ctx?.isPlatformAdmin || ctx?.isEducationManager;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <Link href="/teach">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="max-w-md font-semibold border-0 shadow-none focus-visible:ring-0"
        />
        {data.masterForced && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
            <Lock className="w-3 h-3 mr-1" /> Master locked
          </Badge>
        )}
        <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-gray-50">
          <LayoutTemplate className="w-3.5 h-3.5 text-teal-600" />
          <Select value={selectedMasterId} onValueChange={setSelectedMasterId}>
            <SelectTrigger className="h-7 border-0 shadow-none text-xs w-44 bg-transparent">
              <SelectValue placeholder="Slide master…" />
            </SelectTrigger>
            <SelectContent>
              {(masters ?? []).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}{m.isGlobal ? " (global)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={!selectedMasterId || applyMaster.isPending}
            onClick={() => handleApplyMaster(false)}
          >
            Apply
          </Button>
          {(isAdmin || data.isOwner) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-amber-700"
              disabled={!selectedMasterId || applyMaster.isPending}
              onClick={() => handleApplyMaster(true)}
            >
              Force
            </Button>
          )}
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={addSlide}><Plus className="w-4 h-4 mr-1" /> Slide</Button>
        <Button variant="outline" size="sm" onClick={removeSlide} disabled={slides.length <= 1 || data.masterForced}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete slide
        </Button>
        <Button variant="outline" size="sm" onClick={startPresent}><Play className="w-4 h-4 mr-1" /> Present</Button>
        <Button size="sm" className="bg-teal-600" disabled={update.isPending} onClick={save}>
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
        </Button>
      </div>

      <TeachOfficeEditor
        slides={slides}
        onSlidesChange={(next) => { setSlides(next); setDirty(true); }}
        activeIdx={activeIdx}
        onActiveIdxChange={setActiveIdx}
        masterLocked={data.masterForced ?? false}
      />
    </div>
  );
}
