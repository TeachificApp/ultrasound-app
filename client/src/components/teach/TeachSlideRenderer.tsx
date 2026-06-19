/**
 * TeachSlideRenderer — renders a slide canvas with optional animation state.
 */

import { useEffect, useRef } from "react";
import {
  type TeachSlide,
  type TeachSlideElement,
  animationCssClass,
  DEFAULT_TEXT_STYLE,
  normalizeMediaFormat,
  buildMediaWrapperStyles,
  buildSlideBackground,
} from "@shared/teachPresentation";
import { cn } from "@/lib/utils";

export type TeachRenderMode = "present" | "editor" | "thumbnail" | "preview";

export interface TeachSlideRendererProps {
  slide: TeachSlide;
  /** Elements whose entrance animation has completed (by id). If omitted, all elements are visible. */
  visibleElementIds?: Set<string>;
  /** Currently animating element id */
  animatingElementId?: string | null;
  /** Editor vs presenter scale */
  mode?: TeachRenderMode;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onElementPointerDown?: (e: React.PointerEvent, elId: string) => void;
  /** Called when user starts dragging a resize handle */
  onResizePointerDown?: (e: React.PointerEvent, elId: string, handle: string) => void;
  className?: string;
}

const RESIZE_HANDLES = [
  { id: "nw", cursor: "nw-resize", style: { top: -4, left: -4 } },
  { id: "n",  cursor: "n-resize",  style: { top: -4, left: "calc(50% - 4px)" } },
  { id: "ne", cursor: "ne-resize", style: { top: -4, right: -4 } },
  { id: "e",  cursor: "e-resize",  style: { top: "calc(50% - 4px)", right: -4 } },
  { id: "se", cursor: "se-resize", style: { bottom: -4, right: -4 } },
  { id: "s",  cursor: "s-resize",  style: { bottom: -4, left: "calc(50% - 4px)" } },
  { id: "sw", cursor: "sw-resize", style: { bottom: -4, left: -4 } },
  { id: "w",  cursor: "w-resize",  style: { top: "calc(50% - 4px)", left: -4 } },
] as const;

function ElementContent({
  el,
  visible,
  animating,
  mode,
}: {
  el: TeachSlideElement;
  visible: boolean;
  animating: boolean;
  mode: TeachRenderMode;
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
    const listType = ts.listType ?? "none";
    const containerStyle: React.CSSProperties = {
      ...style,
      fontSize: ts.fontSize,
      fontWeight: ts.fontWeight,
      fontStyle: ts.fontStyle,
      textAlign: ts.textAlign,
      color: ts.color,
      backgroundColor: ts.backgroundColor,
      fontFamily: ts.fontFamily || undefined,
      lineHeight: ts.lineHeight ? `${ts.lineHeight}` : undefined,
      letterSpacing: ts.letterSpacing ? `${ts.letterSpacing}px` : undefined,
      textDecoration: ts.textDecoration && ts.textDecoration !== "none" ? ts.textDecoration : undefined,
    };
    const lines = (el.content ?? "").split("\n");
    if (listType === "bullet") {
      return (
        <div className={cn("w-full h-full overflow-hidden p-1", animClass)} style={containerStyle}>
          <ul className="list-disc list-inside space-y-0.5">
            {lines.map((line, i) => <li key={i} className="whitespace-pre-wrap break-words">{line || "\u00A0"}</li>)}
          </ul>
        </div>
      );
    }
    if (listType === "numbered") {
      return (
        <div className={cn("w-full h-full overflow-hidden p-1", animClass)} style={containerStyle}>
          <ol className="list-decimal list-inside space-y-0.5">
            {lines.map((line, i) => <li key={i} className="whitespace-pre-wrap break-words">{line || "\u00A0"}</li>)}
          </ol>
        </div>
      );
    }
    return (
      <div className={cn("w-full h-full overflow-hidden p-1", animClass)} style={containerStyle}>
        <div className="whitespace-pre-wrap break-words">{el.content}</div>
      </div>
    );
  }

  if (el.type === "image" && el.src) {
    const mf = normalizeMediaFormat(el.mediaFormat);
    const { wrapper, media } = buildMediaWrapperStyles(mf);
    return (
      <div className={cn("w-full h-full", animClass)} style={style}>
        <div style={wrapper as React.CSSProperties}>
          <img
            src={el.src}
            alt=""
            style={media as React.CSSProperties}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  if (el.type === "video" && el.src) {
    const mf = normalizeMediaFormat(el.mediaFormat);
    const { wrapper, media } = buildMediaWrapperStyles(mf);
    return (
      <div className={cn("w-full h-full", animClass)} style={style}>
        <div style={wrapper as React.CSSProperties}>
          <video
            ref={videoRef}
            src={el.src}
            className="bg-black"
            style={media as React.CSSProperties}
            playsInline
            muted={el.video?.muted ?? true}
            loop={el.video?.loop ?? false}
            controls={el.video?.controls ?? true}
          onClick={(e) => e.stopPropagation()}
        />
        </div>
      </div>
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
  onResizePointerDown,
  className,
}: TeachSlideRendererProps) {
  // Compute slide background style from slide data
  const bgStyle = buildSlideBackground(slide);
  // In preview/editor/thumbnail mode all elements are visible regardless of animation state
  const allVisible = mode === "editor" || mode === "thumbnail" || mode === "preview";
  const effectiveVisible = allVisible
    ? new Set(slide.elements.map((e) => e.id))
    : (visibleElementIds ?? new Set<string>());

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg shadow-inner aspect-video",
        className,
      )}
      style={bgStyle}
      onClick={(e) => {
        if (mode === "editor" && e.target === e.currentTarget) onSelectElement?.(null);
      }}
    >
      {[...slide.elements]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((el) => {
          const visible = allVisible || effectiveVisible.has(el.id);
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
              {/* Resize handles */}
              {selected && mode === "editor" && onResizePointerDown && RESIZE_HANDLES.map((h) => (
                <div
                  key={h.id}
                  className="absolute w-2 h-2 bg-white border-2 border-teal-500 rounded-sm"
                  style={{ ...h.style, cursor: h.cursor, position: "absolute", zIndex: 9999 }}
                  onPointerDown={(e) => { e.stopPropagation(); onResizePointerDown(e, el.id, h.id); }}
                />
              ))}
            </div>
          );
        })}
    </div>
  );
}
