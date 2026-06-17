/**
 * TeachPresenterNotes.tsx — presenter notes window.
 * Features: prev/next at top + bottom, next-slide thumbnail, annotation tools
 * (pen/highlighter/pointer) via BroadcastChannel, play/pause auto-advance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Loader2, ChevronLeft, ChevronRight, Pen, Highlighter, MousePointer,
  Eraser, Play, Pause, Monitor,
} from "lucide-react";
import { TeachSlideRenderer } from "@/components/teach/TeachSlideRenderer";
import {
  presenterSlideKey, presenterStepKey, presenterTickKey,
} from "@shared/teachPresentation";
import { cn } from "@/lib/utils";

type AnnotationTool = "pen" | "highlighter" | "pointer" | null;

type AnnotationMsg =
  | { type: "stroke"; stroke: { id: string; tool: "pen" | "highlighter" | "pointer"; color: string; width: number; points: { x: number; y: number }[] } }
  | { type: "pointer-move"; x: number; y: number }
  | { type: "pointer-hide" }
  | { type: "clear" };

const TOOL_COLORS: Record<string, string> = {
  pen: "#ef4444",
  highlighter: "#facc15",
  pointer: "#ef4444",
};

export default function TeachPresenterNotes() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const [slideIdx, setSlideIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null);
  const [annotationColor, setAnnotationColor] = useState("#ef4444");
  const [annotationWidth, setAnnotationWidth] = useState(3);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = trpc.teach.getMaterial.useQuery(
    { materialId },
    { enabled: !isNaN(materialId) },
  );
  const slides = data?.slides ?? [];

  // ─── BroadcastChannel setup ───────────────────────────────────────────────
  useEffect(() => {
    const ch = new BroadcastChannel(`teach-annotations-${materialId}`);
    channelRef.current = ch;
    return () => ch.close();
  }, [materialId]);

  // ─── Sync from localStorage (audience window drives slide) ───────────────
  useEffect(() => {
    const read = () => {
      const s = localStorage.getItem(presenterSlideKey(materialId));
      const st = localStorage.getItem(presenterStepKey(materialId));
      if (s !== null) setSlideIdx(parseInt(s, 10) || 0);
      if (st !== null) setStepIdx(parseInt(st, 10) || 0);
    };
    read();
    const iv = setInterval(read, 400);
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === presenterSlideKey(materialId) ||
        e.key === presenterStepKey(materialId) ||
        e.key === presenterTickKey(materialId)
      ) read();
    };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(iv); window.removeEventListener("storage", onStorage); };
  }, [materialId]);

  // ─── Navigate slides (writes to localStorage → audience window reads) ─────
  const goTo = useCallback((idx: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, idx));
    localStorage.setItem(presenterSlideKey(materialId), String(next));
    localStorage.setItem(presenterStepKey(materialId), "0");
    localStorage.setItem(presenterTickKey(materialId), String(Date.now()));
    setSlideIdx(next);
    setStepIdx(0);
    // Clear annotations on slide change
    channelRef.current?.postMessage({ type: "clear" } as AnnotationMsg);
  }, [materialId, slides.length]);

  // ─── Auto-play timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      return;
    }
    const slide = slides[slideIdx];
    const delay = slide?.advanceAfterMs ?? 5000;
    playTimerRef.current = setTimeout(() => {
      if (slideIdx < slides.length - 1) goTo(slideIdx + 1);
      else setIsPlaying(false);
    }, delay);
    return () => { if (playTimerRef.current) clearTimeout(playTimerRef.current); };
  }, [isPlaying, slideIdx, slides, goTo]);

  // ─── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goTo(slideIdx + 1); }
      if (e.key === "ArrowLeft") goTo(slideIdx - 1);
      if (e.key === "Escape") setActiveTool(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideIdx, goTo]);

  // ─── Annotation drawing on thumbnail ─────────────────────────────────────
  const handleThumbnailPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTool) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    drawingRef.current = true;
    const strokeId = `s-${Date.now()}`;
    currentStrokeRef.current = { id: strokeId, points: [{ x, y }] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (activeTool === "pointer") {
      channelRef.current?.postMessage({ type: "pointer-move", x, y } as AnnotationMsg);
    }
  };

  const handleThumbnailPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTool || !drawingRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (activeTool === "pointer") {
      channelRef.current?.postMessage({ type: "pointer-move", x, y } as AnnotationMsg);
      return;
    }
    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y });
    }
  };

  const handleThumbnailPointerUp = () => {
    if (!activeTool) return;
    drawingRef.current = false;
    if (activeTool === "pointer") {
      channelRef.current?.postMessage({ type: "pointer-hide" } as AnnotationMsg);
      return;
    }
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      channelRef.current?.postMessage({
        type: "stroke",
        stroke: {
          id: currentStrokeRef.current.id,
          tool: activeTool,
          color: annotationColor,
          width: annotationWidth,
          points: currentStrokeRef.current.points,
        },
      } as AnnotationMsg);
    }
    currentStrokeRef.current = null;
  };

  const clearAnnotations = () => {
    channelRef.current?.postMessage({ type: "clear" } as AnnotationMsg);
  };

  const openPresenterWindow = () => {
    window.open(`/teach/present/${materialId}`, `teach-present-${materialId}`, "width=1280,height=720");
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const slide = slides[slideIdx];
  const nextSlide = slides[slideIdx + 1];
  const isFirst = slideIdx === 0;
  const isLast = slideIdx === slides.length - 1;

  const NavBar = ({ className }: { className?: string }) => (
    <div className={cn("flex items-center justify-between px-4 py-2 bg-white border-t", className)}>
      <button
        type="button"
        disabled={isFirst}
        className="flex items-center gap-1 text-sm text-teal-600 disabled:opacity-30 hover:text-teal-800 transition-colors"
        onClick={() => goTo(slideIdx - 1)}
      >
        <ChevronLeft className="w-4 h-4" /> Prev
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-teal-600 hover:text-teal-800 transition-colors"
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? "Pause auto-advance" : "Play auto-advance"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <span className="text-xs text-gray-400">{slideIdx + 1} / {slides.length}</span>
      </div>
      <button
        type="button"
        disabled={isLast}
        className="flex items-center gap-1 text-sm text-teal-600 disabled:opacity-30 hover:text-teal-800 transition-colors"
        onClick={() => goTo(slideIdx + 1)}
      >
        Next <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900">
      {/* Header */}
      <div className="bg-teal-700 text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium truncate">{data.title} — Presenter Notes</span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
          onClick={openPresenterWindow}
          title="Open presentation in new window"
        >
          <Monitor className="w-3.5 h-3.5" /> Open Presentation
        </button>
      </div>

      {/* Top nav */}
      <NavBar className="border-t-0 border-b" />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current slide info */}
        <div>
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
            Slide {slideIdx + 1} of {slides.length}{stepIdx > 0 ? ` · step ${stepIdx}` : ""}
          </p>
          <h2 className="font-bold text-gray-900 text-lg">{slide?.title || "(Untitled)"}</h2>
          <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">
            {slide?.notes || "(No notes for this slide)"}
          </p>
          {slide?.advanceAfterMs ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
              Timed slide: auto-advance after {(slide.advanceAfterMs / 1000).toFixed(1)}s
            </p>
          ) : null}
        </div>

        {/* Annotation tools */}
        <div className="border rounded-lg p-3 bg-white space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Annotation Tools</p>
          <div className="flex items-center gap-2 flex-wrap">
            {(["pen", "highlighter", "pointer"] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium border transition-colors",
                  activeTool === tool
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                )}
                onClick={() => setActiveTool(activeTool === tool ? null : tool)}
              >
                {tool === "pen" && <Pen className="w-3.5 h-3.5" />}
                {tool === "highlighter" && <Highlighter className="w-3.5 h-3.5" />}
                {tool === "pointer" && <MousePointer className="w-3.5 h-3.5" />}
                {tool.charAt(0).toUpperCase() + tool.slice(1)}
              </button>
            ))}
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              onClick={clearAnnotations}
            >
              <Eraser className="w-3.5 h-3.5" /> Clear
            </button>
            {activeTool && activeTool !== "pointer" && (
              <>
                <input
                  type="color"
                  value={annotationColor}
                  onChange={(e) => setAnnotationColor(e.target.value)}
                  className="h-7 w-8 rounded border cursor-pointer"
                  title="Annotation color"
                />
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={annotationWidth}
                  onChange={(e) => setAnnotationWidth(Number(e.target.value))}
                  className="w-20 h-5"
                  title="Stroke width"
                />
              </>
            )}
          </div>
          {activeTool && (
            <p className="text-xs text-teal-600">
              {activeTool === "pointer"
                ? "Draw on the slide preview below to move the laser pointer on the presentation."
                : `Draw on the slide preview below — strokes appear on the presentation window.`}
            </p>
          )}
        </div>

        {/* Current slide thumbnail (annotation surface) */}
        {slide && (
          <div className="border rounded-lg overflow-hidden bg-white">
            <p className="text-xs font-semibold text-gray-500 uppercase px-3 pt-2 pb-1">Current Slide</p>
            <div
              ref={thumbnailRef}
              className={cn(
                "relative select-none",
                activeTool ? "cursor-crosshair" : "cursor-default",
              )}
              onPointerDown={handleThumbnailPointerDown}
              onPointerMove={handleThumbnailPointerMove}
              onPointerUp={handleThumbnailPointerUp}
            >
              <TeachSlideRenderer
                slide={slide}
                mode="preview"
                className="pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* Next slide preview */}
        {nextSlide && (
          <div className="border rounded-lg overflow-hidden bg-white">
            <p className="text-xs font-semibold text-gray-500 uppercase px-3 pt-2 pb-1">Up Next — {nextSlide.title || "Untitled"}</p>
            <TeachSlideRenderer
              slide={nextSlide}
              mode="preview"
              className="opacity-80"
            />
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <NavBar />
    </div>
  );
}
