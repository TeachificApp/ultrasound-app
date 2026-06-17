/**
 * TeachSlideRenderer — renders a slide canvas with optional animation state.
 */

import { useEffect, useRef } from "react";
import {
  type TeachSlide,
  type TeachSlideElement,
  animationCssClass,
  DEFAULT_TEXT_STYLE,
} from "@shared/teachPresentation";
import { cn } from "@/lib/utils";

export interface TeachSlideRendererProps {
  slide: TeachSlide;
  /** Elements whose entrance animation has completed (by id) */
  visibleElementIds: Set<string>;
  /** Currently animating element id */
  animatingElementId?: string | null;
  /** Editor vs presenter scale */
  mode?: "editor" | "present";
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onElementPointerDown?: (e: React.PointerEvent, elId: string) => void;
  className?: string;
}

function ElementContent({
  el,
  visible,
  animating,
  mode,
}: {
  el: TeachSlideElement;
  visible: boolean;
  animating: boolean;
  mode: "editor" | "present";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const anim = el.entrance;
  const animType = anim?.type ?? "none";
  const animClass = visible && animating && animType !== "none" ? animationCssClass(animType) : "";
  const hidden = !visible && mode === "present";

  useEffect(() => {
    if (el.type !== "video" || !videoRef.current || !visible) return;
    const v = videoRef.current;
    const settings = el.video;
    if (!settings) return;
    v.muted = settings.muted;
    v.loop = settings.loop;
    v.controls = settings.controls;
    if (settings.startAtSec) v.currentTime = settings.startAtSec;
    if (settings.autoplay && mode === "present") {
      v.play().catch(() => {});
    }
  }, [el, visible, mode]);

  if (hidden) {
    return <div className="w-full h-full opacity-0 pointer-events-none" />;
  }

  const style: React.CSSProperties = {
    animationDuration: anim?.durationMs ? `${anim.durationMs}ms` : undefined,
    animationDelay: anim?.delayMs ? `${anim.delayMs}ms` : undefined,
    animationFillMode: "both",
  };

  if (el.type === "text") {
    const ts = { ...DEFAULT_TEXT_STYLE, ...el.style };
    return (
      <div
        className={cn("w-full h-full overflow-hidden p-1", animClass)}
        style={{
          ...style,
          fontSize: ts.fontSize,
          fontWeight: ts.fontWeight,
          fontStyle: ts.fontStyle,
          textAlign: ts.textAlign,
          color: ts.color,
          backgroundColor: ts.backgroundColor,
          fontFamily: ts.fontFamily,
        }}
      >
        <div className="whitespace-pre-wrap break-words">{el.content}</div>
      </div>
    );
  }

  if (el.type === "image" && el.src) {
    return (
      <img
        src={el.src}
        alt=""
        className={cn("w-full h-full object-contain", animClass)}
        style={style}
        draggable={false}
      />
    );
  }

  if (el.type === "video" && el.src) {
    return (
      <video
        ref={videoRef}
        src={el.src}
        className={cn("w-full h-full object-contain bg-black", animClass)}
        style={style}
        playsInline
        muted={el.video?.muted ?? true}
        loop={el.video?.loop ?? false}
        controls={el.video?.controls ?? true}
      />
    );
  }

  if (el.type === "shape") {
    const isEllipse = el.shape === "ellipse";
    return (
      <div
        className={cn("w-full h-full", animClass, isEllipse ? "rounded-full" : "rounded")}
        style={{
          ...style,
          backgroundColor: el.fill ?? "#179ca322",
          border: `2px solid ${el.stroke ?? "#179ca3"}`,
        }}
      />
    );
  }

  return null;
}

export function TeachSlideRenderer({
  slide,
  visibleElementIds,
  animatingElementId,
  mode = "present",
  selectedElementId,
  onSelectElement,
  onElementPointerDown,
  className,
}: TeachSlideRendererProps) {
  const bg = slide.backgroundColor ?? "#ffffff";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg shadow-inner",
        mode === "present" ? "aspect-video" : "aspect-video",
        className,
      )}
      style={{
        backgroundColor: bg,
        backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onClick={(e) => {
        if (mode === "editor" && e.target === e.currentTarget) onSelectElement?.(null);
      }}
    >
      {[...slide.elements]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((el) => {
          const visible = mode === "editor" || visibleElementIds.has(el.id);
          const animating = animatingElementId === el.id;
          const selected = selectedElementId === el.id;

          return (
            <div
              key={el.id}
              className={cn(
                "absolute box-border",
                mode === "editor" && "cursor-move",
                selected && mode === "editor" && "ring-2 ring-teal-500 ring-offset-1",
              )}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                zIndex: el.zIndex,
              }}
              onClick={(e) => {
                if (mode === "editor") {
                  e.stopPropagation();
                  onSelectElement?.(el.id);
                }
              }}
              onPointerDown={(e) => {
                if (mode === "editor") {
                  onElementPointerDown?.(e, el.id);
                }
              }}
            >
              <ElementContent el={el} visible={visible} animating={animating} mode={mode} />
            </div>
          );
        })}
    </div>
  );
}
