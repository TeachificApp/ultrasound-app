/**
 * TeachPresenter.tsx — fullscreen audience view with animations, timings, and annotation overlay.
 * Controls auto-hide after 3s of inactivity. Annotation strokes received via BroadcastChannel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { TeachSlideRenderer } from "@/components/teach/TeachSlideRenderer";
import { usePresentationRunner } from "@/components/teach/usePresentationRunner";
import { slideTransitionClass } from "@shared/teachPresentation";
import { cn } from "@/lib/utils";

// ─── Annotation types ────────────────────────────────────────────────────────
type AnnotationStroke = {
  id: string;
  tool: "pen" | "highlighter" | "pointer";
  color: string;
  width: number;
  points: { x: number; y: number }[];
};

type AnnotationMsg =
  | { type: "stroke"; stroke: AnnotationStroke }
  | { type: "pointer-move"; x: number; y: number }
  | { type: "pointer-hide" }
  | { type: "clear" };

export default function TeachPresenter() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  // Check if we should auto-open notes window and request fullscreen
  const searchParams = new URLSearchParams(window.location.search);
  const shouldOpenNotes = searchParams.get("openNotes") === "1";

  const { data, isLoading } = trpc.teach.getMaterial.useQuery(
    { materialId },
    { enabled: !isNaN(materialId) },
  );

  const slides = data?.slides ?? [];

  const {
    slideIdx,
    visibleElementIds,
    animatingElementId,
    isTransitioning,
    currentSlide,
    advance,
    retreat,
  } = usePresentationRunner(materialId, slides);

  // ─── Auto-hide controls ───────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    showControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showControls]);

  // ─── Fullscreen + notes window on mount ──────────────────────────────────
  const notesOpenedRef = useRef(false);
  useEffect(() => {
    if (!shouldOpenNotes || notesOpenedRef.current) return;
    notesOpenedRef.current = true;
    // Open notes window (this is a user-initiated context from the new window)
    window.open(
      `/teach/presentation/${materialId}/notes`,
      `teach-notes-${materialId}`,
      "width=520,height=760,left=0,top=0",
    );
    // Request fullscreen on the document element
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {/* user may deny */});
    }
  }, [materialId, shouldOpenNotes]);

  // ─── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); advance(); }
      if (e.key === "ArrowLeft") retreat();
      if (e.key === "Escape") window.close();
      showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, retreat, showControls]);

  // ─── Annotation overlay ───────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const ch = new BroadcastChannel(`teach-annotations-${materialId}`);
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<AnnotationMsg>) => {
      const msg = e.data;
      if (msg.type === "stroke") {
        setStrokes((prev) => [...prev, msg.stroke]);
      } else if (msg.type === "pointer-move") {
        setPointerPos({ x: msg.x, y: msg.y });
      } else if (msg.type === "pointer-hide") {
        setPointerPos(null);
      } else if (msg.type === "clear") {
        setStrokes([]);
        setPointerPos(null);
      }
    };
    return () => ch.close();
  }, [materialId]);

  // Re-draw canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (stroke.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = stroke.width * 3;
      } else {
        ctx.globalAlpha = 1;
      }
      ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * canvas.width, stroke.points[i].y * canvas.height);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [strokes]);

  if (isLoading || !data || !currentSlide) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
      </div>
    );
  }

  const transClass = slideTransitionClass(currentSlide.transition?.type ?? "fade");

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col select-none overflow-hidden"
      style={{ cursor: controlsVisible ? "default" : "none" }}
      onMouseMove={showControls}
      onClick={(e) => {
        showControls();
        const target = e.target as HTMLElement;
        if (target.closest("video, audio, button, a, input, select, textarea, canvas")) return;
        advance();
      }}
    >
      {/* Slide canvas */}
      <div className="flex-1 flex items-center justify-center relative">
        <div
          key={currentSlide.id}
          className={cn("w-full max-w-6xl px-4", !isTransitioning && transClass)}
        >
          <TeachSlideRenderer
            slide={currentSlide}
            visibleElementIds={visibleElementIds}
            animatingElementId={animatingElementId}
            mode="present"
            className="shadow-2xl"
          />
        </div>

        {/* Annotation canvas overlay */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 50 }}
        />

        {/* Laser pointer dot */}
        {pointerPos && (
          <div
            className="absolute w-5 h-5 rounded-full bg-red-500 shadow-lg pointer-events-none"
            style={{
              left: `${pointerPos.x * 100}%`,
              top: `${pointerPos.y * 100}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 60,
              boxShadow: "0 0 12px 4px rgba(239,68,68,0.6)",
            }}
          />
        )}
      </div>

      {/* Auto-hide controls bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 px-6 py-4 flex items-center justify-between text-sm text-white/70 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ zIndex: 40 }}
      >
        <button
          type="button"
          className="flex items-center gap-1 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); retreat(); }}
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-white/50">{slideIdx + 1} / {slides.length}</span>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); advance(); }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
