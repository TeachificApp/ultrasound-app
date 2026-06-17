/**
 * usePresentationRunner — drives entrance animations, timings, and slide advance (audience window only).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TeachSlide,
  orderedEntranceElements,
  presenterSlideKey,
  presenterStepKey,
  presenterTickKey,
} from "@shared/teachPresentation";

export function usePresentationRunner(materialId: number, slides: TeachSlide[]) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [visibleElementIds, setVisibleElementIds] = useState<Set<string>>(new Set());
  const [animatingElementId, setAnimatingElementId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const clearTimers = useCallback(() => {
    autoTimers.current.forEach(clearTimeout);
    autoTimers.current = [];
    if (slideTimer.current) {
      clearTimeout(slideTimer.current);
      slideTimer.current = null;
    }
  }, []);

  const syncStorage = useCallback(
    (sIdx: number, stIdx: number) => {
      localStorage.setItem(presenterSlideKey(materialId), String(sIdx));
      localStorage.setItem(presenterStepKey(materialId), String(stIdx));
      localStorage.setItem(presenterTickKey(materialId), String(Date.now()));
    },
    [materialId],
  );

  const runEntranceForElement = useCallback(
    (el: { id: string; entrance?: { durationMs: number; delayMs: number } }, onDone: () => void) => {
      const delay = (el.entrance?.delayMs ?? 0) + (el.entrance?.durationMs ?? 600);
      setAnimatingElementId(el.id);
      setVisibleElementIds((prev) => new Set([...prev, el.id]));
      const t = setTimeout(() => {
        setAnimatingElementId(null);
        onDone();
      }, delay);
      autoTimers.current.push(t);
    },
    [],
  );

  const initSlide = useCallback(
    (idx: number) => {
      clearTimers();
      const slide = slidesRef.current[idx];
      if (!slide) return;

      const ordered = orderedEntranceElements(slide);
      const initialVisible = new Set<string>();
      slide.elements.forEach((el) => {
        if (!el.entrance || el.entrance.type === "none") initialVisible.add(el.id);
      });

      setVisibleElementIds(initialVisible);
      setStepIdx(0);
      setAnimatingElementId(null);
      syncStorage(idx, 0);

      let chainIdx = 0;
      const runChain = () => {
        while (chainIdx < ordered.length) {
          const el = ordered[chainIdx]!;
          const trigger = el.entrance?.trigger ?? "onClick";
          if (trigger === "onClick") break;
          chainIdx++;
          runEntranceForElement(el, runChain);
          return;
        }
        setStepIdx(chainIdx);
        syncStorage(idx, chainIdx);

        const advanceMs = slide.advanceAfterMs;
        if (advanceMs && advanceMs > 0) {
          slideTimer.current = setTimeout(() => {
            goToSlideRef.current(idx + 1);
          }, advanceMs);
        }
      };

      runChain();
    },
    [clearTimers, runEntranceForElement, syncStorage],
  );

  const goToSlideRef = useRef<(idx: number) => void>(() => {});

  goToSlideRef.current = (idx: number) => {
    const list = slidesRef.current;
    const next = Math.max(0, Math.min(list.length - 1, idx));
    setSlideIdx((prev) => {
      if (prev === next) return prev;
      setIsTransitioning(true);
      const slide = list[prev];
      const transMs = slide?.transition?.durationMs ?? 400;
      setTimeout(() => {
        setIsTransitioning(false);
        initSlide(next);
      }, transMs);
      syncStorage(next, 0);
      return next;
    });
  };

  const goToSlide = useCallback((idx: number) => {
    goToSlideRef.current(idx);
  }, []);

  const advance = useCallback(() => {
    const slide = slidesRef.current[slideIdx];
    if (!slide) return;

    const ordered = orderedEntranceElements(slide);
    const clickElements = ordered.filter((el) => el.entrance?.trigger === "onClick");

    setVisibleElementIds((visible) => {
      const alreadyShown = clickElements.filter((el) => visible.has(el.id));
      if (alreadyShown.length < clickElements.length) {
        const nextEl = clickElements[alreadyShown.length]!;
        runEntranceForElement(nextEl, () => {
          setStepIdx((s) => {
            const n = s + 1;
            syncStorage(slideIdx, n);
            return n;
          });
        });
        return visible;
      }
      goToSlide(slideIdx + 1);
      return visible;
    });
  }, [slideIdx, runEntranceForElement, syncStorage, goToSlide]);

  const retreat = useCallback(() => {
    goToSlide(slideIdx - 1);
  }, [goToSlide, slideIdx]);

  useEffect(() => {
    if (slides.length === 0) return;
    const stored = localStorage.getItem(presenterSlideKey(materialId));
    const initial = stored ? parseInt(stored, 10) || 0 : 0;
    const safe = Math.min(initial, slides.length - 1);
    setSlideIdx(safe);
    initSlide(safe);
    return clearTimers;
  }, [materialId, slides, initSlide, clearTimers]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === presenterSlideKey(materialId) && e.newValue != null) {
        const idx = parseInt(e.newValue, 10) || 0;
        setSlideIdx((prev) => {
          if (prev !== idx) initSlide(idx);
          return idx;
        });
      }
      if (e.key === presenterStepKey(materialId) && e.newValue != null) {
        setStepIdx(parseInt(e.newValue, 10) || 0);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [materialId, initSlide]);

  return {
    slideIdx,
    stepIdx,
    visibleElementIds,
    animatingElementId,
    isTransitioning,
    currentSlide: slides[slideIdx],
    advance,
    retreat,
    goToSlide,
  };
}
