/**
 * TeachPresenter.tsx — fullscreen audience presentation view.
 * Syncs slide index with presenter notes window via localStorage.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

function storageKey(materialId: number) {
  return `teach-present-${materialId}-slide`;
}

export default function TeachPresenter() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const [slideIdx, setSlideIdx] = useState(0);

  const { data, isLoading } = trpc.teach.getMaterial.useQuery(
    { materialId },
    { enabled: !isNaN(materialId) },
  );

  const slides = data?.slides ?? [];

  const goTo = useCallback(
    (idx: number) => {
      const next = Math.max(0, Math.min(slides.length - 1, idx));
      setSlideIdx(next);
      localStorage.setItem(storageKey(materialId), String(next));
    },
    [materialId, slides.length],
  );

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(materialId));
    if (stored) setSlideIdx(parseInt(stored, 10) || 0);
  }, [materialId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goTo(slideIdx + 1);
      if (e.key === "ArrowLeft") goTo(slideIdx - 1);
      if (e.key === "Escape") window.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideIdx, goTo]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(materialId) && e.newValue) {
        setSlideIdx(parseInt(e.newValue, 10) || 0);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [materialId]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
      </div>
    );
  }

  const slide = slides[slideIdx];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-teal-950 text-white flex flex-col cursor-pointer select-none"
      onClick={() => goTo(slideIdx + 1)}
    >
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-5xl w-full text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">{slide?.title}</h1>
          <p className="text-xl md:text-2xl text-white/80 whitespace-pre-wrap">{slide?.content}</p>
          {slide?.imageUrl && (
            <img src={slide.imageUrl} alt="" className="mx-auto max-h-80 rounded-lg shadow-2xl" />
          )}
        </div>
      </div>

      <div className="px-6 py-4 flex items-center justify-between text-sm text-white/50 border-t border-white/10">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-white"
          onClick={(e) => { e.stopPropagation(); goTo(slideIdx - 1); }}
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span>{slideIdx + 1} / {slides.length}</span>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-white"
          onClick={(e) => { e.stopPropagation(); goTo(slideIdx + 1); }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
