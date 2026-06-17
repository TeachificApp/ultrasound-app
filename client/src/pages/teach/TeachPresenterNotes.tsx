/**
 * TeachPresenterNotes.tsx — presenter notes window (syncs slide index from audience window).
 */

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { presenterSlideKey, presenterStepKey, presenterTickKey } from "@shared/teachPresentation";

export default function TeachPresenterNotes() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const [slideIdx, setSlideIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  const { data, isLoading } = trpc.teach.getMaterial.useQuery(
    { materialId },
    { enabled: !isNaN(materialId) },
  );

  const slides = data?.slides ?? [];

  useEffect(() => {
    const read = () => {
      const s = localStorage.getItem(presenterSlideKey(materialId));
      const st = localStorage.getItem(presenterStepKey(materialId));
      if (s) setSlideIdx(parseInt(s, 10) || 0);
      if (st) setStepIdx(parseInt(st, 10) || 0);
    };
    read();
    const iv = setInterval(read, 400);
    const onStorage = (e: StorageEvent) => {
      if (e.key === presenterSlideKey(materialId) || e.key === presenterStepKey(materialId) || e.key === presenterTickKey(materialId)) {
        read();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(iv);
      window.removeEventListener("storage", onStorage);
    };
  }, [materialId]);

  const goTo = (idx: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, idx));
    localStorage.setItem(presenterSlideKey(materialId), String(next));
    localStorage.setItem(presenterStepKey(materialId), "0");
    localStorage.setItem(presenterTickKey(materialId), String(Date.now()));
    setSlideIdx(next);
    setStepIdx(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goTo(slideIdx + 1);
      if (e.key === "ArrowLeft") goTo(slideIdx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideIdx, slides.length]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const slide = slides[slideIdx];
  const nextSlide = slides[slideIdx + 1];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-teal-700 text-white px-4 py-2 text-sm font-medium">
        Presenter Notes — {data.title}
      </div>
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div>
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
            Slide {slideIdx + 1} · step {stepIdx}
          </p>
          <h2 className="font-bold text-gray-900">{slide?.title}</h2>
          <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
            {slide?.notes || "(No notes for this slide)"}
          </p>
        </div>
        {slide?.advanceAfterMs ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Timed slide: auto-advance after {slide.advanceAfterMs}ms
          </p>
        ) : null}
        {nextSlide && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Up next</p>
            <p className="text-sm font-medium text-gray-700">{nextSlide.title}</p>
          </div>
        )}
      </div>
      <div className="border-t px-4 py-3 flex items-center justify-between bg-white">
        <button type="button" className="text-sm text-teal-600 flex items-center gap-1" onClick={() => goTo(slideIdx - 1)}>
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-xs text-gray-400">{slideIdx + 1} / {slides.length}</span>
        <button type="button" className="text-sm text-teal-600 flex items-center gap-1" onClick={() => goTo(slideIdx + 1)}>
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
