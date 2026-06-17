/**
 * TeachPresentationEditor.tsx — in-browser slide editor with presenter notes.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Play, Save, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

type Slide = { id: string; title: string; content: string; imageUrl?: string; notes?: string };

export default function TeachPresentationEditor() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, refetch } = trpc.teach.getMaterial.useQuery(
    { materialId },
    { enabled: !isNaN(materialId) },
  );

  const update = trpc.teach.updatePresentation.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setDirty(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setSlides(data.slides ?? []);
    }
  }, [data]);

  const active = slides[activeIdx];

  const updateSlide = (patch: Partial<Slide>) => {
    setSlides((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: String(Date.now()),
      title: `Slide ${slides.length + 1}`,
      content: "",
      notes: "",
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveIdx(slides.length);
    setDirty(true);
  };

  const removeSlide = () => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    setDirty(true);
  };

  const save = () => {
    update.mutate({ materialId, title, slides });
  };

  const startPresent = () => {
    if (dirty) {
      update.mutate(
        { materialId, title, slides },
        {
          onSuccess: () => {
            window.open(`/teach/presentation/${materialId}/notes`, `teach-notes-${materialId}`, "width=480,height=720");
            window.open(`/teach/presentation/${materialId}/present`, "_blank");
          },
        },
      );
    } else {
      window.open(`/teach/presentation/${materialId}/notes`, `teach-notes-${materialId}`, "width=480,height=720");
      window.open(`/teach/presentation/${materialId}/present`, "_blank");
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link href="/teach">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="max-w-md font-semibold border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={addSlide}><Plus className="w-4 h-4 mr-1" /> Slide</Button>
        <Button variant="outline" size="sm" onClick={startPresent}><Play className="w-4 h-4 mr-1" /> Present</Button>
        <Button size="sm" className="bg-teal-600" disabled={update.isPending} onClick={save}>
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-48 bg-white border-r overflow-y-auto p-2 space-y-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`w-full text-left px-2 py-2 rounded text-xs truncate ${
                i === activeIdx ? "bg-teal-100 text-teal-800 font-medium" : "hover:bg-gray-50"
              }`}
            >
              {i + 1}. {s.title || "Untitled"}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg aspect-video p-8 flex flex-col">
            <Input
              value={active?.title ?? ""}
              onChange={(e) => updateSlide({ title: e.target.value })}
              className="text-2xl font-bold border-0 shadow-none mb-4"
              placeholder="Slide title"
            />
            <Textarea
              value={active?.content ?? ""}
              onChange={(e) => updateSlide({ content: e.target.value })}
              className="flex-1 resize-none border-0 shadow-none text-lg"
              placeholder="Slide content..."
            />
            {active?.imageUrl && (
              <img src={active.imageUrl} alt="" className="mt-4 max-h-32 object-contain rounded" />
            )}
          </div>

          <div className="max-w-3xl mx-auto mt-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => i - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-400">{activeIdx + 1} / {slides.length}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={activeIdx >= slides.length - 1}
              onClick={() => setActiveIdx((i) => i + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="w-72 bg-white border-l p-4 flex flex-col">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Presenter Notes</p>
          <Textarea
            value={active?.notes ?? ""}
            onChange={(e) => updateSlide({ notes: e.target.value })}
            className="flex-1 resize-none text-sm"
            placeholder="Notes visible only in presenter view..."
          />
          <Button variant="ghost" size="sm" className="mt-2 text-red-500" onClick={removeSlide} disabled={slides.length <= 1}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove slide
          </Button>
        </div>
      </div>
    </div>
  );
}
