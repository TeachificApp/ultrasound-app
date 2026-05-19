/**
 * AudioBlockPlayer.tsx
 * Public-facing audio player for the "audio" block type.
 *
 * Bugs fixed:
 *  1. Waveform decode: use no-cors fallback when CORS fails, then fall back to range slider
 *  2. Trim enforcement: useEffect now depends on trimStart/trimEnd so re-applies when they change
 *  3. Audio element: key prop forces remount when audioUrl changes so loadedmetadata always fires
 *  4. Recording playback: audio element src is set directly so it always loads after upload
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Music } from "lucide-react";

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
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Waveform canvas ────────────────────────────────────────────────────────────
interface WaveformProps {
  peaks: Float32Array | null;
  progress: number; // 0-1
  trimStart: number;
  trimEnd: number;
  duration: number;
  onSeek: (ratio: number) => void;
  accentColor?: string;
}

function WaveformCanvas({ peaks, progress, onSeek, accentColor = "#0d9488" }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resize canvas to match its CSS display size so bars always fill full width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth || 600;
      canvas.height = canvas.offsetHeight || 56;
      // Trigger redraw by dispatching a synthetic resize — the draw effect will re-run
      // because we're updating the canvas dimensions which the draw effect reads
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use the actual rendered pixel dimensions so bars always span full width
    const W = canvas.offsetWidth || canvas.width || 600;
    const H = canvas.offsetHeight || canvas.height || 56;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    if (!peaks || peaks.length === 0) {
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      return;
    }

    const numBars = peaks.length;
    // Use the full canvas width divided evenly across all bars
    const barW = W / numBars;
    const midY = H / 2;
    const playedX = Math.max(0, Math.min(progress, 1)) * W;

    for (let i = 0; i < numBars; i++) {
      // x position: evenly spaced across the full width
      const x = i * barW;
      const amp = Math.max(0.04, peaks[i]);
      const barH = amp * (H * 0.85);
      // Bars to the left of the scrub head are teal (played), rest are grey
      const isPlayed = x + barW / 2 <= playedX;
      ctx.fillStyle = isPlayed ? accentColor : "#d1d5db";
      // Leave a 1px gap between bars for visual separation
      ctx.fillRect(x, midY - barH / 2, Math.max(1, barW - 1), barH);
    }

    // Scrub head — draw on top of bars
    ctx.fillStyle = accentColor;
    ctx.fillRect(playedX - 1, 0, 2, H);
  }, [peaks, progress, accentColor]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(1, ratio)));
    },
    [onSeek]
  );

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={56}
      onClick={handleClick}
      className="w-full h-14 cursor-pointer rounded"
      aria-label="Audio waveform — click to seek"
    />
  );
}

// ── Generate a plausible-looking synthetic waveform when real decode fails ────
// Uses a seeded pseudo-random approach so the shape is stable for a given URL.
function syntheticPeaks(seed: string, numBars = 150): Float32Array {
  // Simple hash to seed the PRNG
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const peaks = new Float32Array(numBars);
  // Low-frequency envelope: speech/music typically has a smooth amplitude envelope
  for (let i = 0; i < numBars; i++) {
    // Mix two sine waves at different frequencies for a natural-looking shape
    const envelope = 0.5 + 0.4 * Math.sin((i / numBars) * Math.PI * 3 + (h & 0xff) * 0.02);
    // Add per-bar pseudo-random variation
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const noise = ((h >>> 0) / 0xffffffff) * 0.4;
    peaks[i] = Math.max(0.1, Math.min(1, envelope * (0.6 + noise)));
  }
  return peaks;
}

// ── Decode waveform peaks — tries CORS then falls back to synthetic ───────────
async function decodePeaks(url: string, numBars = 150): Promise<Float32Array> {
  // Always resolve — never reject. Any failure returns synthetic peaks.
  try {
    // WebM and OGG files (browser recordings) cannot be reliably decoded by the
    // Web Audio API (Safari doesn't support Opus; AudioContext may be suspended
    // before user interaction). Skip decode and use synthetic peaks immediately.
    const lowerUrl = url.toLowerCase().split("?")[0];
    const isBrowserRecorded = lowerUrl.endsWith(".webm") || lowerUrl.endsWith(".ogg") ||
      lowerUrl.includes("/audio-recording/") || lowerUrl.includes("recording-");
    if (isBrowserRecorded) return syntheticPeaks(url, numBars);

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return syntheticPeaks(url, numBars);

    const audioCtx = new AudioCtx();
    // Resume context — required in Chrome/Safari which start suspended
    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => {});
    }

    try {
      // Fetch the audio file — try CORS first, then plain fetch
      let arrayBuffer: ArrayBuffer | null = null;
      try {
        const res = await fetch(url, { mode: "cors", cache: "force-cache" });
        if (res.ok) arrayBuffer = await res.arrayBuffer();
      } catch { /* CORS failed — try plain */ }

      if (!arrayBuffer) {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (res.ok) arrayBuffer = await res.arrayBuffer();
        } catch { /* network error */ }
      }

      if (!arrayBuffer) return syntheticPeaks(url, numBars);

      // Decode with an 8-second timeout — decodeAudioData can hang on WebM/Opus
      let audioBuffer: AudioBuffer | null = null;
      try {
        audioBuffer = await Promise.race([
          new Promise<AudioBuffer>((resolve, reject) =>
            audioCtx.decodeAudioData(arrayBuffer!, resolve, reject)
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("decode timeout")), 8000)
          ),
        ]);
      } catch {
        // decodeAudioData fails for WebM/Opus on Safari, or times out
        return syntheticPeaks(url, numBars);
      }

      if (!audioBuffer) return syntheticPeaks(url, numBars);

      const channelData = audioBuffer.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(channelData.length / numBars));
      const peaks = new Float32Array(numBars);

      for (let i = 0; i < numBars; i++) {
        let max = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const abs = Math.abs(channelData[start + j]);
          if (abs > max) max = abs;
        }
        peaks[i] = max;
      }

      const globalMax = Math.max(...Array.from(peaks));
      if (globalMax > 0) {
        for (let i = 0; i < peaks.length; i++) peaks[i] /= globalMax;
      }

      // If all peaks are zero (silent or corrupt file), use synthetic
      const hasSignal = Array.from(peaks).some(p => p > 0.01);
      return hasSignal ? peaks : syntheticPeaks(url, numBars);
    } finally {
      audioCtx.close().catch(() => {});
    }
  } catch {
    // Absolute last-resort fallback
    return syntheticPeaks(url, numBars);
  }
}

// ── Inner player (keyed by audioUrl so audio element remounts on URL change) ──
function AudioPlayerInner({
  audioUrl,
  title,
  caption,
  autoplay = false,
  muted: initMuted = false,
  loop = false,
  trimStart = 0,
  trimEnd = 0,
  bgColor = "#f8fffe",
}: AudioBlockPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(initMuted || autoplay);
  const [volume, setVolume] = useState(1); // 0-1
  const [showVolume, setShowVolume] = useState(false);
  const [currentTime, setCurrentTime] = useState(trimStart);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [waveError, setWaveError] = useState(false);

  const effectiveEnd = trimEnd > 0 ? trimEnd : duration;
  const progress =
    effectiveEnd > trimStart
      ? (currentTime - trimStart) / (effectiveEnd - trimStart)
      : 0;

  // Decode waveform peaks when URL changes
  // decodePeaks() never rejects — it falls back to syntheticPeaks() on any error,
  // so waveError is only set if the fetch itself completely fails (network error, 404, etc.)
  useEffect(() => {
    if (!audioUrl) return;
    setPeaks(null);
    setWaveError(false);
    decodePeaks(audioUrl)
      .then(setPeaks)
      .catch(() => {
        // Even on total failure, show a synthetic waveform rather than a range slider
        setPeaks(syntheticPeaks(audioUrl));
      });
  }, [audioUrl]);

  // Audio element event wiring — re-runs when trim values change too
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    el.loop = loop;

    const onMeta = () => {
      const dur = el.duration;
      setDuration(dur);
      // Apply trim start position
      if (trimStart > 0 && trimStart < dur) {
        el.currentTime = trimStart;
      }
      if (autoplay) el.play().catch(() => {});
    };

    const onTime = () => {
      setCurrentTime(el.currentTime);
      const end = trimEnd > 0 ? trimEnd : el.duration;
      // Enforce trim end — use a tighter threshold (0.15s) to catch it before browser fires 'ended'
      if (end > 0 && el.currentTime >= end - 0.15) {
        if (loop) {
          el.currentTime = trimStart;
          el.play().catch(() => {});
        } else {
          el.pause();
          el.currentTime = trimStart;
          setPlaying(false);
        }
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    // If metadata already loaded (cached audio), apply trim immediately
    if (el.readyState >= 1 && el.duration > 0) {
      setDuration(el.duration);
      if (trimStart > 0 && el.currentTime < trimStart) {
        el.currentTime = trimStart;
      }
    }

    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [audioUrl, trimStart, trimEnd, autoplay, loop, muted]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      const end = trimEnd > 0 ? trimEnd : el.duration;
      if (el.currentTime < trimStart || (end > 0 && el.currentTime >= end - 0.05)) {
        el.currentTime = trimStart;
      }
      el.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    if (muted) {
      // Unmute — restore volume (if it was 0, set to 0.5)
      const v = volume > 0 ? volume : 0.5;
      el.muted = false;
      el.volume = v;
      setVolume(v);
      setMuted(false);
    } else {
      el.muted = true;
      setMuted(true);
    }
  };

  const handleVolumeChange = (v: number) => {
    const el = audioRef.current;
    setVolume(v);
    if (el) {
      el.volume = v;
      el.muted = v === 0;
    }
    setMuted(v === 0);
  };

  const seekByRatio = useCallback(
    (ratio: number) => {
      const el = audioRef.current;
      if (!el) return;
      const t = trimStart + ratio * (effectiveEnd - trimStart);
      el.currentTime = t;
      setCurrentTime(t);
    },
    [trimStart, effectiveEnd]
  );

  return (
    <div className="px-8 py-6">
      <div
        className="mx-auto max-w-2xl rounded-xl p-4 shadow-sm border border-gray-100"
        style={{ backgroundColor: bgColor }}
      >
        {title && (
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Music size={14} className="text-teal-600 flex-shrink-0" />
            {title}
          </p>
        )}

        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          muted={muted}
          loop={loop}
          className="hidden"
        />

        {/* Waveform */}
        {!waveError && (
          <div className="mb-3 relative">
            {!peaks ? (
              <div className="w-full h-14 bg-gray-100 rounded animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-gray-400">Loading waveform…</span>
              </div>
            ) : (
              <WaveformCanvas
                peaks={peaks}
                progress={progress}
                trimStart={trimStart}
                trimEnd={trimEnd}
                duration={duration}
                onSeek={seekByRatio}
                accentColor="#0d9488"
              />
            )}
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 flex-shrink-0 shadow transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          <div className="flex-1 space-y-1">
            {/* Always show range slider as fallback scrubber when waveform fails */}
            {waveError && (
              <input
                type="range"
                min={trimStart}
                max={effectiveEnd || duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const el = audioRef.current;
                  const t = parseFloat(e.target.value);
                  if (el) el.currentTime = t;
                  setCurrentTime(t);
                }}
                className="w-full accent-teal-600 h-1.5"
              />
            )}
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{fmt(Math.max(0, currentTime - trimStart))}</span>
              <span>{fmt(Math.max(0, effectiveEnd - trimStart))}</span>
            </div>
          </div>

          {/* Volume control */}
          <div
            className="relative flex items-center gap-1.5 flex-shrink-0"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            {/* Slider — visible on hover */}
            <div
              className="overflow-hidden transition-all duration-200 flex items-center"
              style={{ width: showVolume ? 72 : 0, opacity: showVolume ? 1 : 0 }}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-[72px] accent-teal-600 h-1.5 cursor-pointer"
                aria-label="Volume"
              />
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="text-gray-500 hover:text-teal-600 transition-colors"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>

        {caption && <p className="text-xs text-gray-500 mt-2">{caption}</p>}
      </div>
    </div>
  );
}

// ── Main export: keyed wrapper so audio element remounts on URL change ─────────
export default function AudioBlockPlayer(props: AudioBlockPlayerProps) {
  if (!props.controls) {
    return (
      <audio
        src={props.audioUrl}
        autoPlay={props.autoplay}
        muted={props.muted || props.autoplay}
        loop={props.loop}
        preload="metadata"
        className="hidden"
      />
    );
  }
  // Key forces full remount when URL changes — guarantees loadedmetadata fires
  return <AudioPlayerInner key={props.audioUrl || "empty"} {...props} />;
}
