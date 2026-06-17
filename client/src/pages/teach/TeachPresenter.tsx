/**
 * TeachPresenter.tsx — fullscreen audience view with animations & timings.
 */

import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { TeachSlideRenderer } from "@/components/teach/TeachSlideRenderer";
import { usePresentationRunner } from "@/components/teach/usePresentationRunner";
import { slideTransitionClass } from "@shared/teachPresentation";
import { cn } from "@/lib/utils";

export default function TeachPresenter() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        advance();
      }
      if (e.key === "ArrowLeft") retreat();
      if (e.key === "Escape") window.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, retreat]);

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
      className="min-h-screen bg-gray-950 text-white flex flex-col cursor-pointer select-none"
      onClick={() => advance()}
    >
      <div className="flex-1 flex items-center justify-center p-8 md:p-12">
        <div
          key={currentSlide.id}
          className={cn("w-full max-w-6xl", !isTransitioning && transClass)}
        >
          <TeachSlideRenderer
            slide={currentSlide}
            visibleElementIds={visibleElementIds}
            animatingElementId={animatingElementId}
            mode="present"
            className="shadow-2xl"
          />
        </div>
      </div>

      <div className="px-6 py-4 flex items-center justify-between text-sm text-white/50 border-t border-white/10">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-white"
          onClick={(e) => { e.stopPropagation(); retreat(); }}
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span>{slideIdx + 1} / {slides.length}</span>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-white"
          onClick={(e) => { e.stopPropagation(); advance(); }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
