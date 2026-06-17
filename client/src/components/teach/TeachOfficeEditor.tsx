/**
 * TeachOfficeEditor — Office-style presentation editor.
 * Features: drag-move, drag-resize, z-order, slide duplication, multi-select,
 * drag-reorder filmstrip, font picker, bullet lists, background types, default themes.
 */
import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TeachSlideRenderer } from "./TeachSlideRenderer";
import {
  type TeachSlide,
  type TeachSlideElement,
  type TeachPlaceholderRole,
  type TeachBackgroundType,
  createEmptySlide,
  createImageElement,
  createVideoElement,
  createShapeElement,
  createTextElement,
  DEFAULT_ANIMATION,
  DEFAULT_TRANSITION,
  orderedEntranceElements,
  TEACH_FONTS,
  TEACH_THEMES,
  newSlideId,
} from "@shared/teachPresentation";
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Type, Image, Video, Square,
  Trash2, Copy, Loader2, List, ListOrdered, Underline,
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Palette, GripVertical,
} from "lucide-react";

interface TeachOfficeEditorProps {
  slides: TeachSlide[];
  onSlidesChange: (slides: TeachSlide[]) => void;
  activeIdx: number;
  onActiveIdxChange: (idx: number) => void;
  mode?: "presentation" | "master";
  masterLocked?: boolean;
}

type DragState =
  | { kind: "move"; elId: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; elId: string; handle: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number }
  | { kind: "slide-reorder"; fromIdx: number; toIdx: number | null };

export function TeachOfficeEditor({
  slides,
  onSlidesChange,
  activeIdx,
  onActiveIdxChange,
  mode = "presentation",
  masterLocked = false,
}: TeachOfficeEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState("format");
  const [bgTab, setBgTab] = useState<TeachBackgroundType>("solid");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const uploadMedia = trpc.auth.uploadPageMedia.useMutation();

  const slide = slides[activeIdx];
  const selected = slide?.elements.find((e) => e.id === selectedId) ?? null;

  const updateSlide = useCallback(
    (patch: Partial<TeachSlide>) => {
      onSlidesChange(slides.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
    },
    [slides, activeIdx, onSlidesChange],
  );

  const updateElement = useCallback(
    (elId: string, patch: Partial<TeachSlideElement>) => {
      if (!slide) return;
      updateSlide({ elements: slide.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) });
    },
    [slide, updateSlide],
  );

  const addElement = (el: TeachSlideElement) => {
    if (!slide) return;
    updateSlide({ elements: [...slide.elements, el] });
    setSelectedId(el.id);
  };

  const deleteSelected = () => {
    if (!slide || !selectedId || masterLocked) return;
    if (mode === "master" && selected?.placeholderRole) {
      toast.error("Cannot delete placeholder slots in master designer");
      return;
    }
    updateSlide({ elements: slide.elements.filter((e) => e.id !== selectedId) });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: `el-${Date.now()}`, x: selected.x + 2, y: selected.y + 2 };
    addElement(copy);
  };

  // ─── Z-order ────────────────────────────────────────────────────────────────
  const changeZOrder = (elId: string, direction: "front" | "back" | "forward" | "backward") => {
    if (!slide) return;
    const sorted = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === elId);
    if (idx === -1) return;
    let newZ = sorted[idx].zIndex;
    if (direction === "front") newZ = Math.max(...sorted.map((e) => e.zIndex)) + 1;
    else if (direction === "back") newZ = Math.min(...sorted.map((e) => e.zIndex)) - 1;
    else if (direction === "forward" && idx < sorted.length - 1) newZ = sorted[idx + 1].zIndex + 1;
    else if (direction === "backward" && idx > 0) newZ = sorted[idx - 1].zIndex - 1;
    updateElement(elId, { zIndex: newZ });
  };

  // ─── Slide operations ────────────────────────────────────────────────────────
  const addSlide = () => {
    const newSlide = createEmptySlide(slides.length + 1);
    const next = [...slides.slice(0, activeIdx + 1), newSlide, ...slides.slice(activeIdx + 1)];
    onSlidesChange(next);
    onActiveIdxChange(activeIdx + 1);
    setSelectedId(null);
  };

  const duplicateSlide = (idx: number) => {
    const src = slides[idx];
    const copy: TeachSlide = {
      ...src,
      id: newSlideId(),
      title: `${src.title} (copy)`,
      elements: src.elements.map((e) => ({ ...e, id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
    };
    const next = [...slides.slice(0, idx + 1), copy, ...slides.slice(idx + 1)];
    onSlidesChange(next);
    onActiveIdxChange(idx + 1);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx);
    onSlidesChange(next);
    onActiveIdxChange(Math.min(idx, next.length - 1));
    setSelectedId(null);
  };

  const moveSlide = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = [...slides];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onSlidesChange(next);
    onActiveIdxChange(toIdx);
  };

  // ─── Pointer handlers (move + resize) ────────────────────────────────────────
  const handleCanvasPointerDown = (e: React.PointerEvent, elId: string) => {
    if (!slide || !canvasRef.current || masterLocked) return;
    const el = slide.elements.find((x) => x.id === elId);
    if (!el) return;
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(elId)) next.delete(elId); else next.add(elId);
        return next;
      });
    } else {
      setSelectedId(elId);
      setSelectedIds(new Set([elId]));
    }
    setDragState({ kind: "move", elId, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent, elId: string, handle: string) => {
    if (!slide || !canvasRef.current || masterLocked) return;
    const el = slide.elements.find((x) => x.id === elId);
    if (!el) return;
    e.stopPropagation();
    setDragState({ kind: "resize", elId, handle, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.width, origH: el.height });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragState || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragState.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragState.startY) / rect.height) * 100;

    if (dragState.kind === "move") {
      updateElement(dragState.elId, {
        x: Math.max(0, Math.min(95, dragState.origX + dx)),
        y: Math.max(0, Math.min(95, dragState.origY + dy)),
      });
    } else if (dragState.kind === "resize") {
      const { handle, origX, origY, origW, origH } = dragState;
      let x = origX, y = origY, w = origW, h = origH;
      if (handle.includes("e")) w = Math.max(5, origW + dx);
      if (handle.includes("s")) h = Math.max(5, origH + dy);
      if (handle.includes("w")) { x = origX + dx; w = Math.max(5, origW - dx); }
      if (handle.includes("n")) { y = origY + dy; h = Math.max(5, origH - dy); }
      updateElement(dragState.elId, { x: Math.max(0, x), y: Math.max(0, y), width: Math.min(100, w), height: Math.min(100, h) });
    }
  };

  const handleCanvasPointerUp = () => setDragState(null);

  // ─── File upload ─────────────────────────────────────────────────────────────
  const uploadFile = async (file: File, type: "image" | "video") => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      try {
        const result = await uploadMedia.mutateAsync({ base64, mimeType: file.type, filename: file.name });
        if (type === "image") addElement(createImageElement(result.url));
        else addElement(createVideoElement(result.url));
      } catch {
        toast.error("Upload failed");
      }
    };
    reader.readAsDataURL(file);
  };

  // ─── Apply theme ─────────────────────────────────────────────────────────────
  const applyTheme = (themeIdx: number) => {
    const theme = TEACH_THEMES[themeIdx];
    if (!theme || !slide) return;
    updateSlide({
      backgroundColor: theme.backgroundColor,
      backgroundType: theme.backgroundType,
      backgroundGradient: theme.backgroundGradient,
    });
    // Update title and body element colors
    const updatedElements = slide.elements.map((el) => {
      if (el.type !== "text") return el;
      const isTitle = el.style?.fontSize && el.style.fontSize >= 32;
      return {
        ...el,
        style: {
          ...el.style!,
          color: isTitle ? theme.titleColor : theme.bodyColor,
          fontFamily: theme.fontFamily,
        },
      };
    });
    updateSlide({
      backgroundColor: theme.backgroundColor,
      backgroundType: theme.backgroundType,
      backgroundGradient: theme.backgroundGradient,
      elements: updatedElements,
    });
    toast.success(`Theme "${theme.name}" applied`);
  };

  // ─── Visible elements (all visible in editor) ─────────────────────────────────
  const allVisible = new Set(slide?.elements.map((e) => e.id) ?? []);

  if (!slide) return null;

  const currentBgType = slide.backgroundType ?? "solid";
  const gradient = slide.backgroundGradient ?? { type: "linear" as const, angle: 135, stops: [{ color: "#189aa1", position: 0 }, { color: "#0d6b70", position: 100 }] };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Ribbon */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border-b flex-wrap">
        {/* Text format controls */}
        {selected?.type === "text" && (
          <>
            <span className="text-[10px] font-semibold text-gray-400 uppercase mr-1">Text</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, fontWeight: selected.style?.fontWeight === "bold" ? "normal" : "bold" } })}><Bold className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, fontStyle: selected.style?.fontStyle === "italic" ? "normal" : "italic" } })}><Italic className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textDecoration: selected.style?.textDecoration === "underline" ? "none" : "underline" } })}><Underline className="w-3.5 h-3.5" /></Button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bullet list" onClick={() => updateElement(selected.id, { style: { ...selected.style!, listType: selected.style?.listType === "bullet" ? "none" : "bullet" } })}><List className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Numbered list" onClick={() => updateElement(selected.id, { style: { ...selected.style!, listType: selected.style?.listType === "numbered" ? "none" : "numbered" } })}><ListOrdered className="w-3.5 h-3.5" /></Button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textAlign: "left" } })}><AlignLeft className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textAlign: "center" } })}><AlignCenter className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textAlign: "right" } })}><AlignRight className="w-3.5 h-3.5" /></Button>
            <Input type="number" min={8} max={120} className="h-7 w-14 text-xs ml-1" value={selected.style?.fontSize ?? 24} onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, fontSize: parseInt(e.target.value) || 24 } })} />
            <input type="color" className="h-7 w-8 rounded border cursor-pointer" value={selected.style?.color ?? "#111827"} onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, color: e.target.value } })} />
            {/* Font picker */}
            <Select value={selected.style?.fontFamily ?? ""} onValueChange={(v) => updateElement(selected.id, { style: { ...selected.style!, fontFamily: v } })}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Font" /></SelectTrigger>
              <SelectContent>
                {TEACH_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
          </>
        )}
        {/* Z-order controls */}
        {selectedId && (
          <>
            <span className="text-[10px] font-semibold text-gray-400 uppercase mr-1">Order</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bring to Front" onClick={() => changeZOrder(selectedId, "front")}><ChevronsUp className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bring Forward" onClick={() => changeZOrder(selectedId, "forward")}><ArrowUp className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Send Backward" onClick={() => changeZOrder(selectedId, "backward")}><ArrowDown className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Send to Back" onClick={() => changeZOrder(selectedId, "back")}><ChevronsDown className="w-3.5 h-3.5" /></Button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
          </>
        )}
        <span className="text-[10px] font-semibold text-gray-400 uppercase mr-1">Insert</span>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addElement(createTextElement())}><Type className="w-3.5 h-3.5 mr-1" /> Text</Button>
        <label className="cursor-pointer">
          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild><span><Image className="w-3.5 h-3.5 mr-1 inline" /> Image</span></Button>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "image"); e.target.value = ""; }} />
        </label>
        <label className="cursor-pointer">
          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild><span><Video className="w-3.5 h-3.5 mr-1 inline" /> Video</span></Button>
          <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "video"); e.target.value = ""; }} />
        </label>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addElement(createShapeElement())}><Square className="w-3.5 h-3.5 mr-1" /> Shape</Button>
        {selectedId && (
          <>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Duplicate element" onClick={duplicateSelected}><Copy className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" title="Delete element" onClick={deleteSelected}><Trash2 className="w-3.5 h-3.5" /></Button>
          </>
        )}
        {uploadMedia.isPending && <Loader2 className="w-4 h-4 animate-spin text-teal-600 ml-2" />}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Filmstrip */}
        <div className="w-36 bg-white border-r overflow-y-auto p-2 space-y-1">
          {slides.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragState({ kind: "slide-reorder", fromIdx: i, toIdx: null })}
              onDragOver={(e) => { e.preventDefault(); setDragOverSlideIdx(i); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragState?.kind === "slide-reorder") moveSlide(dragState.fromIdx, i);
                setDragState(null);
                setDragOverSlideIdx(null);
              }}
              onDragEnd={() => { setDragState(null); setDragOverSlideIdx(null); }}
              className={`relative rounded border p-1 text-left cursor-pointer group ${i === activeIdx ? "border-teal-500 ring-1 ring-teal-300" : "border-gray-200"} ${dragOverSlideIdx === i ? "border-teal-400 bg-teal-50" : ""}`}
              onClick={() => { onActiveIdxChange(i); setSelectedId(null); }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-400">{i + 1}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button type="button" title="Duplicate slide" className="text-gray-400 hover:text-teal-600" onClick={(e) => { e.stopPropagation(); duplicateSlide(i); }}>
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                  <button type="button" title="Delete slide" className="text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); deleteSlide(i); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <div className="aspect-video bg-gray-100 rounded overflow-hidden pointer-events-none">
                <div className="scale-[0.2] origin-top-left w-[500%] h-[500%]">
                  <TeachSlideRenderer slide={s} visibleElementIds={new Set(s.elements.map((e) => e.id))} mode="thumbnail" />
                </div>
              </div>
              <GripVertical className="absolute right-0.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1" onClick={addSlide}>+ Add Slide</Button>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 p-6 overflow-auto bg-gray-200"
          ref={canvasRef}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          <div className="max-w-4xl mx-auto relative">
            <TeachSlideRenderer
              slide={slide}
              visibleElementIds={allVisible}
              mode="editor"
              selectedElementId={selectedId}
              onSelectElement={setSelectedId}
              onElementPointerDown={handleCanvasPointerDown}
              onResizePointerDown={handleResizePointerDown}
              className="shadow-xl"
            />
            {selected?.type === "text" && (
              <Textarea
                className="absolute z-50 bg-white/95 border-teal-400 text-sm mt-2"
                style={{
                  left: `${selected.x}%`,
                  top: `calc(${selected.y}% + ${selected.height}% + 4px)`,
                  width: `${selected.width}%`,
                  minHeight: 60,
                  fontFamily: selected.style?.fontFamily || undefined,
                  fontSize: selected.style?.fontSize,
                }}
                value={selected.content ?? ""}
                placeholder="Type content here…"
                onChange={(e) => updateElement(selected.id, { content: e.target.value })}
              />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-64 bg-white border-l flex flex-col min-h-0">
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid grid-cols-4 m-2 mb-0 h-8">
              <TabsTrigger value="format" className="text-[10px]">Format</TabsTrigger>
              <TabsTrigger value="anim" className="text-[10px]">Animate</TabsTrigger>
              <TabsTrigger value="slide" className="text-[10px]">Slide</TabsTrigger>
              <TabsTrigger value="notes" className="text-[10px]">Notes</TabsTrigger>
            </TabsList>

            {/* Format tab */}
            <TabsContent value="format" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
              {selected ? (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase">{selected.type} element</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">X %</Label><Input type="number" className="h-7 text-xs mt-1" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: +e.target.value })} /></div>
                    <div><Label className="text-xs">Y %</Label><Input type="number" className="h-7 text-xs mt-1" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: +e.target.value })} /></div>
                    <div><Label className="text-xs">W %</Label><Input type="number" className="h-7 text-xs mt-1" value={Math.round(selected.width)} onChange={(e) => updateElement(selected.id, { width: +e.target.value })} /></div>
                    <div><Label className="text-xs">H %</Label><Input type="number" className="h-7 text-xs mt-1" value={Math.round(selected.height)} onChange={(e) => updateElement(selected.id, { height: +e.target.value })} /></div>
                  </div>
                  <div><Label className="text-xs">Z-Index</Label><Input type="number" className="h-7 text-xs mt-1" value={selected.zIndex} onChange={(e) => updateElement(selected.id, { zIndex: +e.target.value })} /></div>
                  {selected.type === "text" && (
                    <>
                      <div>
                        <Label className="text-xs">Font</Label>
                        <Select value={selected.style?.fontFamily ?? ""} onValueChange={(v) => updateElement(selected.id, { style: { ...selected.style!, fontFamily: v } })}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="System Default" /></SelectTrigger>
                          <SelectContent>
                            {TEACH_FONTS.map((f) => (
                              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">List type</Label>
                        <Select value={selected.style?.listType ?? "none"} onValueChange={(v) => updateElement(selected.id, { style: { ...selected.style!, listType: v as "none" | "bullet" | "numbered" } })}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="bullet">Bullet list</SelectItem>
                            <SelectItem value="numbered">Numbered list</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Line height</Label><Input type="number" step={0.1} min={1} max={3} className="h-7 text-xs mt-1" value={selected.style?.lineHeight ?? 1.4} onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, lineHeight: +e.target.value } })} /></div>
                        <div><Label className="text-xs">Letter spacing</Label><Input type="number" step={0.5} className="h-7 text-xs mt-1" value={selected.style?.letterSpacing ?? 0} onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, letterSpacing: +e.target.value } })} /></div>
                      </div>
                      <div>
                        <Label className="text-xs">Text decoration</Label>
                        <Select value={selected.style?.textDecoration ?? "none"} onValueChange={(v) => updateElement(selected.id, { style: { ...selected.style!, textDecoration: v as "none" | "underline" | "line-through" } })}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="underline">Underline</SelectItem>
                            <SelectItem value="line-through">Strikethrough</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Text background</Label>
                        <input type="color" className="h-8 w-full rounded border mt-1" value={selected.style?.backgroundColor ?? "#ffffff"} onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, backgroundColor: e.target.value === "#ffffff" ? undefined : e.target.value } })} />
                      </div>
                    </>
                  )}
                  {selected.type === "shape" && (
                    <>
                      <div>
                        <Label className="text-xs">Shape</Label>
                        <Select value={selected.shape ?? "rectangle"} onValueChange={(v) => updateElement(selected.id, { shape: v as "rectangle" | "ellipse" })}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rectangle">Rectangle</SelectItem>
                            <SelectItem value="ellipse">Ellipse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Fill</Label><input type="color" className="h-8 w-full rounded border mt-1" value={selected.fill ?? "#179ca322"} onChange={(e) => updateElement(selected.id, { fill: e.target.value })} /></div>
                        <div><Label className="text-xs">Stroke</Label><input type="color" className="h-8 w-full rounded border mt-1" value={selected.stroke ?? "#179ca3"} onChange={(e) => updateElement(selected.id, { stroke: e.target.value })} /></div>
                      </div>
                    </>
                  )}
                  {mode === "master" && (
                    <div>
                      <Label className="text-xs">Placeholder role</Label>
                      <Select value={selected.placeholderRole ?? ""} onValueChange={(v) => updateElement(selected.id, { placeholderRole: (v || undefined) as TeachPlaceholderRole | undefined })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {(["title", "subtitle", "body", "body2", "media", "footer"] as TeachPlaceholderRole[]).map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">Select an element to edit its properties.</p>
              )}
            </TabsContent>

            {/* Animation tab */}
            <TabsContent value="anim" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
              {selected ? (
                <>
                  <div>
                    <Label className="text-xs">Entrance animation</Label>
                    <Select value={selected.entrance?.type ?? "none"} onValueChange={(v) => updateElement(selected.id, { entrance: { ...DEFAULT_ANIMATION, ...selected.entrance, type: v as typeof DEFAULT_ANIMATION.type } })}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["none", "fadeIn", "fadeOut", "slideInLeft", "slideInRight", "slideInUp", "slideInDown", "zoomIn", "bounce"].map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Trigger</Label>
                    <Select value={selected.entrance?.trigger ?? "onClick"} onValueChange={(v) => updateElement(selected.id, { entrance: { ...DEFAULT_ANIMATION, ...selected.entrance, trigger: v as typeof DEFAULT_ANIMATION.trigger } })}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onClick">On click</SelectItem>
                        <SelectItem value="withPrevious">With previous</SelectItem>
                        <SelectItem value="afterPrevious">After previous</SelectItem>
                        <SelectItem value="auto">Auto (on slide enter)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Duration ms</Label><Input type="number" className="h-7 text-xs" value={selected.entrance?.durationMs ?? 600} onChange={(e) => updateElement(selected.id, { entrance: { ...DEFAULT_ANIMATION, ...selected.entrance, durationMs: +e.target.value } })} /></div>
                    <div><Label className="text-xs">Delay ms</Label><Input type="number" className="h-7 text-xs" value={selected.entrance?.delayMs ?? 0} onChange={(e) => updateElement(selected.id, { entrance: { ...DEFAULT_ANIMATION, ...selected.entrance, delayMs: +e.target.value } })} /></div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-400 space-y-2">
                  <p>Animation sequence for this slide:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {orderedEntranceElements(slide).map((el, i) => (
                      <li key={el.id}>{i + 1}. {el.type} — {el.entrance?.trigger ?? "onClick"}</li>
                    ))}
                  </ol>
                </div>
              )}
            </TabsContent>

            {/* Slide tab */}
            <TabsContent value="slide" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
              <div>
                <Label className="text-xs">{mode === "master" ? "Layout name" : "Slide title"}</Label>
                <Input className="h-8 text-xs mt-1" value={slide.title} onChange={(e) => updateSlide({ title: e.target.value })} />
              </div>
              {!masterLocked && (
                <>
                  {/* Background type */}
                  <div>
                    <Label className="text-xs">Background type</Label>
                    <div className="flex gap-1 mt-1">
                      {(["solid", "gradient", "image"] as TeachBackgroundType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`flex-1 text-[10px] py-1 rounded border capitalize ${currentBgType === t ? "bg-teal-600 text-white border-teal-600" : "border-gray-200 text-gray-600 hover:border-teal-400"}`}
                          onClick={() => updateSlide({ backgroundType: t })}
                        >{t}</button>
                      ))}
                    </div>
                  </div>

                  {currentBgType === "solid" && (
                    <div>
                      <Label className="text-xs">Background color</Label>
                      <input type="color" className="h-8 w-full rounded border mt-1" value={slide.backgroundColor ?? "#ffffff"} onChange={(e) => updateSlide({ backgroundColor: e.target.value })} />
                    </div>
                  )}

                  {currentBgType === "gradient" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Gradient</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Type</Label>
                          <Select value={gradient.type} onValueChange={(v) => updateSlide({ backgroundGradient: { ...gradient, type: v as "linear" | "radial" } })}>
                            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="linear">Linear</SelectItem>
                              <SelectItem value="radial">Radial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {gradient.type === "linear" && (
                          <div>
                            <Label className="text-[10px]">Angle °</Label>
                            <Input type="number" min={0} max={360} className="h-7 text-xs mt-0.5" value={gradient.angle ?? 135} onChange={(e) => updateSlide({ backgroundGradient: { ...gradient, angle: +e.target.value } })} />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Color stops</Label>
                        {gradient.stops.map((stop, si) => (
                          <div key={si} className="flex items-center gap-1">
                            <input type="color" className="h-6 w-8 rounded border" value={stop.color} onChange={(e) => {
                              const stops = [...gradient.stops];
                              stops[si] = { ...stops[si], color: e.target.value };
                              updateSlide({ backgroundGradient: { ...gradient, stops } });
                            }} />
                            <Input type="number" min={0} max={100} className="h-6 text-xs flex-1" value={stop.position} onChange={(e) => {
                              const stops = [...gradient.stops];
                              stops[si] = { ...stops[si], position: +e.target.value };
                              updateSlide({ backgroundGradient: { ...gradient, stops } });
                            }} />
                            <span className="text-[10px] text-gray-400">%</span>
                            {gradient.stops.length > 2 && (
                              <button type="button" className="text-red-400 hover:text-red-600 text-xs" onClick={() => {
                                const stops = gradient.stops.filter((_, i) => i !== si);
                                updateSlide({ backgroundGradient: { ...gradient, stops } });
                              }}>×</button>
                            )}
                          </div>
                        ))}
                        <Button size="sm" variant="outline" className="h-6 text-xs w-full" onClick={() => updateSlide({ backgroundGradient: { ...gradient, stops: [...gradient.stops, { color: "#ffffff", position: 100 }] } })}>+ Add stop</Button>
                      </div>
                    </div>
                  )}

                  {currentBgType === "image" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Background image URL</Label>
                      <Input className="h-8 text-xs" placeholder="https://..." value={slide.backgroundImage ?? ""} onChange={(e) => updateSlide({ backgroundImage: e.target.value })} />
                      <label className="cursor-pointer block">
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs" asChild><span>Upload image</span></Button>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = async (ev) => {
                            const base64 = (ev.target?.result as string).split(",")[1];
                            try {
                              const result = await uploadMedia.mutateAsync({ base64, mimeType: f.type, filename: f.name });
                              updateSlide({ backgroundImage: result.url, backgroundType: "image" });
                            } catch { toast.error("Upload failed"); }
                          };
                          reader.readAsDataURL(f);
                          e.target.value = "";
                        }} />
                      </label>
                    </div>
                  )}

                  {/* Themes */}
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Palette className="w-3 h-3" /> Apply theme</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {TEACH_THEMES.map((theme, ti) => (
                        <button
                          key={theme.name}
                          type="button"
                          className="text-[9px] p-1 rounded border border-gray-200 hover:border-teal-400 text-left truncate"
                          style={{ background: theme.backgroundColor, color: theme.titleColor }}
                          onClick={() => applyTheme(ti)}
                          title={theme.name}
                        >
                          {theme.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Transition</Label>
                    <Select value={slide.transition?.type ?? "fade"} onValueChange={(v) => updateSlide({ transition: { ...DEFAULT_TRANSITION, ...slide.transition, type: v as typeof DEFAULT_TRANSITION.type } })}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["none", "fade", "slideLeft", "slideRight", "slideUp", "slideDown", "zoom"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Auto-advance after (ms, empty = manual)</Label>
                    <Input type="number" min={0} className="h-8 text-xs mt-1" value={slide.advanceAfterMs ?? ""} placeholder="Manual" onChange={(e) => updateSlide({ advanceAfterMs: e.target.value ? +e.target.value : null })} />
                  </div>
                </>
              )}
              {masterLocked && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  A slide master is forced on this presentation. Layout and background are locked.
                </p>
              )}
            </TabsContent>

            {/* Notes tab */}
            <TabsContent value="notes" className="flex-1 overflow-y-auto p-3 m-0 flex flex-col">
              <Label className="text-xs">Presenter notes</Label>
              <Textarea className="flex-1 mt-1 text-sm min-h-[200px]" value={slide.notes ?? ""} onChange={(e) => updateSlide({ notes: e.target.value })} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export { createEmptySlide };
