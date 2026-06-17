/**
 * TeachOfficeEditor — Office-style presentation editor (ribbon, canvas, format/animation panels).
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
  createEmptySlide,
  createImageElement,
  createVideoElement,
  createShapeElement,
  createTextElement,
  DEFAULT_ANIMATION,
  DEFAULT_VIDEO,
  DEFAULT_TRANSITION,
  orderedEntranceElements,
} from "@shared/teachPresentation";
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Type, Image, Video, Square,
  Trash2, Copy, ChevronUp, ChevronDown, Loader2,
} from "lucide-react";

interface TeachOfficeEditorProps {
  slides: TeachSlide[];
  onSlidesChange: (slides: TeachSlide[]) => void;
  activeIdx: number;
  onActiveIdxChange: (idx: number) => void;
  /** Master designer mode — shows placeholder role controls */
  mode?: "presentation" | "master";
  /** When master is forced on a presentation, lock layout/background edits */
  masterLocked?: boolean;
}

export function TeachOfficeEditor({
  slides,
  onSlidesChange,
  activeIdx,
  onActiveIdxChange,
  mode = "presentation",
  masterLocked = false,
}: TeachOfficeEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState("format");
  const dragRef = useRef<{ elId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
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
      updateSlide({
        elements: slide.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)),
      });
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

  const handleCanvasPointerDown = (e: React.PointerEvent, elId: string) => {
    if (!slide || !canvasRef.current || masterLocked) return;
    const el = slide.elements.find((x) => x.id === elId);
    if (!el) return;
    e.stopPropagation();
    setSelectedId(elId);
    dragRef.current = { elId, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    updateElement(dragRef.current.elId, {
      x: Math.max(0, Math.min(95, dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(95, dragRef.current.origY + dy)),
    });
  };

  const handleCanvasPointerUp = () => {
    dragRef.current = null;
  };

  const uploadFile = async (file: File, type: "image" | "video") => {
    if (file.size > 40 * 1024 * 1024) {
      toast.error("Max 40 MB");
      return;
    }
    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const result = await uploadMedia.mutateAsync({
        dataUri,
        mimeType: file.type,
        fileName: file.name,
        context: "teach",
      });
      if (type === "image") addElement(createImageElement(result.url));
      else addElement(createVideoElement(result.url));
      toast.success("Inserted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  if (!slide) return null;

  const allVisible = new Set(slide.elements.map((e) => e.id));

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Ribbon */}
      <div className="bg-gray-50 border-b px-3 py-2 flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold text-gray-400 uppercase mr-2">Home</span>
        {selected?.type === "text" && (
          <>
            <Button
              size="sm" variant={selected.style?.fontWeight === "bold" ? "secondary" : "ghost"} className="h-7 w-7 p-0"
              onClick={() => updateElement(selected.id, { style: { ...selected.style!, fontWeight: selected.style?.fontWeight === "bold" ? "normal" : "bold" } })}
            ><Bold className="w-3.5 h-3.5" /></Button>
            <Button
              size="sm" variant={selected.style?.fontStyle === "italic" ? "secondary" : "ghost"} className="h-7 w-7 p-0"
              onClick={() => updateElement(selected.id, { style: { ...selected.style!, fontStyle: selected.style?.fontStyle === "italic" ? "normal" : "italic" } })}
            ><Italic className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textAlign: "left" } })}><AlignLeft className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textAlign: "center" } })}><AlignCenter className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { style: { ...selected.style!, textAlign: "right" } })}><AlignRight className="w-3.5 h-3.5" /></Button>
            <Input
              type="number" min={10} max={96} className="h-7 w-14 text-xs ml-1"
              value={selected.style?.fontSize ?? 24}
              onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, fontSize: parseInt(e.target.value) || 24 } })}
            />
            <input
              type="color" className="h-7 w-8 rounded border cursor-pointer"
              value={selected.style?.color ?? "#111827"}
              onChange={(e) => updateElement(selected.id, { style: { ...selected.style!, color: e.target.value } })}
            />
          </>
        )}
        <div className="w-px h-5 bg-gray-200 mx-1" />
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
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={duplicateSelected}><Copy className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={deleteSelected}><Trash2 className="w-3.5 h-3.5" /></Button>
          </>
        )}
        {uploadMedia.isPending && <Loader2 className="w-4 h-4 animate-spin text-teal-600 ml-2" />}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Filmstrip */}
        <div className="w-36 bg-white border-r overflow-y-auto p-2 space-y-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onActiveIdxChange(i); setSelectedId(null); }}
              className={`w-full rounded border p-1 text-left ${i === activeIdx ? "border-teal-500 ring-1 ring-teal-300" : "border-gray-200"}`}
            >
              <div className="text-[9px] text-gray-400 mb-0.5">{i + 1}</div>
              <div className="aspect-video bg-gray-100 rounded overflow-hidden pointer-events-none scale-[0.85] origin-top-left w-[117%]">
                <TeachSlideRenderer slide={s} visibleElementIds={new Set(s.elements.map((e) => e.id))} mode="editor" />
              </div>
            </button>
          ))}
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
                }}
                value={selected.content ?? ""}
                onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                placeholder="Edit text content..."
              />
            )}
          </div>
        </div>

        {/* Properties */}
        <div className="w-80 bg-white border-l flex flex-col min-h-0">
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="w-full rounded-none border-b h-9 shrink-0">
              <TabsTrigger value="format" className="text-xs flex-1">Format</TabsTrigger>
              <TabsTrigger value="animations" className="text-xs flex-1">Animations</TabsTrigger>
              <TabsTrigger value="slide" className="text-xs flex-1">Slide</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs flex-1">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="format" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
              {selected ? (
                <>
                  {mode === "master" && selected.type === "text" && (
                    <div>
                      <Label className="text-xs">Placeholder role</Label>
                      <Select
                        value={selected.placeholderRole ?? "body"}
                        onValueChange={(v) => updateElement(selected.id, { placeholderRole: v as TeachPlaceholderRole })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["title", "subtitle", "body", "body2", "media", "footer"] as const).map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!masterLocked && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">X %</Label><Input type="number" className="h-7 text-xs" value={selected.x} onChange={(e) => updateElement(selected.id, { x: +e.target.value })} /></div>
                    <div><Label className="text-xs">Y %</Label><Input type="number" className="h-7 text-xs" value={selected.y} onChange={(e) => updateElement(selected.id, { y: +e.target.value })} /></div>
                    <div><Label className="text-xs">Width %</Label><Input type="number" className="h-7 text-xs" value={selected.width} onChange={(e) => updateElement(selected.id, { width: +e.target.value })} /></div>
                    <div><Label className="text-xs">Height %</Label><Input type="number" className="h-7 text-xs" value={selected.height} onChange={(e) => updateElement(selected.id, { height: +e.target.value })} /></div>
                  </div>
                  )}
                  {selected.type === "video" && (
                    <div className="space-y-2 border-t pt-2">
                      <p className="text-xs font-semibold text-gray-500">Video playback</p>
                      {(["autoplay", "loop", "muted", "controls"] as const).map((k) => (
                        <label key={k} className="flex items-center gap-2 text-xs capitalize">
                          <input
                            type="checkbox"
                            checked={selected.video?.[k] ?? DEFAULT_VIDEO[k]}
                            onChange={(e) => updateElement(selected.id, { video: { ...DEFAULT_VIDEO, ...selected.video, [k]: e.target.checked } })}
                          />
                          {k}
                        </label>
                      ))}
                      <div>
                        <Label className="text-xs">Start at (sec)</Label>
                        <Input type="number" min={0} className="h-7 text-xs" value={selected.video?.startAtSec ?? ""} onChange={(e) => updateElement(selected.id, { video: { ...DEFAULT_VIDEO, ...selected.video, startAtSec: e.target.value ? +e.target.value : undefined } })} />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">Select an element on the slide</p>
              )}
            </TabsContent>

            <TabsContent value="animations" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
              {selected ? (
                <>
                  <p className="text-xs font-semibold text-gray-500">Entrance animation</p>
                  <Select
                    value={selected.entrance?.type ?? "fadeIn"}
                    onValueChange={(v) => updateElement(selected.id, { entrance: { ...DEFAULT_ANIMATION, ...selected.entrance, type: v as typeof DEFAULT_ANIMATION.type } })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["none", "fadeIn", "slideInLeft", "slideInRight", "slideInUp", "slideInDown", "zoomIn", "bounce"].map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <Label className="text-xs">Trigger</Label>
                    <Select
                      value={selected.entrance?.trigger ?? "onClick"}
                      onValueChange={(v) => updateElement(selected.id, { entrance: { ...DEFAULT_ANIMATION, ...selected.entrance, trigger: v as typeof DEFAULT_ANIMATION.trigger } })}
                    >
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

            <TabsContent value="slide" className="flex-1 overflow-y-auto p-3 space-y-3 m-0">
              <div>
                <Label className="text-xs">{mode === "master" ? "Layout name" : "Slide title"}</Label>
                <Input className="h-8 text-xs mt-1" value={slide.title} onChange={(e) => updateSlide({ title: e.target.value })} />
              </div>
              {!masterLocked && (
              <>
              <div>
                <Label className="text-xs">Background</Label>
                <input type="color" className="h-8 w-full rounded border mt-1" value={slide.backgroundColor ?? "#ffffff"} onChange={(e) => updateSlide({ backgroundColor: e.target.value })} />
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
                  A slide master is forced on this presentation. Layout and background are locked; edit text and media content only.
                </p>
              )}
            </TabsContent>

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
