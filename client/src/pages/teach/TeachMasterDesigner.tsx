/**
 * TeachMasterDesigner.tsx — In-browser slide master designer.
 * Route: /teach/master/:id/design
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, Loader2, Trash2 } from "lucide-react";
import { TeachOfficeEditor, createEmptySlide } from "@/components/teach/TeachOfficeEditor";
import {
  MASTER_LAYOUT_LABELS,
  type TeachMasterLayoutRole,
  type TeachMasterSlide,
} from "@shared/teachSlideMaster";
import { type TeachSlide } from "@shared/teachPresentation";

function masterToSlides(masterSlides: TeachMasterSlide[]): TeachSlide[] {
  return masterSlides.map((m) => ({
    id: m.id,
    title: m.name,
    backgroundColor: m.backgroundColor,
    backgroundImage: m.backgroundImage,
    masterLayoutRole: m.layoutRole,
    elements: m.elements,
    notes: "",
  }));
}

function slidesToMaster(slides: TeachSlide[], prev: TeachMasterSlide[]): TeachMasterSlide[] {
  return slides.map((s, i) => ({
    id: s.id,
    name: s.title || prev[i]?.name || `Layout ${i + 1}`,
    layoutRole: s.masterLayoutRole ?? prev[i]?.layoutRole ?? "titleAndContent",
    backgroundColor: s.backgroundColor,
    backgroundImage: s.backgroundImage,
    elements: s.elements,
  }));
}

export default function TeachMasterDesigner() {
  const { id } = useParams<{ id: string }>();
  const masterId = Number(id);
  const [slides, setSlides] = useState<TeachSlide[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [masterMeta, setMasterMeta] = useState<TeachMasterSlide[]>([]);

  const { data, isLoading, refetch } = trpc.teach.getMaster.useQuery(
    { masterId },
    { enabled: !isNaN(masterId) },
  );

  const update = trpc.teach.updateMaster.useMutation({
    onSuccess: () => {
      toast.success("Master saved");
      setDirty(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (data) {
      setName(data.name);
      setMasterMeta(data.masterSlides);
      setSlides(masterToSlides(data.masterSlides));
    }
  }, [data]);

  const save = () => {
    update.mutate({
      masterId,
      name,
      masterSlides: slidesToMaster(slides, masterMeta) as Parameters<typeof update.mutate>[0]["masterSlides"],
    });
  };

  const addLayout = () => {
    const empty = createEmptySlide(slides.length + 1);
    setSlides((prev) => [
      ...prev,
      { ...empty, title: `Layout ${prev.length + 1}`, masterLayoutRole: "custom" },
    ]);
    setActiveIdx(slides.length);
    setDirty(true);
  };

  const removeLayout = () => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, i - 1));
    setDirty(true);
  };

  const setLayoutRole = (role: TeachMasterLayoutRole) => {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx
          ? { ...s, masterLayoutRole: role, title: MASTER_LAYOUT_LABELS[role] }
          : s,
      ),
    );
    setDirty(true);
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Slide Master</span>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="max-w-xs font-semibold border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">Layout type</Label>
          <Select
            value={slides[activeIdx]?.masterLayoutRole ?? "titleAndContent"}
            onValueChange={(v) => setLayoutRole(v as TeachMasterLayoutRole)}
          >
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(MASTER_LAYOUT_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={addLayout}><Plus className="w-4 h-4 mr-1" /> Layout</Button>
        <Button variant="outline" size="sm" onClick={removeLayout} disabled={slides.length <= 1}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete layout
        </Button>
        <Button size="sm" className="bg-teal-600" disabled={update.isPending} onClick={save}>
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
        </Button>
      </div>

      <TeachOfficeEditor
        slides={slides}
        onSlidesChange={(next) => { setSlides(next); setDirty(true); }}
        activeIdx={activeIdx}
        onActiveIdxChange={setActiveIdx}
        mode="master"
      />

      {dirty && (
        <div className="fixed bottom-4 right-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg shadow">
          Unsaved master changes
        </div>
      )}
    </div>
  );
}
