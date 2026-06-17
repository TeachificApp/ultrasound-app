/**
 * TeachPresentationEditor.tsx — Office-style presentation editor.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Play, Save, Loader2, Trash2 } from "lucide-react";
import { TeachOfficeEditor, createEmptySlide } from "@/components/teach/TeachOfficeEditor";
import { type TeachSlide } from "@shared/teachPresentation";

export default function TeachPresentationEditor() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const [slides, setSlides] = useState<TeachSlide[]>([]);
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

  const addSlide = () => {
    setSlides((prev) => [...prev, createEmptySlide(prev.length + 1)]);
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
    const open = () => {
      window.open(`/teach/presentation/${materialId}/notes`, `teach-notes-${materialId}`, "width=520,height=760");
      window.open(`/teach/presentation/${materialId}/present`, "_blank");
    };
    if (dirty) {
      update.mutate({ materialId, title, slides }, { onSuccess: open });
    } else {
      open();
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
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0">
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
        <Button variant="outline" size="sm" onClick={removeSlide} disabled={slides.length <= 1}>
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
      />
    </div>
  );
}
