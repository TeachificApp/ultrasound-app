/**
 * CarouselBlock.tsx
 * Public-facing carousel renderer.
 *
 * Transitions are implemented with inline CSS so they are never purged by Tailwind:
 *  - slide: translates the entire track left/right
 *  - fade:  cross-fades between absolutely-positioned slides
 *  - zoom:  scale + fade cross-fade
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CarouselItem {
  id: string;
  mediaType: "image" | "video";
  url: string;
  altText?: string;
  captionTitle?: string;
  captionBody?: string;
}

export interface CarouselBlockData {
  items?: CarouselItem[];
  transition?: "slide" | "fade" | "zoom";
  autoPlayMs?: number;
  showArrows?: boolean;
  showDots?: boolean;
  showCaptions?: boolean;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  maxHeight?: number;
}

const DURATION = 380; // ms — must match CSS transition durations below

export default function CarouselBlock({ data }: { data: CarouselBlockData }) {
  const items: CarouselItem[] = data.items?.filter(i => i.url) ?? [];
  const transition = data.transition ?? "slide";
  const autoPlayMs = data.autoPlayMs ?? 4000;
  const showArrows = data.showArrows !== false;
  const showDots = data.showDots !== false;
  const showCaptions = data.showCaptions !== false;
  const bgColor = data.bgColor ?? "#0e1e2e";
  const borderColor = data.borderColor ?? "#189aa1";
  const borderWidth = data.borderWidth ?? 2;
  const borderRadius = data.borderRadius ?? 12;
  const maxHeight = data.maxHeight ?? 480;

  const count = items.length;

  // current = the slide index that is VISIBLE (settled)
  // pending = the slide index that is ENTERING (during animation)
  const [current, setCurrent] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const go = useCallback((idx: number, d: "next" | "prev" = "next") => {
    if (busyRef.current || count === 0) return;
    const target = ((idx % count) + count) % count;
    if (target === current) return;
    busyRef.current = true;
    setDir(d);
    setPending(target);
    setTimeout(() => {
      setCurrent(target);
      setPending(null);
      busyRef.current = false;
    }, DURATION);
  }, [count, current]);

  const next = useCallback(() => go(current + 1, "next"), [go, current]);
  const prev = useCallback(() => go(current - 1, "prev"), [go, current]);

  // Auto-play
  useEffect(() => {
    if (autoPlayMs > 0 && count > 1) {
      timerRef.current = setTimeout(next, autoPlayMs);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, autoPlayMs, count, next]);

  if (count === 0) {
    return (
      <div
        style={{
          backgroundColor: bgColor,
          borderRadius,
          border: `${borderWidth}px solid ${borderColor}`,
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: 14,
        }}
      >
        No carousel items added yet.
      </div>
    );
  }

  const item = items[current];
  const isVideo = item.mediaType === "video";

  // ─── Slide transition: horizontal track ───────────────────────────────────
  const renderSlideTrack = () => {
    // We render current + pending side-by-side in a track and translate it.
    // When no animation: track is at 0 (only current visible).
    // When animating next: track slides left (current exits left, pending enters right).
    // When animating prev: track slides right (current exits right, pending enters left).
    const isAnimating = pending !== null;
    const translatePct = isAnimating ? (dir === "next" ? -50 : 50) : 0;
    return (
      <div
        style={{
          display: "flex",
          width: isAnimating ? "200%" : "100%",
          height: "100%",
          transform: `translateX(${translatePct}%)`,
          transition: isAnimating ? `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)` : "none",
        }}
      >
        {/* Current slide (or "exiting" slide) */}
        <div style={{ flex: "0 0 50%", height: "100%", overflow: "hidden" }}>
          {renderMedia(item, maxHeight)}
        </div>
        {/* Pending slide (entering) — only rendered during animation */}
        {isAnimating && (
          <div style={{ flex: "0 0 50%", height: "100%", overflow: "hidden" }}>
            {renderMedia(items[pending!], maxHeight)}
          </div>
        )}
      </div>
    );
  };

  // ─── Fade / Zoom transition: stacked absolute layers ──────────────────────
  const renderFadeZoomStack = () => {
    const isZoom = transition === "zoom";
    const isAnimating = pending !== null;
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {/* Current slide — fades/shrinks out */}
        <div
          style={{
            position: "absolute", inset: 0,
            opacity: isAnimating ? 0 : 1,
            transform: isZoom ? (isAnimating ? "scale(1.05)" : "scale(1)") : undefined,
            transition: `opacity ${DURATION}ms ease, transform ${DURATION}ms ease`,
          }}
        >
          {renderMedia(item, maxHeight)}
        </div>
        {/* Pending slide — fades/grows in */}
        {isAnimating && (
          <div
            style={{
              position: "absolute", inset: 0,
              opacity: 1,
              transform: isZoom ? "scale(1)" : undefined,
              animation: `carousel-fadein ${DURATION}ms ease forwards`,
            }}
          >
            {renderMedia(items[pending!], maxHeight)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius,
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Inject keyframes once */}
      <style>{`
        @keyframes carousel-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes carousel-zoomin {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Slide viewport */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          maxHeight,
          minHeight: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {transition === "slide" ? renderSlideTrack() : renderFadeZoomStack()}

        {/* Arrows */}
        {showArrows && count > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous slide"
              style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: bgColor, border: `1.5px solid ${borderColor}`,
                opacity: 0.8, cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
            >
              <ChevronLeft style={{ width: 20, height: 20, color: borderColor }} />
            </button>
            <button
              onClick={next}
              aria-label="Next slide"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: bgColor, border: `1.5px solid ${borderColor}`,
                opacity: 0.8, cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
            >
              <ChevronRight style={{ width: 20, height: 20, color: borderColor }} />
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      {showCaptions && (item.captionTitle || item.captionBody) && (
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${borderColor}30` }}>
          {item.captionTitle && (
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: borderColor }}>{item.captionTitle}</p>
          )}
          {item.captionBody && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{item.captionBody}</p>
          )}
        </div>
      )}

      {/* Dots */}
      {showDots && count > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0" }}>
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > current ? "next" : "prev")}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === current ? 20 : 8,
                height: 8,
                borderRadius: 99,
                border: "none",
                cursor: "pointer",
                padding: 0,
                backgroundColor: i === current ? borderColor : `${borderColor}55`,
                transition: "width 0.2s ease, background-color 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function renderMedia(item: CarouselItem, maxHeight: number) {
  if (item.mediaType === "video") {
    return (
      <video
        key={item.url}
        src={item.url}
        controls
        style={{ width: "100%", maxHeight, display: "block", objectFit: "contain" }}
        aria-label={item.altText ?? item.captionTitle ?? "Carousel video"}
      />
    );
  }
  return (
    <img
      key={item.url}
      src={item.url}
      alt={item.altText ?? item.captionTitle ?? "Carousel image"}
      style={{ width: "100%", maxHeight, display: "block", objectFit: "contain" }}
    />
  );
}
