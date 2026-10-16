import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, X } from "lucide-react";
import type { Block } from "@/components/BlockPreview";
import { MathContent } from "@/components/MathContent";
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";

export type PopupScheduleMode = "always" | "before" | "after" | "between";

export type PopupModuleData = {
  enabled?: boolean;
  title?: string;
  html?: string;
  videoUrl?: string;
  videoAutoplay?: boolean;
  videoMuted?: boolean;
  videoCaption?: string;
  scheduleMode?: PopupScheduleMode;
  startAt?: string;
  endAt?: string;
  displayDurationSeconds?: number;
  showCountdown?: boolean;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  cardBgColor?: string;
  textColor?: string;
  accentColor?: string;
  maxWidth?: number;
  ctaLabel?: string;
  ctaUrl?: string;
};

function scheduleTimestamp(value: unknown, boundary: "start" | "end"): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  // Date-only values intentionally use the visitor's local calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const stamp = new Date(`${normalized}T${boundary === "end" ? "23:59:59.999" : "00:00:00.000"}`).getTime();
    return Number.isNaN(stamp) ? null : stamp;
  }
  const stamp = new Date(normalized).getTime();
  return Number.isNaN(stamp) ? null : stamp;
}

/** Whether the configured date rule allows a popup to be shown at a given time. */
export function isPopupScheduleActive(data: PopupModuleData | null | undefined, now = Date.now()): boolean {
  if (!data || data.enabled === false) return false;
  const mode: PopupScheduleMode = data.scheduleMode ?? "always";
  const start = scheduleTimestamp(data.startAt, "start");
  const end = scheduleTimestamp(data.endAt, "end");

  if (mode === "before") return end === null || now <= end;
  if (mode === "after") return start === null || now >= start;
  if (mode === "between") return (start === null || now >= start) && (end === null || now <= end);
  return true;
}

/** Clamps author input to a sensible client-only visibility duration. Zero keeps the popup open until dismissed. */
export function popupDurationMs(data: PopupModuleData | null | undefined): number {
  const seconds = Number(data?.displayDurationSeconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(Math.round(seconds), 86_400) * 1000;
}

function popupAssetUrl(url?: string): string {
  return resolveAssetUrl(url) ?? url ?? "";
}

function PopupModulePreview({ data }: { data: PopupModuleData }) {
  const schedule = data.scheduleMode ?? "always";
  const timingLabel = schedule === "always"
    ? "Always available"
    : schedule === "before"
      ? "Shown until the selected date"
      : schedule === "after"
        ? "Shown from the selected date"
        : "Shown inside the selected date range";
  return (
    <div className="m-4 rounded-xl border border-dashed border-teal-300 bg-teal-50 p-4 text-left shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-teal-600 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">Popup</div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{data.title || "Scheduled popup"}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{timingLabel}{data.displayDurationSeconds ? ` · closes after ${data.displayDurationSeconds} seconds` : " · visitor dismisses it"}</p>
        </div>
      </div>
    </div>
  );
}

function PopupModal({ block, onClose }: { block: Block; onClose: () => void }) {
  const data = block.data as PopupModuleData;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(Date.now());
  const durationMs = popupDurationMs(data);
  const [remainingMs, setRemainingMs] = useState(durationMs);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (!durationMs) return;
    const tick = () => {
      const next = Math.max(0, durationMs - (Date.now() - openedAt.current));
      setRemainingMs(next);
      if (next === 0) onClose();
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [durationMs, onClose]);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mediaUrl = popupAssetUrl(data.videoUrl);
  const directVideo = /\.(mp4|webm|ogg|mov)([?#]|$)/i.test(mediaUrl);
  const cardStyle = {
    backgroundColor: data.cardBgColor ?? "#ffffff",
    color: data.textColor ?? "#1e293b",
    maxWidth: `${Math.min(Math.max(Number(data.maxWidth) || 640, 320), 1080)}px`,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && data.closeOnBackdrop !== false) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`popup-title-${block.id}`}
        className="relative my-auto w-full overflow-hidden rounded-2xl shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
        style={cardStyle}
      >
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: data.accentColor ?? "#179ca3" }} />
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-6 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            {data.title && <h2 id={`popup-title-${block.id}`} className="text-xl font-bold leading-tight sm:text-2xl">{data.title}</h2>}
            {durationMs > 0 && data.showCountdown && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: data.accentColor ?? "#179ca3" }}>
                <Clock3 className="h-3.5 w-3.5" /> This message closes in {remainingSeconds}s
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={data.closeLabel || "Close popup"}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 pb-6 sm:max-h-[72vh] sm:px-7 sm:pb-7">
          {mediaUrl && (
            <div className="mb-5 overflow-hidden rounded-xl bg-slate-950">
              {directVideo ? (
                <video className="max-h-[48vh] w-full bg-black" controls autoPlay={data.videoAutoplay ?? false} muted={data.videoMuted ?? true} playsInline>
                  <source src={mediaUrl} />
                </video>
              ) : (
                <div className="relative w-full pb-[56.25%]">
                  <iframe className="absolute inset-0 h-full w-full" src={mediaUrl} title={data.videoCaption || data.title || "Popup video"} allow="autoplay; fullscreen" allowFullScreen />
                </div>
              )}
              {data.videoCaption && <p className="px-3 py-2 text-xs text-slate-200">{data.videoCaption}</p>}
            </div>
          )}
          {data.html && <MathContent html={data.html} className="rich-text-display prose prose-slate max-w-none" />}
          {!data.html && !mediaUrl && <p className="text-sm text-slate-600">Add rich text, media, or both in the popup settings.</p>}
          {data.ctaLabel && data.ctaUrl && (
            <div className="mt-6">
              <a href={data.ctaUrl} className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: data.accentColor ?? "#179ca3" }}>
                {data.ctaLabel}
              </a>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

/**
 * Renders the first eligible popup for a block collection. Popup blocks are kept
 * out of the document flow, and date rules are rechecked while a visitor remains
 * on the page. Additional eligible popups appear after the active one is closed.
 */
export function PopupModules({ blocks, editorPreview = false }: { blocks: Block[]; editorPreview?: boolean }) {
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const active = useMemo(() => blocks.find((block) =>
    block.type === "popup" && !closedIds.includes(block.id) && isPopupScheduleActive(block.data as PopupModuleData, now),
  ), [blocks, closedIds, now]);

  if (!active) return null;
  if (editorPreview) return <PopupModulePreview data={active.data as PopupModuleData} />;
  return <PopupModal key={active.id} block={active} onClose={() => setClosedIds((current) => [...current, active.id])} />;
}

/** Compact, non-blocking editor preview for a popup module. */
export function PopupModuleEditorPreview({ data }: { data: PopupModuleData }) {
  return <PopupModulePreview data={data} />;
}
