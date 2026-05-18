/**
 * AudioBlockPlayer.tsx
 * Public-facing audio player for the "audio" block type.
 * Respects trimStart/trimEnd, autoplay, muted, loop, controls settings.
 */
import { useRef, useEffect, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioBlockPlayerProps {
  audioUrl: string;
  title?: string;
  caption?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  trimStart?: number;
  trimEnd?: number;
  bgColor?: string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioBlockPlayer({
  audioUrl,
  title,
  caption,
  autoplay = false,
  muted: initMuted = false,
  loop = false,
  controls = true,
  trimStart = 0,
  trimEnd = 0,
  bgColor = "#f8fffe",
}: AudioBlockPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(initMuted || autoplay); // autoplay requires muted in most browsers
  const [currentTime, setCurrentTime] = useState(trimStart);
  const [duration, setDuration] = useState(0);

  const effectiveEnd = trimEnd > 0 ? trimEnd : duration;

  // ── Initialise ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    el.loop = loop;

    const onMeta = () => {
      setDuration(el.duration);
      el.currentTime = trimStart;
      if (autoplay) el.play().catch(() => {});
    };
    const onTime = () => {
      setCurrentTime(el.currentTime);
      const end = trimEnd > 0 ? trimEnd : el.duration;
      if (end > 0 && el.currentTime >= end) {
        if (loop) { el.currentTime = trimStart; el.play().catch(() => {}); }
        else { el.pause(); el.currentTime = trimStart; setPlaying(false); }
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [audioUrl, trimStart, trimEnd, autoplay, loop]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); }
    else {
      if (el.currentTime < trimStart || (effectiveEnd > 0 && el.currentTime >= effectiveEnd)) {
        el.currentTime = trimStart;
      }
      el.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = parseFloat(e.target.value);
    el.currentTime = t;
    setCurrentTime(t);
  };

  const progress = effectiveEnd > trimStart ? ((currentTime - trimStart) / (effectiveEnd - trimStart)) * 100 : 0;

  if (!controls) {
    // Invisible autoplay-only player
    return (
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay={autoplay}
        muted={muted}
        loop={loop}
        preload="metadata"
        className="hidden"
      />
    );
  }

  return (
    <div className="px-8 py-6">
      <div
        className="mx-auto max-w-2xl rounded-xl p-4 shadow-sm border border-gray-100"
        style={{ backgroundColor: bgColor }}
      >
        {title && <p className="text-sm font-semibold text-gray-800 mb-3">{title}</p>}

        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          muted={muted}
          loop={loop}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 flex-shrink-0 shadow"
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          {/* Progress bar */}
          <div className="flex-1 space-y-1">
            <input
              type="range"
              min={trimStart}
              max={effectiveEnd || duration || 100}
              step={0.1}
              value={currentTime}
              onChange={seek}
              className="w-full accent-teal-600 h-1.5"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{fmt(Math.max(0, currentTime - trimStart))}</span>
              <span>{fmt(Math.max(0, effectiveEnd - trimStart))}</span>
            </div>
          </div>

          {/* Mute */}
          <button
            type="button"
            onClick={toggleMute}
            className="text-gray-500 hover:text-teal-600 flex-shrink-0"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {caption && <p className="text-xs text-gray-500 mt-2">{caption}</p>}
      </div>
    </div>
  );
}
